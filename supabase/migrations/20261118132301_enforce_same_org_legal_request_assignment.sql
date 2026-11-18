create or replace function private.guard_legal_request_identity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.organization_id is distinct from new.organization_id
     or old.requester_user_id is distinct from new.requester_user_id
     or old.requester_department_id is distinct from new.requester_department_id
     or old.corporate_entity_id is distinct from new.corporate_entity_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Request origin and organization context are immutable';
  end if;

  if new.assigned_to is not null and not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.assigned_to
      and m.status = 'active'
  ) then
    raise exception 'Assigned user must be an active member of the same organization';
  end if;

  new.updated_at := now();
  if new.status in ('completed','cancelled') and old.status not in ('completed','cancelled') then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end;
$function$;
