
-- Private evidence storage with case-scoped access and immutable custody events.
alter table public.investigation_evidence
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists sha256 text,
  add column if not exists uploaded_at timestamptz,
  add column if not exists uploaded_by uuid references auth.users(id);

alter table public.investigation_evidence
  add constraint investigation_evidence_file_size_check
    check (file_size_bytes is null or (file_size_bytes > 0 and file_size_bytes <= 52428800)),
  add constraint investigation_evidence_sha256_check
    check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$');

create unique index if not exists investigation_evidence_storage_path_uidx
  on public.investigation_evidence(storage_path)
  where storage_path is not null;

create table if not exists public.investigation_evidence_events (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.administrative_investigations(id) on delete restrict,
  evidence_id uuid not null references public.investigation_evidence(id) on delete restrict,
  event_type text not null check (event_type in ('file_uploaded','file_accessed','file_replaced','reviewed','accepted','rejected','returned','note')),
  actor_user_id uuid not null references auth.users(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists investigation_evidence_events_case_idx
  on public.investigation_evidence_events(investigation_id, created_at desc);
create index if not exists investigation_evidence_events_evidence_idx
  on public.investigation_evidence_events(evidence_id, created_at desc);

create or replace function private.validate_investigation_evidence_event_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.investigation_evidence e
    where e.id = new.evidence_id and e.investigation_id = new.investigation_id
  ) then
    raise exception 'Evidence item does not belong to this investigation';
  end if;
  if new.actor_user_id <> auth.uid() then
    raise exception 'Event actor must be the authenticated user';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_investigation_evidence_event_parent
  on public.investigation_evidence_events;
create trigger validate_investigation_evidence_event_parent
before insert on public.investigation_evidence_events
for each row execute function private.validate_investigation_evidence_event_parent();

alter table public.investigation_evidence_events enable row level security;
drop policy if exists "authorized users can view evidence custody events" on public.investigation_evidence_events;
create policy "authorized users can view evidence custody events"
on public.investigation_evidence_events for select to authenticated
using (private.can_access_investigation(investigation_id));
drop policy if exists "investigation team can append evidence custody events" on public.investigation_evidence_events;
create policy "investigation team can append evidence custody events"
on public.investigation_evidence_events for insert to authenticated
with check (private.can_manage_investigation(investigation_id) and actor_user_id = (select auth.uid()));

revoke all on public.investigation_evidence_events from anon, authenticated;
grant select, insert on public.investigation_evidence_events to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'investigation-evidence-private',
  'investigation-evidence-private',
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
    'text/plain',
    'message/rfc822',
    'audio/mpeg',
    'audio/wav',
    'video/mp4'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "investigation team can upload evidence files" on storage.objects;
create policy "investigation team can upload evidence files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'investigation-evidence-private'
  and array_length(storage.foldername(name), 1) = 2
  and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.can_manage_investigation(split_part(name, '/', 1)::uuid)
    else false
  end
);
drop policy if exists "authorized users can read evidence files" on storage.objects;
create policy "authorized users can read evidence files"
on storage.objects for select to authenticated
using (
  bucket_id = 'investigation-evidence-private'
  and array_length(storage.foldername(name), 1) = 2
  and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.can_access_investigation(split_part(name, '/', 1)::uuid)
    else false
  end
);

revoke update, delete, truncate on public.investigation_evidence_events from authenticated, anon;
