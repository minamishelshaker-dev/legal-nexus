
alter table public.employee_document_versions
  add constraint employee_document_versions_private_bucket_check
  check (storage_bucket = 'employee-records-private'),
  add constraint employee_document_versions_object_key_check
  check (
    storage_object_key !~ '(^/|(^|/)\.\.(?:/|$)|[[:cntrl:]])'
    and length(storage_object_key) between 10 and 700
  ),
  add constraint employee_document_versions_filename_check
  check (
    length(btrim(original_file_name)) between 1 and 255
    and original_file_name !~ '[/\\[:cntrl:]]'
  );

create or replace function private.register_employee_document_version(
  p_organization_id uuid,
  p_employee_id uuid,
  p_document_type text,
  p_title text,
  p_storage_bucket text,
  p_storage_object_key text,
  p_original_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_description text default null,
  p_classification text default 'restricted',
  p_sha256_hex text default null,
  p_employee_document_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_document_id uuid;
  v_version integer;
  v_expected_prefix text := p_organization_id::text || '/' || p_employee_id::text || '/';
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_hr_sensitive_role(p_organization_id) then
    raise exception 'Only authorized HR managers can register employee documents' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.employee_records e
    where e.id = p_employee_id and e.organization_id = p_organization_id
  ) then
    raise exception 'Employee not found in this organization' using errcode = '23503';
  end if;
  if p_storage_bucket <> 'employee-records-private'
     or left(coalesce(p_storage_object_key,''), length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'Employee files must use the private employee bucket and organization/employee path'
      using errcode = '23514';
  end if;
  if p_original_file_name is null
     or p_original_file_name ~ '[/\\[:cntrl:]]'
     or length(btrim(p_original_file_name)) not between 1 and 255 then
    raise exception 'Invalid original file name' using errcode = '23514';
  end if;
  if p_mime_type not in (
    'application/pdf','image/jpeg','image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) then
    raise exception 'Unsupported employee document MIME type' using errcode = '23514';
  end if;
  if p_file_size_bytes <= 0 or p_file_size_bytes > 52428800 then
    raise exception 'Employee document must be between 1 byte and 50 MB' using errcode = '23514';
  end if;
  if p_classification not in ('restricted','highly_restricted') then
    raise exception 'Invalid employee document classification' using errcode = '23514';
  end if;

  if p_employee_document_id is null then
    insert into public.employee_documents (
      organization_id, employee_id, document_type, title,
      description, classification, current_version, created_by
    ) values (
      p_organization_id, p_employee_id, p_document_type, trim(p_title),
      nullif(trim(p_description),''), p_classification, 0, v_actor
    ) returning id into v_document_id;
  else
    select d.id, d.current_version into v_document_id, v_version
    from public.employee_documents d
    where d.id = p_employee_document_id
      and d.organization_id = p_organization_id
      and d.employee_id = p_employee_id
    for update;
    if not found then
      raise exception 'Employee document not found in this organization' using errcode = 'P0002';
    end if;
    if exists (
      select 1 from public.employee_documents d
      where d.id = v_document_id
        and (d.document_type <> p_document_type or d.classification <> p_classification)
    ) then
      raise exception 'Document type and classification cannot change between versions' using errcode = '23514';
    end if;
  end if;

  select d.current_version + 1 into v_version
  from public.employee_documents d where d.id = v_document_id for update;

  insert into public.employee_document_versions (
    organization_id, employee_document_id, version_number,
    storage_bucket, storage_object_key, original_file_name,
    mime_type, file_size_bytes, sha256_hex, uploaded_by
  ) values (
    p_organization_id, v_document_id, v_version,
    p_storage_bucket, p_storage_object_key, trim(p_original_file_name),
    p_mime_type, p_file_size_bytes, lower(p_sha256_hex), v_actor
  );

  update public.employee_documents
  set current_version = v_version, updated_at = now()
  where id = v_document_id;

  insert into public.audit_events (
    organization_id, actor_user_id, action, resource_type, resource_id, metadata
  ) values (
    p_organization_id, v_actor, 'hr.employee_document.version_registered',
    'employee_document', v_document_id::text,
    jsonb_build_object('version', v_version, 'document_type', p_document_type,
      'classification', p_classification, 'employee_id', p_employee_id)
  );
  return v_document_id;
end;
$function$;
