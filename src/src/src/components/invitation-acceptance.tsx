"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvitationAcceptance({ token, isSignedIn, email, lang = "en" }: { token: string; isSignedIn: boolean; email: string; lang?: "ar" | "en" }) {
  const ar = lang === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function accept() {
    if (!token) { setError(ar ? "رابط الدعوة غير صالح أو غير مكتمل." : "The invitation link is invalid or incomplete."); return; }
    setBusy(true); setError("");
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("accept_org_invitation", { target_token: token });
    if (rpcError || !data) setError(rpcError?.message || (ar ? "تعذر قبول الدعوة." : "Unable to accept the invitation."));
    else { setDone(true); router.replace("/workspace"); router.refresh(); }
    setBusy(false);
  }
  return <section className="auth-panel"><div className="auth-kicker">{ar ? "دعوة مؤسسة" : "ORGANIZATION INVITATION"}</div><h1>{ar ? "انضم إلى مساحة العمل." : "Join the workspace."}</h1>
    <p>{ar ? "قبول الدعوة يتطلب تسجيل الدخول بالبريد الإلكتروني الذي أُرسلت إليه الدعوة." : "To accept this invitation, sign in using the email address the invitation was issued to."}</p>
    {isSignedIn ? <><p>{ar ? "الحساب الحالي: " : "Currently signed in as: "}<strong>{email}</strong></p><button className="primary" disabled={busy || done} onClick={() => void accept()}>{busy ? (ar ? "جارٍ قبول الدعوة..." : "Accepting…") : (ar ? "قبول الدعوة" : "Accept invitation")}</button></> : <div className="form-actions"><Link className="module-link" href="/login">{ar ? "تسجيل الدخول" : "Sign in"}</Link><Link className="module-link" href="/signup">{ar ? "إنشاء حساب" : "Create account"}</Link></div>}
    {done && <p className="success-message">{ar ? "تم قبول الدعوة." : "Invitation accepted."}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
