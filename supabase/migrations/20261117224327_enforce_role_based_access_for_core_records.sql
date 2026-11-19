
create or replace function private.has_org_role(target_org uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.membership_role = any(allowed_roles)
  );
$function$;

revoke all on function private.has_org_role(uuid, text[]) from public, anon;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;

-- Legal matters: members may read; only authorized legal staff may write.
drop policy if exists "members can manage legal matters" on public.legal_matters;
create policy "organization members can view legal matters"
on public.legal_matters for select to authenticated
using (private.is_org_member(organization_id));
create policy "authorized roles can create legal matters"
on public.legal_matters for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']));
create policy "authorized roles can update legal matters"
on public.legal_matters for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']))
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']));
create policy "authorized roles can delete legal matters"
on public.legal_matters for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager']));

-- Contracts: members may read; contract/legal leadership and assigned contract managers may write.
drop policy if exists "members can manage contracts" on public.contracts;
create policy "organization members can view contracts"
on public.contracts for select to authenticated
using (private.is_org_member(organization_id));
create policy "authorized roles can create contracts"
on public.contracts for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer','contract_manager']));
create policy "authorized roles can update contracts"
on public.contracts for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer','contract_manager']))
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer','contract_manager']));
create policy "authorized roles can delete contracts"
on public.contracts for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager']));

-- Organization structure is readable by members but maintained by administrators/legal leadership.
drop policy if exists "members can manage departments" on public.departments;
create policy "organization members can view departments"
on public.departments for select to authenticated
using (private.is_org_member(organization_id));
create policy "organization admins can manage departments"
on public.departments for all to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager']))
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager']));

drop policy if exists "members can manage entities" on public.corporate_entities;
create policy "organization members can view corporate entities"
on public.corporate_entities for select to authenticated
using (private.is_org_member(organization_id));
create policy "organization admins can manage corporate entities"
on public.corporate_entities for all to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager']))
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager']));

-- Investigations are retained as legal records; close/archive instead of hard deletion.
drop policy if exists "authorized legal roles can delete investigations" on public.administrative_investigations;
