
create or replace function private.get_employee_record(p_organization_id uuid, p_employee_id uuid)
returns setof public.employee_records
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not private.has_hr_sensitive_role(p_organization_id) then
    raise exception 'Only authorized HR managers can view employee records' using errcode = '42501';
  end if;
  if not exists (select 1 from public.employee_records e where e.id = p_employee_id and e.organization_id = p_organization_id) then
    raise exception 'Employee not found in this organization' using errcode = 'P0002';
  end if;
  insert into public.audit_events(organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (p_organization_id, v_actor, 'hr.employee_record.viewed', 'employee', p_employee_id::text, '{}'::jsonb);
  return query select e.* from public.employee_records e
    where e.id = p_employee_id and e.organization_id = p_organization_id;
end;
$function$;

revoke all on function private.get_employee_record(uuid, uuid) from public, anon;
grant execute on function private.get_employee_record(uuid, uuid) to authenticated;

create or replace function public.get_employee_record(p_organization_id uuid, p_employee_id uuid)
returns setof public.employee_records
language sql
security invoker
set search_path = ''
as $function$
  select * from private.get_employee_record(p_organization_id, p_employee_id);
$function$;

revoke all on function public.get_employee_record(uuid, uuid) from public, anon;
grant execute on function public.get_employee_record(uuid, uuid) to authenticated;
