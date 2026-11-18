"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "contracts" | "matters";
type CoreRecord = Record<string, string | number | null>;

const contractRoles = ["owner", "admin", "legal_manager", "lawyer", "contract_manager"];
const matterRoles = ["owner", "admin", "legal_manager", "lawyer"];

export default function CoreRecordDetail({
  mode,
  organizationId,
  recordId,
  membershipRole,
  lang = "en",
}: {
  mode: Mode;
  organizationId: string;
  recordId: string;
  membershipRole: string;
  lang?: "ar" | "en";
}) {
  const ar = lang === "ar";
  const isContract = mode === "contracts";
  const canEdit = (isContract ? contractRoles : matterRoles).includes(membershipRole);
  const supabase = useMemo(() => createClient(), []);
  const [record, setRecord] = useState<CoreRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let data: CoreRecord | null = null;
    let message = "";
    if (isContract) {
      const result = await supabase.from("contracts")
        .select("id,contract_number,title,counterparty_name,contract_type,status,start_date,end_date,value_amount,currency_code,created_at,updated_at")
        .eq("id", recordId).eq("organization_id", organizationId).maybeSingle();
      data = result.data as CoreRecord | null;
      message = result.error?.message || "";
    } else {
      const result = await supabase.from("legal_matters")
        .select("id,reference_no,title,matter_type,status,priority,description,opened_at,closed_at,created_at,updated_at")
        .eq("id", recordId).eq("organization_id", organizationId).maybeSingle();
      data = result.data as CoreRecord | null;
      message = result.error?.message || "";
    }
    if (message || !data) {
      setRecord(null);
      setError(message || (ar ? "السجل غير موجود أو لا تملك صلاحية عرضه." : "Record not found or you do not have permission to view it."));
      setLoading(false);
      return;
    }
    setRecord(data);
    if (isContract) {
      setForm({
        title: String(data.title || ""),
        contract_number: String(data.contract_number || ""),
        counterparty_name: String(data.counterparty_name || ""),
        contract_type: String(data.contract_type || "other"),
        status: String(data.status || "draft"),
        start_date: String(data.start_date || "").slice(0, 10),
        end_date: String(data.end_date || "").slice(0, 10),
        value_amount: data.value_amount == null ? "" : String(data.value_amount),
        currency_code: String(data.currency_code || "EGP"),
      });
    } else {
      setForm({
        title: String(data.title || ""),
        reference_no: String(data.reference_no || ""),
        matter_type: String(data.matter_type || "general"),
        status: String(data.status || "open"),
        priority: String(data.priority || "normal"),
        description: String(data.description || ""),
        opened_at: String(data.opened_at || "").slice(0, 10),
        closed_at: String(data.closed_at || "").slice(0, 10),
      });
    }
    setLoading(false);
  }, [ar, isContract, organizationId, recordId, supabase]);

  useEffect(() => { void load(); }, [load]);

  function field(name: string, value: string) {
    setForm(current => ({ ...current, [name]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError("");
    setNotice("");
    if (isContract && form.start_date && form.end_date && form.end_date < form.start_date) {
      setError(ar ? "تاريخ انتهاء العقد لا يمكن أن يسبق تاريخ بدايته." : "Contract end date cannot be earlier than its start date.");
      setSaving(false);
      return;
    }
    if (isContract && form.status === "expired" && !form.end_date) {
      setError(ar ? "أدخل تاريخ انتهاء العقد قبل تغيير حالته إلى منتهٍ." : "Enter the contract end date before marking it expired.");
      setSaving(false);
      return;
    }
    if (isContract && !/^[A-Za-z]{3}$/.test(form.currency_code.trim())) {
      setError(ar ? "أدخل رمز عملة مكوناً من ثلاثة أحرف." : "Enter a three-letter currency code.");
      setSaving(false);
      return;
    }
    if (!isContract && form.status === "closed" && !form.closed_at) {
      setError(ar ? "أدخل تاريخ الإغلاق قبل إغلاق الملف." : "Enter a closed date before closing the matter.");
      setSaving(false);
      return;
    }
    if (!isContract && !["closed", "archived"].includes(form.status) && form.closed_at) {
      setError(ar ? "امسح تاريخ الإغلاق إذا كان الملف غير مغلق." : "Clear the closed date while the matter is not closed.");
      setSaving(false);
      return;
    }
    if (!isContract && form.closed_at && form.opened_at && form.closed_at < form.opened_at) {
      setError(ar ? "تاريخ الإغلاق لا يمكن أن يسبق تاريخ القيد." : "Closed date cannot be earlier than the opened date.");
      setSaving(false);
      return;
    }
    let result: { data: unknown; error: { message: string } | null };
    if (isContract) {
      const amount = form.value_amount.trim() ? Number(form.value_amount) : null;
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
        setError(ar ? "قيمة العقد يجب أن تكون رقماً صحيحاً غير سالب." : "Contract value must be a valid non-negative number.");
        setSaving(false);
        return;
      }
      result = await supabase.from("contracts").update({
        title: form.title.trim(),
        contract_number: form.contract_number.trim() || null,
        counterparty_name: form.counterparty_name.trim() || null,
        contract_type: form.contract_type,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        value_amount: amount,
        currency_code: form.currency_code.trim().toUpperCase() || "EGP",
      }).eq("id", recordId).eq("organization_id", organizationId)
        .select("id,contract_number,title,counterparty_name,contract_type,status,start_date,end_date,value_amount,currency_code,created_at,updated_at")
        .maybeSingle();
    } else {
      result = await supabase.from("legal_matters").update({
        title: form.title.trim(),
        reference_no: form.reference_no.trim() || null,
        matter_type: form.matter_type,
        status: form.status,
        priority: form.priority,
        description: form.description.trim() || null,
        opened_at: form.opened_at,
        closed_at: form.closed_at || null,
      }).eq("id", recordId).eq("organization_id", organizationId)
        .select("id,reference_no,title,matter_type,status,priority,description,opened_at,closed_at,created_at,updated_at")
        .maybeSingle();
    }
    if (result.error) setError(result.error.message);
    else if (!result.data) setError(ar ? "لم يتم تحديث السجل. تحقق من صلاحياتك." : "The record was not updated. Check your permissions.");
    else {
      setRecord(result.data as CoreRecord);
      setNotice(ar ? "تم حفظ التعديلات وتسجيلها في سجل التدقيق." : "Changes saved and recorded in the audit trail.");
      await load();
    }
    setSaving(false);
  }

  const types = isContract
    ? [["service", ar ? "خدمات" : "Service"], ["employment", ar ? "عمل" : "Employment"], ["supply", ar ? "توريد" : "Supply"], ["lease", ar ? "إيجار" : "Lease"], ["other", ar ? "أخرى" : "Other"]]
    : [["general", ar ? "عام" : "General"], ["litigation", ar ? "تقاضي" : "Litigation"], ["commercial_dispute", ar ? "نزاع تجاري" : "Commercial dispute"], ["civil_dispute", ar ? "نزاع مدني" : "Civil dispute"], ["other", ar ? "أخرى" : "Other"]];
  const statuses = isContract
    ? [["draft", ar ? "مسودة" : "Draft"], ["in_review", ar ? "قيد المراجعة" : "In review"], ["approved", ar ? "معتمد" : "Approved"], ["signed", ar ? "موقع" : "Signed"], ["active", ar ? "ساري" : "Active"], ["expired", ar ? "منتهي" : "Expired"], ["terminated", ar ? "منهى" : "Terminated"], ["archived", ar ? "مؤرشف" : "Archived"]]
    : [["open", ar ? "مفتوح" : "Open"], ["pending", ar ? "معلق" : "Pending"], ["on_hold", ar ? "متوقف مؤقتاً" : "On hold"], ["closed", ar ? "مغلق" : "Closed"], ["archived", ar ? "مؤرشف" : "Archived"]];

  return <div className="module-layout">
    <section className="module-panel">
      <div className="panel-heading">
        <Link className="back-link" href={`/workspace/${mode}`}>{ar ? "العودة إلى السجلات ←" : "← Back to records"}</Link>
        <span className="auth-kicker">{isContract ? (ar ? "ملف العقد" : "CONTRACT RECORD") : (ar ? "ملف القضية أو المنازعة" : "LEGAL MATTER RECORD")}</span>
        <h2>{loading ? (ar ? "جارٍ تحميل السجل..." : "Loading record…") : String(record?.title || (ar ? "تفاصيل السجل" : "Record details"))}</h2>
        <p>{isContract ? (ar ? "تحديث بيانات العقد مع الاحتفاظ بسجل التغييرات." : "Update contract details with an audit trail.") : (ar ? "تحديث بيانات الملف مع الاحتفاظ بسجل التغييرات." : "Update matter details with an audit trail.")}</p>
      </div>
      {loading ? <div className="empty-state">{ar ? "جارٍ تحميل البيانات..." : "Loading…"}</div> : !record ? <p className="error-message" role="alert">{error}</p> : <form className="module-form" onSubmit={save}>
        <div className="core-detail-grid">
          <label>{ar ? "العنوان" : "Title"}<input required minLength={3} maxLength={200} disabled={!canEdit || saving} value={form.title || ""} onChange={e => field("title", e.target.value)} /></label>
          <label>{isContract ? (ar ? "رقم العقد" : "Contract number") : (ar ? "الرقم المرجعي" : "Reference number")}<input maxLength={100} disabled={!canEdit || saving} value={form[isContract ? "contract_number" : "reference_no"] || ""} onChange={e => field(isContract ? "contract_number" : "reference_no", e.target.value)} /></label>
          {isContract && <label>{ar ? "الطرف المتعاقد" : "Counterparty"}<input maxLength={200} disabled={!canEdit || saving} value={form.counterparty_name || ""} onChange={e => field("counterparty_name", e.target.value)} /></label>}
          <label>{isContract ? (ar ? "نوع العقد" : "Contract type") : (ar ? "نوع الملف" : "Matter type")}<select disabled={!canEdit || saving} value={form[isContract ? "contract_type" : "matter_type"] || ""} onChange={e => field(isContract ? "contract_type" : "matter_type", e.target.value)}>{types.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>{ar ? "الحالة" : "Status"}<select disabled={!canEdit || saving} value={form.status || ""} onChange={e => field("status", e.target.value)}>{statuses.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {isContract ? <>
            <label>{ar ? "تاريخ البداية" : "Start date"}<input type="date" disabled={!canEdit || saving} value={form.start_date || ""} onChange={e => field("start_date", e.target.value)} /></label>
            <label>{ar ? "تاريخ الانتهاء" : "End date"}<input type="date" disabled={!canEdit || saving} value={form.end_date || ""} onChange={e => field("end_date", e.target.value)} /></label>
            <label>{ar ? "قيمة العقد" : "Contract value"}<input type="number" min="0" step="0.01" disabled={!canEdit || saving} value={form.value_amount || ""} onChange={e => field("value_amount", e.target.value)} /></label>
            <label>{ar ? "العملة" : "Currency"}<input minLength={3} maxLength={3} disabled={!canEdit || saving} value={form.currency_code || "EGP"} onChange={e => field("currency_code", e.target.value)} /></label>
          </> : <>
            <label>{ar ? "الأولوية" : "Priority"}<select disabled={!canEdit || saving} value={form.priority || "normal"} onChange={e => field("priority", e.target.value)}>{[["low", ar ? "منخفضة" : "Low"], ["normal", ar ? "عادية" : "Normal"], ["high", ar ? "مرتفعة" : "High"], ["critical", ar ? "حرجة" : "Critical"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>{ar ? "تاريخ القيد" : "Opened date"}<input type="date" required disabled={!canEdit || saving} value={form.opened_at || ""} onChange={e => field("opened_at", e.target.value)} /></label>
            <label>{ar ? "تاريخ الإغلاق" : "Closed date"}<input type="date" disabled={!canEdit || saving} value={form.closed_at || ""} onChange={e => field("closed_at", e.target.value)} /></label>
            <label className="core-detail-wide">{ar ? "الوصف" : "Description"}<textarea rows={6} maxLength={10000} disabled={!canEdit || saving} value={form.description || ""} onChange={e => field("description", e.target.value)} /></label>
          </>}
        </div>
        {!canEdit && <p className="error-message">{ar ? "صلاحيتك تتيح عرض السجل فقط." : "Your role has read-only access to this record."}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="form-actions">
          {canEdit && <button className="primary" type="submit" disabled={saving}>{saving ? (ar ? "جارٍ الحفظ..." : "Saving…") : (ar ? "حفظ التعديلات" : "Save changes")}</button>}
          {notice && <span className="success-message" role="status">{notice}</span>}
        </div>
      </form>}
    </section>
    {record && <section className="module-panel core-record-summary">
      <span className="auth-kicker">{ar ? "بيانات السجل" : "RECORD METADATA"}</span>
      <p>{ar ? "معرف السجل" : "Record ID"}: <code>{record.id}</code></p>
      <p>{ar ? "تاريخ الإنشاء" : "Created"}: {String(record.created_at || "")}</p>
      <p>{ar ? "آخر تحديث" : "Last updated"}: {String(record.updated_at || "")}</p>
      <p>{ar ? "كل تعديل يسجل تلقائياً في سجل التدقيق." : "Every change is automatically written to the audit log."}</p>
    </section>}
  </div>;
}
