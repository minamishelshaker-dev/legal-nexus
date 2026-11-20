import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale";
import { Icon } from "@/components/icons";
import { canOpen, ROLE_LABELS } from "@/lib/access";
import type { ModuleKey } from "@/lib/access";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function head(query: any): Promise<number | null> {
  const r = await query;
  return r.error ? null : (r.count ?? 0);
}

const OPEN_REQUESTS = ["submitted", "under_review", "awaiting_information", "pending_approval", "approved"];
const ACTIVE_CONTRACTS = ["approved", "signed", "active"];
const ACTIVE_MATTERS = ["open", "pending", "on_hold"];
const OPEN_OBLIGATIONS = ["open", "in_progress"];

const REQUEST_STATUS: Record<string, { ar: string; en: string; tone: string }> = {
  submitted: { ar: "مقدّم", en: "Submitted", tone: "gold" },
  under_review: { ar: "قيد المراجعة", en: "Under review", tone: "gold" },
  awaiting_information: { ar: "بانتظار معلومات", en: "Awaiting info", tone: "warn" },
  pending_approval: { ar: "بانتظار الاعتماد", en: "Pending approval", tone: "warn" },
  approved: { ar: "معتمد", en: "Approved", tone: "ok" },
  rejected: { ar: "مرفوض", en: "Rejected", tone: "danger" },
  completed: { ar: "مكتمل", en: "Completed", tone: "ok" },
  cancelled: { ar: "ملغى", en: "Cancelled", tone: "" },
};

function daysFrom(date: string): number {
  const target = new Date(date + "T00:00:00Z").getTime();
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86400000);
}

export default async function WorkspacePage() {
  const lang = await getLocale();
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id,membership_role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const org: string = membership.organization_id;
  const role: string = membership.membership_role;
  const can = (m: ModuleKey) => canOpen(m, role);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in90 = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10);
  const count = (table: string) => supabase.from(table).select("id", { count: "exact", head: true });

  const [
    organization,
    openRequests,
    pendingApprovals,
    expiringContracts,
    activeMatters,
    overdueObligations,
    openInvestigations,
    entities,
    departments,
    memberCount,
    invitations,
    requestTotal,
    contractTotal,
    obligationTotal,
    obligationsList,
    contractsList,
    requestsList,
  ] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", org).maybeSingle(),
    head(count("legal_requests").eq("organization_id", org).in("status", OPEN_REQUESTS)),
    head(
      count("legal_request_approvals")
        .eq("status", "pending")
        .or(`approver_user_id.eq.${user.id},approver_role.eq.${role}`),
    ),
    can("contracts")
      ? head(
          count("contracts")
            .eq("organization_id", org)
            .in("status", ACTIVE_CONTRACTS)
            .gte("end_date", today)
            .lte("end_date", in90),
        )
      : Promise.resolve(null),
    can("matters")
      ? head(count("legal_matters").eq("organization_id", org).in("status", ACTIVE_MATTERS))
      : Promise.resolve(null),
    head(count("obligations").eq("organization_id", org).in("status", OPEN_OBLIGATIONS).lt("due_date", today)),
    can("investigations")
      ? head(count("administrative_investigations").eq("organization_id", org).not("status", "in", "(closed,archived)"))
      : Promise.resolve(null),
    head(count("corporate_entities").eq("organization_id", org)),
    head(count("departments").eq("organization_id", org)),
    head(count("organization_memberships").eq("organization_id", org)),
    can("members") ? head(count("organization_invitations").eq("organization_id", org)) : Promise.resolve(null),
    head(count("legal_requests").eq("organization_id", org)),
    can("contracts") ? head(count("contracts").eq("organization_id", org)) : Promise.resolve(null),
    head(count("obligations").eq("organization_id", org)),
    supabase
      .from("obligations")
      .select("id,title,due_date,priority,status")
      .eq("organization_id", org)
      .in("status", OPEN_OBLIGATIONS)
      .order("due_date", { ascending: true })
      .limit(6),
    can("contracts")
      ? supabase
          .from("contracts")
          .select("id,title,counterparty_name,end_date")
          .eq("organization_id", org)
          .in("status", ACTIVE_CONTRACTS)
          .gte("end_date", today)
          .lte("end_date", in90)
          .order("end_date", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("legal_requests")
      .select("id,title,status,urgency,request_number,created_at")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const orgName: string = (organization as any)?.data?.name ?? t("مؤسستك", "Your organization");
  const obligations: any[] = (obligationsList as any)?.data ?? [];
  const contracts: any[] = (contractsList as any)?.data ?? [];
  const requests: any[] = (requestsList as any)?.data ?? [];

  const fmt = (d: string) =>
    new Date(d + (d.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString(ar ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  const todayLabel = now.toLocaleDateString(ar ? "ar-EG" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const show = (n: number | null) => (n === null ? "—" : String(n));

  type Kpi = { icon: string; label: string; value: number | null; href: string; foot: string; tone?: string };
  const kpis: Kpi[] = [
    {
      icon: "inbox",
      label: t("طلبات قانونية مفتوحة", "Open legal requests"),
      value: openRequests,
      href: "/workspace/requests",
      foot: t("قيد المعالجة حالياً", "Currently in progress"),
    },
    {
      icon: "check",
      label: t("بانتظار اعتمادك", "Awaiting your approval"),
      value: pendingApprovals,
      href: "/workspace/requests",
      foot: t("خطوات اعتماد مسندة إليك", "Approval steps assigned to you"),
      tone: (pendingApprovals ?? 0) > 0 ? "warn" : "",
    },
  ];
  if (can("contracts"))
    kpis.push({
      icon: "contract",
      label: t("عقود تنتهي خلال 90 يوماً", "Contracts expiring in 90 days"),
      value: expiringContracts,
      href: "/workspace/contracts",
      foot: t("تحتاج قرار تجديد أو إنهاء", "Need a renewal or exit decision"),
      tone: (expiringContracts ?? 0) > 0 ? "warn" : "",
    });
  if (can("matters"))
    kpis.push({
      icon: "scale",
      label: t("قضايا ومنازعات نشطة", "Active matters"),
      value: activeMatters,
      href: "/workspace/matters",
      foot: t("مفتوحة أو معلّقة", "Open, pending or on hold"),
    });
  kpis.push({
    icon: "clock",
    label: t("التزامات متأخرة", "Overdue obligations"),
    value: overdueObligations,
    href: "/workspace/obligations",
    foot: t("تجاوزت تاريخ استحقاقها", "Past their due date"),
    tone: (overdueObligations ?? 0) > 0 ? "danger" : "",
  });
  if (can("investigations"))
    kpis.push({
      icon: "shield",
      label: t("تحقيقات قائمة", "Open investigations"),
      value: openInvestigations,
      href: "/workspace/investigations",
      foot: t("لم تُغلق بعد", "Not yet closed"),
    });

  type Step = { label: string; href: string; done: boolean };
  const steps: Step[] = [
    { label: t("إنشاء حساب المؤسسة", "Create your organization"), href: "/workspace/organization", done: true },
    { label: t("تعريف الكيانات القانونية", "Define corporate entities"), href: "/workspace/organization", done: (entities ?? 0) > 0 },
    { label: t("تعريف الإدارات", "Define departments"), href: "/workspace/organization", done: (departments ?? 0) > 0 },
  ];
  if (can("members"))
    steps.push({
      label: t("دعوة أعضاء الفريق", "Invite your team"),
      href: "/workspace/members",
      done: (memberCount ?? 0) > 1 || (invitations ?? 0) > 0,
    });
  steps.push({ label: t("تقديم أول طلب قانوني", "Submit a first legal request"), href: "/workspace/requests", done: (requestTotal ?? 0) > 0 });
  if (can("contracts"))
    steps.push({ label: t("تسجيل أول عقد", "Register a first contract"), href: "/workspace/contracts", done: (contractTotal ?? 0) > 0 });
  steps.push({ label: t("إضافة التزام أو موعد", "Add an obligation or deadline"), href: "/workspace/obligations", done: (obligationTotal ?? 0) > 0 });
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  const modules: { key: ModuleKey; icon: string; href: string; title: string; desc: string }[] = [
    { key: "requests", icon: "inbox", href: "/workspace/requests", title: t("الطلبات القانونية", "Legal requests"), desc: t("طلبات الإدارات الداخلية ومسارات الموافقة.", "Internal requests, routing and approvals.") },
    { key: "contracts", icon: "contract", href: "/workspace/contracts", title: t("العقود", "Contracts"), desc: t("سجل العقود وتواريخ الانتهاء والمسؤولين.", "Contract register, expiry dates and owners.") },
    { key: "matters", icon: "scale", href: "/workspace/matters", title: t("القضايا والمنازعات", "Matters"), desc: t("القضايا والمنازعات وأولوياتها.", "Cases and disputes with priorities.") },
    { key: "investigations", icon: "shield", href: "/workspace/investigations", title: t("التحقيقات الإدارية", "Investigations"), desc: t("الجلسات والأدلة والقرارات والتظلمات.", "Sessions, evidence, decisions and appeals.") },
    { key: "documents", icon: "folder", href: "/workspace/documents", title: t("المستندات", "Documents"), desc: t("ملفات خاصة بتصنيفات سرية وحفظ آمن.", "Private files with classification and secure storage.") },
    { key: "obligations", icon: "clock", href: "/workspace/obligations", title: t("الالتزامات والمواعيد", "Obligations"), desc: t("التزامات مرتبطة بالعقود والقضايا ومواعيد استحقاقها.", "Obligations linked to contracts and matters, with due dates.") },
    { key: "organization", icon: "building", href: "/workspace/organization", title: t("المؤسسة والهيكل", "Organization"), desc: t("الكيانات والإدارات والمناصب.", "Entities, departments and positions.") },
    { key: "members", icon: "users", href: "/workspace/members", title: t("الأعضاء والصلاحيات", "Members & access"), desc: t("الدعوات والأدوار وسجل التدقيق.", "Invitations, roles and audit trail.") },
  ];

  const roleLabel = ROLE_LABELS[role] ? ROLE_LABELS[role][lang] : role;

  return (
    <div className="dash">
      <section className="dash-hero">
        <div>
          <div className="dash-kicker">{t("لوحة التحكم", "DASHBOARD")}</div>
          <h1>{orgName}</h1>
          <p className="dash-sub">
            {todayLabel} · {roleLabel}
          </p>
        </div>
        <div className="dash-actions">
          <Link href="/workspace/requests" className="btn gold">
            <Icon name="plus" size={15} /> {t("طلب قانوني جديد", "New legal request")}
          </Link>
          {can("contracts") && (
            <Link href="/workspace/contracts" className="btn">
              <Icon name="contract" size={15} /> {t("تسجيل عقد", "Add contract")}
            </Link>
          )}
          <Link href="/workspace/obligations" className="btn">
            <Icon name="clock" size={15} /> {t("التزام جديد", "New obligation")}
          </Link>
        </div>
      </section>

      <section className="kpi-grid" aria-label={t("المؤشرات", "Key indicators")}>
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className={"kpi " + (k.tone ?? "")}>
            <div className="kpi-top">
              <span>{k.label}</span>
              <span className="kpi-icon">
                <Icon name={k.icon} size={16} />
              </span>
            </div>
            <div className="kpi-value">{show(k.value)}</div>
            <div className="kpi-foot">{k.foot}</div>
          </Link>
        ))}
      </section>

      <section className="dash-grid">
        <div className="dash-stack">
          <article className="dash-card">
            <div className="dash-card-head">
              <h2>{t("التزامات ومواعيد قادمة", "Upcoming obligations & deadlines")}</h2>
              <Link href="/workspace/obligations" className="dash-link">
                {t("عرض الكل", "View all")} <Icon name="arrow" size={14} />
              </Link>
            </div>
            {obligations.length === 0 ? (
              <div className="dash-empty">{t("لا توجد التزامات مفتوحة. أضف التزاماً مرتبطاً بعقد أو قضية لتبدأ المتابعة.", "No open obligations. Add one linked to a contract or matter to start tracking.")}</div>
            ) : (
              <div>
                {obligations.map((o) => {
                  const days = o.due_date ? daysFrom(o.due_date) : null;
                  const tone = days === null ? "" : days < 0 ? "danger" : days <= 7 ? "warn" : "";
                  const label =
                    days === null
                      ? t("بلا موعد", "No date")
                      : days < 0
                        ? t(`متأخر ${Math.abs(days)} يوماً`, `${Math.abs(days)}d overdue`)
                        : days === 0
                          ? t("اليوم", "Today")
                          : t(`بعد ${days} يوماً`, `In ${days}d`);
                  return (
                    <Link key={o.id} href="/workspace/obligations" className="dash-row">
                      <div className="dash-row-main">
                        <b>{o.title}</b>
                        <small>{o.due_date ? fmt(o.due_date) : "—"}</small>
                      </div>
                      <span className={"chip " + tone}>{label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </article>

          {can("contracts") && (
            <article className="dash-card">
              <div className="dash-card-head">
                <h2>{t("عقود تقترب من الانتهاء", "Contracts nearing expiry")}</h2>
                <Link href="/workspace/contracts" className="dash-link">
                  {t("عرض الكل", "View all")} <Icon name="arrow" size={14} />
                </Link>
              </div>
              {contracts.length === 0 ? (
                <div className="dash-empty">{t("لا توجد عقود نشطة تنتهي خلال 90 يوماً.", "No active contracts expire within 90 days.")}</div>
              ) : (
                <div>
                  {contracts.map((c) => {
                    const days = daysFrom(c.end_date);
                    return (
                      <Link key={c.id} href={`/workspace/contracts/${c.id}`} className="dash-row">
                        <div className="dash-row-main">
                          <b>{c.title}</b>
                          <small>{(c.counterparty_name ? c.counterparty_name + " · " : "") + fmt(c.end_date)}</small>
                        </div>
                        <span className={"chip " + (days <= 30 ? "danger" : "warn")}>{t(`بعد ${days} يوماً`, `In ${days}d`)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </article>
          )}

          <article className="dash-card">
            <div className="dash-card-head">
              <h2>{t("أحدث الطلبات القانونية", "Latest legal requests")}</h2>
              <Link href="/workspace/requests" className="dash-link">
                {t("عرض الكل", "View all")} <Icon name="arrow" size={14} />
              </Link>
            </div>
            {requests.length === 0 ? (
              <div className="dash-empty">{t("لم يُقدَّم أي طلب بعد. يمكن لأي عضو في المؤسسة رفع طلب إلى الفريق القانوني.", "No requests yet. Any member can raise a request to the legal team.")}</div>
            ) : (
              <div>
                {requests.map((r) => {
                  const s = REQUEST_STATUS[r.status];
                  return (
                    <Link key={r.id} href={`/workspace/requests/${r.id}`} className="dash-row">
                      <div className="dash-row-main">
                        <b>{r.title}</b>
                        <small>{(r.request_number ? r.request_number + " · " : "") + fmt(r.created_at.slice(0, 10))}</small>
                      </div>
                      <span className={"chip " + (s?.tone ?? "")}>{s ? s[lang] : r.status}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </article>
        </div>

        <div className="dash-stack">
          <article className="dash-card">
            <div className="dash-card-head">
              <h2>{t("ابدأ التشغيل", "Get started")}</h2>
              <span className="chip gold">
                {doneCount}/{steps.length}
              </span>
            </div>
            <div className="progress" aria-hidden="true">
              <i style={{ width: pct + "%" }} />
            </div>
            <small className="dash-sub">{pct === 100 ? t("اكتمل الإعداد الأساسي.", "Core setup complete.") : t(`${pct}% من الإعداد الأساسي`, `${pct}% of core setup`)}</small>
            <ul className="setup-list">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className={"setup-item " + (s.done ? "done" : "")}>
                    <span className="setup-check">
                      <Icon name="check" size={13} />
                    </span>
                    <span className="t">{s.label}</span>
                    {!s.done && <Icon name="arrow" size={14} />}
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <div className="section-title">{t("كل الوحدات", "ALL MODULES")}</div>
      <section className="module-map">
        {modules
          .filter((m) => can(m.key))
          .map((m) => (
            <Link key={m.key} href={m.href} className="map-card">
              <span className="kpi-icon">
                <Icon name={m.icon} size={16} />
              </span>
              <span>
                <b>{m.title}</b>
                <small>{m.desc}</small>
              </span>
            </Link>
          ))}
      </section>
    </div>
  );
}
