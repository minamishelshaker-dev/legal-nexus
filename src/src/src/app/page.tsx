import Link from "next/link";
import { getLocale } from "@/lib/locale";
import LanguageSwitcher from "@/components/language-switcher";
import ThemeToggle from "@/components/theme-toggle";
import { BrandLockup } from "@/components/brand";
import { Icon } from "@/components/icons";
import "./landing.css";

const COPY = {
  ar: {
    navModules: "الوحدات",
    navWhy: "لماذا Legal Nexus",
    navSecurity: "الأمان",
    login: "تسجيل الدخول",
    start: "أنشئ مؤسستك",
    kicker: "نظام تشغيل للإدارات القانونية",
    title: "كل ما تحتاجه إدارتك القانونية في مساحة عمل واحدة مترابطة.",
    sub: "طلبات قانونية وعقود وقضايا وتحقيقات ومواعيد ومصروفات ومحادثات فريق… كلها معزولة بشكل كامل لكل مؤسسة، وبصلاحيات دقيقة لكل دور، وبواجهة عربية وإنجليزية.",
    ctaPrimary: "ابدأ الآن",
    ctaSecondary: "استكشف الوحدات",
    mockCaption: "عرض توضيحي للواجهة",
    mockKpis: ["طلبات مفتوحة", "بانتظار اعتمادك", "عقود تنتهي قريباً"],
    mockRows: ["مراجعة عقد توريد", "جلسة المحكمة الاقتصادية", "تجديد ترخيص النشاط"],
    modulesTitle: "وحدات متكاملة تعمل معاً",
    modulesSub: "كل وحدة ترتبط بالأخرى: الطلب يتحوّل إلى عقد أو قضية، والقضية تحمل جلساتها وتكلفتها، والمواعيد تظهر في تقويم واحد وإشعارات لحظية.",
    modules: [
      ["inbox", "الطلبات القانونية والموافقات", "بوابة طلبات لكل أعضاء الشركة، ومسارات اعتماد متسلسلة وتعليقات وتحويل بنقرة إلى عقد أو قضية."],
      ["contract", "العقود والقوالب والإصدارات", "سجل عقود، قوالب معتمدة ومكتبة بنود، مسودات بإصدارات مع مقارنة التعديلات وتنبيهات الانتهاء."],
      ["scale", "القضايا والجلسات والتقويم", "ملفات القضايا والمنازعات مع الجلسات والمواعيد النهائية، وتقويم موحّد بالتاريخ الهجري."],
      ["coins", "الإنفاق القانوني والمحامون الخارجيون", "تسجيل الوقت والمصروفات لكل قضية، ميزانيات واعتمادات، وتقارير بحسب القضية والمكتب والشهر."],
      ["shield", "التحقيقات الإدارية", "جلسات وإفادات وأدلة بسلسلة حيازة ومحاضر محصّنة وتوصيات وقرارات وتظلّمات."],
      ["badge", "الموظفون والملفات السرية", "سجل موظفين وتعيينات وتنقلات ومستندات سرية، كل عرض أو تغيير مُدقّق."],
      ["folder", "المستندات والالتزامات", "ملفات بتصنيف سرية وتخزين خاص، والتزامات مرتبطة بالعقود والقضايا مع تنبيهات الاستحقاق."],
      ["chat", "المحادثات والإشعارات", "قنوات ورسائل مباشرة بين أعضاء شركتك فقط، وإشعارات لحظية بكل ما يحتاج متابعة."],
      ["filter", "البحث واللوحات", "بحث موحّد مع فلاتر عبر كل السجلات، ولوحة تحكم حية تعرض ما يحتاج انتباهك اليوم."],
    ],
    whyTitle: "لماذا Legal Nexus؟",
    why: [
      ["مصمّم للتعاون", "محادثات وإشعارات لحظية وتقويم مشترك داخل النظام نفسه، لا في تطبيقات منفصلة."],
      ["تحقيقات وملفات سرية بمستوى مؤسسي", "سلسلة حيازة للأدلة، محاضر لا تُعدّل بعد اعتمادها، وصلاحيات منفصلة للموارد البشرية والمحققين."],
      ["عربي أولاً", "واجهة عربية وإنجليزية كاملة، وتاريخ هجري، وقوالب باللغتين يراجعها محامك قبل الاعتماد."],
      ["منصة تنمو معك", "جزء من رؤية Nexus: تطبيقات مستقلة تتعاون عبر هوية موحّدة."],
    ],
    secTitle: "الأمان من الأساس",
    sec: [
      "عزل كل مؤسسة عن غيرها مفروض في قاعدة البيانات نفسها، لا في واجهة التطبيق فقط.",
      "اختبار عزل قابل للإعادة يحاول اختراق بيانات مؤسسة أخرى بالقراءة والكتابة واستدعاء الدوال.",
      "صلاحيات لكل دور: الوحدات الحساسة متاحة لمن يحق له فقط.",
      "سجل تدقيق للعمليات الحساسة، وملفات مخزّنة في مساحات خاصة بروابط مؤقتة.",
    ],
    ctaTitle: "جاهز لتنظيم شؤونك القانونية؟",
    ctaSub: "أنشئ مؤسستك وادعُ فريقك وابدأ بتسجيل أول طلب أو عقد اليوم.",
    foot: "Legal Management & Enterprise Solutions",
  },
  en: {
    navModules: "Modules",
    navWhy: "Why Legal Nexus",
    navSecurity: "Security",
    login: "Sign in",
    start: "Create your organization",
    kicker: "The operating system for corporate legal departments",
    title: "Everything your legal department needs, in one connected workspace.",
    sub: "Legal requests, contracts, matters, investigations, deadlines, spend and team chat — fully isolated per organization, with precise role-based access and a complete Arabic and English interface.",
    ctaPrimary: "Get started",
    ctaSecondary: "Explore modules",
    mockCaption: "Illustrative preview",
    mockKpis: ["Open requests", "Awaiting your approval", "Contracts expiring soon"],
    mockRows: ["Supplier agreement review", "Commercial court hearing", "Business licence renewal"],
    modulesTitle: "Integrated modules that work together",
    modulesSub: "Every module connects to the next: a request becomes a contract or a matter, a matter carries its hearings and cost, and every date lands in one calendar with real-time alerts.",
    modules: [
      ["inbox", "Legal requests & approvals", "A request portal for everyone in the company, sequential approval routes, comments and one-click conversion into a contract or matter."],
      ["contract", "Contracts, templates & versions", "Contract register, approved templates and clause library, versioned drafts with change comparison and expiry alerts."],
      ["scale", "Matters, hearings & calendar", "Matter files with hearings and deadlines, and a unified calendar with Hijri dates."],
      ["coins", "Legal spend & outside counsel", "Time and expenses per matter, budgets and approvals, and reports by matter, firm and month."],
      ["shield", "Administrative investigations", "Sessions, statements, evidence with chain of custody, locked minutes, recommendations, decisions and appeals."],
      ["badge", "Employees & confidential files", "Employee register, hiring, transfers and confidential documents — every view and change audited."],
      ["folder", "Documents & obligations", "Files with confidentiality classes and private storage; obligations linked to contracts and matters with due-date alerts."],
      ["chat", "Chat & notifications", "Channels and direct messages for your own colleagues only, and real-time alerts for everything that needs follow-up."],
      ["filter", "Search & dashboards", "Unified search with filters across all records and a live dashboard showing what needs your attention today."],
    ],
    whyTitle: "Why Legal Nexus?",
    why: [
      ["Built for collaboration", "Real-time chat, alerts and a shared calendar inside the system itself, not in separate apps."],
      ["Enterprise-grade investigations & confidential files", "Evidence chain of custody, minutes locked after approval, and separate permissions for HR and investigators."],
      ["Arabic first", "Full Arabic and English interface, Hijri calendar, and bilingual templates your lawyer reviews before approval."],
      ["A platform that grows with you", "Part of the Nexus vision: independent applications cooperating through a unified identity."],
    ],
    secTitle: "Security from the ground up",
    sec: [
      "Organization isolation is enforced in the database itself, not only in the application UI.",
      "A repeatable isolation test attempts to read and write another organization's data and call its functions.",
      "Role-based access: sensitive modules are available only to those who need them.",
      "Audit trail for sensitive operations, and files kept in private storage with short-lived links.",
    ],
    ctaTitle: "Ready to organize your legal affairs?",
    ctaSub: "Create your organization, invite your team and register your first request or contract today.",
    foot: "Legal Management & Enterprise Solutions",
  },
} as const;

export default async function Home() {
  const lang = await getLocale();
  const c = COPY[lang];
  const ar = lang === "ar";

  return (
    <main className={"land " + (ar ? "is-ar" : "")} dir={ar ? "rtl" : "ltr"}>
      <header className="land-nav">
        <Link href="/" aria-label="Legal Nexus">
          <BrandLockup size={38} />
        </Link>
        <nav className="land-links" aria-label="Sections">
          <a href="#modules">{c.navModules}</a>
          <a href="#why">{c.navWhy}</a>
          <a href="#security">{c.navSecurity}</a>
        </nav>
        <div className="land-actions">
          <ThemeToggle lang={lang} />
          <LanguageSwitcher lang={lang} />
          <Link href="/login" className="land-btn">
            {c.login}
          </Link>
          <Link href="/signup" className="land-btn gold">
            {c.start}
          </Link>
        </div>
      </header>

      <section className="land-hero">
        <div className="land-hero-text">
          <span className="land-kicker">{c.kicker}</span>
          <h1>{c.title}</h1>
          <p className="land-sub">{c.sub}</p>
          <div className="land-cta">
            <Link href="/signup" className="land-btn gold big">
              {c.ctaPrimary} <Icon name="arrow" size={16} />
            </Link>
            <a href="#modules" className="land-btn big">
              {c.ctaSecondary}
            </a>
          </div>
        </div>

        <div className="land-mock" aria-hidden="true">
          <div className="mock-bar">
            <i />
            <i />
            <i />
            <span>{c.mockCaption}</span>
          </div>
          <div className="mock-kpis">
            {c.mockKpis.map((k, i) => (
              <div key={k}>
                <small>{k}</small>
                <b>{[12, 3, 5][i]}</b>
              </div>
            ))}
          </div>
          <div className="mock-rows">
            {c.mockRows.map((r, i) => (
              <div key={r}>
                <span>{r}</span>
                <em className={i === 0 ? "warn" : i === 1 ? "gold" : ""}>{["3d", "5d", "12d"][i]}</em>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="land-section">
        <h2>{c.modulesTitle}</h2>
        <p className="land-sub center">{c.modulesSub}</p>
        <div className="land-grid">
          {c.modules.map(([icon, title, desc]) => (
            <article key={title} className="land-card">
              <span className="land-icon">
                <Icon name={icon} size={20} />
              </span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="why" className="land-section alt">
        <h2>{c.whyTitle}</h2>
        <div className="land-why">
          {c.why.map(([title, desc]) => (
            <div key={title}>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="security" className="land-section">
        <h2>{c.secTitle}</h2>
        <ul className="land-sec">
          {c.sec.map((s) => (
            <li key={s}>
              <span>
                <Icon name="check" size={15} />
              </span>
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="land-final">
        <h2>{c.ctaTitle}</h2>
        <p>{c.ctaSub}</p>
        <Link href="/signup" className="land-btn gold big">
          {c.start} <Icon name="arrow" size={16} />
        </Link>
      </section>

      <footer className="land-foot">
        <BrandLockup size={28} />
        <span>{c.foot}</span>
        <span>© {new Date().getFullYear()} Legal Nexus</span>
      </footer>
    </main>
  );
}
