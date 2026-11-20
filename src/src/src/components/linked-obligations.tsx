"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id: string;
  title: string;
  obligation_type: string;
  status: string;
  priority: string;
  due_date: string;
  description: string | null;
};

const TYPES: Record<string, { ar: string; en: string }> = {
  contractual: { ar: "تعاقدي", en: "Contractual" },
  regulatory: { ar: "تنظيمي", en: "Regulatory" },
  filing: { ar: "تقديم / إيداع", en: "Filing" },
  policy: { ar: "سياسة", en: "Policy" },
  renewal: { ar: "تجديد", en: "Renewal" },
  other: { ar: "أخرى", en: "Other" },
};
const PRIORITIES: Record<string, { ar: string; en: string }> = {
  low: { ar: "منخفضة", en: "Low" },
  normal: { ar: "عادية", en: "Normal" },
  high: { ar: "مرتفعة", en: "High" },
  critical: { ar: "حرجة", en: "Critical" },
};
const STATUS: Record<string, { ar: string; en: string; tone: string }> = {
  open: { ar: "مفتوح", en: "Open", tone: "gold" },
  in_progress: { ar: "قيد التنفيذ", en: "In progress", tone: "gold" },
  completed: { ar: "مكتمل", en: "Completed", tone: "ok" },
  cancelled: { ar: "ملغى", en: "Cancelled", tone: "" },
};

function daysUntil(date: string): number {
  const target = new Date(date + "T00:00:00Z").getTime();
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86400000);
}

export default function LinkedObligations({
  organizationId,
  recordType,
  recordId,
  canManage,
  lang,
}: {
  organizationId: string;
  recordType: "contract" | "legal_matter";
  recordId: string;
  canManage: boolean;
  lang: "ar" | "en";
}) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: recordType === "contract" ? "contractual" : "filing",
    due: "",
    priority: "normal",
    description: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("obligations")
      .select("id,title,obligation_type,status,priority,due_date,description")
      .eq("organization_id", organizationId)
      .eq("related_record_type", recordType)
      .eq("related_record_id", recordId)
      .order("due_date", { ascending: true });
    if (err) setError(err.message);
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [organizationId, recordType, recordId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(t("انتهت الجلسة. سجّل الدخول من جديد.", "Session expired. Please sign in again."));
      setSaving(false);
      return;
    }
    const { error: err } = await supabase.from("obligations").insert({
      organization_id: organizationId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      obligation_type: form.type,
      priority: form.priority,
      due_date: form.due,
      related_record_type: recordType,
      related_record_id: recordId,
      created_by: user.id,
    });
    if (err) setError(err.message);
    else {
      setNotice(t("تمت إضافة الالتزام وربطه بهذا السجل.", "Obligation added and linked to this record."));
      setForm({ ...form, title: "", due: "", description: "" });
      setOpen(false);
      await load();
    }
    setSaving(false);
  }

  async function setStatus(id: string, status: string) {
    setError("");
    setNotice("");
    const { error: err } = await supabase.from("obligations").update({ status }).eq("id", id).eq("organization_id", organizationId);
    if (err) setError(err.message);
    else await load();
  }

  const openCount = rows.filter((r) => r.status === "open" || r.status === "in_progress").length;

  return (
    <section className="module-panel" style={{ marginTop: 16 }}>
      <div className="dash-card-head">
        <div>
          <span className="auth-kicker">{t("الالتزامات والمواعيد المرتبطة", "LINKED OBLIGATIONS & DEADLINES")}</span>
          <h2 style={{ margin: "6px 0 0" }}>
            {t("التزامات هذا السجل", "Obligations on this record")} <span className="chip gold">{openCount} {t("مفتوح", "open")}</span>
          </h2>
        </div>
        {canManage && (
          <button type="button" className="btn" onClick={() => setOpen((v) => !v)}>
            {open ? t("إغلاق", "Close") : t("+ إضافة التزام", "+ Add obligation")}
          </button>
        )}
      </div>

      {open && canManage && (
        <form className="module-form" onSubmit={add}>
          <label>
            {t("عنوان الالتزام *", "Obligation title *")}
            <input required minLength={3} maxLength={240} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            {t("النوع", "Type")}
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.keys(TYPES).map((k) => (
                <option key={k} value={k}>
                  {TYPES[k][lang]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("تاريخ الاستحقاق *", "Due date *")}
            <input required type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
          </label>
          <label>
            {t("الأولوية", "Priority")}
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {Object.keys(PRIORITIES).map((k) => (
                <option key={k} value={k}>
                  {PRIORITIES[k][lang]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("التفاصيل", "Details")}
            <textarea rows={3} maxLength={4000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="form-actions">
            <button className="primary" disabled={saving}>
              {saving ? t("جارٍ الحفظ…", "Saving…") : t("حفظ الالتزام", "Save obligation")}
            </button>
          </div>
        </form>
      )}

      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      {loading ? (
        <div className="dash-empty">{t("جارٍ التحميل…", "Loading…")}</div>
      ) : rows.length === 0 ? (
        <div className="dash-empty">{t("لا توجد التزامات مرتبطة بهذا السجل بعد.", "No obligations are linked to this record yet.")}</div>
      ) : (
        <div>
          {rows.map((r) => {
            const days = daysUntil(r.due_date);
            const active = r.status === "open" || r.status === "in_progress";
            const tone = !active ? "" : days < 0 ? "danger" : days <= 14 ? "warn" : "";
            const when = !active
              ? (STATUS[r.status]?.[lang] ?? r.status)
              : days < 0
                ? t(`متأخر ${Math.abs(days)} يوماً`, `${Math.abs(days)}d overdue`)
                : days === 0
                  ? t("اليوم", "Today")
                  : t(`بعد ${days} يوماً`, `In ${days}d`);
            return (
              <div className="dash-row" key={r.id}>
                <div className="dash-row-main">
                  <b>{r.title}</b>
                  <small>
                    {(TYPES[r.obligation_type]?.[lang] ?? r.obligation_type) + " · " + r.due_date + " · " + (PRIORITIES[r.priority]?.[lang] ?? r.priority)}
                  </small>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className={"chip " + tone}>{when}</span>
                  {canManage && active && (
                    <>
                      <button type="button" className="btn" onClick={() => void setStatus(r.id, "completed")}>
                        {t("إكمال", "Complete")}
                      </button>
                      <button type="button" className="btn" onClick={() => void setStatus(r.id, "cancelled")}>
                        {t("إلغاء", "Cancel")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p style={{ marginTop: 12 }}>
        <Link href="/workspace/obligations" className="dash-link">
          {t("عرض كل الالتزامات", "View all obligations")}
        </Link>
      </p>
    </section>
  );
}
