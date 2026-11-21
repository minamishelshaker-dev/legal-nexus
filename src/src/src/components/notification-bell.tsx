"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Notice = {
  id: string;
  kind: string;
  subject: string | null;
  meta: Record<string, unknown> | null;
  href: string | null;
  created_at: string;
  read_at: string | null;
};

const REQUEST_STATUS: Record<string, { ar: string; en: string }> = {
  submitted: { ar: "مقدّم", en: "Submitted" },
  under_review: { ar: "قيد المراجعة", en: "Under review" },
  awaiting_information: { ar: "بانتظار معلومات", en: "Awaiting information" },
  pending_approval: { ar: "بانتظار الاعتماد", en: "Pending approval" },
  approved: { ar: "معتمد", en: "Approved" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  completed: { ar: "مكتمل", en: "Completed" },
  cancelled: { ar: "ملغى", en: "Cancelled" },
};

function describe(n: Notice, lang: "ar" | "en"): { title: string; text: string } {
  const ar = lang === "ar";
  const subject = n.subject ?? "";
  const meta = n.meta ?? {};
  const date = (v: unknown) => (typeof v === "string" ? v : "");
  switch (n.kind) {
    case "request_created":
      return { title: ar ? "طلب قانوني جديد" : "New legal request", text: subject };
    case "request_status": {
      const s = REQUEST_STATUS[String(meta.status)];
      return { title: ar ? "تغيّرت حالة طلبك" : "Your request status changed", text: subject + (s ? " · " + s[lang] : "") };
    }
    case "request_assigned":
      return { title: ar ? "أُسند إليك طلب قانوني" : "A legal request was assigned to you", text: subject };
    case "approval_required":
      return { title: ar ? "اعتماد مطلوب منك" : "Your approval is required", text: subject };
    case "approval_decided":
      return {
        title: meta.decision === "approved" ? (ar ? "تم اعتماد خطوة الموافقة" : "An approval step was approved") : ar ? "تم رفض خطوة الموافقة" : "An approval step was rejected",
        text: subject,
      };
    case "request_comment":
      return { title: ar ? "تعليق جديد على طلب" : "New comment on a request", text: subject };
    case "obligation_assigned":
      return { title: ar ? "أُسند إليك التزام" : "An obligation was assigned to you", text: subject + (date(meta.due_date) ? " · " + date(meta.due_date) : "") };
    case "obligation_due":
      return { title: ar ? "التزام يستحق خلال أسبوع" : "Obligation due within a week", text: subject + (date(meta.due_date) ? " · " + date(meta.due_date) : "") };
    case "obligation_overdue":
      return { title: ar ? "التزام متأخر" : "Overdue obligation", text: subject + (date(meta.due_date) ? " · " + date(meta.due_date) : "") };
    case "contract_expiring":
      return { title: ar ? "عقد يقترب من الانتهاء" : "Contract nearing expiry", text: subject + (date(meta.end_date) ? " · " + date(meta.end_date) : "") };
    case "investigation_assigned":
      return { title: ar ? "أُسند إليك ملف تحقيق" : "An investigation file was assigned to you", text: "" };
    case "invitation_accepted":
      return { title: ar ? "تم قبول دعوتك" : "Your invitation was accepted", text: subject };
    case "chat_message": {
      const channel = typeof meta.channel === "string" ? meta.channel : "";
      const preview = typeof meta.preview === "string" ? meta.preview : "";
      const direct = meta.kind === "direct";
      return {
        title: direct ? (ar ? `رسالة من ${subject}` : `Message from ${subject}`) : ar ? `${subject} في #${channel}` : `${subject} in #${channel}`,
        text: preview,
      };
    }
    default:
      return { title: ar ? "إشعار" : "Notification", text: subject };
  }
}

function ago(iso: string, ar: boolean): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return ar ? "الآن" : "just now";
  if (mins < 60) return ar ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return ar ? `منذ ${hours} ساعة` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return ar ? `منذ ${days} يوم` : `${days}d ago`;
}

export default function NotificationBell({ organizationId, userId, lang }: { organizationId: string; userId: string; lang: "ar" | "en" }) {
  const ar = lang === "ar";
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [list, count] = await Promise.all([
      supabase
        .from("notifications")
        .select("id,kind,subject,meta,href,created_at,read_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .is("read_at", null),
    ]);
    if (!list.error) setItems((list.data ?? []) as Notice[]);
    if (!count.error) setUnread(count.count ?? 0);
  }, [organizationId, supabase]);

  useEffect(() => {
    let active = true;
    (async () => {
      await supabase.rpc("refresh_due_notifications", { p_org: organizationId });
      if (active) await load();
    })();
    const channel = supabase
      .channel("notifications-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        void load();
      })
      .subscribe();
    const timer = setInterval(() => void load(), 60000);
    return () => {
      active = false;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [organizationId, userId, supabase, load]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await supabase.rpc("mark_notifications_read", { p_ids: [id] });
  }

  async function markAll() {
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    setUnread(0);
    await supabase.rpc("mark_all_notifications_read", { p_org: organizationId });
  }

  return (
    <div className="bell" ref={box}>
      <button type="button" className="bell-btn" aria-label={ar ? "الإشعارات" : "Notifications"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && <span className="bell-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label={ar ? "الإشعارات" : "Notifications"}>
          <div className="bell-head">
            <b>{ar ? "الإشعارات" : "Notifications"}</b>
            {unread > 0 && (
              <button type="button" onClick={() => void markAll()}>
                {ar ? "تعليم الكل كمقروء" : "Mark all as read"}
              </button>
            )}
          </div>
          <div className="bell-list">
            {items.length === 0 && <div className="bell-empty">{ar ? "لا توجد إشعارات حتى الآن. ستظهر هنا الطلبات والموافقات والمواعيد المهمة والرسائل." : "Nothing yet. Requests, approvals, important deadlines and messages will appear here."}</div>}
            {items.map((n) => {
              const d = describe(n, lang);
              const body = (
                <>
                  <b>{d.title}</b>
                  {d.text && <span>{d.text}</span>}
                  <small>{ago(n.created_at, ar)}</small>
                </>
              );
              const cls = "bell-item" + (n.read_at ? "" : " unread");
              return n.href ? (
                <Link key={n.id} href={n.href} className={cls} onClick={() => { setOpen(false); if (!n.read_at) void markRead(n.id); }}>
                  {body}
                </Link>
              ) : (
                <div key={n.id} className={cls} onClick={() => { if (!n.read_at) void markRead(n.id); }}>
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
