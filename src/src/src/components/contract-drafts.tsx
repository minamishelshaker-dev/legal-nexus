"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Draft = { id: string; version_no: number; body: string; note: string | null; created_at: string };
type Line = { t: "same" | "add" | "del"; s: string };

function lineDiff(a: string, b: string): Line[] | null {
  const x = a.split("\n");
  const y = b.split("\n");
  if (x.length > 700 || y.length > 700) return null;
  const n = x.length;
  const m = y.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Line[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ t: "same", s: x[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ t: "del", s: x[i++] });
    } else {
      out.push({ t: "add", s: y[j++] });
    }
  }
  while (i < n) out.push({ t: "del", s: x[i++] });
  while (j < m) out.push({ t: "add", s: y[j++] });
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function ContractDrafts({
  organizationId,
  contractId,
  canEdit,
  lang,
}: {
  organizationId: string;
  contractId: string;
  canEdit: boolean;
  lang: "ar" | "en";
}) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const supabase = useMemo(() => createClient(), []);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [compare, setCompare] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("contract_drafts")
      .select("id,version_no,body,note,created_at")
      .eq("organization_id", organizationId)
      .eq("contract_id", contractId)
      .order("version_no", { ascending: false });
    if (err) setError(err.message);
    else {
      const rows = (data ?? []) as Draft[];
      setDrafts(rows);
      setSelected((s) => (s && rows.some((r) => r.version_no === s) ? s : (rows[0]?.version_no ?? null)));
    }
    setLoading(false);
  }, [organizationId, contractId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = drafts.find((d) => d.version_no === selected) ?? null;
  const previous = current ? drafts.find((d) => d.version_no === current.version_no - 1) ?? null : null;
  const diff = compare && current && previous ? lineDiff(previous.body, current.body) : null;
  const placeholders = current ? Array.from(new Set(current.body.match(/\{\{[a-z][a-z0-9_]*\}\}/g) ?? [])) : [];
  const rtl = current ? /[\u0600-\u06FF]/.test(current.body) : ar;
  const fmt = (iso: string) => new Date(iso).toLocaleString(ar ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    const { data, error: err } = await supabase.rpc("save_contract_draft", { p_contract: contractId, p_body: editBody, p_note: note.trim() || null });
    if (err) setError(err.message);
    else {
      setNotice(t(`تم حفظ الإصدار ${data}.`, `Version ${data} saved.`));
      setEditing(false);
      setNote("");
      await load();
      setSelected(Number(data));
    }
    setSaving(false);
  }

  function download() {
    if (!current) return;
    const blob = new Blob(["\ufeff" + current.body], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `contract-v${current.version_no}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function print() {
    if (!current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>Contract v${current.version_no}</title><style>body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;line-height:2;padding:40px;white-space:pre-wrap;font-size:14px}</style></head><body>${escapeHtml(current.body)}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <section className="module-panel" style={{ marginTop: 16 }}>
      <div className="dash-card-head">
        <div>
          <span className="auth-kicker">{t("نص العقد وإصداراته", "CONTRACT TEXT & VERSIONS")}</span>
          <h2 style={{ margin: "6px 0 0" }}>{t("المسودات", "Drafts")} <span className="chip gold">{drafts.length}</span></h2>
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setEditBody(current?.body ?? "");
              setEditing(true);
              setNotice("");
            }}
          >
            {current ? t("تعديل وحفظ إصدار جديد", "Edit & save new version") : t("+ إنشاء مسودة", "+ Start a draft")}
          </button>
        )}
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      {loading ? (
        <div className="dash-empty">{t("جارٍ التحميل…", "Loading…")}</div>
      ) : editing ? (
        <div>
          <textarea className="tpl-body" value={editBody} onChange={(e) => setEditBody(e.target.value)} dir={/[\u0600-\u06FF]/.test(editBody) ? "rtl" : "ltr"} aria-label={t("نص المسودة", "Draft text")} />
          <label style={{ display: "grid", gap: 6, margin: "12px 0", fontSize: 12 }}>
            {t("ملاحظة على هذا الإصدار (ماذا تغيّر؟)", "Note for this version (what changed?)")}
            <input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="form-actions">
            <button type="button" className="primary" disabled={saving || !editBody.trim()} onClick={() => void save()}>
              {saving ? t("جارٍ الحفظ…", "Saving…") : t("حفظ كإصدار جديد", "Save as new version")}
            </button>
            <button type="button" className="secondary-button" onClick={() => setEditing(false)}>{t("إلغاء", "Cancel")}</button>
          </div>
        </div>
      ) : !current ? (
        <div className="dash-empty">{t("لا توجد مسودة لهذا العقد. أنشئه من قالب معتمد من صفحة «القوالب» أو ابدأ مسودة يدوياً.", "No draft for this contract. Create one from an approved template on the Templates page, or start one manually.")}</div>
      ) : (
        <div>
          <div className="draft-bar">
            <select value={selected ?? ""} onChange={(e) => setSelected(Number(e.target.value))} aria-label={t("الإصدار", "Version")}>
              {drafts.map((d) => (
                <option key={d.id} value={d.version_no}>
                  {t(`إصدار ${d.version_no}`, `Version ${d.version_no}`)} · {fmt(d.created_at)}
                </option>
              ))}
            </select>
            {previous && (
              <button type="button" className={"type-pill" + (compare ? " active" : "")} aria-pressed={compare} onClick={() => setCompare(!compare)}>
                {t("مقارنة بالإصدار السابق", "Compare with previous")}
              </button>
            )}
            <button type="button" className="btn" onClick={() => void navigator.clipboard.writeText(current.body)}>{t("نسخ", "Copy")}</button>
            <button type="button" className="btn" onClick={download}>{t("تنزيل .txt", "Download .txt")}</button>
            <button type="button" className="btn" onClick={print}>{t("طباعة / PDF", "Print / PDF")}</button>
          </div>
          {current.note && <p className="muted-note" style={{ marginBottom: 10 }}>{current.note}</p>}
          {placeholders.length > 0 && (
            <p className="ph-warn">{t(`يحتوي هذا الإصدار على ${placeholders.length} حقل غير معبأ: `, `This version has ${placeholders.length} unfilled field(s): `)}{placeholders.join(" ")}</p>
          )}
          {compare && previous && diff === null && <p className="muted-note">{t("النص كبير جداً للمقارنة التفصيلية.", "The text is too large for a detailed comparison.")}</p>}
          <div className="draft-view" dir={rtl ? "rtl" : "ltr"}>
            {diff
              ? diff.map((l, i) => (
                  <div key={i} className={"diff-line " + (l.t === "same" ? "" : l.t)}>
                    {l.s || "\u00a0"}
                  </div>
                ))
              : current.body}
          </div>
        </div>
      )}
    </section>
  );
}
