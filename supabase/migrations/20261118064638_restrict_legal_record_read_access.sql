
drop policy if exists "organization members can view contracts" on public.contracts;
create policy "authorized legal and contract roles can view contracts"
on public.contracts
for select
to authenticated
using (
  private.has_org_role(
    organization_id,
    array['owner','admin','legal_manager','lawyer','contract_manager']::text[]
  )
);

drop policy if exists "organization members can view legal matters" on public.legal_matters;
create policy "authorized legal roles can view legal matters"
on public.legal_matters
for select
to authenticated
using (
  private.has_org_role(
    organization_id,
    array['owner','admin','legal_manager','lawyer']::text[]
  )
);
