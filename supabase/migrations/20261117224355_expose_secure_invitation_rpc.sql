
grant select on public.organization_invitations to authenticated;

create or replace function public.create_org_invitation(target_org uuid, target_email text, target_role text)
returns table(invitation_id uuid, invitation_token uuid, expires_at timestamptz)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.create_org_invitation(target_org, target_email, target_role);
$function$;

create or replace function public.accept_org_invitation(target_token uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.accept_org_invitation(target_token);
$function$;

create or replace function public.revoke_org_invitation(target_invitation uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.revoke_org_invitation(target_invitation);
$function$;

revoke all on function public.create_org_invitation(uuid,text,text) from public, anon;
revoke all on function public.accept_org_invitation(uuid) from public, anon;
revoke all on function public.revoke_org_invitation(uuid) from public, anon;
grant execute on function public.create_org_invitation(uuid,text,text) to authenticated;
grant execute on function public.accept_org_invitation(uuid) to authenticated;
grant execute on function public.revoke_org_invitation(uuid) to authenticated;
