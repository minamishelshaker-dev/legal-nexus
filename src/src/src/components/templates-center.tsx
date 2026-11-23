"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STARTER_CLAUSES, STARTER_TEMPLATES } from "@/lib/starter-templates";

type Lang = "ar" | "en";
type Variable = { key: string; label: string; required: boolean; default?: string };
type Template = {
  id: string;
  name: string;
  description: string | null;
  contract_type: string | null;
  language: Lang;
  body: string;
  variables: Variable[];
  status: string;
  version: number;
};
type Clause = { id: string; title: string; category: string | null; language: Lang; body: string; status: string };

const STATUS: Record<string, { ar: string; en: string; tone: string }> = {
  draft: { ar: "قيد المراجعة", en: "In review", tone: "warn" },
  active: { ar: "معتمد", en: "Active", tone: "ok" },
  archived: { ar: "مؤرشف", en: "Archived", tone: "" },
};

function extractVars(body: string, existing: Variable[]): Variable[] {
  const keys: string[] = [];
  for (const m of body.matchAll(/\{\{([a-z][a-z0-9_]{0,40})\}\}/g)) if (!keys.includes(m[1])) keys.push(m[1]);
  return keys.map((k) => existing.find((v) => v.key === k) ?? { key: k, label: k, required: false });
}

export default function TemplatesCenter({ organizationId, userId, canManage, lang }: { organizationId: string; userId: string; canManage: boolean; lang: Lang }) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [tab, setTab] = useState<"templates" | "clauses">("templates");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<null | { id: string | null; name: string; description: string; contract_type: string; language: Lang; body: string; status: string; variables: Variable[] }>(null);
  const [using, setUsing] = useState<null | { template: Template; values: Record<string, string>; title: string; counterparty: string }>(null);
  const [clauseForm, setClauseForm] = useState<null | { id: string | null; title: string; category: string; language: Lang; body: string }>(null);

  const load = useCallback(async () => {
    const [tp, cl] = await Promise.all([
      supabase.from("contract_templates").select("id,name,description,contract_type,language,body,variables,status,version").eq("organization_id", organizationId).order("created_at", { ascending: false }),
      supabase.from("contract_clauses").select("id,title,category,language,body,status").eq("organization_id", organizationId).order("title"),
    ]);
    if (tp.error) setError(tp.error.message);
    else setTemplates((tp.data ?? []) as Template[]);
    if (!cl.error) setClauses((cl.data ?? []) as Clause[]);
    setLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  function newTemplate() {
    setEditing({ id: null, name: "", description: "", contract_type: "", language: ar ? "ar" : "en", body: "", status: "draft", variables: [] });
  }
  function editTemplate(x: Template) {
    setEditing({ id: x.id, name: x.name, description: x.description ?? "", contract_type: x.contract_type ?? "", language: x.language, body: x.body, status: x.status, variables: x.variables ?? [] });
  }

  async function saveTemplate(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    setNotice("");
    const vars = extractVars(editing.body, editing.variables);
    const payload = {
      name: editing.name.trim(),
      description: editing.description.trim() || null,
      contract_type: editing.contract_type.trim() || null,
      language: editing.language,
      body: editing.body,
      variables: vars,
      status: editing.status,
    };
    const res = editing.id
      ? await supabase.from("contract_templates").update(payload).eq("id", editing.id).eq("organization_id", organizationId)
      : await supabase.from("contract_templates").insert({ ...payload, organization_id: organizationId, created_by: userId });
    if (res.error) setError(res.error.message);
    else {
      setNotice(t("تم حفظ القالب.", "Template saved."));
      setEditing(null);
      await load();
    }
    setSaving(false);
  }

  async function setTemplateStatus(x: Template, status: string) {
    setError("");
    const { error: err } = await supabase.from("contract_templates").update({ status }).eq("id", x.id).eq("organization_id", organizationId);
    if (err) setError(err.message);
    else await load();
  }

  async function loadStarters() {
    setSaving(true);
    setError("");
    const { error: e1 } = await supabase.from("contract_templates").insert(
      STARTER_TEMPLATES.map((s) => ({
        organization_id: organizationId,
        created_by: userId,
        name: s.name,
        description: s.description,
        contract_type: s.contract_type,
        language: s.language,
        body: s.body,
        variables: extractVars(s.body, [
          { key: "party_a", label: s.language === "ar" ? "الطرف الأول" : "Party A", required: true },
          { key: "party_b", label: s.language === "ar" ? "الطرف الثاني" : "Party B", required: true },
          { key: "effective_date", label: s.language === "ar" ? "تاريخ الإبرام" : "Effective date", required: true },
          { key: "purpose", label: s.language === "ar" ? "الغرض من تبادل المعلومات" : "Purpose", required: true },
          { key: "term_years", label: s.language === "ar" ? "مدة الاتفاقية (سنوات)" : "Term (years)", required: false, default: "3" },
          { key: "survival_years", label: s.language === "ar" ? "مدة استمرار السرية (سنوات)" : "Confidentiality survival (years)", required: false, default: "3" },
          { key: "governing_law", label: s.language === "ar" ? "القانون الواجب التطبيق" : "Governing law", required: true },
          { key: "court", label: s.language === "ar" ? "جهة الاختصاص" : "Jurisdiction", required: true },
        ]),
        status: "draft",
      })),
    );
    const { error: e2 } = await supabase.from("contract_clauses").insert(
      STARTER_CLAUSES.map((c) => ({ organization_id: organizationId, created_by: userId, title: c.title, category: c.category, language: c.language, body: c.body })),
    );
    if (e1 || e2) setError((e1 ?? e2)?.message ?? "");
    else {
      setNotice(t("تم تحميل القوالب المبدئية بحالة «قيد المراجعة». راجعها قانونياً قبل اعتمادها.", "Starter templates loaded as \"In review\". Have them legally reviewed before activating."));
      await load();
    }
    setSaving(false);
  }

  async function saveClause(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!clauseForm) return;
    setSaving(true);
    setError("");
    const payload = { title: clauseForm.title.trim(), category: clauseForm.category.trim() || null, language: clauseForm.language, body: clauseForm.body };
    const res = clauseForm.id
      ? await supabase.from("contract_clauses").update(payload).eq("id", clauseForm.id).eq("organization_id", organizationId)
      : await supabase.from("contract_clauses").insert({ ...payload, organization_id: organizationId, created_by: userId });
    if (res.error) setError(res.error.message);
    else {
      setClauseForm(null);
      await load();
    }
    setSaving(false);
  }

  async function archiveClause(c: Clause) {
    await supabase.from("contract_clauses").update({ status: c.status === "active" ? "archived" : "active" }).eq("id", c.id).eq("organization_id", organizationId);
    await load();
  }

  function insertClause(c: Clause) {
    if (!editing) return;
    const el = bodyRef.current;
    const pos = el ? el.selectionStart : editing.body.length;
    const before = editing.body.slice(0, pos);
    const after = editing.body.slice(pos);
    const text = (before && !before.endsWith("\n") ? "\n\n" : "") + c.title + "\n" + c.body + "\n\n";
    setEditing({ ...editing, body: before + text + after });
  }

  function startUse(x: Template) {
    const values: Record<string, string> = {};
    for (const v of x.variables ?? []) values[v.key] = v.default ?? "";
    setUsing({ template: x, values, title: x.name, counterparty: "" });
  }

  async function createFromTemplate(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!using) return;
    setSaving(true);
    setError("");
    const { data, error: err } = await supabase.rpc("create_contract_from_template", {
      p_template: using.template.id,
      p_values: using.values,
      p_title: using.title,
      p_counterparty: using.counterparty.trim() || null,
    });
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    router.push(`/workspace/contracts/${data}`);
  }

  const activeClauses = clauses.filter((c) => c.status === "active");

  return (
    <div>
      <div className="people-head">
        <div>
          <div className="people-kicker">{t("العقود", "CONTRACTS")}</div>
          <h1>{t("القوالب ومكتبة البنود", "Templates & clause library")}</h1>
          <p className="people-sub">{t("أنشئ عقداً من قالب معتمد بملء الحقول فقط، واحتفظ ببنودك المعتمدة لإعادة استخدامها. لا يُستخدم إلا القالب المعتمد.", "Create a contract from an approved template by filling in fields, and keep your approved clauses for reuse. Only approved templates can be used.")}</p>
        </div>
        {canManage && tab === "templates" && !editing && (
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button type="button" className="btn-primary" onClick={newTemplate}>{t("+ قالب جديد", "+ New template")}</button>
            {templates.length === 0 && !loading && (
              <button type="button" className="btn-ghost" disabled={saving} onClick={() => void loadStarters()}>{t("تحميل قوالب مبدئية", "Load starter templates")}</button>
            )}
          </div>
        )}
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "templates"} className={"tab" + (tab === "templates" ? " active" : "")} onClick={() => setTab("templates")}>{t("القوالب", "Templates")} ({templates.length})</button>
        <button type="button" role="tab" aria-selected={tab === "clauses"} className={"tab" + (tab === "clauses" ? " active" : "")} onClick={() => setTab("clauses")}>{t("مكتبة البنود", "Clause library")} ({clauses.length})</button>
      </div>

      {error && <p className="note-err" role="alert">{error}</p>}
      {notice && <p className="note-ok" role="status">{notice}</p>}

      {tab === "templates" && using && (
        <section className="panel-block">
          <h2>{t("إنشاء عقد من القالب: ", "Create a contract from: ")}{using.template.name}</h2>
          <p className="lead">{t("املأ الحقول وسيُنشأ عقد بحالة «مسودة» مع النص المعبأ، ثم تستطيع تعديله وحفظ إصدارات منه.", "Fill in the fields to create a draft contract with the completed text. You can then edit it and save versions.")}</p>
          <form onSubmit={createFromTemplate}>
            <div className="form-grid">
              <label>
                {t("عنوان العقد *", "Contract title *")}
                <input required minLength={2} maxLength={240} value={using.title} onChange={(e) => setUsing({ ...using, title: e.target.value })} />
              </label>
              <label>
                {t("الطرف الآخر", "Counterparty")}
                <input maxLength={200} value={using.counterparty} onChange={(e) => setUsing({ ...using, counterparty: e.target.value })} />
              </label>
              {(using.template.variables ?? []).map((v) => (
                <label key={v.key}>
                  {v.label}{v.required ? " *" : ""}
                  <input required={v.required} maxLength={2000} value={using.values[v.key] ?? ""} onChange={(e) => setUsing({ ...using, values: { ...using.values, [v.key]: e.target.value } })} />
                </label>
              ))}
            </div>
            <div className="btn-row">
              <button className="btn-primary" disabled={saving}>{saving ? t("جارٍ الإنشاء…", "Creating…") : t("إنشاء العقد", "Create contract")}</button>
              <button type="button" className="btn-ghost" onClick={() => setUsing(null)}>{t("إلغاء", "Cancel")}</button>
            </div>
          </form>
        </section>
      )}

      {tab === "templates" && editing && (
        <section className="panel-block">
          <h2>{editing.id ? t("تعديل القالب", "Edit template") : t("قالب جديد", "New template")}</h2>
          <p className="lead">{t("اكتب النص وضع الحقول المتغيرة بالصيغة {{party_a}} (أحرف إنجليزية صغيرة وأرقام وشرطة سفلية). ستُكتشف الحقول تلقائياً.", "Write the text and mark variable fields like {{party_a}} (lowercase letters, digits and underscores). Fields are detected automatically.")}</p>
          <form onSubmit={saveTemplate}>
            <div className="form-grid">
              <label>
                {t("اسم القالب *", "Template name *")}
                <input required minLength={2} maxLength={160} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </label>
              <label>
                {t("نوع العقد", "Contract type")}
                <input maxLength={100} value={editing.contract_type} onChange={(e) => setEditing({ ...editing, contract_type: e.target.value })} />
              </label>
              <label>
                {t("اللغة", "Language")}
                <select value={editing.language} onChange={(e) => setEditing({ ...editing, language: e.target.value as Lang })}>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label>
                {t("الحالة", "Status")}
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="draft">{STATUS.draft[lang]}</option>
                  <option value="active">{STATUS.active[lang]}</option>
                  <option value="archived">{STATUS.archived[lang]}</option>
                </select>
              </label>
              <label className="wide">
                {t("الوصف / ملاحظات المراجعة", "Description / review notes")}
                <input maxLength={1000} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </label>
            </div>
            {activeClauses.length > 0 && (
              <div className="btn-row" style={{ marginBottom: 10 }}>
                <select aria-label={t("إدراج بند", "Insert clause")} defaultValue="" onChange={(e) => { const c = activeClauses.find((x) => x.id === e.target.value); if (c) insertClause(c); e.target.value = ""; }} style={{ background: "#0b1525", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 10, padding: "9px 11px", font: "inherit", fontSize: 12 }}>
                  <option value="">{t("+ إدراج بند من المكتبة…", "+ Insert a clause from the library…")}</option>
                  {activeClauses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.language === "ar" ? "ع" : "EN"})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <textarea ref={bodyRef} className="tpl-body" required value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} dir={editing.language === "ar" ? "rtl" : "ltr"} aria-label={t("نص القالب", "Template text")} />
            {extractVars(editing.body, editing.variables).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <p className="lead" style={{ marginBottom: 6 }}>{t("الحقول المكتشفة", "Detected fields")}</p>
                {extractVars(editing.body, editing.variables).map((v) => (
                  <div className="var-row" key={v.key}>
                    <code>{`{{${v.key}}}`}</code>
                    <input value={v.label} onChange={(e) => setEditing({ ...editing, variables: extractVars(editing.body, editing.variables).map((x) => (x.key === v.key ? { ...x, label: e.target.value } : x)) })} aria-label={t("اسم الحقل", "Field label")} />
                    <input value={v.default ?? ""} placeholder={t("قيمة افتراضية", "Default value")} onChange={(e) => setEditing({ ...editing, variables: extractVars(editing.body, editing.variables).map((x) => (x.key === v.key ? { ...x, default: e.target.value } : x)) })} />
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="checkbox" checked={v.required} onChange={(e) => setEditing({ ...editing, variables: extractVars(editing.body, editing.variables).map((x) => (x.key === v.key ? { ...x, required: e.target.checked } : x)) })} />
                      {t("إلزامي", "Required")}
                    </label>
                  </div>
                ))}
              </div>
            )}
            <div className="btn-row">
              <button className="btn-primary" disabled={saving}>{saving ? t("جارٍ الحفظ…", "Saving…") : t("حفظ القالب", "Save template")}</button>
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>{t("إلغاء", "Cancel")}</button>
            </div>
          </form>
        </section>
      )}

      {tab === "templates" && !editing && (
        <section className="panel-block">
          {loading && <div className="dash-empty">{t("جارٍ التحميل…", "Loading…")}</div>}
          {!loading && templates.length === 0 && <div className="dash-empty">{t("لا توجد قوالب بعد.", "No templates yet.")}</div>}
          {templates.map((x) => (
            <div className="tpl-card" key={x.id}>
              <div className="tpl-main">
                <b>{x.name}</b>
                <small>{[x.contract_type, x.language === "ar" ? "العربية" : "English", t(`إصدار ${x.version}`, `v${x.version}`), t(`${(x.variables ?? []).length} حقل`, `${(x.variables ?? []).length} fields`)].filter(Boolean).join(" · ")}</small>
                {x.description && <small>{x.description}</small>}
              </div>
              <div className="tpl-actions">
                <span className={"chip " + (STATUS[x.status]?.tone ?? "")}>{STATUS[x.status]?.[lang] ?? x.status}</span>
                {x.status === "active" && <button type="button" className="btn-primary" onClick={() => startUse(x)}>{t("استخدام القالب", "Use template")}</button>}
                {canManage && x.status === "draft" && <button type="button" className="btn-ghost" onClick={() => void setTemplateStatus(x, "active")}>{t("اعتماد", "Approve")}</button>}
                {canManage && <button type="button" className="btn-ghost" onClick={() => editTemplate(x)}>{t("تعديل", "Edit")}</button>}
                {canManage && x.status !== "archived" && <button type="button" className="btn-ghost" onClick={() => void setTemplateStatus(x, "archived")}>{t("أرشفة", "Archive")}</button>}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "clauses" && (
        <>
          {canManage && !clauseForm && (
            <div className="btn-row" style={{ marginTop: 0, marginBottom: 14 }}>
              <button type="button" className="btn-primary" onClick={() => setClauseForm({ id: null, title: "", category: "", language: ar ? "ar" : "en", body: "" })}>{t("+ بند جديد", "+ New clause")}</button>
            </div>
          )}
          {clauseForm && (
            <section className="panel-block">
              <h2>{clauseForm.id ? t("تعديل البند", "Edit clause") : t("بند جديد", "New clause")}</h2>
              <form onSubmit={saveClause}>
                <div className="form-grid">
                  <label>
                    {t("العنوان *", "Title *")}
                    <input required minLength={2} maxLength={160} value={clauseForm.title} onChange={(e) => setClauseForm({ ...clauseForm, title: e.target.value })} />
                  </label>
                  <label>
                    {t("التصنيف", "Category")}
                    <input maxLength={100} value={clauseForm.category} onChange={(e) => setClauseForm({ ...clauseForm, category: e.target.value })} />
                  </label>
                  <label>
                    {t("اللغة", "Language")}
                    <select value={clauseForm.language} onChange={(e) => setClauseForm({ ...clauseForm, language: e.target.value as Lang })}>
                      <option value="ar">العربية</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                  <label className="wide">
                    {t("نص البند *", "Clause text *")}
                    <textarea required rows={6} maxLength={20000} value={clauseForm.body} dir={clauseForm.language === "ar" ? "rtl" : "ltr"} onChange={(e) => setClauseForm({ ...clauseForm, body: e.target.value })} />
                  </label>
                </div>
                <div className="btn-row">
                  <button className="btn-primary" disabled={saving}>{t("حفظ البند", "Save clause")}</button>
                  <button type="button" className="btn-ghost" onClick={() => setClauseForm(null)}>{t("إلغاء", "Cancel")}</button>
                </div>
              </form>
            </section>
          )}
          <section className="panel-block">
            {!loading && clauses.length === 0 && <div className="dash-empty">{t("لا توجد بنود بعد. يمكنك تحميل البنود المبدئية من تبويب القوالب.", "No clauses yet. You can load starter clauses from the Templates tab.")}</div>}
            {clauses.map((c) => (
              <div className="tpl-card" key={c.id}>
                <div className="tpl-main">
                  <b>{c.title}</b>
                  <small>{[c.category, c.language === "ar" ? "العربية" : "English"].filter(Boolean).join(" · ")}</small>
                  <small style={{ whiteSpace: "pre-wrap" }}>{c.body.length > 220 ? c.body.slice(0, 220) + "…" : c.body}</small>
                </div>
                <div className="tpl-actions">
                  {c.status === "archived" && <span className="chip">{STATUS.archived[lang]}</span>}
                  <button type="button" className="btn-ghost" onClick={() => void navigator.clipboard.writeText(c.body)}>{t("نسخ", "Copy")}</button>
                  {canManage && <button type="button" className="btn-ghost" onClick={() => setClauseForm({ id: c.id, title: c.title, category: c.category ?? "", language: c.language, body: c.body })}>{t("تعديل", "Edit")}</button>}
                  {canManage && <button type="button" className="btn-ghost" onClick={() => void archiveClause(c)}>{c.status === "active" ? t("أرشفة", "Archive") : t("استعادة", "Restore")}</button>}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
