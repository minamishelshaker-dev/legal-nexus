
create or replace function private.update_employee_profile(
  p_organization_id uuid,
  p_employee_id uuid,
  p_full_name text,
  p_work_email text default null,
  p_phone_number text default null,
  p_corporate_entity_id uuid default null,
  p_notes text default null,
  p_summary text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_employee public.employee_records%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_hr_sensitive_role(p_organization_id) then
    raise exception 'Only authorized HR managers can update employee profiles' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_full_name,''))) not between 2 and 180 then
    raise exception 'Employee name must contain between 2 and 180 characters' using errcode = '23514';
  end if;
  if p_work_email is not null and length(trim(p_work_email)) > 254 then
    raise exception 'Work email is too long' using errcode = '23514';
  end if;
  if p_phone_number is not null and length(trim(p_phone_number)) > 40 then
    raise exception 'Phone number is too long' using errcode = '23514';
  end if;
  if p_notes is not null and length(p_notes) > 4000 then
    raise exception 'Employee notes are too long' using errcode = '23514';
  end if;

  select * into v_employee
  from public.employee_records e
  where e.id = p_employee_id
    and e.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Employee record not found in this organization' using errcode = 'P0002';
  end if;

  if p_corporate_entity_id is not null and not exists (
    select 1 from public.corporate_entities ce
    where ce.id = p_corporate_entity_id
      and ce.organization_id = p_organization_id
  ) then
    raise exception 'Selected corporate entity does not belong to this organization'
      using errcode = '23503';
  end if;

  update public.employee_records
  set full_name = trim(p_full_name),
      work_email = nullif(trim(p_work_email),''),
      phone_number = nullif(trim(p_phone_number),''),
      corporate_entity_id = p_corporate_entity_id,
      notes = nullif(trim(p_notes),'')
  where id = p_employee_id
    and organization_id = p_organization_id;

  if (v_employee.full_name, v_employee.work_email, v_employee.phone_number,
      v_employee.corporate_entity_id, v_employee.notes)
     is distinct from
     (trim(p_full_name), nullif(trim(p_work_email),''), nullif(trim(p_phone_number),''),
      p_corporate_entity_id, nullif(trim(p_notes),'')) then
    insert into public.employment_history (
      organization_id, employee_id, event_type, effective_date,
      summary, recorded_by
    ) values (
      p_organization_id, p_employee_id, 'profile_updated', current_date,
      nullif(trim(p_summary),''), v_actor
    );
  end if;
end;
$function$;

revoke all on function private.update_employee_profile(uuid,uuid,text,text,text,uuid,text,text)
from public, anon, authenticated;
grant execute on function private.update_employee_profile(uuid,uuid,text,text,text,uuid,text,text)
to authenticated;

create or replace function public.update_employee_profile(
  p_organization_id uuid,
  p_employee_id uuid,
  p_full_name text,
  p_work_email text default null,
  p_phone_number text default null,
  p_corporate_entity_id uuid default null,
  p_notes text default null,
  p_summary text default null
)
returns void
language sql
set search_path = ''
as $function$
  select private.update_employee_profile(
    p_organization_id, p_employee_id, p_full_name, p_work_email,
    p_phone_number, p_corporate_entity_id, p_notes, p_summary
  );
$function$;

revoke all on function public.update_employee_profile(uuid,uuid,text,text,text,uuid,text,text)
from public, anon;
grant execute on function public.update_employee_profile(uuid,uuid,text,text,text,uuid,text,text)
to authenticated;
