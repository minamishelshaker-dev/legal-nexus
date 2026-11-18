"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type LegalRequest = {
  id: string;
  request_number: string | null;
  request_type: string;
  title: string;
  description: string;
  urgency: string;
  status: string;
  due_at: string | null;
  created_at: string;
};

const requestTypes = [
  ["legal_opinion", "Legal opinion"],
  ["contract_review", "Contract review"],
  ["litigation_support", "Litigation support"],
  ["regulatory_question", "Regulatory question"],
  ["policy_review", "Policy review"],
  ["investigation_referral", "Investigation referral"],
  ["other", "Other"],
];

const labels: Record<string, string> = {
  submitted: "Submitted", pending_approval: "Pending approval", approved: "Approved",
  rejected: "Rejected", in_progress: "In progress", completed: "Completed",
  legal_opinion: "Legal opinion", contract_review: "Contract review",
  litigation_support: "Litigation support", regulatory_question: "Regulatory question",
  policy_review: "Policy review", investigation_referral: "Investigation referral",
  other: "Other", normal: "Normal", high: "High",
};

export default function LegalRequests({ organizationId, userId }: { organizationId: string; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<LegalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState("legal_opinion");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase.from("legal_requests")
      .select("id,request_number,request_type,title,description,urgency,status,due_at,created_at")
      .eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100);
    if (queryError) setError(queryError.message);
    else setRows((data ?? []) as LegalRequest[]);
    setLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    const { error: insertError } = await supabase.from("legal_requests").insert({
      organization_id: organizationId, requester_user_id: userId, request_type: requestType,
      title: title.trim(), description: description.trim(), urgency: "normal",
    });
    if (insertError) setError(insertError.message);
    else {
      setTitle(""); setDescription(""); setNotice("Your legal request was submitted.");
      await load();
    }
    setSaving(false);
  }

  return (
    <div className="module-layout">
      <section className="module-panel">
        <div className="panel-heading"><div><span className="auth-kicker">WORKFLOW · INTAKE</span><h2>Submit a legal request</h2><p>Send a structured request to your legal team. Your access and organization boundary are enforced by database policies.</p></div></div>
        <form className="module-form" onSubmit={submit}>
          <label>Request type<select value={requestType} onChange={(e) => setRequestType(e.target.value)}>{requestTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Request title<input required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Review supplier agreement" /></label>
          <label>Details<textarea required minLength={10} maxLength={10000} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the request, relevant background and expected outcome." /></label>
          <div className="form-actions"><button className="primary" type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit request"}</button>{notice && <span className="success-message" role="status">{notice}</span>}</div>
        </form>
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>
      <section className="module-panel">
        <div className="panel-heading panel-heading-row"><div><span className="auth-kicker">ORGANIZATION WORKFLOW</span><h2>Recent requests</h2><p>Requests visible to your account under the current access rules.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
        {loading ? <div className="empty-state">Loading requests…</div> : rows.length === 0 ? <div className="empty-state"><strong>No legal requests yet</strong><span>Submit the first request using the form. No sample records have been added.</span></div> : (
          <div className="request-list">{rows.map((row) => <article className="request-row" key={row.id}>
            <div className="request-row-main"><div className="request-meta"><span>{row.request_number || "New request"}</span><span>{new Date(row.created_at).toLocaleDateString()}</span></div><h3>{row.title}</h3><p>{row.description}</p><div className="request-tags"><span>{labels[row.request_type] || row.request_type}</span><span>{labels[row.urgency] || row.urgency}</span></div></div>
            <span className={`status-pill status-${row.status}`}>{labels[row.status] || row.status.replaceAll("_", " ")}</span>
          </article>)}</div>
        )}
      </section>
    </div>
  );
}
