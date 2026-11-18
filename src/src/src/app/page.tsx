const modules = [
  ["01", "Corporate governance", "Entities, authority matrix, departments and responsibilities"],
  ["02", "Contract lifecycle", "Drafting, review, approvals, obligations and renewals"],
  ["03", "Legal matters", "Cases, disputes, hearings, deadlines and external counsel"],
  ["04", "Administrative investigations", "Complaints, investigation records, recommendations and decisions"],
  ["05", "Compliance & risk", "Regulatory obligations, controls, policies and legal risk"],
  ["06", "Legal operations", "Requests, workflows, knowledge and performance reporting"],
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav">
        <a className="brand" href="/"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></a>
        <span className="nav-note">CORPORATE LEGAL OPERATING SYSTEM</span>
        <div className="nav-actions"><a className="nav-login" href="/login">Sign in</a><a className="nav-join" href="/signup">Create account</a></div>
      </nav>
      <section className="hero">
        <div className="eyebrow">THE LEGAL DEPARTMENT, CONNECTED</div>
        <h1>Clarity for legal work.<br /><em>Control for the business.</em></h1>
        <p className="intro">One operating system to organize legal teams, manage corporate obligations, and bring every legal workflow into focus.</p>
        <div className="hero-actions"><a href="/signup" className="primary">Start with Legal Nexus <span>↗</span></a><a href="/login" className="secondary">Already have an account?</a></div>
        <div className="hero-note"><span className="note-line" /> BUILT FOR MODERN CORPORATE LEGAL TEAMS</div>
      </section>
      <section className="modules-section">
        <div className="section-head"><div><div className="eyebrow">ONE CONNECTED ENVIRONMENT</div><h2>Every legal workflow.<br /><em>One source of control.</em></h2></div><p>Bring your department's work, knowledge and decisions into one structured workspace.</p></div>
        <div className="modules-grid">{modules.map(([number, title, description]) => <article className="public-module" key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>
      <footer className="site-footer"><span>LEGAL NEXUS</span><span>THE OPERATING SYSTEM FOR CORPORATE LEGAL DEPARTMENTS</span></footer>
    </main>
  );
}
