
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function private.has_legal_sensitive_role(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.membership_role in ('owner','admin','legal_manager','lawyer','hr_investigator')
  );
$$;

revoke all on function private.is_org_member(uuid) from public, anon, authenticated;
revoke all on function private.has_legal_sensitive_role(uuid) from public, anon, authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_legal_sensitive_role(uuid) to authenticated;

alter policy "members can view their organizations" on public.organizations
  using (private.is_org_member(id));
alter policy "members can view organization memberships" on public.organization_memberships
  using (private.is_org_member(organization_id));
alter policy "members can manage entities" on public.corporate_entities
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can view entities" on public.corporate_entities
  using (private.is_org_member(organization_id));
alter policy "members can manage departments" on public.departments
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can view departments" on public.departments
  using (private.is_org_member(organization_id));
alter policy "members can manage legal matters" on public.legal_matters
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can view legal matters" on public.legal_matters
  using (private.is_org_member(organization_id));
alter policy "members can manage contracts" on public.contracts
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can view contracts" on public.contracts
  using (private.is_org_member(organization_id));
alter policy "members can append audit events" on public.audit_events
  with check (private.is_org_member(organization_id) and actor_user_id = (select auth.uid()));
alter policy "members can view audit events" on public.audit_events
  using (private.is_org_member(organization_id));
alter policy "authorized legal roles can create investigations" on public.administrative_investigations
  with check (private.has_legal_sensitive_role(organization_id));
alter policy "authorized legal roles can delete investigations" on public.administrative_investigations
  using (private.has_legal_sensitive_role(organization_id));
alter policy "authorized legal roles can update investigations" on public.administrative_investigations
  using (private.has_legal_sensitive_role(organization_id) or investigator_user_id = (select auth.uid()))
  with check (private.has_legal_sensitive_role(organization_id) or investigator_user_id = (select auth.uid()));
alter policy "authorized legal roles can view investigations" on public.administrative_investigations
  using (private.has_legal_sensitive_role(organization_id) or investigator_user_id = (select auth.uid()) or decision_maker_user_id = (select auth.uid()));
alter policy "members can add documents" on public.documents
  with check (private.is_org_member(organization_id) and uploaded_by = (select auth.uid()));
alter policy "authorized members can delete documents" on public.documents
  using (private.has_legal_sensitive_role(organization_id));
alter policy "authorized members can update documents" on public.documents
  using (private.has_legal_sensitive_role(organization_id))
  with check (private.has_legal_sensitive_role(organization_id));
alter policy "members can view appropriately classified documents" on public.documents
  using (
    private.is_org_member(organization_id)
    and (
      classification = any (array['public'::text, 'internal'::text])
      or private.has_legal_sensitive_role(organization_id)
    )
  );

drop function public.is_org_member(uuid);
drop function public.has_legal_sensitive_role(uuid);
