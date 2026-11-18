create or replace function public.log_document_access(p_document_id uuid)
returns boolean
language plpgsql
security invoker
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

  if not found then
    raise exception 'Document not found or access denied' using errcode = '42501';
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
grant insert on public.audit_events to authenticated;

drop policy if exists "members can log own document access request" on public.audit_events;
create policy "members can log own document access request"
on public.audit_events
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and action = 'document.download_requested'
  and resource_type = 'document'
  and exists (
    select 1
    from public.documents d
    where d.id::text = resource_id
      and d.organization_id = audit_events.organization_id
      and d.classification = metadata->>'classification'
  )
);
