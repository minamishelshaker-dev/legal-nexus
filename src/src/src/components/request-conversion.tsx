"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type LinkRow = { id: string; record_type: string; record_id: string; created_at: string };
type Target = "contract" | "legal_matter";

const MATTER_KINDS = ["general", "litigation", "arbitration", "regulatory", "employment", "corporate", "intellectual_property"];

export default function RequestConversion({
  organizationId,
  requestId,
  canContract,
  canMatter,
  lang,
}: {
  organizationId: string;
  requestId: string;
  canContract: boolean;
  canMatter: boolean;
  lang: "ar" | "en";
}) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [links, setLinks] = useState<LinkRow[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [request, setRequest] = useState<{ title: string; status: string } | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [title, setTitle] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [kind, setKind] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [l, r] = await Promise.all([
      supabase.from("legal_request_links").select("id,record_type,record_id,created_at").eq("legal_request_id", requestId).order("created_at", { ascending: true }),
      supabase.from("legal_requests").select("title,status").eq("id", requestId).maybeSingle(),
    ]);
    const rows = (l.data ?? []) as LinkRow[];
    setLinks(rows);
    if (r.data) setRequest(r.data as { title: string; status: string });
    const contractIds = rows.filter((x) => x.record_type === "contract").map((x) => x.record_id);
    const matterIds = rows.filter((x) => x.record_type === "legal_matter").map((x) => x.record_id);
    const next: Record<string, string> = {};
    if (contractIds.length) {
      const { data } = await supabase.from("contracts").select("id,title").in("id", contractIds);
      for (const c of (data ?? []) as { id: string; title: string }[]) next[c.id] = c.title;
    }
    if (matterIds.length) {
      const { data } = await supabase.from("legal_matters").select("id,title").in("id", matterIds);
      for (const m of (data ?? []) as { id: string; title: string }[]) next[m.id] = m.title;
    }
    setTitles(next);
  }, [requestId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const closed = request ? ["cancelled", "rejected", "completed"].includes(request.status) : false;

  function openForm(tg: Target) {
    setTarget(tg);
    setTitle(request?.title ?? "");
    setCounterparty("");
    setKind("");
    setError("");
  }

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!target) return;
    setSaving(true);
    setError("");
    const { data, error: err } = await supabase.rpc("convert_legal_request", {
      p_request: requestId,
      p_target: target,
      p_title: title.trim() || null,
      p_counterparty: target === "contract" ? counterparty.trim() || null : null,
      p_kind: kind.trim() || null,
    });
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    router.push(target === "contract" ? `/workspace/contracts/${data}` : `/workspace/matters/${data}`);
  }

  if (!canContract && !canMatter && links.length === 0) return null;

  return (
    <section className="module-panel" style={{ marginTop: 16 }}>
      <div className="dash-card-head">
        <div>
          <span className="auth-kicker">{t("التحويل والروابط", "CONVERSION & LINKS")}</span>
          <h2 style={{ margin: "6px 0 0" }}>{t("السجلات الناتجة عن هذا الطلب", "Records created from this request")}</h2>
        </div>
        {!closed && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canContract && (
              <button type="button" className="btn gold" onClick={() => openForm("contract")}>
                {t("تحويل إلى عقد", "Convert to contract")}
              </button>
            )}
            {canMatter && (
              <button type="button" className="btn" onClick={() => openForm("legal_matter")}>
                {t("تحويل إلى قضية", "Convert to matter")}
              </button>
            )}
          </div>
        )}
      </div>

      {closed && <p className="muted-note">{t("هذا الطلب مغلق (مكتمل أو ملغى أو مرفوض) ولا يمكن تحويله إلى سجل جديد.", "This request is closed (completed, cancelled or rejected) and cannot be converted.")}</p>}

      {target && (
        <form className="module-form" onSubmit={submit}>
          <label>
            {target === "contract" ? t("عنوان العقد", "Contract title") : t("عنوان القضية", "Matter title")}
            <input required minLength={2} maxLength={240} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {target === "contract" && (
            <label>
              {t("الطرف الآخر (اختياري)", "Counterparty (optional)")}
              <input maxLength={200} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </label>
          )}
          <label>
            {target === "contract" ? t("نوع العقد (اختياري)", "Contract type (optional)") : t("نوع القضية", "Matter type")}
            <input list={target === "legal_matter" ? "matter-kinds" : undefined} maxLength={100} value={kind} onChange={(e) => setKind(e.target.value)} />
            {target === "legal_matter" && (
              <datalist id="matter-kinds">
                {MATTER_KINDS.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            )}
          </label>
          <p className="muted-note">
            {t("يُنشأ السجل بالبيانات التالية من الطلب: الكيان القانوني، والمسؤول (المسند إليه الطلب أو أنت)", "The record is created with data from the request: legal entity and owner (the assignee, or you)")}
            {target === "legal_matter" ? t("، والأولوية والوصف.", ", priority and description.") : "."}
          </p>
          <div className="form-actions">
            <button className="primary" disabled={saving}>
              {saving ? t("جارٍ الإنشاء…", "Creating…") : t("تأكيد التحويل", "Confirm conversion")}
            </button>
            <button type="button" className="secondary-button" onClick={() => setTarget(null)}>
              {t("إلغاء", "Cancel")}
            </button>
          </div>
        </form>
      )}

      {error && <p className="error-message" role="alert">{error}</p>}

      {links.length === 0 ? (
        <div className="dash-empty">{t("لم يُنشَأ أي عقد أو قضية من هذا الطلب بعد.", "No contract or matter has been created from this request yet.")}</div>
      ) : (
        <div>
          {links.map((l) => (
            <Link key={l.id} href={l.record_type === "contract" ? `/workspace/contracts/${l.record_id}` : `/workspace/matters/${l.record_id}`} className="dash-row">
              <div className="dash-row-main">
                <b>{titles[l.record_id] ?? t("سجل", "Record")}</b>
                <small>{new Date(l.created_at).toLocaleDateString(ar ? "ar-EG" : "en-GB")}</small>
              </div>
              <span className="chip gold">{l.record_type === "contract" ? t("عقد", "Contract") : t("قضية", "Matter")}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
