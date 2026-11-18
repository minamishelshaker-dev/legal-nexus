create or replace function private.validate_legal_request_approval_assignment()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_org uuid;
  v_request_status text;
  v_next_step integer;
begin
  select organization_id, status
    into v_org, v_request_status
  from public.legal_requests
  where id = new.legal_request_id;

  if v_org is null then
    raise exception 'Legal request not found';
  end if;

  if v_request_status in ('approved','rejected','completed','cancelled') then
    raise exception 'Approval steps cannot be added to a terminal request';
  end if;

  if new.created_by is distinct from auth.uid() then
    raise exception 'Approval step creator must be the authenticated user';
  end if;

  if new.status <> 'pending' then
    raise exception 'New approval steps must start as pending';
  end if;

  select coalesce(max(step_no),0)+1
    into v_next_step
  from public.legal_request_approvals
  where legal_request_id = new.legal_request_id;

  if new.step_no <> v_next_step then
    raise exception 'Approval steps must be added in sequential order';
  end if;

  if new.approver_user_id is not null and not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = v_org
      and m.user_id = new.approver_user_id
      and m.status = 'active'
  ) then
    raise exception 'Assigned approver must be an active member of the same organization';
  end if;

  if new.approver_role is not null and not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = v_org
      and m.membership_role = new.approver_role
      and m.status = 'active'
  ) then
    raise exception 'No active organization member currently holds the assigned approval role';
  end if;

  return new;
end;
$function$;
