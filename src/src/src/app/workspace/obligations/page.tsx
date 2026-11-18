import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import ObligationBoard from "@/components/obligation-board";
import LanguageSwitcher from "@/components/language-switcher";
import { getLocale } from "@/lib/locale";
import "../../auth.css";

export default async function ObligationsPage() {
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
  return <main className={"workspace-shell " + (ar ? "is-ar" : "")} dir={ar ? "rtl" : "ltr"}>
    <header className="workspace-header"><Link href="/workspace" className="auth-brand"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></Link><div className="workspace-user"><LanguageSwitcher lang={lang}/><span>{user.email}</span><SignOutButton lang={lang}/></div></header>
    <section className="workspace-hero module-hero"><div className="auth-kicker">{ar ? "سجل الالتزامات" : "OBLIGATIONS REGISTER"}</div><h1>{ar ? "التزامات ومواعيد مؤسستك." : "Organization obligations."}</h1><p>{ar ? "تابع الاستحقاقات التعاقدية والتنظيمية ومواعيد التجديد والتقديم." : "Track contractual, regulatory, renewal and filing deadlines."}</p><Link href="/workspace" className="back-link">{ar ? "العودة إلى مساحة العمل ←" : "← Back to workspace"}</Link></section>
    <ObligationBoard organizationId={membership.organization_id} userId={user.id} membershipRole={membership.membership_role} lang={lang}/>
    <footer className="auth-foot">LEGAL NEXUS · {ar ? "إدارة الالتزامات والمواعيد" : "OBLIGATIONS & DEADLINES"}</footer>
  </main>;
}
