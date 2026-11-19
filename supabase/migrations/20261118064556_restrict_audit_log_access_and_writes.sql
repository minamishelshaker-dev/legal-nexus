
drop policy if exists "members can view audit events" on public.audit_events;
create policy "authorized administrators can view audit events"
on public.audit_events
for select
to authenticated
using (
  private.has_org_role(
    organization_id,
    array['owner','admin','legal_manager','hr_manager']::text[]
  )
);

revoke insert on table public.audit_events from authenticated;
