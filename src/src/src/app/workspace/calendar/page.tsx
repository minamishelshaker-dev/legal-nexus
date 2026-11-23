import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale";
import CalendarCenter from "@/components/calendar-center";
import "../../people.css";
import "../../chat.css";
import "../../searchpage.css";
import "../../calendar.css";

export default async function CalendarPage() {
  const lang = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id,membership_role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  return <CalendarCenter organizationId={membership.organization_id} role={membership.membership_role} lang={lang} />;
}
