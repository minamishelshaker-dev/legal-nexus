
create or replace function public.has_legal_sensitive_role(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.membership_role in ('owner','admin','legal_manager','lawyer','hr_investigator')
  );
$$;

drop policy if exists "members can view investigations" on public.administrative_investigations;
drop policy if exists "members can manage investigations" on public.administrative_investigations;
create policy "authorized legal roles can view investigations" on public.administrative_investigations
for select to authenticated
using (
  public.has_legal_sensitive_role(organization_id)
  or investigator_user_id = auth.uid()
  or decision_maker_user_id = auth.uid()
);
create policy "authorized legal roles can create investigations" on public.administrative_investigations
for insert to authenticated
with check (public.has_legal_sensitive_role(organization_id));
create policy "authorized legal roles can update investigations" on public.administrative_investigations
for update to authenticated
using (public.has_legal_sensitive_role(organization_id) or investigator_user_id = auth.uid())
with check (public.has_legal_sensitive_role(organization_id) or investigator_user_id = auth.uid());
create policy "authorized legal roles can delete investigations" on public.administrative_investigations
for delete to authenticated
using (public.has_legal_sensitive_role(organization_id));

drop policy if exists "members can view documents" on public.documents;
drop policy if exists "members can manage documents" on public.documents;
create policy "members can view appropriately classified documents" on public.documents
for select to authenticated
using (
  public.is_org_member(organization_id)
  and (
    classification in ('public','internal')
    or public.has_legal_sensitive_role(organization_id)
  )
);
create policy "members can add documents" on public.documents
for insert to authenticated
with check (public.is_org_member(organization_id) and uploaded_by = auth.uid());
create policy "authorized members can update documents" on public.documents
for update to authenticated
using (public.has_legal_sensitive_role(organization_id))
with check (public.has_legal_sensitive_role(organization_id));
create policy "authorized members can delete documents" on public.documents
for delete to authenticated
using (public.has_legal_sensitive_role(organization_id));
