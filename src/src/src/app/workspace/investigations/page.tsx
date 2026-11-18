import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import LanguageSwitcher from "@/components/language-switcher";
import Investigations from "@/components/investigations";
import {getLocale} from "@/lib/locale";
import "../../auth.css";

export default async function InvestigationsPage(){
 const lang=await getLocale();const ar=lang==="ar";const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:membership,error}=await supabase.from("organization_memberships").select("organization_id,membership_role").eq("user_id",user.id).eq("status","active").order("created_at",{ascending:true}).limit(1).maybeSingle();
 if(error)throw new Error("Unable to verify your organization access.");if(!membership)redirect("/onboarding");
 const{data:organization}=await supabase.from("organizations").select("name").eq("id",membership.organization_id).maybeSingle();
 const canCreate=["owner","admin","legal_manager","lawyer","hr_investigator"].includes(membership.membership_role);\n const canDecide=["owner","admin"].includes(membership.membership_role);
 return <main className={"workspace-shell "+(ar?"is-ar":"")} dir={ar?"rtl":"ltr"}>
  <header className="workspace-header"><Link href="/workspace" className="auth-brand"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></Link><div className="workspace-user"><LanguageSwitcher lang={lang}/><span>{user.email}</span><SignOutButton lang={lang}/></div></header>
  <section className="workspace-hero module-hero"><div className="auth-kicker">{ar?"الموارد البشرية والشؤون القانونية / التحقيقات":"HR & LEGAL OPERATIONS / INVESTIGATIONS"}</div><h1>{ar?"التحقيقات الإدارية.":"Administrative investigations."}</h1><p>{organization?.name||(ar?"مؤسستك":"Your organization")} · {ar?"تسجيل البلاغات وإدارة ملفات التحقيق بسرية.":"Register reports and manage confidential investigation files."}</p><Link href="/workspace" className="back-link">{ar?"العودة إلى مساحة العمل ←":"← Back to workspace"}</Link></section>
  <Investigations organizationId={membership.organization_id} userId={user.id} canCreate={canCreate} canDecide={canDecide} lang={lang}/>
  <footer className="auth-foot">LEGAL NEXUS · {ar?"السرية وصلاحيات الوصول تطبق على مستوى قاعدة البيانات":"CONFIDENTIALITY AND ACCESS CONTROL ARE ENFORCED AT DATABASE LEVEL"}</footer>
 </main>;
}
