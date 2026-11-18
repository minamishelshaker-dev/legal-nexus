import Link from "next/link";
import AuthForm from "@/components/auth-form";
import LanguageSwitcher from "@/components/language-switcher";
import { getLocale } from "@/lib/locale";
import "../auth.css";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; password?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const lang = await getLocale();
  const ar = lang === "ar";
  const { error, password } = await searchParams;
  const authError = error === "confirmation"
    ? (ar ? "تعذر تأكيد البريد الإلكتروني. قد يكون الرابط منتهي الصلاحية أو غير صالح. اطلب رسالة تأكيد جديدة." : "We couldn't confirm your email. The link may be expired or invalid. Request a new confirmation email.")
    : error === "session"
      ? (ar ? "تم التحقق من الرابط، لكن تعذر إنشاء جلسة تسجيل الدخول. حاول مرة أخرى." : "The link was verified, but we couldn't establish your sign-in session. Please try again.")
      : error === "profile"
        ? (ar ? "تم التحقق من الحساب، لكن تعذر تجهيز ملف المستخدم. يرجى المحاولة مرة أخرى أو التواصل مع الدعم." : "Your account was verified, but we couldn't finish setting up your profile. Please try again or contact support.")
        : null;
  const authSuccess = password === "updated" ? (ar ? "تم تحديث كلمة المرور. يمكنك تسجيل الدخول باستخدام كلمة المرور الجديدة." : "Your password has been updated. Sign in with your new password.") : null;

  return (
    <main className={"auth-shell " + (ar ? "is-ar" : "")} dir={ar ? "rtl" : "ltr"}>
      <header className="auth-top">
        <Link className="auth-brand" href="/"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></Link>
        <LanguageSwitcher lang={lang} />
      </header>
      <section className="auth-panel">
        <div className="auth-kicker">{ar ? "مرحباً بعودتك" : "WELCOME BACK"}</div>
        <h1>{ar ? "سجل الدخول إلى مساحة عملك" : "Sign in to your workspace."}</h1>
        <p>{ar ? "ادخل إلى عمليات مؤسستك القانونية بأمان." : "Access your organization's legal operations securely."}</p>
        {authError && <p className="auth-error" role="alert">{authError}</p>}{authSuccess && <p className="auth-success" role="status">{authSuccess}</p>}
        <AuthForm mode="login" lang={lang} />
        <div className="auth-switch"><Link href="/forgot-password">{ar ? "هل نسيت كلمة المرور؟" : "Forgot your password?"}</Link><span> · </span><Link href="/resend-confirmation">{ar ? "إعادة إرسال التأكيد" : "Resend confirmation"}</Link></div>
        <div className="auth-switch">{ar ? "ليس لديك حساب؟ " : "New to Legal Nexus? "}<Link href="/signup">{ar ? "أنشئ حساباً" : "Create an account"}</Link></div>
        <Link className="auth-home" href="/">{ar ? "العودة إلى المنصة ←" : "← Back to platform"}</Link>
      </section>
      <div className="auth-foot">LEGAL NEXUS · CORPORATE LEGAL OPERATING SYSTEM</div>
    </main>
  );
}
