"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; user_id: string; membership_role: string; status: string; created_at: string };
type Profile = { id: string; full_name: string | null };
type Invitation = { id: string; invited_email: string; membership_role: string; status: string; expires_at: string; created_at: string };

const roles = [
  ["legal_manager", "مدير الإدارة القانونية", "Legal manager"],
  ["lawyer", "محامٍ", "Lawyer"],
  ["contract_manager", "مدير العقود", "Contract manager"],
  ["hr_manager", "مدير الموارد البشرية", "HR manager"],
  ["hr_investigator", "محقق موارد بشرية", "HR investigator"],
  ["employee", "موظف", "Employee"],
  ["auditor", "مراجع", "Auditor"],
  ["member", "عضو", "Member"],
] as const;

export default function OrganizationMembers({ organizationId, lang = "en", currentUserId }: { organizationId: string; lang?: "ar" | "en"; currentUserId: string }) {
  const ar = lang === "ar";
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("lawyer");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [canInvite, setCanInvite] = useState(false);
  const [canAppointAdmin, setCanAppointAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: membershipRows, error: memberError } = await supabase
      .from("organization_memberships")
      .select("id,user_id,membership_role,status,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });
    if (memberError) {
      setError(ar ? "تعذر تحميل أعضاء المؤسسة." : "Unable to load organization members.");
      setLoading(false);
      return;
    }
    const rows = (membershipRows || []) as Member[];
    setMembers(rows);
    const ids = rows.some((m) => m.user_id === currentUserId) ? [currentUserId] : [];
    if (ids.length) {
      const { data: profileRows } = await supabase.from("user_profiles").select("id,full_name").eq("id", currentUserId);
      const map: Record<string, string> = {};
      ((profileRows || []) as Profile[]).forEach((p) => { if (p.full_name) map[p.id] = p.full_name; });
      setProfiles(map);
    } else setProfiles({});
    const { data: current } = await supabase.auth.getUser();
    const manager = rows.find((m) => m.user_id === current.data.user?.id && m.status === "active");
    const allowed = ["owner", "admin"].includes(manager?.membership_role || "");
    setCanInvite(allowed);
    setCanAppointAdmin(manager?.membership_role === "owner");
    if (allowed) {
      const { data: inviteRows, error: inviteError } = await supabase
        .from("organization_invitations")
        .select("id,invited_email,membership_role,status,expires_at,created_at")
        .eq("organization_id", organizationId)
        .eq("status", "invited")
        .order("created_at", { ascending: false });
      if (inviteError) setError(ar ? "تعذر تحميل الدعوات الحالية." : "Unable to load pending invitations.");
      setInvitations((inviteRows || []) as Invitation[]);
    } else setInvitations([]);
    setLoading(false);
  }, [ar, currentUserId, organizationId, supabase]);

  useEffect(() => { void load(); }, [load]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice(""); setInviteLink("");
    const { data, error: rpcError } = await supabase.rpc("create_org_invitation", {
      target_org: organizationId,
      target_email: email.trim().toLowerCase(),
      target_role: role,
    });
    if (rpcError) {
      setError(rpcError.message || (ar ? "تعذر إنشاء الدعوة." : "Could not create invitation."));
    } else {
      const result = Array.isArray(data) ? data[0] : data;
      const token = result?.invitation_token;
      if (!token) setError(ar ? "تم إنشاء الدعوة لكن تعذر الحصول على رابطها. راجع قائمة الدعوات قبل إعادة المحاولة." : "The invitation was created, but its link was not returned. Check pending invitations before retrying.");
      else {
        setInviteLink(`${window.location.origin}/invite?token=${encodeURIComponent(token)}`);
        setEmail("");
        setNotice(ar ? "تم إنشاء الدعوة. انسخ الرابط وأرسله إلى الشخص المدعو؛ لا تُرسل المنصة رسالة بريد تلقائياً حالياً." : "Invitation created. Copy and send the link to the invitee; the platform does not send invitation emails automatically yet.");
        await load();
      }
    }
    setSaving(false);
  }

  async function revokeInvitation(id: string) {
    setError(""); setNotice("");
    const { data, error: rpcError } = await supabase.rpc("revoke_org_invitation", { target_invitation: id });
    if (rpcError || data !== true) setError(rpcError?.message || (ar ? "تعذر إلغاء الدعوة." : "Could not revoke invitation."));
    else { setNotice(ar ? "تم إلغاء الدعوة." : "Invitation revoked."); await load(); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteLink); setNotice(ar ? "تم نسخ رابط الدعوة." : "Invitation link copied."); }
    catch { setError(ar ? "تعذر النسخ تلقائياً؛ انسخ الرابط يدوياً." : "Clipboard access failed; copy the link manually."); }
  }

  return <div className="module-layout">
    <section className="module-panel">
      <div className="panel-heading"><span className="auth-kicker">{ar ? "إدارة الوصول" : "ACCESS MANAGEMENT"}</span><h2>{ar ? "أعضاء المؤسسة" : "Organization members"}</h2><p>{ar ? "عرض العضويات النشطة والأدوار المسندة داخل المؤسسة." : "Review active memberships and assigned organization roles."}</p></div>
      <div className="record-mini-list">
        {members.map((member) => <article className="request-row" key={member.id}>
          <div className="request-row-main"><h3>{profiles[member.user_id] || (member.user_id === currentUserId ? (ar ? "حسابك" : "Your account") : (ar ? "عضو المؤسسة" : "Organization member"))}</h3><div className="request-meta"><span>{member.membership_role}</span><span>{member.status}</span></div><p>{member.user_id === currentUserId ? (ar ? "المستخدم الحالي" : "Current user") : (ar ? "معرّف العضو: " : "Member ID: ") + member.user_id.slice(0, 8)}</p></div>
          <span className="status-pill">{member.membership_role}</span>
        </article>)}
        {!loading && members.length === 0 && <div className="empty-state">{ar ? "لا توجد عضويات لعرضها." : "No memberships to display."}</div>}
      </div>
      {loading && <p className="muted-note">{ar ? "جارٍ التحميل..." : "Loading…"}</p>}
    </section>

    <section className="module-panel">
      <div className="panel-heading"><span className="auth-kicker">{ar ? "دعوات الفريق" : "TEAM INVITATIONS"}</span><h2>{ar ? "دعوة عضو جديد" : "Invite a new member"}</h2><p>{ar ? "أنشئ دعوة مرتبطة ببريد إلكتروني ودور محدد. صلاحية الرابط 7 أيام." : "Create an invitation tied to an email address and role. Links expire after 7 days."}</p></div>
      {canInvite ? <form className="module-form" onSubmit={createInvitation}>
        <label>{ar ? "البريد الإلكتروني للمدعو" : "Invitee email"}<input type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></label>
        <label>{ar ? "الدور داخل المؤسسة" : "Organization role"}<select value={role} onChange={(e) => setRole(e.target.value)}>{canAppointAdmin && <option value="admin">{ar ? "مسؤول المؤسسة" : "Organization admin"}</option>}{roles.map(([value, arabic, english]) => <option key={value} value={value}>{ar ? arabic : english}</option>)}</select></label>
        <div className="form-actions"><button className="primary" disabled={saving || !email.trim()}>{saving ? (ar ? "جارٍ الإنشاء..." : "Creating…") : (ar ? "إنشاء دعوة" : "Create invitation")}</button></div>
        {inviteLink && <div className="invite-link-box"><label>{ar ? "رابط الدعوة — يظهر لك الآن لنسخه وإرساله" : "Invitation link — copy and send it now"}<input readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} /></label><button type="button" className="secondary-button" onClick={copyLink}>{ar ? "نسخ الرابط" : "Copy invitation link"}</button></div>}
      </form> : <div className="empty-state">{ar ? "إنشاء الدعوات وإلغاؤها متاحان لمالك المؤسسة أو المسؤول فقط." : "Only the organization owner or an admin can create or revoke invitations."}</div>}
      <div className="panel-heading" style={{ marginTop: 34 }}><h2>{ar ? "الدعوات المعلقة" : "Pending invitations"}</h2></div>
      <div className="record-mini-list">
        {invitations.map((inv) => <article className="request-row" key={inv.id}><div className="request-row-main"><h3>{inv.invited_email}</h3><div className="request-meta"><span>{inv.membership_role}</span><span>{ar ? "تنتهي: " : "Expires: "}{new Date(inv.expires_at).toLocaleDateString(ar ? "ar-EG" : "en-GB")}</span></div></div>{canInvite && <button type="button" className="secondary-button" onClick={() => void revokeInvitation(inv.id)}>{ar ? "إلغاء الدعوة" : "Revoke"}</button>}</article>)}
        {!loading && canInvite && invitations.length === 0 && <div className="empty-state">{ar ? "لا توجد دعوات معلقة." : "No pending invitations."}</div>}
      </div>
    </section>
    {error && <p className="error-message" role="alert">{error}</p>}
    {notice && <p className="success-message" role="status">{notice}</p>}
    <p className="field-note">{ar ? "ملاحظة أمنية: لا تشارك رابط الدعوة إلا مع البريد المحدد. قبول الدعوة يتطلب تسجيل الدخول بالبريد نفسه. إرسال البريد الآلي غير مفعّل في هذه المرحلة." : "Security note: share the invitation link only with the specified email. Acceptance requires signing in with that same email. Automated invitation email is not enabled in this phase."}</p>
    <div><Link href="/workspace" className="back-link">{ar ? "العودة إلى مساحة العمل ←" : "← Back to workspace"}</Link></div>
  </div>;
}
