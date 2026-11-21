"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";
import { canOpen } from "@/lib/access";

type Lang = "ar" | "en";
type TypeKey = "requests" | "contracts" | "matters" | "obligations" | "documents";
type Row = { id: string; title: string; sub: string; href: string; status: string; date: string };
type Result = { rows: Row[]; total: number };
export type SearchInit = { q: string; types: string[]; status: string; from: string; to: string; mine: boolean; sort: string };

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  submitted: { ar: "مقدّم", en: "Submitted" },
  under_review: { ar: "قيد المراجعة", en: "Under review" },
  awaiting_information: { ar: "بانتظار معلومات", en: "Awaiting information" },
  pending_approval: { ar: "بانتظار الاعتماد", en: "Pending approval" },
  approved: { ar: "معتمد", en: "Approved" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  completed: { ar: "مكتمل", en: "Completed" },
  cancelled: { ar: "ملغى", en: "Cancelled" },
  draft: { ar: "مسودة", en: "Draft" },
  in_review: { ar: "قيد المراجعة", en: "In review" },
  signed: { ar: "موقّع", en: "Signed" },
  active: { ar: "ساري", en: "Active" },
  expired: { ar: "منتهي", en: "Expired" },
  terminated: { ar: "منهى", en: "Terminated" },
  archived: { ar: "مؤرشف", en: "Archived" },
  open: { ar: "مفتوح", en: "Open" },
  pending: { ar: "معلّق", en: "Pending" },
  on_hold: { ar: "مؤجّل", en: "On hold" },
  closed: { ar: "مغلق", en: "Closed" },
  in_progress: { ar: "قيد التنفيذ", en: "In progress" },
};

const CLASS_LABELS: Record<string, { ar: string; en: string }> = {
  public: { ar: "عام", en: "Public" },
  internal: { ar: "داخلي", en: "Internal" },
  confidential: { ar: "سري", en: "Confidential" },
  restricted: { ar: "مقيّد", en: "Restricted" },
  highly_restricted: { ar: "مقيّد جداً", en: "Highly restricted" },
};

const PRIORITY: Record<string, { ar: string; en: string }> = {
  low: { ar: "منخفضة", en: "Low" },
  normal: { ar: "عادية", en: "Normal" },
  high: { ar: "مرتفعة", en: "High" },
  critical: { ar: "حرجة", en: "Critical" },
  urgent: { ar: "عاجلة", en: "Urgent" },
};

type Meta = {
  ar: string;
  en: string;
  icon: string;
  table: string;
  cols: string;
  text: string[];
  mine: string[];
  statuses: string[] | null;
};

const TYPES: Record<TypeKey, Meta> = {
  requests: {
    ar: "الطلبات القانونية",
    en: "Legal requests",
    icon: "inbox",
    table: "legal_requests",
    cols: "id,title,request_number,status,urgency,created_at",
    text: ["title", "request_number", "description"],
    mine: ["requester_user_id", "assigned_to"],
    statuses: ["submitted", "under_review", "awaiting_information", "pending_approval", "approved", "rejected", "completed", "cancelled"],
  },
  contracts: {
    ar: "العقود",
    en: "Contracts",
    icon: "contract",
    table: "contracts",
    cols: "id,title,counterparty_name,contract_number,status,end_date,created_at",
    text: ["title", "counterparty_name", "contract_number"],
    mine: ["responsible_user_id"],
    statuses: ["draft", "in_review", "approved", "signed", "active", "expired", "terminated", "archived"],
  },
  matters: {
    ar: "القضايا والمنازعات",
    en: "Matters",
    icon: "scale",
    table: "legal_matters",
    cols: "id,title,reference_no,status,priority,created_at",
    text: ["title", "reference_no", "description"],
    mine: ["owner_user_id"],
    statuses: ["open", "pending", "on_hold", "closed", "archived"],
  },
  obligations: {
    ar: "الالتزامات والمواعيد",
    en: "Obligations",
    icon: "clock",
    table: "obligations",
    cols: "id,title,status,priority,due_date,created_at",
    text: ["title", "description"],
    mine: ["responsible_user_id", "created_by"],
    statuses: ["open", "in_progress", "completed", "cancelled"],
  },
  documents: {
    ar: "المستندات",
    en: "Documents",
    icon: "folder",
    table: "documents",
    cols: "id,title,classification,mime_type,created_at",
    text: ["title"],
    mine: ["uploaded_by"],
    statuses: null,
  },
};

const ALL_STATUSES = ["submitted", "under_review", "awaiting_information", "pending_approval", "approved", "rejected", "draft", "in_review", "signed", "active", "expired", "terminated", "open", "pending", "on_hold", "in_progress", "completed", "closed", "cancelled", "archived"];
const PAGE = 25;

type Client = ReturnType<typeof createClient>;

function toRow(key: TypeKey, r: Record<string, string | null>, lang: Lang): Row {
  const pr = (v: string | null) => (v ? (PRIORITY[v]?.[lang] ?? v) : "");
  switch (key) {
    case "requests":
      return { id: r.id as string, title: r.title ?? "", sub: [r.request_number, pr(r.urgency)].filter(Boolean).join(" · "), href: `/workspace/requests/${r.id}`, status: r.status ?? "", date: (r.created_at ?? "").slice(0, 10) };
    case "contracts":
      return { id: r.id as string, title: r.title ?? "", sub: [r.counterparty_name, r.contract_number, r.end_date ? (lang === "ar" ? "ينتهي " : "ends ") + r.end_date : ""].filter(Boolean).join(" · "), href: `/workspace/contracts/${r.id}`, status: r.status ?? "", date: (r.created_at ?? "").slice(0, 10) };
    case "matters":
      return { id: r.id as string, title: r.title ?? "", sub: [r.reference_no, pr(r.priority)].filter(Boolean).join(" · "), href: `/workspace/matters/${r.id}`, status: r.status ?? "", date: (r.created_at ?? "").slice(0, 10) };
    case "obligations":
      return { id: r.id as string, title: r.title ?? "", sub: [r.due_date ? (lang === "ar" ? "الاستحقاق " : "due ") + r.due_date : "", pr(r.priority)].filter(Boolean).join(" · "), href: "/workspace/obligations", status: r.status ?? "", date: (r.created_at ?? "").slice(0, 10) };
    default:
      return { id: r.id as string, title: r.title ?? "", sub: CLASS_LABELS[r.classification ?? ""]?.[lang] ?? r.classification ?? "", href: "/workspace/documents", status: "", date: (r.created_at ?? "").slice(0, 10) };
  }
}

async function fetchType(
  supabase: Client,
  key: TypeKey,
  p: { org: string; userId: string; clean: string; status: string; from: string; to: string; mine: boolean; sort: string; limit: number; lang: Lang },
): Promise<Result> {
  const meta = TYPES[key];
  if (p.status && (!meta.statuses || !meta.statuses.includes(p.status))) return { rows: [], total: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from(meta.table).select(meta.cols, { count: "exact" }).eq("organization_id", p.org);
  if (p.status) q = q.eq("status", p.status);
  if (p.from) q = q.gte("created_at", p.from + "T00:00:00Z");
  if (p.to) q = q.lte("created_at", p.to + "T23:59:59Z");
  const like = `%${p.clean}%`;
  if (p.clean && p.mine) {
    const combos: string[] = [];
    for (const m of meta.mine) for (const c of meta.text) combos.push(`and(${m}.eq.${p.userId},${c}.ilike.${like})`);
    q = q.or(combos.join(","));
  } else if (p.clean) {
    q = q.or(meta.text.map((c) => `${c}.ilike.${like}`).join(","));
  } else if (p.mine) {
    q = q.or(meta.mine.map((m) => `${m}.eq.${p.userId}`).join(","));
  }
  if (p.sort === "az") q = q.order("title", { ascending: true });
  else q = q.order("created_at", { ascending: p.sort === "oldest" });
  const { data, count, error } = await q.limit(p.limit);
  if (error) throw new Error(error.message);
  return { rows: ((data ?? []) as Record<string, string | null>[]).map((r) => toRow(key, r, p.lang)), total: count ?? 0 };
}

export default function SearchCenter({
  organizationId,
  userId,
  role,
  lang,
  init,
}: {
  organizationId: string;
  userId: string;
  role: string;
  lang: Lang;
  init: SearchInit;
}) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();

  const allowed = useMemo(() => (Object.keys(TYPES) as TypeKey[]).filter((k) => (k === "contracts" ? canOpen("contracts", role) : k === "matters" ? canOpen("matters", role) : true)), [role]);

  const [q, setQ] = useState(init.q);
  const [types, setTypes] = useState<TypeKey[]>(init.types.filter((x): x is TypeKey => allowed.includes(x as TypeKey)));
  const [status, setStatus] = useState(init.status);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [mine, setMine] = useState(init.mine);
  const [sort, setSort] = useState(init.sort || "newest");
  const [limit, setLimit] = useState(PAGE);
  const [results, setResults] = useState<Partial<Record<TypeKey, Result>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const seq = useRef(0);

  const active = types.length ? types : allowed;

  useEffect(() => {
    const id = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const clean = q.replace(/[%_*,()"'\\]/g, " ").trim();
      try {
        const entries = await Promise.all(
          active.map(async (k) => [k, await fetchType(supabase, k, { org: organizationId, userId, clean, status, from, to, mine, sort, limit, lang })] as const),
        );
        if (id !== seq.current) return;
        const next: Partial<Record<TypeKey, Result>> = {};
        for (const [k, v] of entries) next[k] = v;
        setResults(next);
        setError("");
      } catch (e) {
        if (id !== seq.current) return;
        setError(e instanceof Error ? e.message : String(e));
      }
      setLoading(false);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (types.length) params.set("t", types.join(","));
      if (status) params.set("s", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (mine) params.set("mine", "1");
      if (sort !== "newest") params.set("sort", sort);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, types, status, from, to, mine, sort, limit, organizationId, userId, lang, supabase]);

  function toggleType(k: TypeKey) {
    setLimit(PAGE);
    setTypes((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }
  function reset() {
    setQ("");
    setTypes([]);
    setStatus("");
    setFrom("");
    setTo("");
    setMine(false);
    setSort("newest");
    setLimit(PAGE);
  }

  const total = active.reduce((n, k) => n + (results[k]?.total ?? 0), 0);
  const filtered = Boolean(q.trim() || types.length || status || from || to || mine);

  return (
    <div className="search-page">
      <div className="people-head">
        <div>
          <div className="people-kicker">{t("البحث والتصفية", "SEARCH & FILTER")}</div>
          <h1>{t("البحث المتقدّم", "Advanced search")}</h1>
          <p className="people-sub">{t("ابحث في كل سجلات مؤسستك وصفّها بالحالة والتاريخ والمسؤولية. تظهر لك فقط السجلات التي تسمح بها صلاحياتك.", "Search every record in your organization and filter by status, date and ownership. You only see records your permissions allow.")}</p>
        </div>
      </div>

      <div className="panel-block">
        <div className="search-bar">
          <span className="search-bar-icon">
            <Icon name="search" size={18} />
          </span>
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder={t("ابحث بالعنوان أو الرقم أو اسم الطرف الآخر…", "Search by title, number or counterparty…")} aria-label={t("نص البحث", "Search text")} />
        </div>
        <div className="type-pills" role="group" aria-label={t("نوع السجلات", "Record types")}>
          {allowed.map((k) => (
            <button key={k} type="button" className={"type-pill" + (types.includes(k) ? " active" : "")} aria-pressed={types.includes(k)} onClick={() => toggleType(k)}>
              <Icon name={TYPES[k].icon} size={14} /> {TYPES[k][lang]}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <label>
            {t("الحالة", "Status")}
            <select value={status} onChange={(e) => { setStatus(e.target.value); setLimit(PAGE); }}>
              <option value="">{t("كل الحالات", "All statuses")}</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]?.[lang] ?? s}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("من تاريخ الإنشاء", "Created from")}
            <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setLimit(PAGE); }} />
          </label>
          <label>
            {t("إلى تاريخ", "Created to")}
            <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setLimit(PAGE); }} />
          </label>
          <label>
            {t("الترتيب", "Sort")}
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">{t("الأحدث أولاً", "Newest first")}</option>
              <option value="oldest">{t("الأقدم أولاً", "Oldest first")}</option>
              <option value="az">{t("العنوان أ-ي", "Title A-Z")}</option>
            </select>
          </label>
          <label className="chat-check">
            <input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); setLimit(PAGE); }} />
            {t("الخاصة بي فقط", "Only mine")}
          </label>
          {filtered && (
            <button type="button" className="btn-ghost" onClick={reset}>
              {t("مسح التصفية", "Clear filters")}
            </button>
          )}
        </div>
      </div>

      {error && <p className="note-err" role="alert">{error}</p>}
      <p className="search-summary" aria-live="polite">
        {loading ? t("جارٍ البحث…", "Searching…") : t(`${total} نتيجة`, `${total} result${total === 1 ? "" : "s"}`)}
        {status && !types.length ? " · " + t("المستندات لا تتضمن حالة", "documents have no status") : ""}
      </p>

      {active.map((k) => {
        const res = results[k];
        if (!res || (res.rows.length === 0 && (status || filtered))) {
          if (!res || res.total === 0) return null;
        }
        return (
          <section className="panel-block result-section" key={k}>
            <div className="result-head">
              <Icon name={TYPES[k].icon} size={16} />
              <h2>{TYPES[k][lang]}</h2>
              <span className="chip gold">{res.total}</span>
            </div>
            {res.rows.map((r) => (
              <Link key={r.id} href={r.href} className="result-row">
                <div className="dash-row-main">
                  <b>{r.title}</b>
                  {r.sub && <small>{r.sub}</small>}
                </div>
                <div className="result-side">
                  {r.status && <span className="chip">{STATUS_LABELS[r.status]?.[lang] ?? r.status}</span>}
                  <small>{r.date}</small>
                </div>
              </Link>
            ))}
            {res.total > res.rows.length && (
              <div className="btn-row">
                <button type="button" className="btn-ghost" onClick={() => setLimit((n) => n + PAGE)}>
                  {t(`عرض المزيد (${res.rows.length} من ${res.total})`, `Show more (${res.rows.length} of ${res.total})`)}
                </button>
              </div>
            )}
          </section>
        );
      })}

      {!loading && total === 0 && (
        <div className="dash-empty">{filtered ? t("لا توجد نتائج تطابق البحث والتصفية. جرّب توسيع النطاق.", "No results match your search and filters. Try widening them.") : t("لا توجد سجلات بعد.", "No records yet.")}</div>
      )}
    </div>
  );
}
