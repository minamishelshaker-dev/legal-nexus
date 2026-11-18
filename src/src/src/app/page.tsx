const modules = [
  ["01","Corporate governance","Entities, authority matrix, departments and responsibilities"],
  ["02","Contract lifecycle","Drafting, review, approvals, obligations and renewals"],
  ["03","Legal matters","Cases, disputes, hearings, deadlines and external counsel"],
  ["04","Administrative investigations","Complaints, investigation records, recommendations, decisions and grievances"],
  ["05","Compliance & risk","Regulatory obligations, controls, policies and legal risk register"],
  ["06","Legal operations","Requests, workflows, knowledge, reporting and performance"],
];
export default function Home() {
 return <main className="shell">
  <nav className="nav">
   <div className="brand"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></div>
   <span className="nav-note">CORPORATE LEGAL OPERATING SYSTEM</span>
   <div className="nav-actions"><a className="nav-login" href="/login">Sign in</a><a className="nav-join" href="/signup">Create account</a></div>
  </nav>
  <section className="hero">
   <div className="eyebrow">THE LEGAL DEPARTMENT, CONNECTED</div>
   <h1>Clarity for legal work.<br/><em>Control for the business.</em></h1>
   <p className="intro">One operating system to organize legal teams, manage corporate obligations, and bring every legal workflow into focus.</p>
   <div className="hero-actions"><a href="/signup" className="primary">Start with Legal Nexus <span>â†—</span></a><a href="/login" className="secondary">Already have an acco¶»§q«^