import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "@/components/onboarding-form";
import SignOutButton from "@/components/sign-out-button";
import "../auth.css";
export default async function OnboardingPage() {
 const supabase=await createClient();
 const {data:claimsData}=await supabase.auth.getClaims();
 const userId=typeof claimsData?.claims?.sub==="string"?claimsData.claims.sub:null;
 if(!userId) redirect("/login");
 const {data:memberships}=await supabase.from("organization_memberships").select("id").eq("user_id",userId).eq("status","active").limit(1);
 if(memberships?.length) redirect("/workspace");
 return <main className="auth-shell"><header className="onboard-header"><div className="auth-brand"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></div><SignOutButton/></header><section className="auth-panel"><div className="auth-kicker">ORGANIZATION SETUP · STEP 1</div><h1>Create your legal workspace.</h1><p>Set up your organization. Your account will become its first owner, and you can invite colleagues after the workspace is created.</p><OnboardingForm/><div className="auth-switch">This is a first-time setup for your organization.</div><Link className="auth-home" href="/">← Back to platform</Link></section><div className="auth-foot">YOUR ORGANIZATION DATA IS ISOLATED FROM OTHER WORKSPACES</div></main>;
}