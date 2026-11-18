insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-documents-private',
  'organization-documents-private',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'text/plain'
  ]::text[]
)
on conflict (id) do nothing;

create or replace function private.can_access_document_storage_path(target_path text, require_uploader boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_folders text[];
  v_org uuid;
  v_document uuid;
begin
  if target_path is null then return false; end if;
  v_folders := storage.foldername(target_path);
  if coalesce(array_length(v_folders, 1), 0) <> 2 then return false; end if;
  if v_folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_folders[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_org := v_folders[1]::uuid;
  v_document := v_folders[2]::uuid;

  return exists (
    select 1
    from public.documents d
    where d.organization_id = v_org
      and d.id = v_document
      and d.storage_key = target_path
      and private.is_org_member(v_org)
      and (
        d.classification in ('public', 'internal')
        or private.has_legal_sensitive_role(v_org)
      )
      and (
        not require_uploader
        or d.uploaded_by = auth.uid()
      )
  );
exception
  when others then return false;
end;
$function$;

revoke all on function private.can_access_document_storage_path(text, boolean) from public, anon;
grant execute on function private.can_access_document_storage_path(text, boolean) to authenticated;

drop policy if exists "members can add documents" on public.documents;
create policy "members can add appropriately classified documents"
on public.documents
for insert
to authenticated
with check (
  private.is_org_member(organization_id)
  and uploaded_by = auth.uid()
  and (
    classification in ('public', 'internal')
    or private.has_legal_sensitive_role(organization_id)
  )
);

drop policy if exists "organization members can read document files" on storage.objects;
create policy "organization members can read document files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'organization-documents-private'
  and private.can_access_document_storage_path(name, false)
);

drop policy if exists "document uploader can upload registered files" on storage.objects;
create policy "document uploader can upload registered files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organization-documents-private'
  and private.can_access_document_storage_path(name, true)
);

create or replace function public.log_document_access(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid;
  v_classification text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select organization_id, classification
    into v_org, v_classification
  from public.documents
  where id = p_document_id;

  if not found or not private.is_org_member(v_org) then
    raise exception 'Document not found or access denied' using errcode = '42501';
  end if;

  if v_classification not in ('public', 'internal')
     and not private.has_legal_sensitive_role(v_org) then
    raise exception 'Insufficient permission to access this document' using errcode = '42501';
  end if;

  insert into public.audit_events (
    organization_id, actor_user_id, action, resource_type, resource_id, metadata
  ) values (
    v_org, auth.uid(), 'document.download_requested', 'document',
    p_document_id::text, jsonb_build_object('classification', v_classification)
  );

  return true;
end;
$function$;

revoke all on function public.log_document_access(uuid) from public, anon;
grant execute on function public.log_document_access(uuid) to authenticated;

drop trigger if exists trg_audit_documents on public.documents;
create trigger trg_audit_documents
after insert or update or delete on public.documents
for each row execute function private.audit_core_legal_record_change();

create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 240),
  description text,
  obligation_type text not null default 'other'
    check (obligation_type in ('contractual','regulatory','filing','policy','renewal','other')),
  status text not null default 'open'
    check (status in ('open','in_progress','completed','cancelled')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','critical')),
  due_date date not null,
  responsible_user_id uuid references auth.users(id) on delete set null,
  related_record_type text check (related_record_type in ('contract','legal_matter')),
  related_record_id uuid,
  created_by uuid not null references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obligations_related_record_pair_check
    check ((related_record_type is null and related_record_id is null)
        or (related_record_type is not null and related_record_id is not null))
);

create index if not exists obligations_org_due_date_idx on public.obligations(organization_id, due_date);
create index if not exists obligations_org_status_idx on public.obligations(organization_id, status);
create index if not exists obligations_responsible_user_idx on public.obligations(responsible_user_id);

alter table public.obligations enable row level security;
grant select, insert, update, delete on public.obligations to authenticated;

create policy "authorized members can view obligations"
on public.obligations
for select
to authenticated
using (
  private.is_org_member(organization_id)
  and (
    responsible_user_id = auth.uid()
    or private.has_legal_sensitive_role(organization_id)
    or private.has_org_role(organization_id, array['owner','admin','legal_manager','contract_manager'])
  )
);

create policy "legal roles can create obligations"
on public.obligations
for insert
to authenticated
with check (
  created_by = auth.uid()
  and private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer','contract_manager'])
);

create policy "legal roles can update obligations"
on public.obligations
for update
to authenticated
using (
  private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer','contract_manager'])
)
with check (
  private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer','contract_manager'])
);

create policy "administrators can delete obligations"
on public.obligations
for delete
to authenticated
using (
  private.has_org_role(organization_id, array['owner','admin','legal_manager'])
);

create or replace function private.guard_obligation_integrity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.created_by is distinct from auth.uid() then
      raise exception 'Obligation creator must be the authenticated user';
    end if;
  else
    if old.organization_id is distinct from new.organization_id
       or old.created_by is distinct from new.created_by then
      raise exception 'Obligation organization and creator are immutable';
    end if;
  end if;

  if new.responsible_user_id is not null and not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.responsible_user_id
      and m.status = 'active'
  ) then
    raise exception 'Responsible user must be an active member of the same organization';
  end if;

  if new.related_record_type = 'contract' and not exists (
    select 1 from public.contracts c
    where c.id = new.related_record_id and c.organization_id = new.organization_id
  ) then
    raise exception 'Related contract must belong to the same organization';
  end if;

  if new.related_record_type = 'legal_matter' and not exists (
    select 1 from public.legal_matters m
    where m.id = new.related_record_id and m.organization_id = new.organization_id
  ) then
    raise exception 'Related legal matter must belong to the same organization';
  end if;

  new.updated_at := now();
  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_obligation_integrity on public.obligations;
create trigger trg_guard_obligation_integrity
before insert or update on public.obligations
for each row execute function private.guard_obligation_integrity();

drop trigger if exists trg_audit_obligations on public.obligations;
create trigger trg_audit_obligations
after insert or update or delete on public.obligations
for each row execute function private.audit_core_legal_record_change();
