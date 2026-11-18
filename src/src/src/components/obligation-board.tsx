"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Obligation = {
  id: string;
  title: string;
  description: string | null;
  obligation_type: string;
  status: string;
  priority: string;
  due_date: string;
  responsible_user_id: string | null;
  related_record_type: string | null;
  related_record_id: string | null;
  created_at: string;
};

export default function ObligationBoard({
  organizationId,
  userId,
  membershipRole,
  lang = "en",
}: {
  organizationId: string;
  userId: string;
  membershipRole: string;
  lang?: "ar" | "en";
}) {
  const ar = lang === "ar";
  const canManage = ["owner", "admin", "legal_manager", "lawyer", "contract_manager"].includes(membershipRole);
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Obligation[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("contractual");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [relatedType, setRelatedType] = useState("");
  const [relatedId, setRelatedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase.from("obligations")
      .select("id,title,description,obligation_type,status,priority,due_date,responsible_user_id,related_record_type,related_record_id,created_at")
      .eq("organization_id", organizationId)
      .order("due_date", { ascending: true });
    if (queryError) setError(queryError.message);
    else setRows((data || []) as Obligation[]);
    setLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => { void load(); }, [load]);

  async function createObligation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError("");
    setNotice("");
    if (title.trim().length < 3 || !dueDate) {
      setError(ar ? "أدخل عنوان الالتزام وتاريخ الاستحقاق." : "Enter an obligation title and due date.");
      setSaving(false);
      return;
    }
    if ((relatedType && !relatedId.trim()) || (!relatedType && relatedId.trim())) {
      setError(ar ? "اختر نوع السجل المرتبط وأدخل معرفه معاً." : "Choose a related record type and provide its ID together.");
      setSaving(false);
      return;
    }
    const { error: insertError } = await supabase.from("obligations").insert({
      organization_id: organizationId,
      title: title.trim(),
      description: description.trim() || null,
      obligation_type: type,
      status: "open",
      priority,
      due_date: dueDate,
      responsible_user_id: userId,
      related_record_type: relatedType || null,
      related_record_id: relatedId.trim() || null,
      created_by: userId,
    });
    if (insertError) setError(insertError.message);
    else {
      setTitle("");
      setDescription("");
      setDueDate("");
      setRelatedType("");
      setRelatedId("");
      setNotice(ar ? "تم تسجيل الالتزام." : "Obligation created.");
      await load();
    }
    setSaving(false);
  }

  async function updateStatus(row: Obligation, status: string) {
    setError("");
    setNotice("");
    const { data, error: updateError } = await supabase.from("obligations")
      .update({ status })
      .eq("id", row.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (updateError) setError(updateError.message);
    else if (!data) setError(ar ? "لم يتم تحديث الالتزام. تحقق من الصلاحيات." : "The obligation was not updated. Check your permissions.");
    else {
      setNotice(ar ? "تم تحديث حالة الالتزام." : "Obligation status updated.");
      await load();
    }
  }

  const labels: Record<string, string> = {
    contractual: ar ? "تعاقدي" : "Contractual",
    regulatory: ar ? "تنظيمي" : "Regulatory",
    filing: ar ? "إيداع أو تقديم" : "Filing",
    policy: ar ? "سياسة داخلية" : "Policy",
    renewal: ar ? "تجديد" : "Renewal",
    other: ar ? "أخرى" : "Other",
  };
  const statusLabels: Record<string, string> = {
    open: ar ? "مفتوح" : "Open",
    in_progress: ar ? "قيد التنفيذ" : "In progress",
    completed: ar ? "مكتمل" : "Completed",
    cancelled: ar ? "ملغى" : "Cancelled",
  };
  const priorityLabels: Record<string, string> = {
    low: ar ? "منخفضة" : "Low",
    normal: ar ? "عادية" : "Normal",
    high: ar ? "مرتفعة" : "High",
    critical: ar ? "حرجة" : "Critical",
  };

  return <div className="module-layout">
    {canManage && <section className="module-panel">
      <div className="panel-heading"><span className="auth-kicker">{ar ? "إدارة الالتزامات" : "OBLIGATION MANAGEMENT"}</span><h2>{ar ? "تسجيل التزام جديد" : "Create an obligation"}</h2><p>{ar ? "سجّل المواعيد التعاقدية والتنظيمية والتجديدات ومهام التقديم." : "Track contractual, regulatory, filing and renewal deadlines."}</p></div>
      <form className="module-form" onSubmit={createObligation}>
        <div className="obligation-form-grid">
          <label>{ar ? "عنوان الالتزام" : "Obligation title"}<input required minLength={3} maxLength={240} value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label>{ar ? "تاريخ الاستحقاق" : "Due date"}<input required type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
          <label>{ar ? "النوع" : "Type"}<select value={type} onChange={e => setType(e.target.value)}>{[["contractual",ar?"تعاقدي":"Contractual"],["regulatory",ar?"تنظيمي":"Regulatory"],["filing",ar?"إيداع أو تقديم":"Filing"],["policy",ar?"سياسة داخلية":"Policy"],["renewal",ar?"تجديد":"Renewal"],["other",ar?"أخرى":"Other"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label>{ar ? "الأولوية" : "Priority"}<select value={priority} onChange={e => setPriority(e.target.value)}>{[["low",ar?"منخفضة":"Low"],["normal",ar?"عادية":"Normal"],["high",ar?"مرتفعة":"High"],["critical",ar?"حرجة":"Critical"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label>{ar ? "مرتبط بسجل" : "Related record"}<select value={relatedType} onChange={e => setRelatedType(e.target.value)}><option value="">{ar?"بدون ارتباط":"No relation"}</option><option value="contract">{ar?"عقد":"Contract"}</option><option value="legal_matter">{ar?"قضية أو منازعة":"Legal matter"}</option></select></label>
          <label>{ar ? "معرف السجل المرتبط" : "Related record ID"}<input value={relatedId} disabled={!relatedType} onChange={e => setRelatedId(e.target.value)} placeholder="UUID" /></label>
          <label className="obligation-form-wide">{ar ? "الوصف" : "Description"}<textarea rows={3} maxLength={5000} value={description} onChange={e => setDescription(e.target.value)} /></label>
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
        {notice && <p className="success-message" role="status">{notice}</p>}
        <div className="form-actions"><button className="primary" type="submit" disabled={saving}>{saving ? (ar?"جارٍ الحفظ...":"Saving…") : (ar?"حفظ الالتزام":"Save obligation")}</button></div>
      </form>
    </section>}
    <section className="module-panel">
      <div className="panel-heading"><span className="auth-kicker">{ar ? "قائمة المتابعة" : "FOLLOW-UP REGISTER"}</span><h2>{ar ? "الالتزامات والمواعيد" : "Obligations & deadlines"}</h2><p>{ar ? "تظهر هنا الالتزامات المسندة إليك أو المتاحة لدورك." : "You see obligations assigned to you or visible to your role."}</p></div>
      {loading ? <div className="empty-state">{ar?"جارٍ تحميل الالتزامات...":"Loading obligations…"}</div> : rows.length===0 ? <div className="empty-state">{ar?"لا توجد التزامات متاحة حالياً.":"No obligations are available yet."}</div> : <div className="obligation-list">{rows.map(row=>{
        const overdue = !["completed","cancelled"].includes(row.status) && new Date(`${row.due_date}T23:59:59`).getTime() < Date.now();
        return <article className="obligation-row" key={row.id}>
          <div className="obligation-row-main"><strong>{row.title}</strong><span>{labels[row.obligation_type]||row.obligation_type} · {priorityLabels[row.priority]||row.priority}</span><small>{ar?"الاستحقاق: ":"Due: "}{new Date(`${row.due_date}T00:00:00`).toLocaleDateString(ar?"ar-EG":"en-GB")}{overdue?<b className="overdue-label">{ar?" · متأخر":" · Overdue"}</b>:""}</small>{row.description&&<p>{row.description}</p>}{row.related_record_type&&row.related_record_id&&<small>{row.related_record_type==="contract"?(ar?"عقد: ":"Contract: "):(ar?"ملف: ":"Matter: ")}{row.related_record_id}</small>}</div>
          <div className="obligation-row-actions"><span className="status-pill">{statusLabels[row.status]||row.status}</span>{canManage&&row.status!=="completed"&&row.status!=="cancelled"&&<select aria-label={ar?"تحديث الحالة":"Update status"} value={row.status} onChange={e=>void updateStatus(row,e.target.value)}><option value="open">{statusLabels.open}</option><option value="in_progress">{statusLabels.in_progress}</option><option value="completed">{statusLabels.completed}</option><option value="cancelled">{statusLabels.cancelled}</option></select>}</div>
        </article>;
      })}</div>}
      {error && !canManage && <p className="error-message" role="alert">{error}</p>}
    </section>
  </div>;
}
