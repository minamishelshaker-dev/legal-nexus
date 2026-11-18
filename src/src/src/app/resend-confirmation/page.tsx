import Link from "next/link";
import AuthActionForm from "@/components/auth-action-form";
import LanguageSwitcher from "@/components/language-switcher";
import { getLocale } from "@/lib/locale";
import "../auth.css";
export default async function ResendConfirmationPage() {
  const lang = await getLocale(); const ar = lang === "ar";
  return <main className={"auth-shell " + (ar ? "is-ar" : "")} dir={ar ? "rtl" : "ltr"}>
    <header className="auth-top"><Link className="auth-brand" href="/"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></Link><LanguageSwitcher lang={lang} /></header>
    <section className="auth-panel"><div className="auth-kicker">{ar ? "تأكيد البريد الإلكتروني" : "EMAIL CONFIRMATION"}</div>
      <h1>{ar ? "إعادة إرسال رسالة التأكيد" : "Resend confirmation email."}</h1>
      <p>{ar ? "أدخل البريد المستخدم عند التسجيل لطلب رسالة تأكيد جديدة." : "Enter the email you used to sign up to request a new confirmation message."}</p>
      <AuthActionForm mode="resend-confirmation" lang={lang} />
      <div className="auth-switch"><Link href="/login">{ar ? "العودة إلى تسجيل الدخول" : "Back to sign in"}</Link></div>
    </section><div className="auth-foot">LEGAL NEXUS · CORPORATE LEGAL OPERATING SYSTEM</div>
  </main>;
}
