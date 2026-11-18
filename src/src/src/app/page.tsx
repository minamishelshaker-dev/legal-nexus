import Link from "next/link";
import { cookies } from "next/headers";
import LanguageSwitcher from "@/components/language-switcher";
import "./globals.css";

const en = {
  nav:"THE CORPORATE LEGAL OPERATING SYSTEM", login:"Sign in", signup:"Create account",
  eyebrow:"THE OPERATING SYSTEM FOR CORPORATE LEGAL DEPARTMENTS",
  title1:"Your legal department.", title2:"Under control.",
  intro:"Legal Nexus brings your corporate legal work into one connected environment — from contracts and disputes to investigations, compliance and day-to-day legal requests.",
  start:"Explore your workspace", discover:"Discover the platform",
  capabilities:"A connected legal department", capIntro:"One platform to organize people, processes, documents and decisions — with visibility and accountability across your organization.",
  services:[
   ["01","Organization & governance","Structure your legal department, entities, departments, roles, responsibilities and approval authority."],
   ["02","Contract lifecycle management","Register contracts, coordinate reviews, track status, obligations, key dates and renewals."],
   ["03","Cases & legal matters","Organize disputes and legal matters, follow hearings, deadlines, case records and legal actions."],
   ["04","Administrative investigations","Manage referrals, investigation sessions, statements, evidence, minutes, recommendations, decisions and grievances."],
   ["05","Legal requests & approvals","Receive internal legal requests, route them for review and manage sequential approvals."],
   ["06","Documents & records","Keep legal records organized with controlled access and a structured document history."],
   ["07","Compliance & legal risk","Build a foundation for regulatory obligations, policies, controls and legal risk monitoring."],
   ["08","External counsel & legal knowledge","Coordinate external advisors and build a searchable institutional legal knowledge base."]
  ],
  workflow:"Designed around the way legal teams work", workflowIntro:"Connect legal work from the first request through review, decision, execution and follow-up.",
  steps:[["Capture","Receive a request, contract, case or investigation referral."],["Coordinate","Assign responsibilities, route approvals and collaborate securely."],["Track","Follow deadlines, status, obligations and the complete activity history."],["Report","Give decision-makers a clearer view of legal workload and progress."]],
  audience:"For organizations that take legal operations seriously", audienceIntro:"A flexible foundation for companies and institutions of different sizes and sectors.",
  audiences:["Companies and corporate groups","Legal departments and in-house counsel","Compliance, HR and risk teams","Institutions managing contracts and disputes"],
  trust:"Built for controlled, accountable legal operations", trustIntro:"Organization-level data separation, role-based access and database-enforced security policies form the foundation. Advanced controls and integrations will be introduced in subsequent product stages.",
  cta:"Bring your legal work together.", ctaIntro:"Create your organization's workspace and start building a more structured legal operation.",
  footer:"THE OPERATING SYSTEM FOR CORPORATE LEGAL DEPARTMENTS",
  disclaimer:"The platform is under active development. Some capabilities described are planned and are not yet available in the current release."
};
const ar = {
  nav:"نظام التشغيل للإدارات القانونية بالشركات", login:"تسجيل الدخول", signup:"إنشاء حساب",
  eyebrow:"نظام التشغيل المتكامل للإدارات القانونية بالشركات والمؤسسات",
  title1:"إدارتك القانونية.", title2:"تحت السيطرة.",
  intro:"يجمع Legal Nexus أعمال الإدارة القانونية في بيئة رقمية مترابطة؛ بدءاً من العقود والمنازعات، مروراً بالتحقيقات والالتزام، وصولاً إلى الطلبات القانونية اليومية.",
  start:"ابدأ مساحة عملك", discover:"اكتشف المنصة",
  capabilities:"منظومة مترابطة للإدارة القانونية", capIntro:"منصة واحدة لتنظيم الأفراد والإجراءات والمستندات والقرارات، مع وضوح المسؤوليات وإمكانية متابعة الأعمال داخل المؤسسة.",
  services:[
   ["01","تأسيس وتنظيم الإدارة القانونية","تنظيم هيكل الإدارة القانونية والكيانات والإدارات والأدوار والمسؤوليات وصلاحيات الاعتماد."],
   ["02","إدارة دورة حياة العقود","تسجيل العقود وتنسيق مراجعتها ومتابعة حالتها والتزاماتها ومواعيدها وتجديدها."],
   ["03","القضايا والمنازعات القانونية","تنظيم ملفات القضايا والمنازعات ومتابعة الجلسات والمواعيد والإجراءات القانونية."],
   ["04","التحقيقات الإدارية والجزاءات","إدارة الإحالات وجلسات التحقيق والأقوال والأدلة والمحاضر والتوصيات والقرارات والتظلمات."],
   ["05","الطلبات القانونية والموافقات","استقبال طلبات الإدارات المختلفة وتوجيهها للمراجعة وإدارة مسارات الموافقات المتتابعة."],
   ["06","المستندات والسجلات القانونية","تنظيم السجلات والمستندات القانونية وإتاحة الوصول إليها وفق الصلاحيات وسجل منظم للملفات."],
   ["07","الالتزام والمخاطر القانونية","بناء منظومة لمتابعة الالتزامات التنظيمية والسياسات والضوابط والمخاطر القانونية."],
   ["08","المستشارون الخارجيون والمعرفة القانونية","تنسيق العمل مع المستشارين الخارجيين وبناء قاعدة معرفة قانونية مؤسسية قابلة للبحث."]
  ],
  workflow:"مصممة وفقاً لطريقة عمل الإدارات القانونية", workflowIntro:"اربط دورة العمل القانوني من لحظة تقديم الطلب وحتى المراجعة والقرار والتنفيذ والمتابعة.",
  steps:[["استقبال","استقبل طلباً قانونياً أو عقداً أو قضية أو إحالة للتحقيق."],["تنسيق","وزع المسؤوليات ومرر الموافقات ومكّن التعاون المنظم."],["متابعة","تابع المواعيد والحالات والالتزامات وسجل الأنشطة."],["تقارير","امنح متخذي القرار رؤية أوضح لحجم العمل القانوني ومعدلات الإنجاز."]],
  audience:"للمؤسسات التي تسعى إلى إدارة قانونية أكثر كفاءة", audienceIntro:"بنية مرنة تناسب الشركات والمؤسسات باختلاف أحجامها وقطاعاتها.",
  audiences:["الشركات ومجموعات الشركات","الإدارات القانونية والمستشارون الداخليون","فرق الالتزام والموارد البشرية وإدارة المخاطر","المؤسسات التي تدير العقود والمنازعات"],
  trust:"مصممة لإدارة قانونية منضبطة وقابلة للمساءلة", trustIntro:"يعتمد الأساس التقني على فصل بيانات المؤسسات، والصلاحيات حسب الأدوار، وسياسات حماية مطبقة على مستوى قاعدة البيانات. وستضاف الضوابط والتكاملات المتقدمة في مراحل التطوير التالية.",
  cta:"اجمع أعمالك القانونية في مكان واحد.", ctaIntro:"أنشئ مساحة عمل مؤسستك وابدأ في بناء إدارة قانونية أكثر تنظيماً.",
  footer:"نظام التشغيل للإدارات القانونية بالشركات والمؤسسات",
  disclaimer:"المنصة قيد التطوير النشط. بعض الإمكانات الموضحة مخطط لها وليست متاحة بعد في الإصدار الحالي."
};
export default async function Home(){
 const jar=await cookies(); const lang=jar.get("ln_lang")?.value==="ar"?"ar":"en"; const t=lang==="ar"?ar:en;
 return <main className={"shell "+(lang==="ar"?"is-ar":"")} dir={lang==="ar"?"rtl":"ltr"}>
  <nav className="nav"><Link className="brand" href="/"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></Link><span className="nav-note">{t.nav}</span><div className="nav-actions"><LanguageSwitcher lang={lang}/><Link className="nav-login" href="/login">{t.login}</Link><Link className="nav-join" href="/signup">{t.signup}</Link></div></nav>
  <section className="hero"><div className="eyebrow">{t.eyebrow}</div><h1>{t.title1}<br/><em>{t.title2}</em></h1><p className="intro">{t.intro}</p><div className="hero-actions"><Link href="/signup" className="primary">{t.start} <span>↗</span></Link><a href="#capabilities" className="secondary">{t.discover}</a></div><div className="hero-note"><span className="note-line"/> {t.nav}</div></section>
  <section className="modules-section" id="capabilities"><div className="section-head"><div><div className="eyebrow">LEGAL NEXUS</div><h2>{t.capabilities}</h2></div><p>{t.capIntro}</p></div><div className="modules-grid">{t.services.map(([number,title,description])=><article className="public-module" key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>
  <section className="story-section"><div className="section-head"><div><div className="eyebrow">CONNECTED WORKFLOWS</div><h2>{t.workflow}</h2></div><p>{t.workflowIntro}</p></div><div className="steps-grid">{t.steps.map(([title,desc],i)=><article className="step-card" key={title}><span>0{i+1}</span><h3>{title}</h3><p>{desc}</p></article>)}</div></section>
  <section className="audience-section"><div className="section-head"><div><div className="eyebrow">BUILT FOR ORGANIZATIONS</div><h2>{t.audience}</h2></div><p>{t.audienceIntro}</p></div><div className="audience-list">{t.audiences.map(x=><div key={x}><span>↗</span>{x}</div>)}</div></section>
  <section className="trust-section"><div className="eyebrow">SECURITY & ACCOUNTABILITY</div><h2>{t.trust}</h2><p>{t.trustIntro}</p></section>
  <section className="closing-cta"><div><div className="eyebrow">LEGAL NEXUS</div><h2>{t.cta}</h2><p>{t.ctaIntro}</p></div><Link href="/signup" className="primary">{t.signup} <span>↗</span></Link></section>
  <footer className="site-footer"><span>LEGAL NEXUS</span><span>{t.footer}</span><small>{t.disclaimer}</small></footer>
 </main>;
}
