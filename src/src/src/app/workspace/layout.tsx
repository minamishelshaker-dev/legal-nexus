import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale";
import AppShell from "@/components/app-shell";
import "../auth.css";
import "../shell.css";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
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

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", membership.organization_id)
    .maybeSingle();

  return (
    <AppShell lang={lang} orgName={organization?.name ?? ""} role={membership.membership_role} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
