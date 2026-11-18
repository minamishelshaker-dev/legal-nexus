"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "forgot" | "resend" | "reset";
const productionOrigin = "https://legal-nexus-hayah7.vercel.app";

export default function AuthRecoveryForm({ mode, lang = "en" }: { mode: Mode; lang?: "ar" | "en" }) {
  const ar = lang === "ar";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(mode !== "reset");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "reset") return;
    let active = true;
    createClient().auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError || !data.user) setError(ar ? "جلسة استعادة كلمة المرور غير صالحة أو انتهت. اطلب رابطاً جديداً." : "This password recovery session is invalid or expired. Request a new link.");
      setReady(true);
    });
    return () => { active = false; };
  }, [mode, ar]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const supabase = createClient();
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: productionOrigin + "/auth/callback?next=/reset-password",
        });
        if (error) throw error;
        setMessage(ar ? "إذا كان البريد مسجلاً، فستصلك رسالة تتضمن رابطاً آمناً لتغيير كلمة المرور." : "If the email is registered, you will receive a secure password-reset link.");
      } else if (mode === "resend") {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: productionOrigin + "/auth/callback" },
        });
        if (error) throw error;
        setMessage(ar ? "إذا كان الحساب ينتظر التأكيد، فستصلك رسالة تأكيد جديدة." : "If the account is awaiting confirmation, a new confirmation email will be sent.");
      } else {
        if (password.length < 8) throw new Error(ar ? "يجب ألا تقل كلمة المرور عن 8 أحرف." : "Password must be at least 8 characters.");
        if (password !== confirmPassword) throw new Error(ar ? "كلمتا المرور غير متطابقتين." : "The passwords do not match.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage(ar ? "تم تغيير كلمة المرور بنجاح. جارٍ تحويلك إلى مساحة العمل..." : "Your password has been updated. Redirecting to your workspace...");
        router.replace("/workspace");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : (ar ? "تعذر إتمام الطلب. حاول مرة أخرى." : "We couldn't complete the request. Please try again."));
    } finally { setBusy(false); }
  }

  if (!ready) return <p role="status">{ar ? "جارٍ التحقق من الرابط..." : "Checking your recovery link..."}</p>;

  return <form className="auth-form" onSubmit={submit}>
    {mode !== "reset" && <label>{ar ? "البريد الإلكتروني" : "Email address"}<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>}
    {mode === "reset" && <>
      <label>{ar ? "كلمة المرور الجديدة" : "New password"}<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label>{ar ? "تأكيد كلمة المرور" : "Confirm password"}<input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
    </>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {message && <p className="auth-success" role="status">{message}</p>}
    <button className="auth-submit" type="submit" disabled={busy || (mode === "reset" && !!error)}>
      {busy ? (ar ? "يرجى الانتظار..." : "Please wait...") :
        mode === "forgot" ? (ar ? "إرسال رابط الاستعادة" : "Send reset link") :
        mode === "resend" ? (ar ? "إعادة إرسال رسالة التأكيد" : "Resend confirmation email") :
        (ar ? "حفظ كلمة المرور الجديدة" : "Save new password")}
    </button>
  </form>;
}
