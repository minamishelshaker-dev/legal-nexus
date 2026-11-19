
drop index if exists public.uq_org_membership_user;
create index if not exists idx_org_invitations_invited_by
on public.organization_invitations (invited_by);
create index if not exists idx_org_invitations_accepted_by
on public.organization_invitations (accepted_by);

drop policy if exists "invitees and org admins can view invitations" on public.organization_invitations;
create policy "invitees and org admins can view invitations"
on public.organization_invitations for select to authenticated
using (
  lower(invited_email) = lower(coalesce((select auth.jwt()) ->> 'email',''))
  or private.has_org_role(organization_id, array['owner','admin'])
);
