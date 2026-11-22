
create table public.legal_request_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_request_id uuid not null references public.legal_requests(id) on delete restrict,
  record_type text not null check (record_type in ('contract','legal_matter')),
  record_id uuid not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (legal_request_id, record_type, record_id)
);
create index idx_legal_request_links_record on public.legal_request_links(record_type, record_id);
create index idx_legal_request_links_org on public.legal_request_links(organization_id);
create index idx_legal_request_links_created_by on public.legal_request_links(created_by);

alter table public.legal_request_links enable row level security;
revoke all on public.legal_request_links from public, anon, authenticated;
grant select on public.legal_request_links to authenticated;
create policy "request viewers can see conversions" on public.legal_request_links
  for select to authenticated using (private.can_access_legal_request(legal_request_id));

create or replace function private.convert_legal_request(
  p_request uuid, p_target text, p_title text, p_counterparty text default null, p_kind text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $f$
declare
  v uuid := auth.uid();
  r public.legal_requests%rowtype;
  v_id uuid;
  v_title text;
  v_priority text;
  v_owner uuid;
begin
  if v is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into r from public.legal_requests where id = p_request;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if p_target not in ('contract','legal_matter') then
    raise exception 'Unsupported conversion target' using errcode = '22023';
  end if;
  if p_target = 'contract' and not private.has_org_role(r.organization_id, array['owner','admin','legal_manager','lawyer','contract_manager']) then
    raise exception 'Only legal and contract roles can create contracts' using errcode = '42501';
  end if;
  if p_target = 'legal_matter' and not private.has_org_role(r.organization_id, array['owner','admin','legal_manager','lawyer']) then
    raise exception 'Only legal roles can create matters' using errcode = '42501';
  end if;
  if r.status in ('cancelled','rejected','completed') then
    raise exception 'This request can no longer be converted (status: %)', r.status using errcode = '22023';
  end if;

  v_title := coalesce(nullif(btrim(coalesce(p_title, '')), ''), r.title);
  v_owner := coalesce(r.assigned_to, v);
  if not exists (select 1 from public.organization_memberships m
                 where m.organization_id = r.organization_id and m.user_id = v_owner and m.status = 'active') then
    v_owner := v;
  end if;

  if p_target = 'contract' then
    insert into public.contracts(organization_id, corporate_entity_id, title, counterparty_name, contract_type, status, responsible_user_id, metadata)
    values (r.organization_id, r.corporate_entity_id, v_title,
            nullif(btrim(coalesce(p_counterparty, '')), ''), nullif(btrim(coalesce(p_kind, '')), ''), 'draft', v_owner,
            jsonb_build_object('source_request_id', r.id, 'source_request_number', r.request_number))
    returning id into v_id;
  else
    v_priority := case r.urgency when 'urgent' then 'critical' when 'high' then 'high' when 'low' then 'low' else 'normal' end;
    insert into public.legal_matters(organization_id, corporate_entity_id, title, matter_type, priority, description, owner_user_id)
    values (r.organization_id, r.corporate_entity_id, v_title,
            coalesce(nullif(btrim(coalesce(p_kind, '')), ''), 'general'), v_priority, r.description, v_owner)
    returning id into v_id;
  end if;

  insert into public.legal_request_links(organization_id, legal_request_id, record_type, record_id, created_by)
  values (r.organization_id, r.id, p_target, v_id, v);

  insert into public.audit_events(organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (r.organization_id, v, 'legal_request.converted', 'legal_request', r.id::text,
          jsonb_build_object('target_type', p_target, 'target_id', v_id));
  return v_id;
end;
$f$;
revoke all on function private.convert_legal_request(uuid,text,text,text,text) from public, anon;
grant execute on function private.convert_legal_request(uuid,text,text,text,text) to authenticated;

create or replace function public.convert_legal_request(p_request uuid, p_target text, p_title text, p_counterparty text default null, p_kind text default null)
returns uuid language sql security invoker set search_path = ''
as $f$ select private.convert_legal_request(p_request, p_target, p_title, p_counterparty, p_kind); $f$;
revoke all on function public.convert_legal_request(uuid,text,text,text,text) from public, anon;
grant execute on function public.convert_legal_request(uuid,text,text,text,text) to authenticated;
