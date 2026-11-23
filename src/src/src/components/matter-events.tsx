"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Ev = {
  id: string;
  event_type: string;
  title: string;
  starts_at: string;
  court_name: string | null;
  location: string | null;
  notes: string | null;
  status: string;
};

const TYPES: Record<string, { ar: string; en: string }> = {
  hearing: { ar: "جلسة", en: "Hearing" },
  deadline: { ar: "موعد نهائي", en: "Deadline" },
  filing: { ar: "تقديم / إيداع", en: "Filing" },
  meeting: { ar: "اجتماع", en: "Meeting" },
  other: { ar: "أخرى", en: "Other" },
};
const STATUS: Record<string, { ar: string; en: string; tone: string }> = {
  scheduled: { ar: "مجدول", en: "Scheduled", tone: "gold" },
  completed: { ar: "تم", en: "Completed", tone: "ok" },
  postponed: { ar: "مؤجّل", en: "Postponed", tone: "warn" },
  cancelled: { ar: "ملغى", en: "Cancelled", tone: "" },
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function MatterEvents({
  organizationId,
  matterId,
  canManage,
  lang,
}: {
  organizationId: string;
  matterId: string;
  canManage: boolean;
  lang: "ar" | "en";
}) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resched, setResched] = useState<{ id: string; value: string } | null>(null);
  const [form, setForm] = useState({ type: "hearing", title: "", at: "", court: "", location: "", notes: "" });

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("matter_events")
      .select("id,event_type,title,starts_at,court_name,location,notes,status")
      .eq("organization_id", organizationId)
      .eq("matter_id", matterId)
      .order("starts_at", { ascending: true });
    if (err) setError(err.message);
    else setRows((data ?? []) as Ev[]);
    setLoading(false);
  }, [organizationId, matterId, supabase]);

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
    const { error: err } = await supabase.from("matter_events").insert({
      organization_id: organizationId,
      matter_id: matterId,
      event_type: form.type,
      title: form.title.trim(),
      starts_at: new Date(form.at).toISOString(),
      court_name: form.court.trim() || null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      responsible_user_id: user.id,
      created_by: user.id,
    });
    if (err) setError(err.message);
    else {
      setNotice(t("تمت إضافة الموعد إلى التقويم.", "Added to the calendar."));
      setForm({ type: "hearing", title: "", at: "", court: "", location: "", notes: "" });
      setOpen(false);
      await load();
    }
    setSaving(false);
  }

  async function setStatus(id: string, status: string) {
    setError("");
    const { error: err } = await supabase.from("matter_events").update({ status }).eq("id", id).eq("organization_id", organizationId);
    if (err) setError(err.message);
    else await load();
  }

  async function reschedule() {
    if (!resched || !resched.value) return;
    setError("");
    const { error: err } = await supabase
      .from("matter_events")
      .update({ starts_at: new Date(resched.value).toISOString(), status: "scheduled" })
      .eq("id", resched.id)
      .eq("organization_id", organizationId);
    if (err) setError(err.message);
    else {
      setResched(null);
      await load();
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(ar ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const now = Date.now();
  const upcoming = rows.filter((r) => r.status === "scheduled" && new Date(r.starts_at).getTime() >= now);

  return (
    <section className="module-panel" style={{ marginTop: 16 }}>
      <div className="dash-card-head">
        <div>
          <span className="auth-kicker">{t("الجلسات والمواعيد النهائية", "HEARINGS & DEADLINES")}</span>
          <h2 style={{ margin: "6px 0 0" }}>
            {t("مواعيد هذه القضية", "Matter schedule")} <span className="chip gold">{upcoming.length} {t("قادم", "upcoming")}</span>
          </h2>
        </div>
        {canManage && (
          <button type="button" className="btn" onClick={() => setOpen((v) => !v)}>
            {open ? t("إغلاق", "Close") : t("+ إضافة جلسة أو موعد", "+ Add hearing or deadline")}
          </button>
        )}
      </div>

      {open && canManage && (
        <form className="module-form" onSubmit={add}>
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
            {t("العنوان *", "Title *")}
            <input required minLength={2} maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            {t("التاريخ والوقت *", "Date and time *")}
            <input required type="datetime-local" value={form.at} onChange={(e) => setForm({ ...form, at: e.target.value })} />
          </label>
          <label>
            {t("المحكمة / الجهة", "Court / authority")}
            <input maxLength={200} value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} />
          </label>
          <label>
            {t("المكان / الدائرة / القاعة", "Location / circuit / room")}
            <input maxLength={200} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </label>
          <label>
            {t("ملاحظات", "Notes")}
            <textarea rows={3} maxLength={4000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <div className="form-actions">
            <button className="primary" disabled={saving}>
              {saving ? t("جارٍ الحفظ…", "Saving…") : t("حفظ الموعد", "Save")}
            </button>
          </div>
        </form>
      )}

      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      {loading ? (
        <div className="dash-empty">{t("جارٍ التحميل…", "Loading…")}</div>
      ) : rows.length === 0 ? (
        <div className="dash-empty">{t("لا توجد جلسات أو مواعيد مسجّلة لهذه القضية.", "No hearings or deadlines are recorded for this matter.")}</div>
      ) : (
        <div>
          {rows.map((r) => (
            <div className="ev-row" key={r.id}>
              <div className="ev-main">
                <b>{r.title}</b>
                <small>{[TYPES[r.event_type]?.[lang], fmt(r.starts_at), r.court_name, r.location].filter(Boolean).join(" · ")}</small>
                {r.notes && <small>{r.notes}</small>}
              </div>
              <div className="ev-actions">
                <span className={"chip " + (STATUS[r.status]?.tone ?? "")}>{STATUS[r.status]?.[lang] ?? r.status}</span>
                {canManage && r.status === "scheduled" && (
                  <>
                    <button type="button" className="btn" onClick={() => void setStatus(r.id, "completed")}>{t("إتمام", "Complete")}</button>
                    <button type="button" className="btn" onClick={() => setResched({ id: r.id, value: toLocalInput(r.starts_at) })}>{t("تأجيل", "Reschedule")}</button>
                    <button type="button" className="btn" onClick={() => void setStatus(r.id, "cancelled")}>{t("إلغاء", "Cancel")}</button>
                  </>
                )}
                {resched?.id === r.id && (
                  <>
                    <input type="datetime-local" value={resched.value} onChange={(e) => setResched({ id: r.id, value: e.target.value })} />
                    <button type="button" className="btn gold" onClick={() => void reschedule()}>{t("حفظ الموعد الجديد", "Save new time")}</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
