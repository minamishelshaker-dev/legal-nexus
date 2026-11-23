import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale";
import { canOpen } from "@/lib/access";
import TemplatesCenter from "@/components/templates-center";
import "../../people.css";
import "../../templates.css";

export default async function TemplatesPage() {
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

  if (!canOpen("templates", membership.membership_role)) {
    return (
      <div className="denied">
        <strong>{ar ? "هذه الوحدة غير متاحة لدورك" : "This module is not available for your role"}</strong>
        {ar ? "قوالب العقود متاحة لأدوار القانون والعقود فقط." : "Contract templates are available to legal and contract roles only."}
      </div>
    );
  }

  const canManage = ["owner", "admin", "legal_manager", "lawyer"].includes(membership.membership_role);
  return <TemplatesCenter organizationId={membership.organization_id} userId={user.id} canManage={canManage} lang={lang} />;
}
