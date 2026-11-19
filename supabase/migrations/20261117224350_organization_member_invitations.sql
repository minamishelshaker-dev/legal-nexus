
create unique index if not exists uq_org_membership_user
on public.organization_memberships (organization_id, user_id);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_email text not null,
  membership_role text not null
    check (membership_role in ('admin','legal_manager','lawyer','contract_manager','hr_investigator','employee','auditor','member')),
  token_hash text not null unique,
  status text not null default 'invited'
    check (status in ('invited','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint invitation_email_not_blank check (length(trim(invited_email)) > 3)
);

create index if not exists idx_org_invitations_org_status
on public.organization_invitations (organization_id, status, created_at desc);
create index if not exists idx_org_invitations_email
on public.organization_invitations (lower(invited_email));

alter table public.organization_invitations enable row level security;

create policy "invitees and org admins can view invitations"
on public.organization_invitations for select to authenticated
using (
  lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email',''))
  or private.has_org_role(organization_id, array['owner','admin'])
);

create or replace function private.create_org_invitation(
  target_org uuid,
  target_email text,
  target_role text
)
returns table(invitation_id uuid, invitation_token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token uuid := gen_random_uuid();
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
  v_actor uuid := auth.uid();
  v_email text := lower(trim(target_email));
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;
  if v_email is null or length(v_email) < 5 or position('@' in v_email) < 2 then
    raise exception 'A valid email address is required';
  end if;
  if target_role not in ('admin','legal_manager','lawyer','contract_manager','hr_investigator','employee','auditor','member') then
    raise exception 'Role is not eligible for invitation';
  end if;
  if not private.has_org_role(target_org, array['owner','admin']) then
    raise exception 'Insufficient permission to invite members';
  end if;
  if target_role = 'admin' and not private.has_org_role(target_org, array['owner']) then
    raise exception 'Only the organization owner can appoint an admin';
  end if;
  if exists (
    select 1 from public.organization_memberships m
    join auth.users u on u.id = m.user_id
    where m.organization_id = target_org
      and lower(u.email) = v_email
      and m.status in ('active','invited')
  ) then
    raise exception 'This email already has an organization membership';
  end if;
  if exists (
    select 1 from public.organization_invitations i
    where i.organization_id = target_org
      and lower(i.invited_email) = v_email
      and i.status = 'invited'
      and i.expires_at > now()
  ) then
    raise exception 'An active invitation already exists for this email';
  end if;

  insert into public.organization_invitations
    (organization_id, invited_email, membership_role, token_hash, invited_by, expires_at)
  values
    (target_org, v_email, target_role, md5(v_token::text), v_actor, v_expires)
  returning id into v_id;

  insert into public.audit_events
    (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values
    (target_org, v_actor, 'member.invited', 'organization_invitation', v_id::text,
     jsonb_build_object('email', v_email, 'role', target_role));

  return query select v_id, v_token, v_expires;
end;
$function$;

create or replace function private.accept_org_invitation(target_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  v_inv public.organization_invitations%rowtype;
  v_membership uuid;
begin
  if v_actor is null or v_email = '' then
    raise exception 'A verified signed-in account is required';
  end if;

  select * into v_inv
  from public.organization_invitations i
  where i.token_hash = md5(target_token::text)
  for update;

  if not found then
    raise exception 'Invitation is invalid';
  end if;
  if v_inv.status <> 'invited' then
    raise exception 'Invitation is no longer active';
  end if;
  if v_inv.expires_at <= now() then
    update public.organization_invitations set status='expired' where id=v_inv.id;
    raise exception 'Invitation has expired';
  end if;
  if lower(v_inv.invited_email) <> v_email then
    raise exception 'The signed-in email does not match the invitation';
  end if;
  if exists (
    select 1 from public.organization_memberships m
    where m.organization_id=v_inv.organization_id and m.user_id=v_actor
  ) then
    raise exception 'This user already has a membership in the organization';
  end if;

  insert into public.organization_memberships
    (organization_id, user_id, membership_role, status)
  values
    (v_inv.organization_id, v_actor, v_inv.membership_role, 'active')
  returning id into v_membership;

  update public.organization_invitations
  set status='accepted', accepted_by=v_actor, accepted_at=now()
  where id=v_inv.id;

  insert into public.audit_events
    (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values
    (v_inv.organization_id, v_actor, 'member.invitation_accepted', 'organization_membership', v_membership::text,
     jsonb_build_object('invitation_id', v_inv.id, 'role', v_inv.membership_role));

  return v_membership;
end;
$function$;

create or replace function private.revoke_org_invitation(target_invitation uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;
  select organization_id into v_org
  from public.organization_invitations
  where id=target_invitation and status='invited'
  for update;
  if v_org is null then
    return false;
  end if;
  if not private.has_org_role(v_org, array['owner','admin']) then
    raise exception 'Insufficient permission to revoke invitations';
  end if;
  update public.organization_invitations
  set status='revoked', revoked_at=now()
  where id=target_invitation and status='invited';
  insert into public.audit_events
    (organization_id, actor_user_id, action, resource_type, resource_id)
  values
    (v_org, v_actor, 'member.invitation_revoked', 'organization_invitation', target_invitation::text);
  return true;
end;
$function$;

revoke all on function private.create_org_invitation(uuid,text,text) from public, anon;
revoke all on function private.accept_org_invitation(uuid) from public, anon;
revoke all on function private.revoke_org_invitation(uuid) from public, anon;
grant execute on function private.create_org_invitation(uuid,text,text) to authenticated;
grant execute on function private.accept_org_invitation(uuid) to authenticated;
grant execute on function private.revoke_org_invitation(uuid) to authenticated;
