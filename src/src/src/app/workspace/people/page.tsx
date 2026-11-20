import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale";
import { canOpen } from "@/lib/access";
import PeopleDirectory from "@/components/people-directory";
import "../../people.css";

export default async function PeoplePage() {
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

  if (!canOpen("people", membership.membership_role)) {
    return (
      <div className="denied">
        <strong>{ar ? "هذه الوحدة غير متاحة لدورك" : "This module is not available for your role"}</strong>
        {ar ? "بيانات الموظفين سرية وتتاح للمالك ومدير النظام ومدير الموارد البشرية فقط." : "Employee data is confidential and available to the owner, administrators and HR managers only."}
      </div>
    );
  }

  return <PeopleDirectory organizationId={membership.organization_id} lang={lang} />;
}
