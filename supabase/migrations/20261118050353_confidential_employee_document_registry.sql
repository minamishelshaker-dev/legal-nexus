
create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_id uuid not null,
  document_type text not null check (document_type = any (array[
    'employment_contract','identity_document','qualification','experience_letter',
    'job_description','performance_review','leave_document','disciplinary_notice',
    'termination_document','other'
  ])),
  title text not null check (length(btrim(title)) between 2 and 200),
  description text,
  classification text not null default 'restricted'
    check (classification in ('restricted','highly_restricted')),
  current_version integer not null default 0 check (current_version >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_documents_employee_same_org_fk
    foreign key (employee_id, organization_id)
    references public.employee_records(id, organization_id) on delete restrict,
  constraint employee_documents_id_org_unique unique (id, organization_id),
  constraint employee_documents_description_check check (description is null or length(description) <= 2000)
);

create table public.employee_document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_document_id uuid not null,
  version_number integer not null check (version_number > 0),
  storage_bucket text not null,
  storage_object_key text not null,
  original_file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 52428800),
  sha256_hex text,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint employee_document_versions_document_same_org_fk
    foreign key (employee_document_id, organization_id)
    references public.employee_documents(id, organization_id) on delete restrict,
  constraint employee_document_versions_version_unique
    unique (employee_document_id, version_number),
  constraint employee_document_versions_object_unique
    unique (storage_bucket, storage_object_key),
  constraint employee_document_versions_sha_check
    check (sha256_hex is null or sha256_hex ~ '^[0-9a-fA-F]{64}$')
);

create index idx_employee_documents_org_employee
  on public.employee_documents(organization_id, employee_id, created_at desc);
create index idx_employee_document_versions_org_doc
  on public.employee_document_versions(organization_id, employee_document_id, version_number desc);

alter table public.employee_documents enable row level security;
alter table public.employee_document_versions enable row level security;

revoke all on public.employee_documents from public, anon, authenticated;
revoke all on public.employee_document_versions from public, anon, authenticated;
grant select on public.employee_documents to authenticated;
grant select on public.employee_document_versions to authenticated;

create policy "HR managers can view employee documents"
on public.employee_documents for select to authenticated
using ((select private.has_hr_sensitive_role(organization_id)));

create policy "HR managers can view employee document versions"
on public.employee_document_versions for select to authenticated
using ((select private.has_hr_sensitive_role(organization_id)));

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
  from public.employee_documents d
  where d.id = v_document_id
  for update;

  insert into public.employee_document_versions (
    organization_id, employee_document_id, version_number,
    storage_bucket, storage_object_key, original_file_name,
    mime_type, file_size_bytes, sha256_hex, uploaded_by
  ) values (
    p_organization_id, v_document_id, v_version,
    trim(p_storage_bucket), trim(p_storage_object_key), trim(p_original_file_name),
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

revoke all on function private.register_employee_document_version(
  uuid,uuid,text,text,text,text,text,text,bigint,text,text,text,uuid
) from public, anon, authenticated;
grant execute on function private.register_employee_document_version(
  uuid,uuid,text,text,text,text,text,text,bigint,text,text,text,uuid
) to authenticated;

create or replace function public.register_employee_document_version(
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
language sql
set search_path = ''
as $function$
  select private.register_employee_document_version(
    p_organization_id, p_employee_id, p_document_type, p_title,
    p_storage_bucket, p_storage_object_key, p_original_file_name,
    p_mime_type, p_file_size_bytes, p_description, p_classification,
    p_sha256_hex, p_employee_document_id
  );
$function$;

revoke all on function public.register_employee_document_version(
  uuid,uuid,text,text,text,text,text,text,bigint,text,text,text,uuid
) from public, anon;
grant execute on function public.register_employee_document_version(
  uuid,uuid,text,text,text,text,text,text,bigint,text,text,text,uuid
) to authenticated;
