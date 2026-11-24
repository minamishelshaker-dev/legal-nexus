import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale";
import { canOpen } from "@/lib/access";
import LegalSpend from "@/components/legal-spend";
import "../../people.css";
import "../../chat.css";
import "../../searchpage.css";
import "../../templates.css";
import "../../spend.css";
import "../investigations/investigations.css";

export default async function SpendPage() {
  const lang = await getLocale();
  const ar = lang === "ar";
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

  if (!canOpen("spend", membership.membership_role)) {
    return (
      <div className="denied">
        <strong>{ar ? "هذه الوحدة غير متاحة لدورك" : "This module is not available for your role"}</strong>
        {ar ? "تقارير الإنفاق القانوني متاحة للمالك ومدير النظام ومدير الشؤون القانونية." : "Legal spend reports are available to the owner, administrators and legal managers."}
      </div>
    );
  }

  return <LegalSpend organizationId={membership.organization_id} userId={user.id} lang={lang} />;
}
