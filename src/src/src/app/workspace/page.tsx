import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import "../auth.css";

const areas = [
  ["01", "Organization & governance", "Entities, departments, roles and responsibilities"],
  ["02", "Contract lifecycle", "Contract records, reviews, approvals and renewals"],
  ["03", "Legal matters", "Cases, disputes, hearings and deadlines"],
  ["04", "Investigations", "Administrative investigations, evidence and decisions"],
  ["05", "Legal requests", "Internal requests, routing and approvals"],
  ["06", "Documents & obligations", "Secure records, retention and reminders"],
];

export default async function WorkspacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("id, organization_id, membership_role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(10);

  if (error) throw new Error("Unable to load your organization access.");
  if (!memberships?.length) redirect("/onboarding");

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <Link href="/" className="auth-brand"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></Link>
        <div className="workspace-user"><span>{user.email}</span><SignOutButton /></div>
      </header>
      <section className="workspace-hero">
        <div className="auth-kicker">CORPORATE LEGAL OPERATIONS</div>
        <h1>Your legal workspace.</h1>
        <p>Secure access is active. Your account is connected to {memberships.length} organization membership{memberships.length === 1 ? "" : "s"}.</p>
      </section>
      <section className="module-grid" aria-label="Legal Nexus modules">
        {areas.map(([number, title, description]) => (
          <article className="module-card" key={number}>
            <span className="module-number">{number}</span>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="module-state">FOUNDATION READY · MODULE UI IN PROGRESS</span>
          </article>
        ))}
      </section>
      <footer className="auth-foot">LEGAL NEXUS · THE OPERATING SYSTEM FOR CORPORATE LEGAL DEPARTMENTS</footer>
    </main>
  );
}
