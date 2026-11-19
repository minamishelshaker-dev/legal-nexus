
create or replace function private.prevent_position_hierarchy_cycle()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 0));

 if new.parent_position_id is null then
   return new;
 end if;

 if exists (
   with recursive ancestors(id, parent_position_id, path) as (
     select p.id, p.parent_position_id, array[p.id]
     from public.job_positions p
     where p.id = new.parent_position_id
       and p.organization_id = new.organization_id
     union all
     select p.id, p.parent_position_id, a.path || p.id
     from public.job_positions p
     join ancestors a on p.id = a.parent_position_id
     where p.organization_id = new.organization_id
       and not p.id = any(a.path)
   )
   select 1 from ancestors where id = new.id
 ) then
   raise exception 'Position hierarchy cannot contain a reporting cycle'
     using errcode = '23514';
 end if;
 return new;
end;
$$;

create or replace function private.protect_org_structure_identity()
returns trigger language plpgsql set search_path = ''
as $$
begin
 if new.organization_id is distinct from old.organization_id then
   raise exception 'Organization ownership cannot be changed'
     using errcode = '23514';
 end if;

 if tg_table_name = 'job_positions'
    and new.created_by is distinct from old.created_by then
   raise exception 'Position creator cannot be changed'
     using errcode = '23514';
 end if;

 if tg_table_name = 'position_assignments'
    and new.assigned_by is distinct from old.assigned_by then
   raise exception 'Assignment creator cannot be changed'
     using errcode = '23514';
 end if;

 return new;
end;
$$;

create trigger trg_protect_job_position_identity
before update on public.job_positions
for each row execute function private.protect_org_structure_identity();

create trigger trg_protect_position_assignment_identity
before update on public.position_assignments
for each row execute function private.protect_org_structure_identity();
