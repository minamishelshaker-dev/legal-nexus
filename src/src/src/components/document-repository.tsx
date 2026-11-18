"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DocumentRow = {
  id: string;
  title: string;
  storage_key: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  classification: string;
  related_record_type: string | null;
  related_record_id: string | null;
  created_at: string;
};

const bucket = "organization-documents-private";
const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "text/plain",
]);

export default function DocumentRepository({
  organizationId,
  userId,
  membershipRole,
  lang = "en",
}: {
  organizationId: string;
  userId: string;
  membershipRole: string;
  lang?: "ar" | "en";
}) {
  const ar = lang === "ar";
  const canManageSensitive = ["owner", "admin", "legal_manager", "lawyer", "hr_investigator"].includes(membershipRole);
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [title, setTitle] = useState("");
  const [classification, setClassification] = useState("internal");
  const [relatedType, setRelatedType] = useState("");
  const [relatedId, setRelatedId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState<{ id: string; path: string } | null>(null);
  const [download, setDownload] = useState<{ id: string; url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase.from("documents")
      .select("id,title,storage_key,mime_type,file_size_bytes,classification,related_record_type,related_record_id,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setRows((data || []) as DocumentRow[]);
    setLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => { void load(); }, [load]);

  async function uploadFile() {
    if (!file) {
      setError(ar ? "اختر ملفاً أولاً." : "Choose a file first.");
      return;
    }
    if (!title.trim() || title.trim().length < 3) {
      setError(ar ? "أدخل عنواناً لا يقل عن ثلاثة أحرف." : "Enter a title with at least three characters.");
      return;
    }
    if (!allowedTypes.has(file.type)) {
      setError(ar ? "نوع الملف غير مدعوم." : "This file type is not supported.");
      return;
    }
    if (file.size <= 0 || file.size > 50 * 1024 * 1024) {
      setError(ar ? "الحد الأقصى لحجم الملف 50 ميجابايت." : "Maximum file size is 50 MB.");
      return;
    }
    if ((relatedType && !relatedId.trim()) || (!relatedType && relatedId.trim())) {
      setError(ar ? "اختر نوع السجل المرتبط وأدخل معرفه معاً." : "Choose a related record type and provide its ID together.");
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");
    let documentId = pending?.id;
    let storagePath = pending?.path;
    if (!pending) {
      documentId = crypto.randomUUID();
      const safeName = file.name.normalize("NFKC").replace(/[^\w.() -]/g, "_").replace(/\s+/g, "_").slice(0, 160) || "document";
      storagePath = `${organizationId}/${documentId}/${safeName}`;
      const { error: insertError } = await supabase.from("documents").insert({
        id: documentId,
        organization_id: organizationId,
        title: title.trim(),
        storage_key: storagePath,
        mime_type: file.type,
        file_size_bytes: file.size,
        classification,
        related_record_type: relatedType || null,
        related_record_id: relatedId.trim() || null,
        uploaded_by: userId,
      });
      if (insertError) {
        setError(insertError.message);
        setUploading(false);
        return;
      }
      setPending({ id: documentId, path: storagePath });
    }

    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath!, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      setError(ar ? `تم حفظ بيانات المستند لكن تعذر رفع الملف: ${uploadError.message}. أعد المحاولة بالملف نفسه.` : `Document metadata was saved, but file upload failed: ${uploadError.message}. Retry with the same file.`);
      setUploading(false);
      return;
    }

    setPending(null);
    setFile(null);
    setTitle("");
    setRelatedType("");
    setRelatedId("");
    setNotice(ar ? "تم رفع المستند إلى المخزن الخاص." : "Document uploaded to the private repository.");
    await load();
    setUploading(false);
  }

  async function downloadFile(row: DocumentRow) {
    setError("");
    setNotice("");
    const { error: logError } = await supabase.rpc("log_document_access", { p_document_id: row.id });
    if (logError) {
      setError(logError.message);
      return;
    }
    const { data, error: urlError } = await supabase.storage.from(bucket).createSignedUrl(row.storage_key, 300);
    if (urlError || !data?.signedUrl) {
      setError(urlError?.message || (ar ? "تعذر إنشاء رابط التنزيل." : "Could not create a download link."));
      return;
    }
    setDownload({ id: row.id, url: data.signedUrl });
  }

  function fileSize(bytes: number | null) {
    if (!bytes) return "—";
    return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  }

  const classificationLabel: Record<string, string> = {
    public: ar ? "عام" : "Public",
    internal: ar ? "داخلي" : "Internal",
    confidential: ar ? "سري" : "Confidential",
    restricted: ar ? "مقيد" : "Restricted",
    highly_restricted: ar ? "شديد التقييد" : "Highly restricted",
  };

  return <div className="module-layout">
    <section className="module-panel">
      <div className="panel-heading">
        <span className="auth-kicker">{ar ? "مستودع المستندات" : "DOCUMENT REPOSITORY"}</span>
        <h2>{ar ? "رفع مستند مؤسسي" : "Upload an organization document"}</h2>
        <p>{ar ? "الملفات خاصة، وتخضع صلاحية الوصول لتصنيف المستند وعضوية المؤسسة." : "Files remain private; access depends on document classification and active organization membership."}</p>
      </div>
      <form className="module-form" onSubmit={e => { e.preventDefault(); void uploadFile(); }}>
        <div className="document-upload-grid">
          <label>{ar ? "عنوان المستند" : "Document title"}<input required minLength={3} maxLength={200} value={title} disabled={uploading || !!pending} onChange={e => setTitle(e.target.value)} /></label>
          <label>{ar ? "التصنيف" : "Classification"}<select value={classification} disabled={uploading || !!pending} onChange={e => setClassification(e.target.value)}>
            <option value="public">{ar ? "عام" : "Public"}</option>
            <option value="internal">{ar ? "داخلي" : "Internal"}</option>
            {canManageSensitive && <><option value="confidential">{ar ? "سري" : "Confidential"}</option><option value="restricted">{ar ? "مقيد" : "Restricted"}</option><option value="highly_restricted">{ar ? "شديد التقييد" : "Highly restricted"}</option></>}
          </select></label>
          <label>{ar ? "مرتبط بسجل" : "Related record"}<select value={relatedType} disabled={uploading || !!pending} onChange={e => setRelatedType(e.target.value)}><option value="">{ar ? "بدون ارتباط" : "No relation"}</option><option value="contract">{ar ? "عقد" : "Contract"}</option><option value="legal_matter">{ar ? "قضية أو منازعة" : "Legal matter"}</option></select></label>
          <label>{ar ? "معرف السجل المرتبط (اختياري)" : "Related record ID (optional)"}<input value={relatedId} disabled={uploading || !!pending || !relatedType} onChange={e => setRelatedId(e.target.value)} placeholder="UUID" /></label>
          <label className="document-file-field">{ar ? "الملف (حتى 50 ميجابايت)" : "File (up to 50 MB)"}<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt" disabled={uploading || !!pending} onChange={e => setFile(e.target.files?.[0] || null)} /></label>
        </div>
        {file && <p className="document-file-meta">{file.name} · {fileSize(file.size)} · {file.type || "unknown MIME"}</p>}
        {pending && <p className="document-pending">{ar ? "بيانات المستند محفوظة والملف ينتظر إعادة الرفع." : "Document record is saved; the file is waiting for an upload retry."}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {notice && <p className="success-message" role="status">{notice}</p>}
        <div className="form-actions"><button className="primary" type="submit" disabled={uploading || !file}>{uploading ? (ar ? "جارٍ الرفع..." : "Uploading…") : pending ? (ar ? "إعادة محاولة رفع الملف" : "Retry file upload") : (ar ? "رفع المستند" : "Upload document")}</button></div>
      </form>
    </section>
    <section className="module-panel">
      <div className="panel-heading"><span className="auth-kicker">{ar ? "ملفات المؤسسة" : "ORGANIZATION FILES"}</span><h2>{ar ? "المستندات المسجلة" : "Registered documents"}</h2></div>
      {loading ? <div className="empty-state">{ar ? "جارٍ تحميل المستندات..." : "Loading documents…"}</div> : rows.length === 0 ? <div className="empty-state">{ar ? "لا توجد مستندات متاحة وفق صلاحياتك." : "No documents are available to your role yet."}</div> : <div className="document-list">{rows.map(row => <article className="document-row" key={row.id}>
        <div className="document-row-main"><strong>{row.title}</strong><span>{classificationLabel[row.classification] || row.classification} · {fileSize(row.file_size_bytes)} · {row.mime_type || "—"}</span><small>{new Date(row.created_at).toLocaleDateString(ar ? "ar-EG" : "en-GB")}</small></div>
        <div className="document-row-actions"><button type="button" className="secondary" onClick={() => void downloadFile(row)}>{ar ? "إنشاء رابط تنزيل" : "Create download link"}</button>{download?.id === row.id && <a className="module-link" href={download.url} target="_blank" rel="noreferrer">{ar ? "فتح الملف" : "Open file"} ↗</a>}</div>
      </article>)}</div>}
    </section>
  </div>;
}
