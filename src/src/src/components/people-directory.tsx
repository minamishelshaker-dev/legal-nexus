"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";
import { AUTHORITY, STATUS, fmtDate, initials, todayIso } from "@/lib/people";
import type { Employee, Lang, Option, Position } from "@/lib/people";

const emptyForm = {
  number: "",
  name: "",
  email: "",
  phone: "",
  entity: "",
  dept: "",
  position: "",
  manager: "",
  date: "",
  notes: "",
};

export default function PeopleDirectory({ organizationId, lang }: { organizationId: string; lang: Lang }) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const supabase = useMemo(() => createClient(), []);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [entities, setEntities] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [showHire, setShowHire] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, date: todayIso() });
  const [posForm, setPosForm] = useState({ title: "", dept: "", level: "standard" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [e, d, en, p] = await Promise.all([
      supabase.rpc("list_employee_records", {
        p_organization_id: organizationId,
        p_search: query || null,
        p_status: null,
        p_department_id: null,
        p_limit: 200,
        p_offset: 0,
      }),
      supabase.from("departments").select("id,name").eq("organization_id", organizationId).order("name"),
      supabase.from("corporate_entities").select("id,name").eq("organization_id", organizationId).order("name"),
      supabase.from("job_positions").select("id,title,department_id,status,authority_level").eq("organization_id", organizationId).order("title"),
    ]);
    if (e.error) setError(e.error.message);
    else setEmployees((e.data ?? []) as Employee[]);
    setDepartments((d.data ?? []) as Option[]);
    setEntities((en.data ?? []) as Option[]);
    setPositions((p.data ?? []) as Position[]);
    setLoading(false);
  }, [organizationId, query, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const deptName = (id: string | null) => departments.find((x) => x.id === id)?.name ?? "—";
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: employees.length };
    for (const x of employees) c[x.employment_status] = (c[x.employment_status] ?? 0) + 1;
    return c;
  }, [employees]);
  const visible = status === "all" ? employees : employees.filter((x) => x.employment_status === status);
  const activeEmployees = employees.filter((x) => x.employment_status === "active");
  const activePositions = positions.filter((x) => x.status === "active");

  async function hire(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const { error: err } = await supabase.rpc("hire_employee", {
      p_organization_id: organizationId,
      p_employee_number: form.number.trim(),
      p_full_name: form.name.trim(),
      p_work_email: form.email.trim() || null,
      p_phone_number: form.phone.trim() || null,
      p_corporate_entity_id: form.entity || null,
      p_department_id: form.dept || null,
      p_manager_employee_id: form.manager || null,
      p_user_id: null,
      p_hire_date: form.date,
      p_position_id: form.position || null,
      p_notes: form.notes.trim() || null,
    });
    if (err) setError(err.message);
    else {
      setNotice(t("تم تعيين الموظف وتسجيله في السجل الوظيفي.", "Employee hired and recorded in the employment history."));
      setForm({ ...emptyForm, date: todayIso() });
      setShowHire(false);
      await load();
    }
    setSaving(false);
  }

  async function addPosition(ev: FormEvent<HTMLFormElement>) {
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
    const { error: err } = await supabase.from("job_positions").insert({
      organization_id: organizationId,
      title: posForm.title.trim(),
      department_id: posForm.dept || null,
      authority_level: posForm.level,
      created_by: user.id,
    });
    if (err) setError(err.message);
    else {
      setNotice(t("تمت إضافة الوظيفة.", "Position added."));
      setPosForm({ title: "", dept: "", level: "standard" });
      await load();
    }
    setSaving(false);
  }

  const filterKeys = ["all", "active", "on_leave", "suspended", "terminated"];

  return (
    <div>
      <div className="people-head">
        <div>
          <div className="people-kicker">{t("الموارد البشرية", "HUMAN RESOURCES")}</div>
          <h1>{t("الموظفون", "Employees")}</h1>
          <p className="people-sub">
            {t("سجل الموظفين والتعيينات والتنقلات والمستندات السرية. كل عرض أو تغيير يُسجّل في سجل التدقيق.", "Employee register, hiring, transfers and confidential documents. Every view and change is audited.")}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowHire((v) => !v)}>
          <Icon name="plus" size={14} /> {showHire ? t("إغلاق النموذج", "Close form") : t("تعيين موظف جديد", "Hire employee")}
        </button>
      </div>

      {error && <p className="note-err" role="alert">{error}</p>}
      {notice && <p className="note-ok" role="status">{notice}</p>}

      {showHire && (
        <section className="panel-block">
          <h2>{t("تعيين موظف جديد", "Hire a new employee")}</h2>
          <p className="lead">{t("يُنشئ النظام سجل الموظف وإسناد الوظيفة وحدث التعيين في عملية واحدة.", "Creates the employee record, the position assignment and the hiring event in one operation.")}</p>
          <form onSubmit={hire}>
            <div className="form-grid">
              <label>
                {t("الرقم الوظيفي *", "Employee number *")}
                <input required maxLength={64} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </label>
              <label>
                {t("الاسم الكامل *", "Full name *")}
                <input required minLength={2} maxLength={180} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>
                {t("تاريخ التعيين *", "Hire date *")}
                <input required type="date" max={todayIso()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
              <label>
                {t("البريد الوظيفي", "Work email")}
                <input type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label>
                {t("الهاتف", "Phone")}
                <input maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label>
                {t("الكيان القانوني", "Legal entity")}
                <select value={form.entity} onChange={(e) => setForm({ ...form, entity: e.target.value })}>
                  <option value="">—</option>
                  {entities.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("الإدارة", "Department")}
                <select value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}>
                  <option value="">—</option>
                  {departments.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("الوظيفة", "Position")}
                <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
                  <option value="">—</option>
                  {activePositions.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("المدير المباشر", "Direct manager")}
                <select value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })}>
                  <option value="">—</option>
                  {activeEmployees.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide">
                {t("ملاحظات", "Notes")}
                <textarea rows={2} maxLength={4000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>
            <div className="btn-row">
              <button className="btn-primary" disabled={saving}>
                {saving ? t("جارٍ الحفظ…", "Saving…") : t("تعيين الموظف", "Hire employee")}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setShowHire(false)}>
                {t("إلغاء", "Cancel")}
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="toolbar">
        <form
          className="search-box"
          onSubmit={(ev) => {
            ev.preventDefault();
            setQuery(search.trim());
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("بحث بالاسم أو الرقم أو البريد", "Search name, number or email")}
            aria-label={t("بحث", "Search")}
          />
          <button className="btn-ghost">{t("بحث", "Search")}</button>
        </form>
        <div className="pills">
          {filterKeys.map((k) => (
            <button key={k} type="button" className={"pill" + (status === k ? " active" : "")} onClick={() => setStatus(k)}>
              {k === "all" ? t("الكل", "All") : STATUS[k][lang]} ({counts[k] ?? 0})
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("الموظف", "Employee")}</th>
              <th>{t("الإدارة", "Department")}</th>
              <th>{t("الحالة", "Status")}</th>
              <th>{t("تاريخ التعيين", "Hire date")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((x) => (
              <tr key={x.id}>
                <td>
                  <Link href={`/workspace/people/${x.id}`} className="person">
                    <span className="avatar">{initials(x.full_name)}</span>
                    <span>
                      <b>{x.full_name}</b>
                      <small>{x.employee_number + (x.work_email ? " · " + x.work_email : "")}</small>
                    </span>
                  </Link>
                </td>
                <td>{deptName(x.department_id)}</td>
                <td>
                  <span className={"chip " + (STATUS[x.employment_status]?.tone ?? "")}>{STATUS[x.employment_status]?.[lang] ?? x.employment_status}</span>
                </td>
                <td>{fmtDate(x.hire_date, lang)}</td>
                <td>
                  <Link href={`/workspace/people/${x.id}`} className="dash-link">
                    {t("فتح الملف", "Open")} <Icon name="arrow" size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && visible.length === 0 && (
          <div className="dash-empty">
            {employees.length === 0
              ? t("لا يوجد موظفون بعد. ابدأ بتعيين أول موظف.", "No employees yet. Hire your first employee to begin.")
              : t("لا توجد نتائج مطابقة.", "No matching employees.")}
          </div>
        )}
        {loading && <div className="dash-empty">{t("جارٍ التحميل…", "Loading…")}</div>}
      </div>

      <section className="panel-block" style={{ marginTop: 20 }}>
        <h2>{t("الوظائف", "Job positions")}</h2>
        <p className="lead">{t("عرّف الوظائف لتُسند للموظفين عند التعيين والترقية.", "Define positions to assign when hiring or promoting employees.")}</p>
        <form onSubmit={addPosition}>
          <div className="form-grid">
            <label>
              {t("المسمى الوظيفي *", "Job title *")}
              <input required minLength={2} maxLength={160} value={posForm.title} onChange={(e) => setPosForm({ ...posForm, title: e.target.value })} />
            </label>
            <label>
              {t("الإدارة", "Department")}
              <select value={posForm.dept} onChange={(e) => setPosForm({ ...posForm, dept: e.target.value })}>
                <option value="">—</option>
                {departments.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("مستوى الصلاحية", "Authority level")}
              <select value={posForm.level} onChange={(e) => setPosForm({ ...posForm, level: e.target.value })}>
                {Object.keys(AUTHORITY).map((k) => (
                  <option key={k} value={k}>
                    {AUTHORITY[k][lang]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="btn-row">
            <button className="btn-primary" disabled={saving}>
              {t("إضافة وظيفة", "Add position")}
            </button>
          </div>
        </form>
        <div style={{ marginTop: 16 }}>
          {positions.map((p) => (
            <div className="dash-row" key={p.id}>
              <div className="dash-row-main">
                <b>{p.title}</b>
                <small>{deptName(p.department_id)}</small>
              </div>
              <span className="chip">{AUTHORITY[p.authority_level ?? "standard"]?.[lang] ?? p.authority_level}</span>
            </div>
          ))}
          {!loading && positions.length === 0 && <div className="dash-empty">{t("لا توجد وظائف معرفة بعد.", "No positions defined yet.")}</div>}
        </div>
      </section>
    </div>
  );
}
