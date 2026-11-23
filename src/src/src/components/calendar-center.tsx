"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";
import { canOpen } from "@/lib/access";

type Lang = "ar" | "en";
type Kind = "event" | "obligation" | "contract";
type Item = { key: string; date: string; time: string | null; title: string; sub: string; href: string; kind: Kind };

const EVENT_TYPES: Record<string, { ar: string; en: string }> = {
  hearing: { ar: "جلسة", en: "Hearing" },
  deadline: { ar: "موعد نهائي", en: "Deadline" },
  filing: { ar: "تقديم / إيداع", en: "Filing" },
  meeting: { ar: "اجتماع", en: "Meeting" },
  other: { ar: "أخرى", en: "Other" },
};

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function CalendarCenter({ organizationId, role, lang }: { organizationId: string; role: string; lang: Lang }) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const supabase = useMemo(() => createClient(), []);
  const locale = ar ? "ar-EG" : "en-GB";

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [items, setItems] = useState<Item[]>([]);
  const [layers, setLayers] = useState<Record<Kind, boolean>>({ event: true, obligation: true, contract: true });
  const [hijri, setHijri] = useState(ar);
  const [selected, setSelected] = useState(keyOf(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canEvents = canOpen("matters", role);
  const canContracts = canOpen("contracts", role);
  const weekStart = ar ? 6 : 1;

  const { gridStart, days } = useMemo(() => {
    const offset = (cursor.getDay() - weekStart + 7) % 7;
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - offset);
    const list = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    return { gridStart: start, days: list };
  }, [cursor, weekStart]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      const endEx = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 42);
      const fromKey = keyOf(gridStart);
      const toKey = keyOf(endEx);
      const jobs: PromiseLike<Item[]>[] = [];

      if (canEvents)
        jobs.push(
          supabase
            .from("matter_events")
            .select("id,matter_id,event_type,title,starts_at,court_name,status")
            .eq("organization_id", organizationId)
            .gte("starts_at", gridStart.toISOString())
            .lt("starts_at", endEx.toISOString())
            .neq("status", "cancelled")
            .then(({ data, error: e }) => {
              if (e) setError(e.message);
              return (data ?? []).map((r: { id: string; matter_id: string; event_type: string; title: string; starts_at: string; court_name: string | null }) => {
                const d = new Date(r.starts_at);
                return {
                  key: "e" + r.id,
                  date: keyOf(d),
                  time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
                  title: r.title,
                  sub: [EVENT_TYPES[r.event_type]?.[lang] ?? r.event_type, r.court_name].filter(Boolean).join(" · "),
                  href: `/workspace/matters/${r.matter_id}`,
                  kind: "event" as Kind,
                };
              });
            }),
        );

      jobs.push(
        supabase
          .from("obligations")
          .select("id,title,due_date,status,priority")
          .eq("organization_id", organizationId)
          .in("status", ["open", "in_progress"])
          .gte("due_date", fromKey)
          .lt("due_date", toKey)
          .then(({ data }) =>
            (data ?? []).map((r: { id: string; title: string; due_date: string }) => ({
              key: "o" + r.id,
              date: r.due_date,
              time: null,
              title: r.title,
              sub: t("استحقاق التزام", "Obligation due"),
              href: "/workspace/obligations",
              kind: "obligation" as Kind,
            })),
          ),
      );

      if (canContracts)
        jobs.push(
          supabase
            .from("contracts")
            .select("id,title,end_date,counterparty_name")
            .eq("organization_id", organizationId)
            .in("status", ["approved", "signed", "active"])
            .gte("end_date", fromKey)
            .lt("end_date", toKey)
            .then(({ data }) =>
              (data ?? []).map((r: { id: string; title: string; end_date: string; counterparty_name: string | null }) => ({
                key: "c" + r.id,
                date: r.end_date,
                time: null,
                title: r.title,
                sub: [t("انتهاء عقد", "Contract ends"), r.counterparty_name].filter(Boolean).join(" · "),
                href: `/workspace/contracts/${r.id}`,
                kind: "contract" as Kind,
              })),
            ),
        );

      const all = (await Promise.all(jobs)).flat();
      if (active) {
        setItems(all);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridStart, organizationId, canEvents, canContracts, supabase, lang]);

  const visible = items.filter((i) => layers[i.kind]);
  const byDay = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const i of visible) (map[i.date] ??= []).push(i);
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, layers]);

  const todayKey = keyOf(new Date());
  const monthLabel = cursor.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const mid = new Date(cursor.getFullYear(), cursor.getMonth(), 15);
  const hijriMonth = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { month: "long", year: "numeric" }).format(mid);
  const hijriDay = (d: Date) => new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric" }).format(d);
  const dowLabels = days.slice(0, 7).map((d) => d.toLocaleDateString(locale, { weekday: "short" }));
  const selItems = byDay[selected] ?? [];
  const selDate = new Date(selected + "T00:00:00");

  const layerMeta: { k: Kind; label: string; show: boolean }[] = [
    { k: "event", label: t("الجلسات والمواعيد القضائية", "Hearings & deadlines"), show: canEvents },
    { k: "obligation", label: t("الالتزامات", "Obligations"), show: true },
    { k: "contract", label: t("انتهاء العقود", "Contract expiries"), show: canContracts },
  ];

  return (
    <div>
      <div className="people-head">
        <div>
          <div className="people-kicker">{t("التقويم", "CALENDAR")}</div>
          <h1>{t("تقويم المواعيد", "Deadlines calendar")}</h1>
          <p className="people-sub">{t("كل الجلسات والمواعيد النهائية واستحقاقات الالتزامات وانتهاء العقود في مكان واحد.", "Hearings, deadlines, obligation due dates and contract expiries in one place.")}</p>
        </div>
      </div>

      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="btn-ghost" aria-label={t("الشهر السابق", "Previous month")} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <Icon name="arrow" size={14} />
          </button>
          <div className="cal-title">
            {monthLabel}
            {hijri && <small>{hijriMonth}</small>}
          </div>
          <button type="button" className="btn-ghost" aria-label={t("الشهر التالي", "Next month")} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}>
              <Icon name="arrow" size={14} />
            </span>
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              const d = new Date();
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
              setSelected(keyOf(d));
            }}
          >
            {t("اليوم", "Today")}
          </button>
        </div>
        <div className="cal-layers">
          {layerMeta
            .filter((l) => l.show)
            .map((l) => (
              <button key={l.k} type="button" className={"type-pill" + (layers[l.k] ? " active" : "")} aria-pressed={layers[l.k]} onClick={() => setLayers({ ...layers, [l.k]: !layers[l.k] })}>
                {l.label}
              </button>
            ))}
          <button type="button" className={"type-pill" + (hijri ? " active" : "")} aria-pressed={hijri} onClick={() => setHijri(!hijri)}>
            {t("التاريخ الهجري", "Hijri dates")}
          </button>
        </div>
      </div>

      {error && <p className="note-err" role="alert">{error}</p>}

      <div className="cal-grid" role="grid" aria-busy={loading}>
        {dowLabels.map((d, i) => (
          <div key={i} className="cal-dow" role="columnheader">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const k = keyOf(d);
          const list = byDay[k] ?? [];
          const cls = ["cal-cell", d.getMonth() !== cursor.getMonth() ? "out" : "", k === todayKey ? "today" : "", k === selected ? "selected" : ""].join(" ");
          return (
            <button key={k} type="button" className={cls} onClick={() => setSelected(k)} aria-label={d.toLocaleDateString(locale, { dateStyle: "full" }) + (list.length ? ` - ${list.length}` : "")}>
              <span className="cal-day">
                {d.getDate()}
                {hijri && <small>{hijriDay(d)}</small>}
              </span>
              {list.slice(0, 3).map((i) => (
                <span key={i.key} className={"cal-chip " + i.kind}>
                  {i.time ? i.time + " " : ""}
                  {i.title}
                </span>
              ))}
              {list.length > 3 && <span className="cal-more">{t(`+${list.length - 3} المزيد`, `+${list.length - 3} more`)}</span>}
              {list.length > 0 && (
                <span className="cal-dots">
                  {list.slice(0, 6).map((i) => (
                    <i key={i.key} className={i.kind} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section className="panel-block cal-agenda">
        <h2>{selDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
        {hijri && <p className="lead">{new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { dateStyle: "long" }).format(selDate)}</p>}
        {selItems.length === 0 ? (
          <div className="dash-empty">{loading ? t("جارٍ التحميل…", "Loading…") : t("لا توجد مواعيد في هذا اليوم.", "Nothing scheduled for this day.")}</div>
        ) : (
          selItems.map((i) => (
            <Link key={i.key} href={i.href} className="cal-item">
              <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                <span className="cal-time">{i.time ?? "—"}</span>
                <div className="dash-row-main">
                  <b>{i.title}</b>
                  <small>{i.sub}</small>
                </div>
              </div>
              <span className={"chip " + (i.kind === "event" ? "gold" : i.kind === "contract" ? "warn" : "")}>{i.kind === "event" ? t("موعد قضائي", "Hearing/deadline") : i.kind === "contract" ? t("عقد", "Contract") : t("التزام", "Obligation")}</span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
