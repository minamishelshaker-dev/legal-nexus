import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import CoreRecordDetail from "@/components/core-record-detail";
import ContractDrafts from "@/components/contract-drafts";
import LinkedObligations from "@/components/linked-obligations";
import SourceRequest from "@/components/source-request";
import LanguageSwitcher from "@/components/language-switcher";
import { getLocale } from "@/lib/locale";
import "../../../auth.css";
import "../../../people.css";
import "../../../templates.css";
import "../../investigations/investigations.css";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await getLocale();
  const ar = lang === "ar";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership, error } = await supabase.from("organization_memberships")
    .select("organization_id,membership_role")
    .eq("user_id", user.id).eq("status", "active")
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error("Unable to verify organization access.");
  if (!membership) redirect("/onboarding");
  const canManage = ["owner", "admin", "legal_manager", "lawyer", "contract_manager"].includes(membership.membership_role);
  return <main className={"workspace-shell " + (ar ? "is-ar" : "")} dir={ar ? "rtl" : "ltr"}>
    <header className="workspace-header">
      <Link href="/workspace" className="auth-brand"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></Link>
      <div className="workspace-user"><LanguageSwitcher lang={lang}/><span>{user.email}</span><SignOutButton lang={lang}/></div>
    </header>
    <section className="workspace-hero module-hero"><div className="auth-kicker">{ar ? "إدارة العقود" : "CONTRACT MANAGEMENT"}</div><h1>{ar ? "تفاصيل العقد." : "Contract details."}</h1><SourceRequest recordType="contract" recordId={id} lang={lang}/></section>
    <CoreRecordDetail mode="contracts" organizationId={membership.organization_id} recordId={id} membershipRole={membership.membership_role} lang={lang}/>
    <ContractDrafts organizationId={membership.organization_id} contractId={id} canEdit={canManage} lang={lang}/>
    <LinkedObligations organizationId={membership.organization_id} recordType="contract" recordId={id} canManage={canManage} lang={lang}/>
    <footer className="auth-foot">LEGAL NEXUS · {ar ? "سجل العقد" : "CONTRACT RECORD"}</footer>
  </main>;
}
