"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { EXPENSE_CATEGORIES } from "@/components/matter-costs";

type Lang = "ar" | "en";
type Report = {
  by_currency: { currency: string; total: number; expenses: number; time_cost: number; hours: number }[];
  by_matter: { matter_id: string; title: string; currency: string; total: number; hours: number; budget: number | null; budget_currency: string | null }[];
  by_counsel: { counsel_id: string; name: string; currency: string; total: number; hours: number }[];
  by_category: { category: string; currency: string; total: number }[];
  by_month: { mth: string; currency: string; total: number }[];
};
type CounselRow = { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; specialties: string | null; default_rate: number | null; currency: string; notes: string | null; status: string };

const CURRENCIES = ["EGP", "USD", "EUR", "SAR", "AED", "GBP"];
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const todayIso = () => new Date().toISOString().slice(0, 10);

function Bars({ rows, cur, loc }: { rows: { label: string; value: number; over?: boolean }[]; cur: string; loc: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      {rows.map((r, i) => (
        <div className="bar-row" key={i}>
          <span title={r.label}>{r.label}</span>
          <div className="bar-track"><i className={r.over ? "over" : ""} style={{ width: Math.max(2, (r.value / max) * 100) + "%" }} /></div>
          <em>{Number(r.value).toLocaleString(loc, { maximumFractionDigits: 0 })} {cur}</em>
        </div>
      ))}
    </div>
  );
}

export default function LegalSpend({ organizationId, userId, lang }: { organizationId: string; userId: string; lang: Lang }) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const loc = ar ? "ar-EG" : "en-GB";
  const supabase = useMemo(() => createClient(), []);

  const [tab, setTab] = useState<"report" | "counsel">("report");
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(todayIso());
  const [report, setReport] = useState<Report | null>(null);
  const [cur, setCur] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counsel, setCounsel] = useState<CounselRow[]>([]);
  const [form, setForm] = useState<null | { id: string | null; name: string; contact_name: string; email: string; phone: string; specialties: string; default_rate: string; currency: string; notes: string }>(null);
  const [saving, setSaving] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.rpc("legal_spend_report", { p_org: organizationId, p_from: from, p_to: to });
    if (err) setError(err.message);
    else {
      const r = data as Report;
      setReport(r);
      setCur((c) => (c && r.by_currency.some((x) => x.currency === c) ? c : (r.by_currency[0]?.currency ?? "EGP")));
    }
    setLoading(false);
  }, [organizationId, from, to, supabase]);

  const loadCounsel = useCallback(async () => {
    const { data } = await supabase.from("outside_counsel").select("id,name,contact_name,email,phone,specialties,default_rate,currency,notes,status").eq("organization_id", organizationId).order("name");
    setCounsel(((data ?? []) as CounselRow[]).map((c) => ({ ...c, default_rate: c.default_rate === null ? null : Number(c.default_rate) })));
  }, [organizationId, supabase]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);
  useEffect(() => {
    void loadCounsel();
  }, [loadCounsel]);

  async function saveCounsel(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      contact_name: form.contact_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      specialties: form.specialties.trim() || null,
      default_rate: form.default_rate === "" ? null : Number(form.default_rate),
      currency: form.currency,
      notes: form.notes.trim() || null,
    };
    const res = form.id
      ? await supabase.from("outside_counsel").update(payload).eq("id", form.id).eq("organization_id", organizationId)
      : await supabase.from("outside_counsel").insert({ ...payload, organization_id: organizationId, created_by: userId });
    if (res.error) setError(res.error.message);
    else {
      setForm(null);
      await loadCounsel();
    }
    setSaving(false);
  }

  async function toggleCounsel(c: CounselRow) {
    await supabase.from("outside_counsel").update({ status: c.status === "active" ? "inactive" : "active" }).eq("id", c.id).eq("organization_id", organizationId);
    await loadCounsel();
  }

  function exportCsv() {
    if (!report) return;
    const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push(`${esc("Legal spend report")},${esc(from)},${esc(to)}`, "");
    lines.push(["By matter", "Currency", "Total", "Hours", "Budget"].map(esc).join(","));
    for (const r of report.by_matter) lines.push([r.title, r.currency, r.total, r.hours, r.budget ?? ""].map(esc).join(","));
    lines.push("", ["By outside counsel", "Currency", "Total", "Hours"].map(esc).join(","));
    for (const r of report.by_counsel) lines.push([r.name, r.currency, r.total, r.hours].map(esc).join(","));
    lines.push("", ["By category", "Currency", "Total"].map(esc).join(","));
    for (const r of report.by_category) lines.push([r.category, r.currency, r.total].map(esc).join(","));
    lines.push("", ["By month", "Currency", "Total"].map(esc).join(","));
    for (const r of report.by_month) lines.push([r.mth, r.currency, r.total].map(esc).join(","));
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `legal-spend-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const totals = report?.by_currency.find((x) => x.currency === cur);
  const spendByCounsel = (id: string) => (report?.by_counsel ?? []).filter((x) => x.counsel_id === id).map((x) => `${Number(x.total).toLocaleString(loc, { maximumFractionDigits: 0 })} ${x.currency}`).join(" + ");

  return (
    <div>
      <div className="people-head">
        <div>
          <div className="people-kicker">{t("الإنفاق القانوني", "LEGAL SPEND")}</div>
          <h1>{t("الإنفاق القانوني والمحامون الخارجيون", "Legal spend & outside counsel")}</h1>
          <p className="people-sub">{t("تكلفة الشؤون القانونية من الوقت المسجّل والمصروفات المعتمدة، مجمّعة حسب القضية والمحامي الخارجي والتصنيف والشهر. العملات تُعرض منفصلة دون تحويل.", "Legal cost from logged time and approved expenses, grouped by matter, outside counsel, category and month. Currencies are shown separately, without conversion.")}</p>
        </div>
        {tab === "report" && report && (
          <button type="button" className="btn-ghost" onClick={exportCsv}>{t("تصدير CSV", "Export CSV")}</button>
        )}
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "report"} className={"tab" + (tab === "report" ? " active" : "")} onClick={() => setTab("report")}>{t("التقرير", "Report")}</button>
        <button type="button" role="tab" aria-selected={tab === "counsel"} className={"tab" + (tab === "counsel" ? " active" : "")} onClick={() => setTab("counsel")}>{t("المحامون الخارجيون", "Outside counsel")} ({counsel.length})</button>
      </div>

      {error && <p className="note-err" role="alert">{error}</p>}

      {tab === "report" && (
        <>
          <div className="panel-block">
            <div className="filter-row">
              <label>{t("من تاريخ", "From")}<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
              <label>{t("إلى تاريخ", "To")}<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
              {report && report.by_currency.length > 1 && (
                <label>{t("العملة", "Currency")}<select value={cur} onChange={(e) => setCur(e.target.value)}>{report.by_currency.map((c) => <option key={c.currency}>{c.currency}</option>)}</select></label>
              )}
            </div>
          </div>

          {loading && <div className="dash-empty">{t("جارٍ التحميل…", "Loading…")}</div>}
          {!loading && report && report.by_currency.length === 0 && (
            <div className="dash-empty">{t("لا توجد تكاليف معتمدة في هذه الفترة. سجّل الوقت والمصروفات من صفحة القضية، واعتمد المصروفات.", "No approved costs in this period. Log time and expenses from a matter page and approve expenses.")}</div>
          )}

          {report && totals && (
            <>
              <div className="spend-cards">
                <div className="spend-card"><small>{t("الإجمالي", "Total")}</small><b>{Number(totals.total).toLocaleString(loc, { maximumFractionDigits: 0 })} {cur}</b></div>
                <div className="spend-card"><small>{t("مصروفات معتمدة", "Approved expenses")}</small><b>{Number(totals.expenses).toLocaleString(loc, { maximumFractionDigits: 0 })}</b></div>
                <div className="spend-card"><small>{t("تكلفة الوقت القابل للفوترة", "Billable time cost")}</small><b>{Number(totals.time_cost).toLocaleString(loc, { maximumFractionDigits: 0 })}</b></div>
                <div className="spend-card"><small>{t("الساعات المسجّلة", "Hours logged")}</small><b>{Number(totals.hours).toLocaleString(loc, { maximumFractionDigits: 1 })}</b></div>
              </div>

              <section className="panel-block">
                <h2>{t("حسب الشهر", "By month")}</h2>
                <Bars cur={cur} loc={loc} rows={report.by_month.filter((x) => x.currency === cur).map((x) => ({ label: new Date(x.mth + "T00:00:00Z").toLocaleDateString(loc, { month: "long", year: "numeric", timeZone: "UTC" }), value: Number(x.total) }))} />
              </section>
              <section className="panel-block">
                <h2>{t("حسب القضية (أعلى 50)", "By matter (top 50)")}</h2>
                <Bars cur={cur} loc={loc} rows={report.by_matter.filter((x) => x.currency === cur).map((x) => ({ label: x.title, value: Number(x.total), over: x.budget !== null && x.budget_currency === cur && Number(x.total) > Number(x.budget) }))} />
                <p className="muted-note">{t("اللون الأحمر = تجاوزت القضية ميزانيتها.", "Red = the matter exceeded its budget.")}</p>
              </section>
              <section className="panel-block">
                <h2>{t("حسب المحامي الخارجي", "By outside counsel")}</h2>
                {report.by_counsel.filter((x) => x.currency === cur).length === 0 ? (
                  <div className="dash-empty">{t("لا توجد تكاليف مرتبطة بمحامٍ خارجي.", "No costs linked to outside counsel.")}</div>
                ) : (
                  <Bars cur={cur} loc={loc} rows={report.by_counsel.filter((x) => x.currency === cur).map((x) => ({ label: x.name, value: Number(x.total) }))} />
                )}
              </section>
              <section className="panel-block">
                <h2>{t("حسب التصنيف", "By category")}</h2>
                <Bars cur={cur} loc={loc} rows={report.by_category.filter((x) => x.currency === cur).map((x) => ({ label: EXPENSE_CATEGORIES[x.category]?.[lang] ?? x.category, value: Number(x.total) }))} />
              </section>
            </>
          )}
        </>
      )}

      {tab === "counsel" && (
        <>
          {!form && (
            <div className="btn-row" style={{ marginTop: 0, marginBottom: 14 }}>
              <button type="button" className="btn-primary" onClick={() => setForm({ id: null, name: "", contact_name: "", email: "", phone: "", specialties: "", default_rate: "", currency: "EGP", notes: "" })}>{t("+ محامٍ خارجي جديد", "+ New outside counsel")}</button>
            </div>
          )}
          {form && (
            <section className="panel-block">
              <h2>{form.id ? t("تعديل البيانات", "Edit details") : t("محامٍ خارجي جديد", "New outside counsel")}</h2>
              <form onSubmit={saveCounsel}>
                <div className="form-grid">
                  <label>{t("الاسم / المكتب *", "Name / firm *")}<input required minLength={2} maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                  <label>{t("المتصل الرئيسي", "Contact person")}<input maxLength={200} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></label>
                  <label>{t("البريد", "Email")}<input type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                  <label>{t("الهاتف", "Phone")}<input maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                  <label>{t("التخصصات", "Specialties")}<input maxLength={500} value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} /></label>
                  <label>{t("سعر الساعة الافتراضي", "Default hourly rate")}<input type="number" min="0" step="0.01" value={form.default_rate} onChange={(e) => setForm({ ...form, default_rate: e.target.value })} /></label>
                  <label>{t("العملة", "Currency")}<select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                  <label className="wide">{t("ملاحظات", "Notes")}<textarea rows={2} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                </div>
                <div className="btn-row">
                  <button className="btn-primary" disabled={saving}>{t("حفظ", "Save")}</button>
                  <button type="button" className="btn-ghost" onClick={() => setForm(null)}>{t("إلغاء", "Cancel")}</button>
                </div>
              </form>
            </section>
          )}
          <section className="panel-block">
            {counsel.length === 0 && <div className="dash-empty">{t("لا يوجد محامون خارجيون بعد.", "No outside counsel yet.")}</div>}
            {counsel.map((c) => (
              <div className="tpl-card" key={c.id}>
                <div className="tpl-main">
                  <b>{c.name}</b>
                  <small>{[c.contact_name, c.email, c.phone, c.specialties].filter(Boolean).join(" · ")}</small>
                  <small>{[c.default_rate !== null ? `${c.default_rate} ${c.currency}/${t("س", "h")}` : "", spendByCounsel(c.id) ? t("إنفاق الفترة: ", "Period spend: ") + spendByCounsel(c.id) : ""].filter(Boolean).join(" · ")}</small>
                </div>
                <div className="tpl-actions">
                  <span className={"chip " + (c.status === "active" ? "ok" : "")}>{c.status === "active" ? t("نشط", "Active") : t("غير نشط", "Inactive")}</span>
                  <button type="button" className="btn-ghost" onClick={() => setForm({ id: c.id, name: c.name, contact_name: c.contact_name ?? "", email: c.email ?? "", phone: c.phone ?? "", specialties: c.specialties ?? "", default_rate: c.default_rate === null ? "" : String(c.default_rate), currency: c.currency, notes: c.notes ?? "" })}>{t("تعديل", "Edit")}</button>
                  <button type="button" className="btn-ghost" onClick={() => void toggleCounsel(c)}>{c.status === "active" ? t("إيقاف", "Deactivate") : t("تفعيل", "Activate")}</button>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
