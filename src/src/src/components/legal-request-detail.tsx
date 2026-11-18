"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Req={id:string;request_number:string|null;request_type:string;title:string;description:string;urgency:string;status:string;requester_user_id:string;assigned_to:string|null;due_at:string|null;resolution_summary:string|null;created_at:string};
type Member={user_id:string;membership_role:string;status:string};
type Comment={id:string;author_user_id:string;body:string;visibility:string;created_at:string};
type Approval={id:string;step_no:number;approver_user_id:string|null;approver_role:string|null;status:string;decision_note:string|null;decided_at:string|null};
const roleNames:Record<string,[string,string]>={owner:["مالك المؤسسة","Owner"],admin:["مسؤول المؤسسة","Admin"],legal_manager:["مدير الإدارة القانونية","Legal manager"],lawyer:["محامٍ","Lawyer"],contract_manager:["مدير العقود","Contract manager"],hr_investigator:["محقق موارد بشرية","HR investigator"],employee:["موظف","Employee"],auditor:["مراجع","Auditor"],member:["عضو","Member"]};
const statuses:Record<string,[string,string]>={submitted:["مقدم","Submitted"],under_review:["قيد المراجعة","Under review"],awaiting_information:["بانتظار معلومات","Awaiting information"],pending_approval:["بانتظار الموافقة","Pending approval"],approved:["معتمد","Approved"],rejected:["مرفوض","Rejected"],completed:["مكتمل","Completed"],cancelled:["ملغي","Cancelled"],pending:["معلق","Pending"],skipped:["تم تجاوزه","Skipped"]};
const types:Record<string,[string,string]>={legal_opinion:["رأي قانوني","Legal opinion"],contract_review:["مراجعة عقد","Contract review"],litigation_support:["دعم التقاضي","Litigation support"],regulatory_query:["استفسار تنظيمي","Regulatory question"],policy_review:["مراجعة سياسة","Policy review"],investigation_referral:["إحالة للتحقيق","Investigation referral"],other:["أخرى","Other"]};
const urgencies:Record<string,[string,string]>={low:["منخفض","Low"],normal:["عادي","Normal"],high:["مرتفع","High"],urgent:["عاجل جداً","Urgent"]};
const legalRoles=["owner","admin","legal_manager","lawyer","hr_investigator"];
export default function LegalRequestDetail({requestId,organizationId,userId,membershipRole,lang="en"}:{requestId:string;organizationId:string;userId:string;membershipRole:string;lang?:"ar"|"en"}) {
 const ar=lang==="ar", supabase=useMemo(()=>createClient(),[]);
 const [request,setRequest]=useState<Req|null>(null),[members,setMembers]=useState<Member[]>([]),[comments,setComments]=useState<Comment[]>([]),[approvals,setApprovals]=useState<Approval[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [comment,setComment]=useState(""),[visibility,setVisibility]=useState("requester_visible"),[approverRole,setApproverRole]=useState("legal_manager"),[decisionNotes,setDecisionNotes]=useState<Record<string,string>>({});
 const [assignedTo,setAssignedTo]=useState(""),[dueAt,setDueAt]=useState(""),[urgency,setUrgency]=useState("normal"),[status,setStatus]=useState("submitted"),[resolution,setResolution]=useState("");
 const canManage=legalRoles.includes(membershipRole);
 const canCommentInternally=canManage||request?.assigned_to===userId;
 const availableRoles=useMemo(()=>[...new Set(members.filter(m=>m.status==="active").map(m=>m.membership_role).filter(r=>Object.keys(roleNames).includes(r)&&r!=="contract_manager"))],[members]);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  const [rr,mr,cr,arows]=await Promise.all([
   supabase.from("legal_requests").select("id,request_number,request_type,title,description,urgency,status,requester_user_id,assigned_to,due_at,resolution_summary,created_at").eq("id",requestId).eq("organization_id",organizationId).maybeSingle(),
   supabase.from("organization_memberships").select("user_id,membership_role,status").eq("organization_id",organizationId).eq("status","active"),
   supabase.from("legal_request_comments").select("id,author_user_id,body,visibility,created_at").eq("legal_request_id",requestId).order("created_at",{ascending:true}),
   supabase.from("legal_request_approvals").select("id,step_no,approver_user_id,approver_role,status,decision_note,decided_at").eq("legal_request_id",requestId).order("step_no",{ascending:true})
  ]);
  if(rr.error||!rr.data){setRequest(null);setError(ar?"تعذر العثور على الطلب أو لا تملك صلاحية عرضه.":"Request not found or you do not have permission to view it.");setLoading(false);return;}
  const row=rr.data as Req;setRequest(row);setMembers((mr.data||[]) as Member[]);setComments((cr.data||[]) as Comment[]);setApprovals((arows.data||[]) as Approval[]);
  setAssignedTo(row.assigned_to||"");setDueAt(row.due_at?new Date(row.due_at).toISOString().slice(0,16):"");setUrgency(row.urgency);setStatus(row.status);setResolution(row.resolution_summary||"");setLoading(false);
 },[ar,organizationId,requestId,supabase]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{setVisibility(canCommentInternally?"internal":"requester_visible");},[canCommentInternally]);
 useEffect(()=>{if(availableRoles.length&&!availableRoles.includes(approverRole))setApproverRole(availableRoles[0]);},[availableRoles,approverRole]);
 async function updateRequest(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!request)return;setSaving(true);setError("");setNotice("");
  const {error:e1}=await supabase.from("legal_requests").update({assigned_to:assignedTo||null,due_at:dueAt?new Date(dueAt).toISOString():null,urgency,status,resolution_summary:resolution.trim()||null}).eq("id",request.id).eq("organization_id",organizationId);
  if(e1)setError(e1.message);else{setNotice(ar?"تم تحديث الطلب وتسجيل التغيير في سجل التدقيق.":"Request updated and audit event recorded.");await load();}setSaving(false);
 }
 async function addComment(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!request||comment.trim().length<2)return;setSaving(true);setError("");setNotice("");
  const {error:e1}=await supabase.from("legal_request_comments").insert({legal_request_id:request.id,author_user_id:userId,body:comment.trim(),visibility:canCommentInternally?visibility:"requester_visible"});
  if(e1)setError(e1.message);else{setComment("");setNotice(ar?"تمت إضافة التعليق.":"Comment added.");await load();}setSaving(false);
 }
 async function addApproval(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!request)return;setSaving(true);setError("");setNotice("");
  const nextStep=approvals.reduce((m,a)=>Math.max(m,a.step_no),0)+1;
  const {error:e1}=await supabase.from("legal_request_approvals").insert({legal_request_id:request.id,step_no:nextStep,approver_role:approverRole,created_by:userId,status:"pending"});
  if(e1)setError(e1.message);else{setNotice(ar?"تمت إضافة خطوة الموافقة.":"Approval step added.");await load();}setSaving(false);
 }
 async function decide(a:Approval,d:"approved"|"rejected"){setSaving(true);setError("");setNotice("");
  const {error:e1}=await supabase.from("legal_request_approvals").update({status:d,decision_note:decisionNotes[a.id]?.trim()||null}).eq("id",a.id).eq("status","pending");
  if(e1)setError(e1.message);else{setNotice(ar?"تم تسجيل قرار الموافقة.":"Approval decision recorded.");await load();}setSaving(false);
 }
 const transitions:Record<string,string[]>={submitted:["under_review","awaiting_information","cancelled"],under_review:approvals.length===0?["awaiting_information","approved","rejected","completed","cancelled"]:["awaiting_information","cancelled"],awaiting_information:["under_review","cancelled"],approved:["completed","cancelled"]};
 const allowed=[request?.status||"submitted",...(transitions[request?.status||""]||[])];
 const canAct=(a:Approval)=>!["completed","cancelled","rejected"].includes(request?.status||"")&&a.status==="pending"&&(a.approver_user_id===userId||(!!a.approver_role&&a.approver_role===membershipRole)||["owner","admin","legal_manager"].includes(membershipRole))&&!approvals.some(p=>p.step_no<a.step_no&&!["approved","skipped"].includes(p.status));
 if(loading)return <div className="module-panel"><p className="muted-note">{ar?"جارٍ تحميل تفاصيل الطلب...":"Loading request details…"}</p></div>;
 if(!request)return <div className="module-panel"><p className="error-message">{error}</p><Link href="/workspace/requests" className="back-link">{ar?"العودة إلى الطلبات ←":"← Back to requests"}</Link></div>;
 return <div className="module-layout">
  <section className="module-panel"><div className="panel-heading"><span className="auth-kicker">{request.request_number||"LEGAL REQUEST"} · {types[request.request_type]?.[ar?0:1]||request.request_type}</span><h2>{request.title}</h2><p>{request.description}</p><div className="request-tags"><span>{statuses[request.status]?.[ar?0:1]||request.status}</span><span>{urgencies[request.urgency]?.[ar?0:1]||request.urgency}</span><span>{new Date(request.created_at).toLocaleString(ar?"ar-EG":"en-GB")}</span></div></div>
  {canManage&&<form className="module-form" onSubmit={updateRequest}><div className="panel-heading"><h3>{ar?"إدارة الطلب":"Request management"}</h3><p>{ar?"الإسناد والأولوية والموعد والحالة.":"Assignment, priority, due date and status."}</p></div>
   <label>{ar?"المسؤول المكلف":"Assigned member"}<select value={assignedTo} onChange={e=>setAssignedTo(e.target.value)}><option value="">{ar?"غير مسند":"Unassigned"}</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{roleNames[m.membership_role]?.[ar?0:1]||m.membership_role} · {m.user_id.slice(0,8)}</option>)}</select></label>
   <label>{ar?"الأولوية":"Urgency"}<select value={urgency} onChange={e=>setUrgency(e.target.value)}>{Object.entries(urgencies).map(([v,n])=><option key={v} value={v}>{n[ar?0:1]}</option>)}</select></label>
   <label>{ar?"موعد الاستحقاق":"Due date"}<input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label>
   <label>{ar?"الحالة":"Status"}<select value={status} onChange={e=>setStatus(e.target.value)}>{[...new Set(allowed)].map(v=><option key={v} value={v}>{statuses[v]?.[ar?0:1]||v}</option>)}</select></label>
   <label>{ar?"ملخص المعالجة":"Resolution summary"}<textarea rows={3} maxLength={10000} value={resolution} onChange={e=>setResolution(e.target.value)}/></label>
   <div className="form-actions"><button className="primary" disabled={saving}>{saving?(ar?"جارٍ الحفظ...":"Saving…"):(ar?"حفظ التعديلات":"Save changes")}</button></div>
  </form>}</section>
  <section className="module-panel"><div className="panel-heading"><span className="auth-kicker">{ar?"سلسلة الموافقات":"APPROVAL CHAIN"}</span><h2>{ar?"خطوات الاعتماد":"Approval steps"}</h2><p>{ar?"تُنفذ الموافقات بالتتابع.":"Approvals run sequentially."}</p></div>
   <div className="record-mini-list">{approvals.map(a=><article className="request-row" key={a.id}><div className="request-row-main"><div className="request-meta"><span>{ar?"الخطوة":"Step"} {a.step_no}</span><span>{statuses[a.status]?.[ar?0:1]||a.status}</span></div><h3>{a.approver_role?roleNames[a.approver_role]?.[ar?0:1]||a.approver_role:(a.approver_user_id||"").slice(0,8)}</h3>{a.decision_note&&<p>{a.decision_note}</p>}</div>
   {canAct(a)&&<div className="approval-actions"><textarea rows={2} maxLength={2000} placeholder={ar?"ملاحظة القرار (اختياري)":"Decision note (optional)"} value={decisionNotes[a.id]||""} onChange={e=>setDecisionNotes(p=>({...p,[a.id]:e.target.value}))}/><div className="form-actions"><button type="button" className="primary" disabled={saving} onClick={()=>void decide(a,"approved")}>{ar?"اعتماد":"Approve"}</button><button type="button" className="secondary-button" disabled={saving} onClick={()=>void decide(a,"rejected")}>{ar?"رفض":"Reject"}</button></div></div>}</article>)}{approvals.length===0&&<div className="empty-state">{ar?"لا توجد خطوات موافقة بعد.":"No approval steps yet."}</div>}</div>
   {canManage&&!["approved","rejected","completed","cancelled"].includes(request.status)&&<form className="module-form" onSubmit={addApproval}><label>{ar?"دور المعتمد":"Approver role"}<select value={approverRole} onChange={e=>setApproverRole(e.target.value)}>{availableRoles.map(r=><option key={r} value={r}>{roleNames[r]?.[ar?0:1]||r}</option>)}</select></label><div className="form-actions"><button className="secondary-button" disabled={saving||availableRoles.length===0}>{ar?"إضافة خطوة موافقة":"Add approval step"}</button></div></form>}
  </section>
  <section className="module-panel"><div className="panel-heading"><span className="auth-kicker">{ar?"سجل التواصل":"REQUEST DISCUSSION"}</span><h2>{ar?"التعليقات والملاحظات":"Comments & notes"}</h2><p>{ar?"تظهر الملاحظات الداخلية للفريق القانوني والمكلفين فقط.":"Internal notes are visible only to the legal team and assignee."}</p></div>
   <div className="record-mini-list">{comments.map(c=><article className="detail-record" key={c.id}><div className="request-meta"><span>{c.visibility==="internal"?(ar?"ملاحظة داخلية":"Internal note"):(ar?"مرئية لمقدم الطلب":"Requester-visible")}</span><span>{new Date(c.created_at).toLocaleString(ar?"ar-EG":"en-GB")}</span></div><p>{c.body}</p><small>{ar?"المستخدم: ":"Author: "}{c.author_user_id.slice(0,8)}</small></article>)}{comments.length===0&&<div className="empty-state">{ar?"لا توجد تعليقات بعد.":"No comments yet."}</div>}</div>
   <form className="module-form" onSubmit={addComment}><label>{ar?"إضافة تعليق":"Add a comment"}<textarea required minLength={2} maxLength={10000} rows={4} value={comment} onChange={e=>setComment(e.target.value)}/></label>{canCommentInternally&&<label>{ar?"نوع الملاحظة":"Visibility"}<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="internal">{ar?"داخلية للفريق":"Internal"}</option><option value="requester_visible">{ar?"مرئية لمقدم الطلب":"Requester-visible"}</option></select></label>}<div className="form-actions"><button className="primary" disabled={saving||comment.trim().length<2}>{ar?"إضافة التعليق":"Add comment"}</button></div></form>
  </section>
  {error&&<p className="error-message" role="alert">{error}</p>}{notice&&<p className="success-message" role="status">{notice}</p>}
  <Link href="/workspace/requests" className="back-link">{ar?"العودة إلى الطلبات ←":"← Back to requests"}</Link>
 </div>;
}
