
-- Legal Nexus: employee lifecycle foundation (HR-confidential layer)
alter table public.organization_memberships
  drop constraint organization_memberships_membership_role_check;
alter table public.organization_memberships
  add constraint organization_memberships_membership_role_check
  check (membership_role = any (array[
    'owner','admin','legal_manager','lawyer','contract_manager',
    'hr_manager','hr_investigator','employee','auditor','member'
  ]));

create or replace function private.has_hr_sensitive_role(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.membership_role = any (array['owner','admin','hr_manager'])
  );
$function$;

revoke all on function private.has_hr_sensitive_role(uuid) from public, anon;
grant execute on function private.has_hr_sensitive_role(uuid) to authenticated;

create table public.employee_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  corporate_entity_id uuid,
  department_id uuid,
  manager_employee_id uuid,
  user_id uuid,
  employee_number text not null,
  full_name text not null,
  work_email text,
  phone_number text,
  employment_status text not null default 'pre_hire'
    check (employment_status = any (array['pre_hire','active','on_leave','suspended','terminated'])),
  hire_date date,
  termination_date date,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_records_name_check check (length(btrim(full_name)) between 2 and 180),
  constraint employee_records_number_check check (length(btrim(employee_number)) between 1 and 64),
  constraint employee_records_email_check check (work_email is null or length(work_email) <= 254),
  constraint employee_records_phone_check check (phone_number is null or length(phone_number) <= 40),
  constraint employee_records_dates_check check (
    (termination_date is null or hire_date is null or termination_date >= hire_date)
  ),
  constraint employee_records_org_id_unique unique (id, organization_id),
  constraint employee_records_org_number_unique unique (organization_id, employee_number),
  constraint employee_records_entity_same_org_fk
    foreign key (organization_id, corporate_entity_id)
    references public.corporate_entities(organization_id, id)
    on delete set null (corporate_entity_id),
  constraint employee_records_department_same_org_fk
    foreign key (department_id, organization_id)
    references public.departments(id, organization_id)
    on delete set null (department_id),
  constraint employee_records_manager_same_org_fk
    foreign key (manager_employee_id, organization_id)
    references public.employee_records(id, organization_id)
    on delete set null (manager_employee_id),
  constraint employee_records_user_same_org_fk
    foreign key (organization_id, user_id)
    references public.organization_memberships(organization_id, user_id)
    on delete set null (user_id)
);

create unique index uq_employee_records_org_user
  on public.employee_records(organization_id, user_id)
  where user_id is not null;
create index idx_employee_records_org_status
  on public.employee_records(organization_id, employment_status);
create index idx_employee_records_org_department
  on public.employee_records(organization_id, department_id);
create index idx_employee_records_org_manager
  on public.employee_records(organization_id, manager_employee_id);

create table public.employment_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_id uuid not null,
  event_type text not null check (event_type = any (array[
    'hired','transferred','promoted','demoted','manager_changed',
    'status_changed','leave_started','leave_ended','terminated',
    'rehired','assignment_created','assignment_ended','profile_updated'
  ])),
  effective_date date not null,
  previous_department_id uuid,
  new_department_id uuid,
  previous_position_id uuid,
  new_position_id uuid,
  previous_manager_employee_id uuid,
  new_manager_employee_id uuid,
  previous_status text,
  new_status text,
  summary text,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint employment_history_employee_same_org_fk
    foreign key (employee_id, organization_id)
    references public.employee_records(id, organization_id) on delete restrict,
  constraint employment_history_previous_department_fk
    foreign key (previous_department_id, organization_id)
    references public.departments(id, organization_id) on delete set null (previous_department_id),
  constraint employment_history_new_department_fk
    foreign key (new_department_id, organization_id)
    references public.departments(id, organization_id) on delete set null (new_department_id),
  constraint employment_history_previous_position_fk
    foreign key (previous_position_id, organization_id)
    references public.job_positions(id, organization_id) on delete set null (previous_position_id),
  constraint employment_history_new_position_fk
    foreign key (new_position_id, organization_id)
    references public.job_positions(id, organization_id) on delete set null (new_position_id),
  constraint employment_history_previous_manager_fk
    foreign key (previous_manager_employee_id, organization_id)
    references public.employee_records(id, organization_id) on delete set null (previous_manager_employee_id),
  constraint employment_history_new_manager_fk
    foreign key (new_manager_employee_id, organization_id)
    references public.employee_records(id, organization_id) on delete set null (new_manager_employee_id),
  constraint employment_history_status_values_check check (
    (previous_status is null or previous_status = any (array['pre_hire','active','on_leave','suspended','terminated']))
    and
    (new_status is null or new_status = any (array['pre_hire','active','on_leave','suspended','terminated']))
  ),
  constraint employment_history_summary_check check (summary is null or length(summary) <= 2000)
);

create index idx_employment_history_org_employee_date
  on public.employment_history(organization_id, employee_id, effective_date desc, created_at desc);

alter table public.position_assignments
  alter column user_id drop not null,
  add column employee_id uuid;

alter table public.position_assignments
  add constraint position_assignments_employee_same_org_fk
  foreign key (employee_id, organization_id)
  references public.employee_records(id, organization_id)
  on delete restrict,
  add constraint position_assignments_employee_or_user_check
  check (employee_id is not null or user_id is not null);

create index idx_position_assignments_employee_status
  on public.position_assignments(organization_id, employee_id, status)
  where employee_id is not null;

create unique index uq_position_primary_active_per_employee_org
  on public.position_assignments(organization_id, employee_id)
  where employee_id is not null and is_primary and status = 'active';

create unique index uq_position_active_employee_per_position
  on public.position_assignments(organization_id, position_id, employee_id)
  where employee_id is not null and status = 'active';

create or replace function private.validate_position_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  employee_user uuid;
begin
  if new.user_id is not null and not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.user_id
      and m.status = 'active'
  ) then
    raise exception 'The assigned user must be an active member of this organization'
      using errcode = '23514';
  end if;

  if new.employee_id is not null then
    select e.user_id into employee_user
    from public.employee_records e
    where e.id = new.employee_id
      and e.organization_id = new.organization_id
      and e.employment_status = 'active';

    if not found then
      raise exception 'The assigned employee must be active in this organization'
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

create or replace function private.audit_hr_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_org uuid;
  target_id text;
  target_action text;
  changed text[];
begin
  if tg_op = 'INSERT' then
    target_org := new.organization_id;
    target_id := new.id::text;
    target_action := 'created';
    changed := array['record_created'];
  elsif tg_op = 'UPDATE' then
    target_org := new.organization_id;
    target_id := new.id::text;
    target_action := 'updated';
    select coalesce(array_agg(k order by k), array[]::text[])
      into changed
    from jsonb_object_keys(to_jsonb(new)) as k
    where (to_jsonb(new)->k) is distinct from (to_jsonb(old)->k);
  else
    target_org := old.organization_id;
    target_id := old.id::text;
    target_action := 'deleted';
    changed := array['record_deleted'];
  end if;

  insert into public.audit_events (
    organization_id, actor_user_id, action, resource_type, resource_id, metadata
  ) values (
    target_org, (select auth.uid()), 'hr_employee_' || target_action,
    tg_table_name, target_id,
    jsonb_build_object('changed_fields', to_jsonb(changed))
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function private.audit_hr_change() from public, anon, authenticated;

create trigger trg_audit_employee_records
after insert or update or delete on public.employee_records
for each row execute function private.audit_hr_change();

create trigger trg_audit_employment_history
after insert on public.employment_history
for each row execute function private.audit_hr_change();

alter table public.employee_records enable row level security;
alter table public.employment_history enable row level security;

revoke all on public.employee_records from anon;
revoke all on public.employment_history from anon;
grant select, insert, update on public.employee_records to authenticated;
grant select, insert on public.employment_history to authenticated;

create policy "HR managers can view employee records"
on public.employee_records for select to authenticated
using ((select private.has_hr_sensitive_role(organization_id)));

create policy "HR managers can create employee records"
on public.employee_records for insert to authenticated
with check (
  (select private.has_hr_sensitive_role(organization_id))
  and created_by = (select auth.uid())
);

create policy "HR managers can update employee records"
on public.employee_records for update to authenticated
using ((select private.has_hr_sensitive_role(organization_id)))
with check (
  (select private.has_hr_sensitive_role(organization_id))
  and organization_id = (select organization_id from public.employee_records e where e.id = employee_records.id)
  and created_by = (select created_by from public.employee_records e where e.id = employee_records.id)
);

create policy "HR managers can view employment history"
on public.employment_history for select to authenticated
using ((select private.has_hr_sensitive_role(organization_id)));

create policy "HR managers can record employment history"
on public.employment_history for insert to authenticated
with check (
  (select private.has_hr_sensitive_role(organization_id))
  and recorded_by = (select auth.uid())
);

-- History is append-only for authenticated users.
revoke update, delete on public.employment_history from authenticated;
