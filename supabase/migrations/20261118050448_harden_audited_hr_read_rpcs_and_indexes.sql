
-- Keep RLS policies explicit while denying direct table access.
create policy "HR-only row visibility for employee records"
on public.employee_records for select to authenticated
using ((select private.has_hr_sensitive_role(organization_id)));

create policy "HR-only row visibility for employment history"
on public.employment_history for select to authenticated
using ((select private.has_hr_sensitive_role(organization_id)));

create policy "HR-only row visibility for employee documents"
on public.employee_documents for select to authenticated
using ((select private.has_hr_sensitive_role(organization_id)));

create policy "HR-only row visibility for employee document versions"
on public.employee_document_versions for select to authenticated
using ((select private.has_hr_sensitive_role(organization_id)));

-- Move audited, privileged read implementations out of the exposed public API.
alter function public.list_employee_records(uuid,text,text,uuid,integer,integer) set schema private;
alter function public.get_employee_history(uuid,uuid) set schema private;
alter function public.get_employee_documents(uuid,uuid) set schema private;
alter function public.get_employee_document_versions(uuid,uuid) set schema private;

create or replace function public.list_employee_records(
  p_organization_id uuid,
  p_search text default null,
  p_status text default null,
  p_department_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns setof public.employee_records
language sql
security invoker
set search_path = ''
as $function$
  select * from private.list_employee_records(
    p_organization_id,p_search,p_status,p_department_id,p_limit,p_offset
  );
$function$;

create or replace function public.get_employee_history(p_organization_id uuid,p_employee_id uuid)
returns setof public.employment_history
language sql
security invoker
set search_path = ''
as $function$
  select * from private.get_employee_history(p_organization_id,p_employee_id);
$function$;

create or replace function public.get_employee_documents(p_organization_id uuid,p_employee_id uuid)
returns setof public.employee_documents
language sql
security invoker
set search_path = ''
as $function$
  select * from private.get_employee_documents(p_organization_id,p_employee_id);
$function$;

create or replace function public.get_employee_document_versions(p_organization_id uuid,p_employee_document_id uuid)
returns setof public.employee_document_versions
language sql
security invoker
set search_path = ''
as $function$
  select * from private.get_employee_document_versions(p_organization_id,p_employee_document_id);
$function$;

revoke all on function private.list_employee_records(uuid,text,text,uuid,integer,integer) from public,anon;
revoke all on function private.get_employee_history(uuid,uuid) from public,anon;
revoke all on function private.get_employee_documents(uuid,uuid) from public,anon;
revoke all on function private.get_employee_document_versions(uuid,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.list_employee_records(uuid,text,text,uuid,integer,integer) to authenticated;
grant execute on function private.get_employee_history(uuid,uuid) to authenticated;
grant execute on function private.get_employee_documents(uuid,uuid) to authenticated;
grant execute on function private.get_employee_document_versions(uuid,uuid) to authenticated;

revoke all on function public.list_employee_records(uuid,text,text,uuid,integer,integer) from public,anon;
revoke all on function public.get_employee_history(uuid,uuid) from public,anon;
revoke all on function public.get_employee_documents(uuid,uuid) from public,anon;
revoke all on function public.get_employee_document_versions(uuid,uuid) from public,anon;
grant execute on function public.list_employee_records(uuid,text,text,uuid,integer,integer) to authenticated;
grant execute on function public.get_employee_history(uuid,uuid) to authenticated;
grant execute on function public.get_employee_documents(uuid,uuid) to authenticated;
grant execute on function public.get_employee_document_versions(uuid,uuid) to authenticated;

create index idx_administrative_investigations_subject_employee_org_fk
  on public.administrative_investigations(subject_employee_id,organization_id);
create index idx_employee_document_versions_uploaded_by
  on public.employee_document_versions(uploaded_by);
create index idx_employee_documents_created_by
  on public.employee_documents(created_by);
create index idx_employee_documents_employee_org_fk
  on public.employee_documents(employee_id,organization_id);
create index idx_employee_document_versions_document_org_fk
  on public.employee_document_versions(employee_document_id,organization_id);
