
create or replace function private.validate_position_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if not exists (
   select 1 from public.organization_memberships m
   where m.organization_id = new.organization_id
     and m.user_id = new.user_id and m.status = 'active'
 ) then
   raise exception 'The assigned user must be an active member of this organization'
     using errcode = '23514';
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
$$;

create or replace function private.prevent_position_hierarchy_cycle()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if new.parent_position_id is null then
   return new;
 end if;
 if exists (
   with recursive ancestors(id, parent_position_id) as (
     select p.id, p.parent_position_id
     from public.job_positions p
     where p.id = new.parent_position_id and p.organization_id = new.organization_id
     union all
     select p.id, p.parent_position_id
     from public.job_positions p
     join ancestors a on p.id = a.parent_position_id
     where p.organization_id = new.organization_id
   )
   select 1 from ancestors where id = new.id
 ) then
   raise exception 'Position hierarchy cannot contain a reporting cycle'
     using errcode = '23514';
 end if;
 return new;
end;
$$;

create trigger trg_validate_position_assignment
before insert or update on public.position_assignments
for each row execute function private.validate_position_assignment();

create trigger trg_prevent_position_hierarchy_cycle
before insert or update of parent_position_id, organization_id on public.job_positions
for each row execute function private.prevent_position_hierarchy_cycle();

create or replace function private.touch_org_structure_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
 new.updated_at := now();
 return new;
end;
$$;

create trigger trg_touch_job_position_updated_at
before update on public.job_positions
for each row execute function private.touch_org_structure_updated_at();

create trigger trg_touch_position_assignment_updated_at
before update on public.position_assignments
for each row execute function private.touch_org_structure_updated_at();

alter table public.job_positions enable row level security;
alter table public.position_assignments enable row level security;

grant select, insert, update, delete on public.job_positions to authenticated;
grant select, insert, update, delete on public.position_assignments to authenticated;
revoke all privileges on public.job_positions, public.position_assignments from anon;

create policy "organization members can view job positions"
on public.job_positions for select to authenticated
using (private.is_org_member(organization_id));

create policy "organization admins can create job positions"
on public.job_positions for insert to authenticated
with check (
 private.has_org_role(organization_id, array['owner','admin','legal_manager'])
 and created_by = (select auth.uid())
);

create policy "organization admins can update job positions"
on public.job_positions for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager']))
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager']));

create policy "organization admins can delete job positions"
on public.job_positions for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager']));

create policy "organization members can view position assignments"
on public.position_assignments for select to authenticated
using (private.is_org_member(organization_id));

create policy "authorized managers can create position assignments"
on public.position_assignments for insert to authenticated
with check (
 private.has_org_role(organization_id, array['owner','admin','legal_manager','hr_investigator'])
 and assigned_by = (select auth.uid())
);

create policy "authorized managers can update position assignments"
on public.position_assignments for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager','hr_investigator']))
with check (private.has_org_role(organization_id, array['owner','admin','legal_manager','hr_investigator']));

create policy "authorized managers can delete position assignments"
on public.position_assignments for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','legal_manager','hr_investigator']));
