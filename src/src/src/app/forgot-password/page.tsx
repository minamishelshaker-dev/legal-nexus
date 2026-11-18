import Link from "next/link";
import AuthActionForm from "@/components/auth-action-form";
import LanguageSwitcher from "@/components/language-switcher";
import { getLocale } from "@/lib/locale";
import "../auth.css";
export default async function ForgotPasswordPage() {
  const lang = await getLocale(); const ar = lang === "ar";
  return <main className={"auth-shell " + (ar ? "is-ar" : "")} dir={ar ? "rtl" : "ltr"}>
    <header className="auth-top"><Link className="auth-brand" href="/"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></Link><LanguageSwitcher lang={lang} /></header>
    <section className="auth-panel"><div className="auth-kicker">{ar ? "استعادة الحساب" : "ACCOUNT RECOVERY"}</div>
      <h1>{ar ? "إعادة تعيين كلمة المرور" : "Reset your password."}</h1>
      <p>{ar ? "أدخل بريدك الإلكتروني وسنرسل إليك رابطاً آمناً لإعادة تعيين كلمة المرور." : "Enter your email and we'll send you a secure link to reset your password."}</p>
      <AuthActionForm mode="request-reset" lang={lang} />
      <div className="auth-switch"><Link href="/login">{ar ? "العودة إلى تسجيل الدخول" : "Back to sign in"}</Link></div>
    </section><div className="auth-foot">LEGAL NEXUS · CORPORATE LEGAL OPERATING SYSTEM</div>
  </main>;
}
