
-- All employee creation must pass through an atomic hire workflow so the
-- employee record, initial position assignment, history and audit trail agree.
drop policy "HR managers can create employee records" on public.employee_records;
drop policy "HR managers can update employee records" on public.employee_records;
drop policy "HR managers can record employment history" on public.employment_history;

revoke insert, update, delete on public.employee_records from authenticated;
grant select on public.employee_records to authenticated;
revoke insert, update, delete on public.employment_history from authenticated;
grant select on public.employment_history to authenticated;

create or replace function private.hire_employee(
  p_organization_id uuid,
  p_employee_number text,
  p_full_name text,
  p_work_email text default null,
  p_phone_number text default null,
  p_corporate_entity_id uuid default null,
  p_department_id uuid default null,
  p_manager_employee_id uuid default null,
  p_user_id uuid default null,
  p_hire_date date default current_date,
  p_position_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_employee_id uuid;
  v_department_id uuid := p_department_id;
  v_position_department uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_hr_sensitive_role(p_organization_id) then
    raise exception 'Only authorized HR managers can hire employees' using errcode = '42501';
  end if;
  if p_hire_date is null or p_hire_date > current_date then
    raise exception 'Hire date must not be in the future' using errcode = '23514';
  end if;
  if p_user_id is not null and not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    raise exception 'Linked user must be an active member of this organization'
      using errcode = '23514';
  end if;

  if p_position_id is not null then
    select jp.department_id into v_position_department
    from public.job_positions jp
    where jp.id = p_position_id
      and jp.organization_id = p_organization_id
      and jp.status = 'active';

    if not found then
      raise exception 'Selected job position is not active in this organization'
        using errcode = '23503';
    end if;
    if v_department_id is not null
       and v_position_department is not null
       and v_department_id is distinct from v_position_department then
      raise exception 'Selected position does not belong to the selected department'
        using errcode = '23514';
    end if;
    v_department_id := coalesce(v_department_id, v_position_department);
  end if;

  insert into public.employee_records (
    organization_id, corporate_entity_id, department_id, manager_employee_id,
    user_id, employee_number, full_name, work_email, phone_number,
    employment_status, hire_date, notes, created_by
  ) values (
    p_organization_id, p_corporate_entity_id, v_department_id, p_manager_employee_id,
    p_user_id, trim(p_employee_number), trim(p_full_name),
    nullif(trim(p_work_email), ''), nullif(trim(p_phone_number), ''),
    'active', p_hire_date, p_notes, v_actor
  )
  returning id into v_employee_id;

  if p_position_id is not null then
    insert into public.position_assignments (
      organization_id, position_id, employee_id, user_id,
      start_date, status, is_primary, assigned_by
    ) values (
      p_organization_id, p_position_id, v_employee_id, p_user_id,
      p_hire_date, 'active', true, v_actor
    );
  end if;

  insert into public.employment_history (
    organization_id, employee_id, event_type, effective_date,
    new_department_id, new_position_id, new_manager_employee_id,
    new_status, summary, recorded_by
  ) values (
    p_organization_id, v_employee_id, 'hired', p_hire_date,
    v_department_id, p_position_id, p_manager_employee_id,
    'active', 'Initial employment record created', v_actor
  );

  return v_employee_id;
end;
$function$;

revoke all on function private.hire_employee(
  uuid,text,text,text,text,uuid,uuid,uuid,uuid,date,uuid,text
) from public, anon;
grant execute on function private.hire_employee(
  uuid,text,text,text,text,uuid,uuid,uuid,uuid,date,uuid,text
) to authenticated;

create or replace function public.hire_employee(
  p_organization_id uuid,
  p_employee_number text,
  p_full_name text,
  p_work_email text default null,
  p_phone_number text default null,
  p_corporate_entity_id uuid default null,
  p_department_id uuid default null,
  p_manager_employee_id uuid default null,
  p_user_id uuid default null,
  p_hire_date date default current_date,
  p_position_id uuid default null,
  p_notes text default null
)
returns uuid
language sql
set search_path = ''
as $function$
  select private.hire_employee(
    p_organization_id, p_employee_number, p_full_name, p_work_email,
    p_phone_number, p_corporate_entity_id, p_department_id,
    p_manager_employee_id, p_user_id, p_hire_date, p_position_id, p_notes
  );
$function$;

revoke all on function public.hire_employee(
  uuid,text,text,text,text,uuid,uuid,uuid,uuid,date,uuid,text
) from public, anon;
grant execute on function public.hire_employee(
  uuid,text,text,text,text,uuid,uuid,uuid,uuid,date,uuid,text
) to authenticated;
