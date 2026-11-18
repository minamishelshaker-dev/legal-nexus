import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale";
import InvitationAcceptance from "@/components/invitation-acceptance";
import "../../auth.css";

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const lang = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <main className={"auth-shell " + (lang === "ar" ? "is-ar" : "")} dir={lang === "ar" ? "rtl" : "ltr"}>
    <div className="onboard-header"><a href="/" className="auth-brand"><span className="mark">LN</span><span>LEGAL <b>NEXUS</b></span></a></div>
    <InvitationAcceptance token={token || ""} isSignedIn={!!user} email={user?.email || ""} lang={lang}/>
    <footer className="auth-foot">LEGAL NEXUS · {lang === "ar" ? "دعوة للانضمام إلى مؤسسة" : "ORGANIZATION INVITATION"}</footer>
  </main>;
}
