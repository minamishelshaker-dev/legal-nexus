import Link from "next/link";
import AuthActionForm from "@/components/auth-action-form";
import LanguageSwitcher from "@/components/language-switcher";
import { getLocale } from "@/lib/locale";
import "../auth.css";
export default async function ResetPasswordPage() {
  const lang = await getLocale(); const ar = lang === "ar";
  return <main className={"auth-shell " + (ar ? "is-ar" : "")} dir={ar ? "rtl" : "ltr"}>
    <header className="auth-top"><Link className="auth-brand" href="/"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></Link><LanguageSwitcher lang={lang} /></header>
    <section className="auth-panel"><div className="auth-kicker">{ar ? "تأمين الحساب" : "SECURE YOUR ACCOUNT"}</div>
      <h1>{ar ? "اختر كلمة مرور جديدة" : "Choose a new password."}</h1>
      <p>{ar ? "استخدم كلمة مرور قوية لا تقل عن 8 أحرف." : "Choose a strong password of at least 8 characters."}</p>
      <AuthActionForm mode="update-password" lang={lang} />
      <div className="auth-switch"><Link href="/login">{ar ? "العودة إلى تسجيل الدخول" : "Back to sign in"}</Link></div>
    </section><div className="auth-foot">LEGAL NEXUS · CORPORATE LEGAL OPERATING SYSTEM</div>
  </main>;
}
