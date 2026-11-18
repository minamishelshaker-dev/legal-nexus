import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import "../auth.css";

const areas = [
  ["01", "Organization & governance", "Entities, departments, roles and responsibilities", null],
  ["02", "Contract lifecycle", "Contract records, reviews, approvals and renewals", null],
  ["03", "Legal matters", "Cases, disputes, hearings and deadlines", null],
  ["04", "Investigations", "Administrative investigations, evidence and decisions", null],
  ["05", "Legal requests", "Internal requests, routing and approvals", "/workspace/requests"],
  ["06", "Documents & obligations", "Secure records, retention and reminders", null],
] as const;

export default async function WorkspacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships, error } = await supabase.from("organization_memberships")
    .select("id, organization_id, membership_role").eq("user_id", user.id).eq("status", "active").limit(10);
  if (error) throw new Error("Unable to load your organization access.");
  if (!memberships?.length) redirect("/onboarding");
  const { data: organization } = await supabase.from("organizations").select("name")
    .eq("id", memberships[0].organization_id).maybeSingle();

  return (
    <main className="workspace-shell">
      <header className="workspace-header"><Link href="/" className="auth-brand"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></Link><div className="workspace-user"><span>{user.email}</span><SignOutButton /></div></header>
      <section className="workspace-hero"><div className="auth-kicker">CORPORATE LEGAL OPERATIONS</div><h1>Your legal workspace.</h1><p>{organization?.name || "Your organization"} · {memberships.length} active organization membership{memberships.length === 1 ? "" : "s"}.</p></section>
      <section className="module-grid" aria-label="Legal Nexus modules">
        {areas.map(([number, title, description, href]) => <article className={`module-card ${href ? "module-card-active" : ""}`} key={number}><span className="module-number">{number}</span><h2>{title}</h2><p>{description}</p>{href ? <Link className="module-link" href={href}>Open module <span>→</span></Link> : <span className="module-state">MODULE UI IN PROGRESS</span>}</article>)}
      </section>
      <footer className="auth-foot">LEGAL NEXUS · THE OPERATING SYSTEM FOR CORPORATE LEGAL DEPARTMENTS</footer>
    </main>
  );
}
