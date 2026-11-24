"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Lang = "ar" | "en";
type Time = { id: string; user_id: string; work_date: string; hours: number; rate: number | null; currency: string; billable: boolean; description: string; outside_counsel_id: string | null };
type Expense = { id: string; expense_date: string; category: string; amount: number; currency: string; description: string; vendor: string | null; status: string; outside_counsel_id: string | null };
type Counsel = { id: string; name: string; default_rate: number | null; currency: string };
type Person = { user_id: string; display_name: string };

export const EXPENSE_CATEGORIES: Record<string, { ar: string; en: string }> = {
  outside_counsel_fees: { ar: "أتعاب محامٍ خارجي", en: "Outside counsel fees" },
  court_fees: { ar: "رسوم قضائية", en: "Court fees" },
  expert: { ar: "خبير", en: "Expert" },
  travel: { ar: "انتقالات وسفر", en: "Travel" },
  translation: { ar: "ترجمة", en: "Translation" },
  filing: { ar: "رسوم تقديم وإيداع", en: "Filing fees" },
  other: { ar: "أخرى", en: "Other" },
  time: { ar: "وقت مسجّل", en: "Logged time" },
};
const EXP_STATUS: Record<string, { ar: string; en: string; tone: string }> = {
  pending: { ar: "بانتظار الاعتماد", en: "Pending", tone: "warn" },
  approved: { ar: "معتمد", en: "Approved", tone: "ok" },
  rejected: { ar: "مرفوض", en: "Rejected", tone: "danger" },
  paid: { ar: "مدفوع", en: "Paid", tone: "gold" },
};
const CURRENCIES = ["EGP", "USD", "EUR", "SAR", "AED", "GBP"];
const todayIso = () => new Date().toISOString().slice(0, 10);
const money = (n: number, c: string, loc: string) => `${Number(n).toLocaleString(loc, { maximumFractionDigits: 2 })} ${c}`;

export default function MatterCosts({
  organizationId,
  matterId,
  userId,
  canLog,
  isManager,
  lang,
}: {
  organizationId: string;
  matterId: string;
  userId: string;
  canLog: boolean;
  isManager: boolean;
  lang: Lang;
}) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const loc = ar ? "ar-EG" : "en-GB";
  const supabase = useMemo(() => createClient(), []);

  const [times, setTimes] = useState<Time[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [counsel, setCounsel] = useState<Counsel[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [budget, setBudget] = useState<{ amount: number | null; currency: string }>({ amount: null, currency: "EGP" });
  const [budgetEdit, setBudgetEdit] = useState<{ amount: string; currency: string } | null>(null);
  const [tab, setTab] = useState<"time" | "expenses">("time");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tf, setTf] = useState({ date: todayIso(), hours: "", rate: "", currency: "EGP", billable: true, counsel: "", description: "" });
  const [ef, setEf] = useState({ date: todayIso(), category: "court_fees", amount: "", currency: "EGP", vendor: "", counsel: "", description: "" });

  const load = useCallback(async () => {
    const [m, ti, ex, co, dir] = await Promise.all([
      supabase.from("legal_matters").select("budget_amount,budget_currency").eq("id", matterId).maybeSingle(),
      supabase.from("matter_time_entries").select("id,user_id,work_date,hours,rate,currency,billable,description,outside_counsel_id").eq("organization_id", organizationId).eq("matter_id", matterId).order("work_date", { ascending: false }).limit(200),
      supabase.from("matter_expenses").select("id,expense_date,category,amount,currency,description,vendor,status,outside_counsel_id").eq("organization_id", organizationId).eq("matter_id", matterId).order("expense_date", { ascending: false }).limit(200),
      supabase.from("outside_counsel").select("id,name,default_rate,currency").eq("organization_id", organizationId).eq("status", "active").order("name"),
      supabase.rpc("list_org_directory", { p_org: organizationId }),
    ]);
    if (m.data) setBudget({ amount: m.data.budget_amount === null ? null : Number(m.data.budget_amount), currency: m.data.budget_currency ?? "EGP" });
    if (ti.error) setError(ti.error.message);
    else setTimes(((ti.data ?? []) as Time[]).map((r) => ({ ...r, hours: Number(r.hours), rate: r.rate === null ? null : Number(r.rate) })));
    if (!ex.error) setExpenses(((ex.data ?? []) as Expense[]).map((r) => ({ ...r, amount: Number(r.amount) })));
    setCounsel(((co.data ?? []) as Counsel[]).map((c) => ({ ...c, default_rate: c.default_rate === null ? null : Number(c.default_rate) })));
    setPeople((dir.data ?? []) as Person[]);
  }, [organizationId, matterId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = (id: string) => (id === userId ? t("أنت", "You") : (people.find((p) => p.user_id === id)?.display_name ?? "—"));
  const counselName = (id: string | null) => (id ? (counsel.find((c) => c.id === id)?.name ?? "") : "");

  const summary = useMemo(() => {
    const m: Record<string, { hours: number; time: number; approved: number; pending: number }> = {};
    const get = (c: string) => (m[c] ??= { hours: 0, time: 0, approved: 0, pending: 0 });
    for (const x of times) {
      const s = get(x.currency);
      s.hours += x.hours;
      if (x.billable) s.time += (x.rate ?? 0) * x.hours;
    }
    for (const x of expenses) {
      const s = get(x.currency);
      if (x.status === "approved" || x.status === "paid") s.approved += x.amount;
      else if (x.status === "pending") s.pending += x.amount;
    }
    return m;
  }, [times, expenses]);

  const spentInBudgetCurrency = (summary[budget.currency]?.time ?? 0) + (summary[budget.currency]?.approved ?? 0);
  const pct = budget.amount && budget.amount > 0 ? Math.min(100, Math.round((spentInBudgetCurrency / budget.amount) * 100)) : 0;
  const over = budget.amount !== null && budget.amount > 0 && spentInBudgetCurrency > budget.amount;

  function pickCounselForTime(id: string) {
    const c = counsel.find((x) => x.id === id);
    setTf({ ...tf, counsel: id, rate: c?.default_rate !== null && c?.default_rate !== undefined ? String(c.default_rate) : tf.rate, currency: c?.currency ?? tf.currency });
  }

  async function addTime(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const { error: err } = await supabase.from("matter_time_entries").insert({
      organization_id: organizationId,
      matter_id: matterId,
      user_id: userId,
      created_by: userId,
      work_date: tf.date,
      hours: Number(tf.hours),
      rate: tf.rate === "" ? null : Number(tf.rate),
      currency: tf.currency,
      billable: tf.billable,
      outside_counsel_id: tf.counsel || null,
      description: tf.description.trim(),
    });
    if (err) setError(err.message);
    else {
      setNotice(t("تم تسجيل الوقت.", "Time logged."));
      setTf({ ...tf, hours: "", description: "" });
      setAdding(false);
      await load();
    }
    setSaving(false);
  }

  async function addExpense(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const { error: err } = await supabase.from("matter_expenses").insert({
      organization_id: organizationId,
      matter_id: matterId,
      created_by: userId,
      status: "pending",
      expense_date: ef.date,
      category: ef.category,
      amount: Number(ef.amount),
      currency: ef.currency,
      vendor: ef.vendor.trim() || null,
      outside_counsel_id: ef.counsel || null,
      description: ef.description.trim(),
    });
    if (err) setError(err.message);
    else {
      setNotice(t("أُضيف المصروف وهو بانتظار الاعتماد.", "Expense added and awaiting approval."));
      setEf({ ...ef, amount: "", vendor: "", description: "" });
      setAdding(false);
      await load();
    }
    setSaving(false);
  }

  async function decide(id: string, decision: string) {
    setError("");
    const { error: err } = await supabase.rpc("decide_expense", { p_id: id, p_decision: decision });
    if (err) setError(err.message);
    else await load();
  }

  async function removeTime(id: string) {
    const { error: err } = await supabase.from("matter_time_entries").delete().eq("id", id).eq("organization_id", organizationId);
    if (err) setError(err.message);
    else await load();
  }

  async function removeExpense(id: string) {
    const { error: err } = await supabase.from("matter_expenses").delete().eq("id", id).eq("organization_id", organizationId);
    if (err) setError(err.message);
    else await load();
  }

  async function saveBudget() {
    if (!budgetEdit) return;
    const amount = budgetEdit.amount === "" ? null : Number(budgetEdit.amount);
    const { error: err } = await supabase.from("legal_matters").update({ budget_amount: amount, budget_currency: budgetEdit.currency }).eq("id", matterId).eq("organization_id", organizationId);
    if (err) setError(err.message);
    else {
      setBudgetEdit(null);
      await load();
    }
  }

  const currencies = Object.keys(summary);

  return (
    <section className="module-panel" style={{ marginTop: 16 }}>
      <div className="dash-card-head">
        <div>
          <span className="auth-kicker">{t("التكلفة والوقت", "COST & TIME")}</span>
          <h2 style={{ margin: "6px 0 0" }}>{t("الوقت المسجّل والمصروفات", "Time & expenses")}</h2>
        </div>
      </div>

      <div className="spend-cards">
        {currencies.length === 0 && <div className="spend-card"><small>{t("الإجمالي", "Total")}</small><b>0</b></div>}
        {currencies.map((c) => (
          <div className="spend-card" key={c}>
            <small>{t("التكلفة المعتمدة (وقت + مصروفات)", "Approved cost (time + expenses)")} · {c}</small>
            <b>{money(summary[c].time + summary[c].approved, c, loc)}</b>
            <small>{t(`${summary[c].hours} ساعة · بانتظار الاعتماد: ${money(summary[c].pending, c, loc)}`, `${summary[c].hours} h · pending: ${money(summary[c].pending, c, loc)}`)}</small>
          </div>
        ))}
        <div className={"spend-card" + (over ? " over" : "")}>
          <small>{t("الميزانية", "Budget")}</small>
          <b>{budget.amount === null ? "—" : money(budget.amount, budget.currency, loc)}</b>
          {budget.amount !== null && (
            <>
              <div className="bar-track"><i className={over ? "over" : ""} style={{ width: pct + "%" }} /></div>
              <small>{over ? t("تجاوزت الميزانية", "Over budget") : t(`${pct}% مستخدم`, `${pct}% used`)}</small>
            </>
          )}
          {isManager && !budgetEdit && (
            <button type="button" className="btn-ghost" onClick={() => setBudgetEdit({ amount: budget.amount === null ? "" : String(budget.amount), currency: budget.currency })}>{t("تعديل الميزانية", "Edit budget")}</button>
          )}
        </div>
      </div>

      {budgetEdit && (
        <div className="budget-line">
          <input type="number" min="0" step="0.01" value={budgetEdit.amount} onChange={(e) => setBudgetEdit({ ...budgetEdit, amount: e.target.value })} aria-label={t("مبلغ الميزانية", "Budget amount")} />
          <select value={budgetEdit.currency} onChange={(e) => setBudgetEdit({ ...budgetEdit, currency: e.target.value })} style={{ background: "#0b1525", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 10, padding: "8px 10px" }}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button type="button" className="btn-primary" onClick={() => void saveBudget()}>{t("حفظ", "Save")}</button>
          <button type="button" className="btn-ghost" onClick={() => setBudgetEdit(null)}>{t("إلغاء", "Cancel")}</button>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "time"} className={"tab" + (tab === "time" ? " active" : "")} onClick={() => { setTab("time"); setAdding(false); }}>{t("الوقت", "Time")} ({times.length})</button>
        <button type="button" role="tab" aria-selected={tab === "expenses"} className={"tab" + (tab === "expenses" ? " active" : "")} onClick={() => { setTab("expenses"); setAdding(false); }}>{t("المصروفات", "Expenses")} ({expenses.length})</button>
        {canLog && (
          <button type="button" className="btn" style={{ marginInlineStart: "auto" }} onClick={() => setAdding((v) => !v)}>
            {adding ? t("إغلاق", "Close") : tab === "time" ? t("+ تسجيل وقت", "+ Log time") : t("+ مصروف جديد", "+ New expense")}
          </button>
        )}
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      {adding && canLog && tab === "time" && (
        <form onSubmit={addTime}>
          <div className="spend-form">
            <label>{t("التاريخ", "Date")}<input required type="date" value={tf.date} onChange={(e) => setTf({ ...tf, date: e.target.value })} /></label>
            <label>{t("الساعات *", "Hours *")}<input required type="number" min="0.25" max="24" step="0.25" value={tf.hours} onChange={(e) => setTf({ ...tf, hours: e.target.value })} /></label>
            <label>{t("سعر الساعة", "Hourly rate")}<input type="number" min="0" step="0.01" value={tf.rate} onChange={(e) => setTf({ ...tf, rate: e.target.value })} /></label>
            <label>{t("العملة", "Currency")}<select value={tf.currency} onChange={(e) => setTf({ ...tf, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>{t("محامٍ خارجي (اختياري)", "Outside counsel (optional)")}<select value={tf.counsel} onChange={(e) => pickCounselForTime(e.target.value)}><option value="">—</option>{counsel.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}><input type="checkbox" checked={tf.billable} onChange={(e) => setTf({ ...tf, billable: e.target.checked })} />{t("قابل للفوترة", "Billable")}</label>
            <label className="wide">{t("وصف العمل *", "Work description *")}<textarea required rows={2} minLength={3} maxLength={1000} value={tf.description} onChange={(e) => setTf({ ...tf, description: e.target.value })} /></label>
          </div>
          <button className="btn-primary" disabled={saving}>{saving ? t("جارٍ الحفظ…", "Saving…") : t("حفظ الوقت", "Save time")}</button>
        </form>
      )}

      {adding && canLog && tab === "expenses" && (
        <form onSubmit={addExpense}>
          <div className="spend-form">
            <label>{t("التاريخ", "Date")}<input required type="date" value={ef.date} onChange={(e) => setEf({ ...ef, date: e.target.value })} /></label>
            <label>{t("التصنيف", "Category")}<select value={ef.category} onChange={(e) => setEf({ ...ef, category: e.target.value })}>{Object.keys(EXPENSE_CATEGORIES).filter((k) => k !== "time").map((k) => <option key={k} value={k}>{EXPENSE_CATEGORIES[k][lang]}</option>)}</select></label>
            <label>{t("المبلغ *", "Amount *")}<input required type="number" min="0.01" step="0.01" value={ef.amount} onChange={(e) => setEf({ ...ef, amount: e.target.value })} /></label>
            <label>{t("العملة", "Currency")}<select value={ef.currency} onChange={(e) => setEf({ ...ef, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>{t("الجهة / المورّد", "Vendor")}<input maxLength={200} value={ef.vendor} onChange={(e) => setEf({ ...ef, vendor: e.target.value })} /></label>
            <label>{t("محامٍ خارجي (اختياري)", "Outside counsel (optional)")}<select value={ef.counsel} onChange={(e) => setEf({ ...ef, counsel: e.target.value })}><option value="">—</option>{counsel.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="wide">{t("الوصف *", "Description *")}<textarea required rows={2} minLength={3} maxLength={1000} value={ef.description} onChange={(e) => setEf({ ...ef, description: e.target.value })} /></label>
          </div>
          <button className="btn-primary" disabled={saving}>{saving ? t("جارٍ الحفظ…", "Saving…") : t("إضافة للاعتماد", "Submit for approval")}</button>
        </form>
      )}

      {tab === "time" &&
        (times.length === 0 ? (
          <div className="dash-empty">{t("لا توجد ساعات مسجّلة لهذه القضية.", "No time logged for this matter.")}</div>
        ) : (
          times.map((x) => (
            <div className="cost-row" key={x.id}>
              <div className="cost-main">
                <b>{x.description}</b>
                <small>{[x.work_date, nameOf(x.user_id), counselName(x.outside_counsel_id), x.billable ? "" : t("غير قابل للفوترة", "non-billable")].filter(Boolean).join(" · ")}</small>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="chip">{x.hours} {t("س", "h")}{x.rate !== null && x.billable ? " · " + money(x.rate * x.hours, x.currency, loc) : ""}</span>
                {canLog && (x.user_id === userId || isManager) && <button type="button" className="btn-ghost" onClick={() => void removeTime(x.id)}>{t("حذف", "Delete")}</button>}
              </div>
            </div>
          ))
        ))}

      {tab === "expenses" &&
        (expenses.length === 0 ? (
          <div className="dash-empty">{t("لا توجد مصروفات مسجّلة لهذه القضية.", "No expenses recorded for this matter.")}</div>
        ) : (
          expenses.map((x) => (
            <div className="cost-row" key={x.id}>
              <div className="cost-main">
                <b>{x.description}</b>
                <small>{[x.expense_date, EXPENSE_CATEGORIES[x.category]?.[lang], x.vendor, counselName(x.outside_counsel_id)].filter(Boolean).join(" · ")}</small>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="chip">{money(x.amount, x.currency, loc)}</span>
                <span className={"chip " + (EXP_STATUS[x.status]?.tone ?? "")}>{EXP_STATUS[x.status]?.[lang] ?? x.status}</span>
                {isManager && x.status === "pending" && (
                  <>
                    <button type="button" className="btn" onClick={() => void decide(x.id, "approved")}>{t("اعتماد", "Approve")}</button>
                    <button type="button" className="btn" onClick={() => void decide(x.id, "rejected")}>{t("رفض", "Reject")}</button>
                  </>
                )}
                {isManager && x.status === "approved" && <button type="button" className="btn" onClick={() => void decide(x.id, "paid")}>{t("تسجيل الدفع", "Mark paid")}</button>}
                {canLog && x.status === "pending" && <button type="button" className="btn-ghost" onClick={() => void removeExpense(x.id)}>{t("حذف", "Delete")}</button>}
              </div>
            </div>
          ))
        ))}
    </section>
  );
}
