
create or replace function private.lookup_employees_for_investigation(p_organization_id uuid, p_search text)
returns table(employee_id uuid, employee_number text, full_name text, department_name text, employment_status text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_q text := nullif(trim(p_search), '');
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_legal_sensitive_role(p_organization_id) then
    raise exception 'Only authorized investigation roles can look up employees' using errcode = '42501';
  end if;
  if v_q is null or length(v_q) < 2 then
    raise exception 'Enter at least 2 characters to search' using errcode = '22023';
  end if;

  insert into public.audit_events(organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (p_organization_id, v_actor, 'investigation.employee_lookup', 'employee_directory',
          p_organization_id::text, jsonb_build_object('query_length', length(v_q)));

  return query
  select e.id, e.employee_number, e.full_name, d.name, e.employment_status
  from public.employee_records e
  left join public.departments d
    on d.id = e.department_id and d.organization_id = e.organization_id
  where e.organization_id = p_organization_id
    and (position(lower(v_q) in lower(e.full_name)) > 0
         or position(lower(v_q) in lower(e.employee_number)) > 0)
  order by e.full_name
  limit 15;
end;
$function$;

revoke all on function private.lookup_employees_for_investigation(uuid, text) from public, anon;
grant execute on function private.lookup_employees_for_investigation(uuid, text) to authenticated;

create or replace function public.lookup_employees_for_investigation(p_organization_id uuid, p_search text)
returns table(employee_id uuid, employee_number text, full_name text, department_name text, employment_status text)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.lookup_employees_for_investigation(p_organization_id, p_search);
$function$;

revoke all on function public.lookup_employees_for_investigation(uuid, text) from public, anon;
grant execute on function public.lookup_employees_for_investigation(uuid, text) to authenticated;
