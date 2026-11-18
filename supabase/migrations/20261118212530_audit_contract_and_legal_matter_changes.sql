create or replace function private.audit_core_legal_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid;
  v_record_id text;
  v_action text;
  v_changed_fields text[];
begin
  if tg_op = 'INSERT' then
    v_org := new.organization_id;
    v_record_id := new.id::text;
    v_action := lower(tg_table_name) || '.created';
    v_changed_fields := array['record_created'];
  elsif tg_op = 'UPDATE' then
    v_org := new.organization_id;
    v_record_id := new.id::text;
    v_action := lower(tg_table_name) || '.updated';
    select coalesce(array_agg(k order by k), array[]::text[])
      into v_changed_fields
    from jsonb_object_keys(to_jsonb(new)) as keys(k)
    where (to_jsonb(new)->k) is distinct from (to_jsonb(old)->k);
  else
    v_org := old.organization_id;
    v_record_id := old.id::text;
    v_action := lower(tg_table_name) || '.deleted';
    v_changed_fields := array['record_deleted'];
  end if;

  insert into public.audit_events (
    organization_id, actor_user_id, action, resource_type, resource_id, metadata
  ) values (
    v_org, (select auth.uid()), v_action, tg_table_name, v_record_id,
    jsonb_build_object('changed_fields', to_jsonb(v_changed_fields))
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists trg_audit_contracts on public.contracts;
create trigger trg_audit_contracts
after insert or update or delete on public.contracts
for each row execute function private.audit_core_legal_record_change();

drop trigger if exists trg_audit_legal_matters on public.legal_matters;
create trigger trg_audit_legal_matters
after insert or update or delete on public.legal_matters
for each row execute function private.audit_core_legal_record_change();

revoke all on function private.audit_core_legal_record_change() from public, anon, authenticated;
