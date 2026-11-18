create or replace function public.finalize_investigation_evidence_upload(
  p_evidence_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_sha256 text,
  p_file_name text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_investigation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_file_size_bytes is null or p_file_size_bytes < 1 or p_file_size_bytes > 52428800 then
    raise exception 'Evidence file size must be between 1 byte and 50 MB' using errcode = '22023';
  end if;

  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'A valid SHA-256 digest is required' using errcode = '22023';
  end if;

  if p_mime_type is null or p_mime_type not in (
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
  ) then
    raise exception 'Unsupported evidence MIME type' using errcode = '22023';
  end if;

  select e.investigation_id
    into v_investigation_id
    from public.investigation_evidence e
   where e.id = p_evidence_id
   for update;

  if v_investigation_id is null then
    raise exception 'Evidence record not found or not accessible' using errcode = 'P0002';
  end if;

  if p_storage_path is null
     or p_storage_path !~ ('^' || v_investigation_id::text || '/' || p_evidence_id::text || '/[^/]+$') then
    raise exception 'Evidence storage path does not match the investigation record' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from storage.objects o
     where o.bucket_id = 'investigation-evidence-private'
       and o.name = p_storage_path
  ) then
    raise exception 'Uploaded evidence object was not found in private storage' using errcode = 'P0002';
  end if;

  update public.investigation_evidence
     set storage_path = p_storage_path,
         mime_type = p_mime_type,
         file_size_bytes = p_file_size_bytes,
         sha256 = p_sha256,
         uploaded_at = pg_catalog.now(),
         uploaded_by = auth.uid()
   where id = p_evidence_id;

  insert into public.investigation_evidence_events (
    investigation_id, evidence_id, event_type, actor_user_id, details
  ) values (
    v_investigation_id,
    p_evidence_id,
    'file_uploaded',
    auth.uid(),
    pg_catalog.jsonb_build_object(
      'file_name', pg_catalog.left(coalesce(p_file_name, 'evidence'), 255),
      'mime_type', p_mime_type,
      'file_size_bytes', p_file_size_bytes,
      'sha256', p_sha256
    )
  );
end;
$function$;

revoke all on function public.finalize_investigation_evidence_upload(uuid,text,text,bigint,text,text) from public, anon;
grant execute on function public.finalize_investigation_evidence_upload(uuid,text,text,bigint,text,text) to authenticated;
