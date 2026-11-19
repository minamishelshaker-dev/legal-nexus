
drop policy if exists "organization admins can manage departments" on public.departments;
create policy "organization admins can insert departments"
on public.departments for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager']));
create policy "organization admins can update departments"
on public.departments for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager']))
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager']));
create policy "organization admins can delete departments"
on public.departments for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager']));

drop policy if exists "organization admins can manage corporate entities" on public.corporate_entities;
create policy "organization admins can insert corporate entities"
on public.corporate_entities for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager']));
create policy "organization admins can update corporate entities"
on public.corporate_entities for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager']))
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager']));
create policy "organization admins can delete corporate entities"
on public.corporate_entities for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager']));
