"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SourceRequest({
  recordType,
  recordId,
  lang,
}: {
  recordType: "contract" | "legal_matter";
  recordId: string;
  lang: "ar" | "en";
}) {
  const ar = lang === "ar";
  const supabase = useMemo(() => createClient(), []);
  const [req, setReq] = useState<{ id: string; title: string; request_number: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: link } = await supabase
        .from("legal_request_links")
        .select("legal_request_id")
        .eq("record_type", recordType)
        .eq("record_id", recordId)
        .limit(1)
        .maybeSingle();
      if (!link || !active) return;
      const { data } = await supabase.from("legal_requests").select("id,title,request_number").eq("id", link.legal_request_id).maybeSingle();
      if (data && active) setReq(data as { id: string; title: string; request_number: string | null });
    })();
    return () => {
      active = false;
    };
  }, [recordType, recordId, supabase]);

  if (!req) return null;
  return (
    <div className="source-banner">
      <span className="chip gold">{ar ? "أُنشئ من طلب قانوني" : "Created from a legal request"}</span>
      <Link href={`/workspace/requests/${req.id}`} className="dash-link">
        {(req.request_number ? req.request_number + " · " : "") + req.title}
      </Link>
    </div>
  );
}
