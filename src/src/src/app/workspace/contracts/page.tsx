import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import CoreRecords from "@/components/core-records";
import "../../auth.css";

export default async function ContractsPage() {
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login");
 const {data:membership,error}=await supabase.from("organization_memberships").select("organization_id").eq("user_id",user.id).eq("status","active").order("created_at",{ascending:true}).limit(1).maybeSingle();
 if(error) throw new Error("Unable to verify organization access.");
 if(!membership) redirect("/onboarding");
 const {data:organization}=await supabase.from("organizations").select("name").eq("id",membership.organization_id).maybeSingle();
 return <main className="workspace-shell"><header className="workspace-header"><Link href="/workspace" className="auth-brand"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></Link><div className="workspace-user"><span>{user.email}</span><SignOutButton/></div></header><section className="workspace-hero module-hero"><div className="auth-kicker">CONTRACT MANAGEMENT</div><h1>Contract management.</h1><p>{organization?.name || "Your organization"} · Register and track contracts.</p><Link href="/workspace" className="back-link">← Back to workspace</Link></section><CoreRecords mode="contracts" organizationId={membership.organization_id}/><footer className="auth-foot">LEGAL NEXUS · ORGANIZATION DATA IS PROTECTED BY ROW-LEVEL SECURITY</footer></main>;
}
