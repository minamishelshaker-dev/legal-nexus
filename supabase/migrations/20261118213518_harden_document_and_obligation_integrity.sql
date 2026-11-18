create or replace function private.guard_obligation_integrity()
returns trigger
language plpgsql
security definer
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

revoke all on function private.guard_obligation_integrity() from public, anon, authenticated;

create or replace function private.guard_document_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_folders text[];
begin
  if tg_op = 'INSERT' then
    if new.uploaded_by is distinct from auth.uid() then
      raise exception 'Document uploader must be the authenticated user';
    end if;
  else
    if old.id is distinct from new.id
       or old.organization_id is distinct from new.organization_id
       or old.uploaded_by is distinct from new.uploaded_by
       or old.storage_key is distinct from new.storage_key then
      raise exception 'Document identity, organization, uploader and storage path are immutable';
    end if;
  end if;

  v_folders := storage.foldername(new.storage_key);
  if coalesce(array_length(v_folders, 1), 0) <> 2
     or v_folders[1] <> new.organization_id::text
     or v_folders[2] <> new.id::text
     or nullif(split_part(new.storage_key, '/', 3), '') is null then
    raise exception 'Document storage path must be organization_id/document_id/file_name';
  end if;

  if (new.related_record_type is null) <> (new.related_record_id is null) then
    raise exception 'Related record type and ID must be supplied together';
  end if;

  if new.related_record_type is not null and new.related_record_type not in ('contract','legal_matter') then
    raise exception 'Unsupported related record type';
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

  return new;
end;
$function$;

revoke all on function private.guard_document_integrity() from public, anon, authenticated;

drop trigger if exists trg_guard_document_integrity on public.documents;
create trigger trg_guard_document_integrity
before insert or update on public.documents
for each row execute function private.guard_document_integrity();
