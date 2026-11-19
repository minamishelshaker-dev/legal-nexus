
alter table public.administrative_investigations
  add column subject_employee_id uuid;

alter table public.administrative_investigations
  add constraint administrative_investigations_subject_employee_same_org_fk
  foreign key (subject_employee_id, organization_id)
  references public.employee_records(id, organization_id)
  on delete restrict;

create index idx_administrative_investigations_subject_employee
  on public.administrative_investigations(organization_id, subject_employee_id)
  where subject_employee_id is not null;

comment on column public.administrative_investigations.subject_employee_id is
  'Optional normalized link to the HR employee record. Investigation access remains governed by investigation RLS; this FK does not grant access to the employee profile.';

create or replace function private.validate_investigation_employee_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.subject_employee_id is not null then
    if not exists (
      select 1
      from public.employee_records e
      where e.id = new.subject_employee_id
        and e.organization_id = new.organization_id
    ) then
      raise exception 'The subject employee must belong to the same organization'
        using errcode = '23503';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function private.validate_investigation_employee_link() from public, anon, authenticated;

create trigger trg_validate_investigation_employee_link
before insert or update of subject_employee_id, organization_id
on public.administrative_investigations
for each row execute function private.validate_investigation_employee_link();
