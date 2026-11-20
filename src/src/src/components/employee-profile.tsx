"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";
import { ALLOWED_MIME, DOC_TYPES, EVENTS, STATUS, fmtDate, initials, todayIso } from "@/lib/people";
import type { Employee, Lang, Option, Position } from "@/lib/people";

type HistoryRow = {
  id: string;
  event_type: string;
  effective_date: string;
  previous_status: string | null;
  new_status: string | null;
  previous_department_id: string | null;
  new_department_id: string | null;
  previous_position_id: string | null;
  new_position_id: string | null;
  summary: string | null;
  created_at: string;
};
type DocRow = {
  id: string;
  document_type: string;
  title: string;
  description: string | null;
  classification: string;
  current_version: number;
  updated_at: string;
};
type VersionRow = {
  id: string;
  version_number: number;
  storage_bucket: string;
  storage_object_key: string;
  original_file_name: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
};
type Assignment = { id: string; position_id: string; start_date: string; is_primary: boolean };

type Tab = "overview" | "change" | "history" | "documents";

function allowedEvents(status: string): string[] {
  switch (status) {
    case "active":
      return ["transferred", "promoted", "demoted", "manager_changed", "status_changed", "leave_started", "terminated"];
    case "on_leave":
      return ["leave_ended", "status_changed", "manager_changed", "terminated"];
    case "suspended":
      return ["status_changed", "manager_changed", "terminated"];
    case "terminated":
      return ["rehired"];
    default:
      return [];
  }
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fmtSize(n: number): string {
  if (n >= 1048576) return (n / 1048576).toFixed(1) + " MB";
  return Math.max(1, Math.round(n / 1024)) + " KB";
}

export default function EmployeeProfile({
  organizationId,
  employeeId,
  lang,
}: {
  organizationId: string;
  employeeId: string;
  lang: Lang;
}) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const supabase = useMemo(() => createClient(), []);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [entities, setEntities] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [people, setPeople] = useState<Employee[]>([]);
  const [versions, setVersions] = useState<Record<string, VersionRow[]>>({});
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [edit, setEdit] = useState({ name: "", email: "", phone: "", entity: "", notes: "", summary: "" });
  const [change, setChange] = useState({ event: "", date: todayIso(), dept: "", position: "", manager: "", status: "active", summary: "" });
  const [docForm, setDocForm] = useState({ type: "employment_contract", title: "", description: "", classification: "restricted", target: "" });
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const args = { p_organization_id: organizationId, p_employee_id: employeeId };
    const [r, h, d, dep, pos, asg, emps, ents] = await Promise.all([
      supabase.rpc("get_employee_record", args),
      supabase.rpc("get_employee_history", args),
      supabase.rpc("get_employee_documents", args),
      supabase.from("departments").select("id,name").eq("organization_id", organizationId).order("name"),
      supabase.from("job_positions").select("id,title,department_id,status").eq("organization_id", organizationId).order("title"),
      supabase
        .from("position_assignments")
        .select("id,position_id,start_date,is_primary")
        .eq("organization_id", organizationId)
        .eq("employee_id", employeeId)
        .eq("status", "active"),
      supabase.rpc("list_employee_records", {
        p_organization_id: organizationId,
        p_search: null,
        p_status: null,
        p_department_id: null,
        p_limit: 200,
        p_offset: 0,
      }),
      supabase.from("corporate_entities").select("id,name").eq("organization_id", organizationId).order("name"),
    ]);
    if (r.error) {
      setError(r.error.message);
      setEmployee(null);
    } else {
      const row = ((r.data ?? []) as Employee[])[0] ?? null;
      setEmployee(row);
      if (row)
        setEdit({
          name: row.full_name,
          email: row.work_email ?? "",
          phone: row.phone_number ?? "",
          entity: row.corporate_entity_id ?? "",
          notes: row.notes ?? "",
          summary: "",
        });
    }
    setHistory((h.data ?? []) as HistoryRow[]);
    setDocs((d.data ?? []) as DocRow[]);
    setDepartments((dep.data ?? []) as Option[]);
    setPositions((pos.data ?? []) as Position[]);
    setAssignments((asg.data ?? []) as Assignment[]);
    setPeople((emps.data ?? []) as Employee[]);
    setEntities((ents.data ?? []) as Option[]);
    setLoading(false);
  }, [organizationId, employeeId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const deptName = (id: string | null) => departments.find((x) => x.id === id)?.name ?? "—";
  const posTitle = (id: string | null) => positions.find((x) => x.id === id)?.title ?? "—";
  const personName = (id: string | null) => people.find((x) => x.id === id)?.full_name ?? "—";
  const activePositions = positions.filter((x) => x.status === "active");
  const managers = people.filter((x) => x.employment_status === "active" && x.id !== employeeId);

  async function saveProfile(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const { error: err } = await supabase.rpc("update_employee_profile", {
      p_organization_id: organizationId,
      p_employee_id: employeeId,
      p_full_name: edit.name,
      p_work_email: edit.email || null,
      p_phone_number: edit.phone || null,
      p_corporate_entity_id: edit.entity || null,
      p_notes: edit.notes || null,
      p_summary: edit.summary || null,
    });
    if (err) setError(err.message);
    else {
      setNotice(t("تم تحديث بيانات الموظف.", "Employee profile updated."));
      await load();
    }
    setSaving(false);
  }

  async function submitChange(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!employee) return;
    const e = change.event;
    const needsPosition = e === "promoted" || e === "demoted" || e === "rehired";
    if (needsPosition && !change.position) {
      setError(t("هذا الإجراء يتطلب اختيار وظيفة جديدة.", "This action requires selecting a new position."));
      return;
    }
    if (e === "transferred" && !change.dept && !change.position) {
      setError(t("اختر إدارة أو وظيفة جديدة للنقل.", "Select a new department or position for the transfer."));
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const { error: err } = await supabase.rpc("change_employee_lifecycle", {
      p_organization_id: organizationId,
      p_employee_id: employeeId,
      p_event_type: e,
      p_effective_date: change.date,
      p_change_department: (e === "transferred" || e === "rehired") && !!change.dept,
      p_new_department_id: change.dept || null,
      p_change_position: ["transferred", "promoted", "demoted", "rehired"].includes(e) && !!change.position,
      p_new_position_id: change.position || null,
      p_change_manager: e === "manager_changed",
      p_new_manager_employee_id: change.manager || null,
      p_new_status: e === "status_changed" ? change.status : null,
      p_summary: change.summary || null,
    });
    if (err) setError(err.message);
    else {
      setNotice(t("تم تسجيل الإجراء في السجل الوظيفي.", "Action recorded in the employment history."));
      setChange({ event: "", date: todayIso(), dept: "", position: "", manager: "", status: "active", summary: "" });
      setTab("history");
      await load();
    }
    setSaving(false);
  }

  async function uploadDocument(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!file) {
      setError(t("اختر ملفاً للرفع.", "Choose a file to upload."));
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      setError(t("نوع الملف غير مدعوم. المسموح: PDF وصور وملفات Office.", "Unsupported file type. Allowed: PDF, images and Office files."));
      return;
    }
    if (file.size > 52428800) {
      setError(t("حجم الملف يتجاوز 50 ميجابايت.", "File exceeds 50 MB."));
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
    const key = `${organizationId}/${employeeId}/${crypto.randomUUID()}-${safe}`;
    const hash = await sha256(file);
    const up = await supabase.storage.from("employee-records-private").upload(key, file, { contentType: file.type, upsert: false });
    if (up.error) {
      setError(up.error.message);
      setSaving(false);
      return;
    }
    const existing = docForm.target ? docs.find((x) => x.id === docForm.target) : undefined;
    const { error: err } = await supabase.rpc("register_employee_document_version", {
      p_organization_id: organizationId,
      p_employee_id: employeeId,
      p_document_type: existing ? existing.document_type : docForm.type,
      p_title: existing ? existing.title : docForm.title,
      p_storage_bucket: "employee-records-private",
      p_storage_object_key: key,
      p_original_file_name: file.name.replace(/[\\/\u0000-\u001f]/g, "_"),
      p_mime_type: file.type,
      p_file_size_bytes: file.size,
      p_description: existing ? existing.description : docForm.description || null,
      p_classification: existing ? existing.classification : docForm.classification,
      p_sha256_hex: hash,
      p_employee_document_id: existing ? existing.id : null,
    });
    if (err) {
      await supabase.storage.from("employee-records-private").remove([key]);
      setError(err.message);
    } else {
      setNotice(t("تم رفع المستند وتسجيله بإصدار جديد.", "Document uploaded and registered as a new version."));
      setFile(null);
      setDocForm({ type: "employment_contract", title: "", description: "", classification: "restricted", target: "" });
      setVersions({});
      await load();
    }
    setSaving(false);
  }

  async function showVersions(docId: string) {
    if (versions[docId]) {
      const next = { ...versions };
      delete next[docId];
      setVersions(next);
      return;
    }
    const { data, error: err } = await supabase.rpc("get_employee_document_versions", {
      p_organization_id: organizationId,
      p_employee_document_id: docId,
    });
    if (err) setError(err.message);
    else setVersions({ ...versions, [docId]: (data ?? []) as VersionRow[] });
  }

  async function download(v: VersionRow) {
    const { data, error: err } = await supabase.storage
      .from(v.storage_bucket)
      .createSignedUrl(v.storage_object_key, 60, { download: v.original_file_name });
    if (err || !data) setError(err?.message ?? t("تعذر إنشاء رابط التنزيل.", "Could not create download link."));
    else window.open(data.signedUrl, "_blank", "noopener");
  }

  if (loading && !employee) return <div className="dash-empty">{t("جارٍ التحميل…", "Loading…")}</div>;
  if (!employee)
    return (
      <div>
        <Link href="/workspace/people" className="back-row">
          <Icon name="arrow" size={14} /> {t("العودة إلى الموظفين", "Back to employees")}
        </Link>
        <div className="denied">
          <strong>{t("تعذر عرض الموظف", "Employee unavailable")}</strong>
          {error || t("السجل غير موجود أو لا تملك صلاحية عرضه.", "The record does not exist or you do not have access.")}
        </div>
      </div>
    );

  const events = allowedEvents(employee.employment_status);
  const st = STATUS[employee.employment_status];
  const current = assignments.find((a) => a.is_primary) ?? assignments[0];
  const ev = change.event;
  const showDept = ev === "transferred" || ev === "rehired";
  const showPos = ev === "transferred" || ev === "promoted" || ev === "demoted" || ev === "rehired";
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t("نظرة عامة", "Overview") },
    { key: "change", label: t("تسجيل إجراء", "Record action") },
    { key: "history", label: t("السجل الوظيفي", "History") + " (" + history.length + ")" },
    { key: "documents", label: t("المستندات", "Documents") + " (" + docs.length + ")" },
  ];

  return (
    <div>
      <Link href="/workspace/people" className="back-row">
        <Icon name="arrow" size={14} /> {t("العودة إلى الموظفين", "Back to employees")}
      </Link>
      <div className="profile-head">
        <span className="avatar lg">{initials(employee.full_name)}</span>
        <div>
          <h1>{employee.full_name}</h1>
          <div className="profile-meta">
            <span>{employee.employee_number}</span>
            <span className={"chip " + (st?.tone ?? "")}>{st?.[lang] ?? employee.employment_status}</span>
            <span>{t("تاريخ التعيين: ", "Hired: ") + fmtDate(employee.hire_date, lang)}</span>
          </div>
        </div>
      </div>

      {error && <p className="note-err" role="alert">{error}</p>}
      {notice && <p className="note-ok" role="status">{notice}</p>}

      <div className="tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} className={"tab" + (tab === x.key ? " active" : "")} onClick={() => setTab(x.key)}>
            {x.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <section className="panel-block">
            <h2>{t("بيانات الموظف", "Employee details")}</h2>
            <dl className="detail-grid" style={{ marginTop: 14 }}>
              <div>
                <dt>{t("الإدارة", "Department")}</dt>
                <dd>{deptName(employee.department_id)}</dd>
              </div>
              <div>
                <dt>{t("الوظيفة الحالية", "Current position")}</dt>
                <dd>{current ? posTitle(current.position_id) : "—"}</dd>
              </div>
              <div>
                <dt>{t("المدير المباشر", "Direct manager")}</dt>
                <dd>{personName(employee.manager_employee_id)}</dd>
              </div>
              <div>
                <dt>{t("الكيان القانوني", "Legal entity")}</dt>
                <dd>{entities.find((x) => x.id === employee.corporate_entity_id)?.name ?? "—"}</dd>
              </div>
              <div>
                <dt>{t("البريد الوظيفي", "Work email")}</dt>
                <dd>{employee.work_email ?? "—"}</dd>
              </div>
              <div>
                <dt>{t("الهاتف", "Phone")}</dt>
                <dd>{employee.phone_number ?? "—"}</dd>
              </div>
              {employee.termination_date && (
                <div>
                  <dt>{t("تاريخ إنهاء الخدمة", "Termination date")}</dt>
                  <dd>{fmtDate(employee.termination_date, lang)}</dd>
                </div>
              )}
              <div className="wide" style={{ gridColumn: "1/-1" }}>
                <dt>{t("ملاحظات", "Notes")}</dt>
                <dd>{employee.notes ?? "—"}</dd>
              </div>
            </dl>
          </section>
          <section className="panel-block">
            <h2>{t("تعديل البيانات الأساسية", "Edit profile")}</h2>
            <p className="lead">{t("تغيير الإدارة أو الوظيفة أو المدير أو الحالة يتم من تبويب تسجيل إجراء ليُوثَّق في السجل الوظيفي.", "Department, position, manager and status changes are made under Record action so they are documented in the history.")}</p>
            <form onSubmit={saveProfile}>
              <div className="form-grid">
                <label>
                  {t("الاسم الكامل", "Full name")}
                  <input required minLength={2} maxLength={180} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                </label>
                <label>
                  {t("البريد الوظيفي", "Work email")}
                  <input type="email" maxLength={254} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
                </label>
                <label>
                  {t("الهاتف", "Phone")}
                  <input maxLength={40} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                </label>
                <label>
                  {t("الكيان القانوني", "Legal entity")}
                  <select value={edit.entity} onChange={(e) => setEdit({ ...edit, entity: e.target.value })}>
                    <option value="">—</option>
                    {entities.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  {t("ملاحظات", "Notes")}
                  <textarea rows={2} maxLength={4000} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
                </label>
                <label className="wide">
                  {t("سبب التعديل (يظهر في السجل)", "Reason for change (shown in history)")}
                  <input maxLength={2000} value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} />
                </label>
              </div>
              <div className="btn-row">
                <button className="btn-primary" disabled={saving}>
                  {t("حفظ التعديلات", "Save changes")}
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {tab === "change" && (
        <section className="panel-block">
          <h2>{t("تسجيل إجراء وظيفي", "Record an employment action")}</h2>
          <p className="lead">{t("كل إجراء يُحدّث سجل الموظف والإسناد الوظيفي والسجل التاريخي في عملية واحدة.", "Each action updates the employee record, position assignment and history in one operation.")}</p>
          {events.length === 0 ? (
            <div className="dash-empty">{t("لا توجد إجراءات متاحة لحالة الموظف الحالية.", "No actions are available for the current status.")}</div>
          ) : (
            <form onSubmit={submitChange}>
              <div className="form-grid">
                <label>
                  {t("نوع الإجراء *", "Action *")}
                  <select required value={change.event} onChange={(e) => setChange({ ...change, event: e.target.value })}>
                    <option value="">{t("اختر…", "Select…")}</option>
                    {events.map((k) => (
                      <option key={k} value={k}>
                        {EVENTS[k][lang]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("تاريخ السريان *", "Effective date *")}
                  <input required type="date" min={employee.hire_date ?? undefined} max={todayIso()} value={change.date} onChange={(e) => setChange({ ...change, date: e.target.value })} />
                </label>
                {ev === "status_changed" && (
                  <label>
                    {t("الحالة الجديدة", "New status")}
                    <select value={change.status} onChange={(e) => setChange({ ...change, status: e.target.value })}>
                      {["active", "on_leave", "suspended"].map((k) => (
                        <option key={k} value={k}>
                          {STATUS[k][lang]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {showDept && (
                  <label>
                    {t("الإدارة الجديدة", "New department")}
                    <select value={change.dept} onChange={(e) => setChange({ ...change, dept: e.target.value })}>
                      <option value="">—</option>
                      {departments.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {showPos && (
                  <label>
                    {t("الوظيفة الجديدة", "New position")}
                    <select value={change.position} onChange={(e) => setChange({ ...change, position: e.target.value })}>
                      <option value="">—</option>
                      {activePositions.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {ev === "manager_changed" && (
                  <label>
                    {t("المدير المباشر الجديد", "New direct manager")}
                    <select value={change.manager} onChange={(e) => setChange({ ...change, manager: e.target.value })}>
                      <option value="">{t("بدون مدير", "No manager")}</option>
                      {managers.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="wide">
                  {t("الملخص / السبب", "Summary / reason")}
                  <textarea rows={2} maxLength={2000} value={change.summary} onChange={(e) => setChange({ ...change, summary: e.target.value })} />
                </label>
              </div>
              <div className="btn-row">
                <button className="btn-primary" disabled={saving || !change.event}>
                  {saving ? t("جارٍ التسجيل…", "Recording…") : t("تسجيل الإجراء", "Record action")}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {tab === "history" && (
        <section className="panel-block">
          <h2>{t("السجل الوظيفي", "Employment history")}</h2>
          <p className="lead">{t("سجل تاريخي غير قابل للتعديل لكل ما مرّ به الموظف.", "An immutable record of everything that happened to this employee.")}</p>
          {history.length === 0 ? (
            <div className="dash-empty">{t("لا توجد أحداث مسجلة.", "No events recorded.")}</div>
          ) : (
            <div className="timeline">
              {history.map((h) => (
                <div className="tl-item" key={h.id}>
                  <span className="tl-dot" />
                  <div className="tl-body">
                    <b>{EVENTS[h.event_type]?.[lang] ?? h.event_type}</b>
                    <small>
                      {fmtDate(h.effective_date, lang)}
                      {h.previous_status && h.new_status && h.previous_status !== h.new_status
                        ? " · " + (STATUS[h.previous_status]?.[lang] ?? h.previous_status) + " → " + (STATUS[h.new_status]?.[lang] ?? h.new_status)
                        : ""}
                      {h.new_department_id && h.new_department_id !== h.previous_department_id ? " · " + deptName(h.new_department_id) : ""}
                      {h.new_position_id && h.new_position_id !== h.previous_position_id ? " · " + posTitle(h.new_position_id) : ""}
                    </small>
                    {h.summary && <p>{h.summary}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "documents" && (
        <>
          <section className="panel-block">
            <h2>{docForm.target ? t("إضافة إصدار جديد", "Add a new version") : t("رفع مستند سري", "Upload a confidential document")}</h2>
            <p className="lead">{t("الملفات تُحفظ في مخزن خاص مشفّر، وتُحسب بصمة SHA-256 لكل ملف للتحقق من سلامته.", "Files are stored in a private bucket and a SHA-256 fingerprint is recorded for integrity checks.")}</p>
            <form onSubmit={uploadDocument}>
              <div className="form-grid">
                {!docForm.target && (
                  <>
                    <label>
                      {t("نوع المستند", "Document type")}
                      <select value={docForm.type} onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}>
                        {Object.keys(DOC_TYPES).map((k) => (
                          <option key={k} value={k}>
                            {DOC_TYPES[k][lang]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("العنوان *", "Title *")}
                      <input required minLength={2} maxLength={200} value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} />
                    </label>
                    <label>
                      {t("مستوى السرية", "Classification")}
                      <select value={docForm.classification} onChange={(e) => setDocForm({ ...docForm, classification: e.target.value })}>
                        <option value="restricted">{t("مقيّد", "Restricted")}</option>
                        <option value="highly_restricted">{t("مقيّد جداً", "Highly restricted")}</option>
                      </select>
                    </label>
                  </>
                )}
                <label className={docForm.target ? "" : "wide"}>
                  {t("الملف *", "File *")}
                  <input type="file" required accept={ALLOWED_MIME.join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div className="btn-row">
                <button className="btn-primary" disabled={saving}>
                  <Icon name="upload" size={14} /> {saving ? t("جارٍ الرفع…", "Uploading…") : t("رفع", "Upload")}
                </button>
                {docForm.target && (
                  <button type="button" className="btn-ghost" onClick={() => setDocForm({ ...docForm, target: "" })}>
                    {t("إلغاء الإصدار الجديد", "Cancel new version")}
                  </button>
                )}
              </div>
            </form>
          </section>
          <section className="panel-block">
            <h2>{t("مستندات الموظف", "Employee documents")}</h2>
            {docs.length === 0 && <div className="dash-empty">{t("لا توجد مستندات.", "No documents.")}</div>}
            {docs.map((d) => (
              <div className="doc-row" key={d.id}>
                <div className="doc-main">
                  <b>{d.title}</b>
                  <small>
                    {(DOC_TYPES[d.document_type]?.[lang] ?? d.document_type) + " · v" + d.current_version + " · " + fmtDate(d.updated_at, lang)}
                  </small>
                </div>
                <div className="btn-row" style={{ marginTop: 0 }}>
                  <span className={"chip " + (d.classification === "highly_restricted" ? "danger" : "warn")}>
                    {d.classification === "highly_restricted" ? t("مقيّد جداً", "Highly restricted") : t("مقيّد", "Restricted")}
                  </span>
                  <button type="button" className="btn-ghost" onClick={() => void showVersions(d.id)}>
                    {versions[d.id] ? t("إخفاء الإصدارات", "Hide versions") : t("الإصدارات", "Versions")}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setDocForm({ ...docForm, target: d.id })}>
                    {t("إصدار جديد", "New version")}
                  </button>
                </div>
                {versions[d.id] && (
                  <div className="doc-versions">
                    {versions[d.id].map((v) => (
                      <div className="doc-version" key={v.id}>
                        <span>
                          v{v.version_number} · {v.original_file_name} · {fmtSize(v.file_size_bytes)} · {fmtDate(v.created_at, lang)}
                        </span>
                        <button type="button" className="btn-ghost" onClick={() => void download(v)}>
                          <Icon name="download" size={13} /> {t("تنزيل", "Download")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
