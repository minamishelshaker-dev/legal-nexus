"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";
import { canOpen } from "@/lib/access";

type Hit = { key: string; group: string; title: string; sub: string; href: string };

const GROUPS: Record<string, { ar: string; en: string }> = {
  requests: { ar: "طلبات قانونية", en: "Legal requests" },
  contracts: { ar: "عقود", en: "Contracts" },
  matters: { ar: "قضايا ومنازعات", en: "Matters" },
  obligations: { ar: "التزامات", en: "Obligations" },
};

export default function GlobalSearch({ organizationId, role, lang }: { organizationId: string; role: string; lang: "ar" | "en" }) {
  const ar = lang === "ar";
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clean = q.replace(/[%_*,()"'\\]/g, " ").trim();
    if (clean.length < 2) {
      setHits([]);
      setBusy(false);
      return;
    }
    const id = ++seq.current;
    setBusy(true);
    const timer = setTimeout(async () => {
      const like = `%${clean}%`;
      const jobs: PromiseLike<Hit[]>[] = [];

      jobs.push(
        supabase
          .from("legal_requests")
          .select("id,title,request_number,status")
          .eq("organization_id", organizationId)
          .or(`title.ilike.${like},request_number.ilike.${like}`)
          .limit(5)
          .then(({ data }) =>
            (data ?? []).map((r: { id: string; title: string; request_number: string | null; status: string }) => ({
              key: "r" + r.id,
              group: "requests",
              title: r.title,
              sub: r.request_number ?? r.status,
              href: `/workspace/requests/${r.id}`,
            })),
          ),
      );
      if (canOpen("contracts", role))
        jobs.push(
          supabase
            .from("contracts")
            .select("id,title,counterparty_name,contract_number")
            .eq("organization_id", organizationId)
            .or(`title.ilike.${like},counterparty_name.ilike.${like},contract_number.ilike.${like}`)
            .limit(5)
            .then(({ data }) =>
              (data ?? []).map((r: { id: string; title: string; counterparty_name: string | null; contract_number: string | null }) => ({
                key: "c" + r.id,
                group: "contracts",
                title: r.title,
                sub: r.counterparty_name ?? r.contract_number ?? "",
                href: `/workspace/contracts/${r.id}`,
              })),
            ),
        );
      if (canOpen("matters", role))
        jobs.push(
          supabase
            .from("legal_matters")
            .select("id,title,reference_no")
            .eq("organization_id", organizationId)
            .or(`title.ilike.${like},reference_no.ilike.${like}`)
            .limit(5)
            .then(({ data }) =>
              (data ?? []).map((r: { id: string; title: string; reference_no: string | null }) => ({
                key: "m" + r.id,
                group: "matters",
                title: r.title,
                sub: r.reference_no ?? "",
                href: `/workspace/matters/${r.id}`,
              })),
            ),
        );
      jobs.push(
        supabase
          .from("obligations")
          .select("id,title,due_date")
          .eq("organization_id", organizationId)
          .ilike("title", like)
          .limit(5)
          .then(({ data }) =>
            (data ?? []).map((r: { id: string; title: string; due_date: string }) => ({
              key: "o" + r.id,
              group: "obligations",
              title: r.title,
              sub: r.due_date,
              href: "/workspace/obligations",
            })),
          ),
      );

      const results = await Promise.all(jobs);
      if (id !== seq.current) return;
      setHits(results.flat());
      setBusy(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [q, organizationId, role, supabase]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const show = open && q.trim().length >= 2;
  const groups = Object.keys(GROUPS).filter((g) => hits.some((h) => h.group === g));

  return (
    <div className="gsearch" ref={box}>
      <span className="gsearch-icon">
        <Icon name="search" size={15} />
      </span>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={ar ? "بحث في العقود والقضايا والطلبات والالتزامات…" : "Search contracts, matters, requests, obligations…"}
        aria-label={ar ? "بحث عام" : "Global search"}
        autoComplete="off"
      />
      {show && (
        <div className="gsearch-panel" role="listbox">
          {busy && hits.length === 0 && <div className="gsearch-empty">{ar ? "جارٍ البحث…" : "Searching…"}</div>}
          {!busy && hits.length === 0 && <div className="gsearch-empty">{ar ? "لا توجد نتائج مطابقة." : "No matching results."}</div>}
          {groups.map((g) => (
            <div key={g}>
              <div className="gsearch-group">{GROUPS[g][lang]}</div>
              {hits
                .filter((h) => h.group === g)
                .map((h) => (
                  <Link key={h.key} href={h.href} className="gsearch-hit" onClick={() => setOpen(false)}>
                    <b>{h.title}</b>
                    {h.sub && <small>{h.sub}</small>}
                  </Link>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
