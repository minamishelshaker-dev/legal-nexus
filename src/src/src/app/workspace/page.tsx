import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
export default async function WorkspacePage() {
 const supabase=await createClient();
 const {data:claimsData}=await supabase.auth.getClaims();
 const claims=claimsData?.claims;
 const userId=typeof claims?.sub==="string"?claims.sub:null;
 if(!userId) redirect("/login");
 const email=typeof claims?.email==="string"?claims.email:"Signed-in user";
 const {data:memberships}=await supabase.from("organization_memberships").select("id,membership_role,status,organization_id").eq("user_id",userId).eq("status","active").limit(5);
 if(!memberships?.length) redirect("/onboarding");
 return <main className="workspace-shell"><header><div className="auth-brand"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></div><SignOutButton/></header><section className="workspace-card"><div className="auth-kicker">SECURE WORKSPACE</div><h1>Welcome to Legal Nexus.</h1><p>You are signed in as <strong>{email}</strong>.</p><div className="workspace-status">Your account is linked to {memberships.length} active organization membership(s). Your organization workspace is ready for the next configuration stage.</div><Link href="/onboarding" className="auth-home">Manage organization setup</Link></section><div className="auth-foot">ACCOUNT ACCESS IS ACTIVE Â· BUSINESS MODULES ARE BEING ENABLED IN STAGES</div></main¶»§q«^