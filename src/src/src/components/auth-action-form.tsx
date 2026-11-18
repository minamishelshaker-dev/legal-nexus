"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "request-reset" | "update-password" | "resend-confirmation";
export default function AuthActionForm({ mode, lang = "en" }: { mode: Mode; lang?: "ar" | "en" }) {
  const ar = lang === "ar";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionReady, setSessionReady] = useState(mode !== "update-password");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (mode !== "update-password") return;
    let active = true;
    createClient().auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError || !data.user) {
        setError(ar ? "رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً." : "The recovery link is invalid or expired. Please request a new link.");
      }
      setSessionReady(true);
    });
    return () => { active = false; };
  }, [mode, ar]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const supabase = createClient();
    try {
      if (mode === "update-password") {
        if (password.length < 8) throw new Error(ar ? "يجب ألا تقل كلمة المرور عن 8 أحرف." : "Password must be at least 8 characters.");
        if (password !== confirm) throw new Error(ar ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.");
        const { data: { user }, error: sessionError } = await supabase.auth.getUser();
        if (sessionError || !user) throw new Error(ar ? "جلسة الاستعادة غير صالحة. اطلب رابطاً جديداً." : "Your recovery session is invalid. Request a new link.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage(ar ? "تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول." : "Password updated successfully. You can now sign in.");
        router.replace("/login?password=updated");
        router.refresh();
      } else if (mode === "request-reset") {
        const redirectTo = window.location.origin + "/auth/callback?next=/reset-password";
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        setMessage(ar ? "إذا كان البريد مسجلاً، فستصلك رسالة تتضمن رابطاً آمناً لتغيير كلمة المرور." : "If the email is registered, you'll receive a secure password-reset link.");
      } else {
        const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: window.location.origin + "/auth/callback" } });
        if (error) throw error;
        setMessage(ar ? "إذا كان الحساب يحتاج إلى تأكيد، فستصلك رسالة جديدة." : "If the account needs confirmation, a new email will be sent.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : (ar ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again."));
    } finally { setBusy(false); }
  }

  const update = mode === "update-password";
  const resend = mode === "resend-confirmation";
  if (update && !sessionReady) return <p role="status">{ar ? "جارٍ التحقق من رابط الاستعادة..." : "Verifying your recovery link..."}</p>;
  return <form className="auth-form" onSubmit={submit}>
    {!update && <label>{ar ? "البريد الإلكتروني" : "Email address"}<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>}
    {update && <>
      <label>{ar ? "كلمة المرور الجديدة" : "New password"}<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label>{ar ? "تأكيد كلمة المرور" : "Confirm password"}<input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
    </>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {message && <p className="auth-success" role="status">{message}</p>}
    {update && error && <p className="auth-switch"><a href="/forgot-password">{ar ? "طلب رابط استعادة جديد" : "Request a new recovery link"}</a></p>}
    <button className="auth-submit" type="submit" disabled={busy || (update && !!error)}>{busy ? (ar ? "يرجى الانتظار..." : "Please wait...") : update ? (ar ? "تحديث كلمة المرور" : "Update password") : resend ? (ar ? "إعادة إرسال رسالة التأكيد" : "Resend confirmation email") : (ar ? "إرسال رابط الاستعادة" : "Send reset link")}</button>
  </form>;
}
