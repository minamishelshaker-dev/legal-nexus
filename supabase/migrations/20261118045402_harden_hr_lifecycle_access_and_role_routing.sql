
-- Tighten employee record invariants and complete HR role routing.
create or replace function private.protect_employee_record_identity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Employee organization cannot be changed'
      using errcode = '23514';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'Employee record creator cannot be changed'
      using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create trigger trg_protect_employee_record_identity
before update on public.employee_records
for each row execute function private.protect_employee_record_identity();

drop policy "HR managers can update employee records" on public.employee_records;
create policy "HR managers can update employee records"
on public.employee_records for update to authenticated
using ((select private.has_hr_sensitive_role(organization_id)))
with check ((select private.has_hr_sensitive_role(organization_id)));

revoke all on public.employee_records from public, anon, authenticated;
grant select, insert, update on public.employee_records to authenticated;
revoke delete on public.employee_records from authenticated;

revoke all on public.employment_history from public, anon, authenticated;
grant select, insert on public.employment_history to authenticated;
revoke update, delete on public.employment_history from authenticated;

alter table public.organization_invitations
  drop constraint organization_invitations_membership_role_check;
alter table public.organization_invitations
  add constraint organization_invitations_membership_role_check
  check (membership_role = any (array[
    'admin','legal_manager','lawyer','contract_manager',
    'hr_manager','hr_investigator','employee','auditor','member'
  ]));

create or replace function private.create_org_invitation(target_org uuid, target_email text, target_role text)
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
  if target_role not in ('admin','legal_manager','lawyer','contract_manager','hr_manager','hr_investigator','employee','auditor','member') then
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

-- HR managers can administer position structures and assignments, but not investigation content.
drop policy "organization admins can create job positions" on public.job_positions;
create policy "organization admins can create job positions"
on public.job_positions for insert to authenticated
with check (
  private.has_org_role(organization_id, array['owner','admin','legal_manager','hr_manager'])
  and created_by = (select auth.uid())
);

drop policy "organization admins can update job positions" on public.job_positions;
create policy "organization admins can update job positions"
on public.job_positions for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager','hr_manager']))
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager','hr_manager']));

drop policy "organization admins can delete job positions" on public.job_positions;
create policy "organization admins can delete job positions"
on public.job_positions for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager','hr_manager']));

drop policy "authorized managers can create position assignments" on public.position_assignments;
create policy "authorized managers can create position assignments"
on public.position_assignments for insert to authenticated
with check (
  private.has_org_role(organization_id, array['owner','admin','legal_manager','hr_manager','hr_investigator'])
  and assigned_by = (select auth.uid())
);

drop policy "authorized managers can update position assignments" on public.position_assignments;
create policy "authorized managers can update position assignments"
on public.position_assignments for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager','hr_manager','hr_investigator']))
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager','hr_manager','hr_investigator']));

drop policy "authorized managers can delete position assignments" on public.position_assignments;
create policy "authorized managers can delete position assignments"
on public.position_assignments for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager','hr_manager','hr_investigator']));

-- Cover every new FK with a matching index; no unused indexes are removed.
create index idx_employee_records_created_by on public.employee_records(created_by);
create index idx_employee_records_department_org_fk on public.employee_records(department_id, organization_id);
create index idx_employee_records_entity_org_fk on public.employee_records(organization_id, corporate_entity_id);
create index idx_employee_records_manager_org_fk on public.employee_records(manager_employee_id, organization_id);
create index idx_employee_records_user_org_fk on public.employee_records(organization_id, user_id);
create index idx_employment_history_employee_org_fk on public.employment_history(employee_id, organization_id);
create index idx_employment_history_new_department_org_fk on public.employment_history(new_department_id, organization_id);
create index idx_employment_history_new_manager_org_fk on public.employment_history(new_manager_employee_id, organization_id);
create index idx_employment_history_new_position_org_fk on public.employment_history(new_position_id, organization_id);
create index idx_employment_history_previous_department_org_fk on public.employment_history(previous_department_id, organization_id);
create index idx_employment_history_previous_manager_org_fk on public.employment_history(previous_manager_employee_id, organization_id);
create index idx_employment_history_previous_position_org_fk on public.employment_history(previous_position_id, organization_id);
create index idx_employment_history_recorded_by on public.employment_history(recorded_by);
create index idx_position_assignments_employee_org_fk on public.position_assignments(employee_id, organization_id);
