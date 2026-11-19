
create or replace function private.validate_position_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  employee_user uuid;
  employee_status text;
begin
  if new.status = 'active' and new.user_id is not null and not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.user_id
      and m.status = 'active'
  ) then
    raise exception 'The assigned user must be an active member of this organization'
      using errcode = '23514';
  end if;

  if new.employee_id is not null then
    select e.user_id, e.employment_status
      into employee_user, employee_status
    from public.employee_records e
    where e.id = new.employee_id
      and e.organization_id = new.organization_id;

    if not found then
      raise exception 'The assigned employee must belong to this organization'
        using errcode = '23514';
    end if;

    if new.status = 'active' and employee_status <> 'active' then
      raise exception 'Only active employees can hold an active position assignment'
        using errcode = '23514';
    end if;

    if new.user_id is not null and employee_user is distinct from new.user_id then
      raise exception 'Assignment user must match the linked employee account'
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'active' and new.end_date is not null and new.end_date < current_date then
    raise exception 'An active assignment cannot have an end date in the past'
      using errcode = '23514';
  end if;

  if new.status <> 'active' and new.is_primary then
    new.is_primary := false;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

create or replace function private.change_employee_lifecycle(
  p_organization_id uuid,
  p_employee_id uuid,
  p_event_type text,
  p_effective_date date,
  p_change_department boolean default false,
  p_new_department_id uuid default null,
  p_change_position boolean default false,
  p_new_position_id uuid default null,
  p_change_manager boolean default false,
  p_new_manager_employee_id uuid default null,
  p_new_status text default null,
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
  v_old_position uuid;
  v_new_department uuid;
  v_new_position uuid;
  v_new_manager uuid;
  v_new_status text;
  v_position_department uuid;
  v_assignment_start date;
  v_termination_date date;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_hr_sensitive_role(p_organization_id) then
    raise exception 'Only authorized HR managers can change employee records' using errcode = '42501';
  end if;
  if p_effective_date is null or p_effective_date > current_date then
    raise exception 'Effective date must not be in the future' using errcode = '23514';
  end if;
  if p_event_type not in (
    'transferred','promoted','demoted','manager_changed',
    'status_changed','leave_started','leave_ended','terminated','rehired'
  ) then
    raise exception 'Unsupported employee lifecycle event' using errcode = '23514';
  end if;

  select * into v_employee
  from public.employee_records e
  where e.id = p_employee_id
    and e.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Employee record not found in this organization' using errcode = 'P0002';
  end if;
  if p_effective_date < v_employee.hire_date then
    raise exception 'Effective date cannot precede the employee hire date' using errcode = '23514';
  end if;

  select pa.position_id, pa.start_date
    into v_old_position, v_assignment_start
  from public.position_assignments pa
  where pa.organization_id = p_organization_id
    and pa.employee_id = p_employee_id
    and pa.status = 'active'
    and pa.is_primary
  order by pa.start_date desc
  limit 1;

  v_new_department := case when p_change_department then p_new_department_id else v_employee.department_id end;
  v_new_position := case when p_change_position then p_new_position_id else v_old_position end;
  v_new_manager := case when p_change_manager then p_new_manager_employee_id else v_employee.manager_employee_id end;
  v_new_status := v_employee.employment_status;

  if p_event_type in ('transferred','promoted','demoted') then
    if not p_change_department and not p_change_position then
      raise exception 'Transfer or promotion requires a department or position change' using errcode = '23514';
    end if;
    if p_event_type in ('promoted','demoted') and (not p_change_position or p_new_position_id is null) then
      raise exception 'Promotion or demotion requires a new position' using errcode = '23514';
    end if;
  elsif p_event_type = 'manager_changed' then
    if not p_change_manager then
      raise exception 'Manager change requires an explicit manager selection' using errcode = '23514';
    end if;
  elsif p_event_type = 'leave_started' then
    if v_employee.employment_status <> 'active' then
      raise exception 'Only active employees can start leave' using errcode = '23514';
    end if;
    v_new_status := 'on_leave';
  elsif p_event_type = 'leave_ended' then
    if v_employee.employment_status <> 'on_leave' then
      raise exception 'Only employees on leave can end leave' using errcode = '23514';
    end if;
    v_new_status := 'active';
  elsif p_event_type = 'terminated' then
    if v_employee.employment_status = 'terminated' then
      raise exception 'Employee is already terminated' using errcode = '23514';
    end if;
    v_new_status := 'terminated';
    v_new_position := null;
  elsif p_event_type = 'rehired' then
    if v_employee.employment_status <> 'terminated' then
      raise exception 'Only terminated employees can be rehired' using errcode = '23514';
    end if;
    if not p_change_position or p_new_position_id is null then
      raise exception 'Rehire requires a new position assignment' using errcode = '23514';
    end if;
    v_new_status := 'active';
  elsif p_event_type = 'status_changed' then
    if v_employee.employment_status = 'terminated'
       or p_new_status not in ('active','on_leave','suspended') then
      raise exception 'Use the rehire workflow for terminated employees; other status changes must select active, on_leave, or suspended'
        using errcode = '23514';
    end if;
    v_new_status := p_new_status;
  end if;

  if p_change_position and v_new_position is not null then
    select jp.department_id into v_position_department
    from public.job_positions jp
    where jp.id = v_new_position
      and jp.organization_id = p_organization_id
      and jp.status = 'active';
    if not found then
      raise exception 'Selected job position is not active in this organization' using errcode = '23503';
    end if;
    if p_change_department
       and v_position_department is not null
       and v_new_department is distinct from v_position_department then
      raise exception 'Selected position does not belong to the selected department' using errcode = '23514';
    end if;
    if not p_change_department and v_position_department is not null then
      v_new_department := v_position_department;
    end if;
  elsif p_change_department and v_new_position is not null then
    select jp.department_id into v_position_department
    from public.job_positions jp
    where jp.id = v_new_position
      and jp.organization_id = p_organization_id
      and jp.status = 'active';
    if not found then
      raise exception 'Current position is no longer active in this organization' using errcode = '23503';
    end if;
    if v_position_department is not null and v_position_department is distinct from v_new_department then
      raise exception 'Changing department requires a compatible new position assignment' using errcode = '23514';
    end if;
  end if;

  if v_new_manager = p_employee_id then
    raise exception 'An employee cannot be their own manager' using errcode = '23514';
  end if;

  if p_change_position or p_event_type = 'terminated' then
    if v_old_position is not null then
      if p_effective_date < v_assignment_start then
        raise exception 'Effective date cannot precede the current position start date' using errcode = '23514';
      end if;
      update public.position_assignments
      set status = 'ended', end_date = p_effective_date, is_primary = false
      where organization_id = p_organization_id
        and employee_id = p_employee_id
        and status = 'active'
        and is_primary;
    end if;

    if v_new_position is not null and v_new_status = 'active' then
      insert into public.position_assignments (
        organization_id, position_id, employee_id, user_id,
        start_date, status, is_primary, assigned_by
      ) values (
        p_organization_id, v_new_position, p_employee_id, v_employee.user_id,
        p_effective_date, 'active', true, v_actor
      );
    end if;
  end if;

  v_termination_date := case
    when v_new_status = 'terminated' then p_effective_date
    when p_event_type = 'rehired' then null
    else v_employee.termination_date
  end;

  update public.employee_records
  set department_id = v_new_department,
      manager_employee_id = v_new_manager,
      employment_status = v_new_status,
      termination_date = v_termination_date
  where id = p_employee_id
    and organization_id = p_organization_id;

  insert into public.employment_history (
    organization_id, employee_id, event_type, effective_date,
    previous_department_id, new_department_id,
    previous_position_id, new_position_id,
    previous_manager_employee_id, new_manager_employee_id,
    previous_status, new_status, summary, recorded_by
  ) values (
    p_organization_id, p_employee_id, p_event_type, p_effective_date,
    v_employee.department_id, v_new_department,
    v_old_position, v_new_position,
    v_employee.manager_employee_id, v_new_manager,
    v_employee.employment_status, v_new_status,
    nullif(trim(p_summary), ''), v_actor
  );
end;
$function$;
