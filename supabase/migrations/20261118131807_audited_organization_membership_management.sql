create or replace function private.update_org_membership(
  target_membership uuid,
  target_role text,
  target_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_org uuid;
  v_target_user uuid;
  v_current_role text;
  v_current_status text;
  v_actor_role text;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if target_role not in ('admin','legal_manager','lawyer','contract_manager','hr_manager','hr_investigator','employee','auditor','member') then
    raise exception 'Role is not eligible for assignment';
  end if;
  if target_status not in ('active','suspended') then
    raise exception 'Membership status is not eligible';
  end if;

  select m.organization_id, m.user_id, m.membership_role, m.status
    into v_org, v_target_user, v_current_role, v_current_status
  from public.organization_memberships m
  where m.id = target_membership
  for update;

  if not found then
    return false;
  end if;

  if private.has_org_role(v_org, array['owner']) then
    v_actor_role := 'owner';
  elsif private.has_org_role(v_org, array['admin']) then
    v_actor_role := 'admin';
  else
    raise exception 'Insufficient permission to manage organization members';
  end if;

  if v_current_role = 'owner' then
    raise exception 'The organization owner membership cannot be changed here';
  end if;

  if v_target_user = v_actor and target_status = 'suspended' then
    raise exception 'You cannot suspend your own membership';
  end if;

  if v_actor_role = 'admin' and (v_current_role = 'admin' or target_role = 'admin') then
    raise exception 'Only the organization owner can manage admin memberships';
  end if;

  if v_current_role = target_role and v_current_status = target_status then
    return true;
  end if;

  update public.organization_memberships
  set membership_role = target_role,
      status = target_status
  where id = target_membership;

  insert into public.audit_events
    (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values
    (v_org, v_actor, 'member.membership_updated', 'organization_membership', target_membership::text,
     jsonb_build_object(
       'target_user_id', v_target_user,
       'old_role', v_current_role,
       'new_role', target_role,
       'old_status', v_current_status,
       'new_status', target_status
     ));

  return true;
end;
$function$;

revoke all on function private.update_org_membership(uuid,text,text) from public, anon;
grant execute on function private.update_org_membership(uuid,text,text) to authenticated;

create or replace function public.update_org_membership(
  target_membership uuid,
  target_role text,
  target_status text
)
returns boolean
language sql
set search_path = ''
as $function$
  select private.update_org_membership(target_membership, target_role, target_status);
$function$;

revoke all on function public.update_org_membership(uuid,text,text) from public, anon;
grant execute on function public.update_org_membership(uuid,text,text) to authenticated;
