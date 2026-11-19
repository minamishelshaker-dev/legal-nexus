
create or replace function private.can_access_employee_storage_path(
  p_organization_id text,
  p_employee_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or p_organization_id is null
     or p_employee_id is null
     or p_organization_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_employee_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  return private.has_hr_sensitive_role(p_organization_id::uuid)
    and exists (
      select 1
      from public.employee_records e
      where e.organization_id = p_organization_id::uuid
        and e.id = p_employee_id::uuid
    );
end;
$function$;

revoke all on function private.can_access_employee_storage_path(text, text) from public;
revoke all on function private.can_access_employee_storage_path(text, text) from anon;
grant execute on function private.can_access_employee_storage_path(text, text) to authenticated;

create policy "employee_records_hr_upload_only"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'employee-records-private'
  and array_length(storage.foldername(name), 1) = 2
  and private.can_access_employee_storage_path(
    (storage.foldername(name))[1],
    (storage.foldername(name))[2]
  )
);

create policy "employee_records_hr_download_only"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'employee-records-private'
  and array_length(storage.foldername(name), 1) = 2
  and private.can_access_employee_storage_path(
    (storage.foldername(name))[1],
    (storage.foldername(name))[2]
  )
);
