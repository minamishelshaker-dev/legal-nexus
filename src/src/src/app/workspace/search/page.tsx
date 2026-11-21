import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale";
import SearchCenter from "@/components/search-center";
import "../../people.css";
import "../../chat.css";
import "../../searchpage.css";

type Params = { q?: string; t?: string; s?: string; from?: string; to?: string; mine?: string; sort?: string };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
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

  const init = {
    q: (sp.q ?? "").slice(0, 200),
    types: (sp.t ?? "").split(",").filter(Boolean),
    status: (sp.s ?? "").slice(0, 40),
    from: sp.from && DATE.test(sp.from) ? sp.from : "",
    to: sp.to && DATE.test(sp.to) ? sp.to : "",
    mine: sp.mine === "1",
    sort: ["newest", "oldest", "az"].includes(sp.sort ?? "") ? (sp.sort as string) : "newest",
  };

  return <SearchCenter organizationId={membership.organization_id} userId={user.id} role={membership.membership_role} lang={lang} init={init} />;
}
