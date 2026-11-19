
alter table public.investigation_evidence_events
  drop constraint if exists investigation_evidence_events_event_type_check;
alter table public.investigation_evidence_events
  add constraint investigation_evidence_events_event_type_check
  check (event_type in ('file_uploaded','file_access_link_issued','file_replaced','reviewed','accepted','rejected','returned','note'));

alter table public.investigation_evidence
  add constraint investigation_evidence_storage_path_case_check
  check (
    storage_path is null
    or storage_path like investigation_id::text || '/' || id::text || '/%'
  );

create index if not exists investigation_evidence_uploaded_by_idx
  on public.investigation_evidence(uploaded_by);
create index if not exists investigation_evidence_events_actor_idx
  on public.investigation_evidence_events(actor_user_id);

create or replace function private.protect_investigation_evidence_file_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.storage_path is not null and (
    new.storage_path is distinct from old.storage_path
    or new.mime_type is distinct from old.mime_type
    or new.file_size_bytes is distinct from old.file_size_bytes
    or new.sha256 is distinct from old.sha256
    or new.uploaded_at is distinct from old.uploaded_at
    or new.uploaded_by is distinct from old.uploaded_by
  ) then
    raise exception 'Uploaded evidence file identity is immutable';
  end if;
  if new.storage_path is not null and new.storage_path is distinct from old.storage_path then
    if new.uploaded_by is distinct from auth.uid() then
      raise exception 'Uploader must be the authenticated user';
    end if;
    if new.storage_path not like new.investigation_id::text || '/' || new.id::text || '/%' then
      raise exception 'Evidence storage path must be scoped to its case and evidence record';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_investigation_evidence_file_identity
  on public.investigation_evidence;
create trigger protect_investigation_evidence_file_identity
before update on public.investigation_evidence
for each row execute function private.protect_investigation_evidence_file_identity();
