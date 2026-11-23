
create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 160),
  description text check (description is null or length(description) <= 1000),
  contract_type text check (contract_type is null or length(contract_type) <= 100),
  language text not null default 'ar' check (language in ('ar','en')),
  body text not null check (length(body) between 1 and 200000),
  variables jsonb not null default '[]'::jsonb check (jsonb_typeof(variables) = 'array'),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_contract_templates_org on public.contract_templates(organization_id, status);
create index idx_contract_templates_created_by on public.contract_templates(created_by);

create table public.contract_clauses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(btrim(title)) between 2 and 160),
  category text check (category is null or length(category) <= 100),
  language text not null default 'ar' check (language in ('ar','en')),
  body text not null check (length(body) between 1 and 20000),
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_contract_clauses_org on public.contract_clauses(organization_id, status);
create index idx_contract_clauses_created_by on public.contract_clauses(created_by);

create table public.contract_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contract_id uuid not null,
  template_id uuid references public.contract_templates(id) on delete set null,
  version_no integer not null check (version_no > 0),
  body text not null check (length(body) <= 200000),
  note text check (note is null or length(note) <= 500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (contract_id, version_no),
  constraint contract_drafts_contract_same_org_fk foreign key (organization_id, contract_id)
    references public.contracts(organization_id, id) on delete cascade
);
create index idx_contract_drafts_org on public.contract_drafts(organization_id, contract_id, version_no desc);
create index idx_contract_drafts_template on public.contract_drafts(template_id);
create index idx_contract_drafts_created_by on public.contract_drafts(created_by);

alter table public.contract_templates enable row level security;
alter table public.contract_clauses enable row level security;
alter table public.contract_drafts enable row level security;
revoke all on public.contract_templates, public.contract_clauses, public.contract_drafts from public, anon, authenticated;
grant select, insert, update on public.contract_templates, public.contract_clauses to authenticated;
grant select on public.contract_drafts to authenticated;

create policy "contract roles read templates" on public.contract_templates for select to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer','contract_manager']));
create policy "legal roles create templates" on public.contract_templates for insert to authenticated
  with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']));
create policy "legal roles update templates" on public.contract_templates for update to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']))
  with check (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']));

create policy "contract roles read clauses" on public.contract_clauses for select to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer','contract_manager']));
create policy "legal roles create clauses" on public.contract_clauses for insert to authenticated
  with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']));
create policy "legal roles update clauses" on public.contract_clauses for update to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']))
  with check (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']));

create policy "contract roles read drafts" on public.contract_drafts for select to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer','contract_manager']));

create or replace function private.guard_template_row()
returns trigger language plpgsql set search_path = ''
as $f$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id or new.created_by is distinct from old.created_by then
      raise exception 'Ownership cannot be changed' using errcode = '23514';
    end if;
    if tg_table_name = 'contract_templates' and new.body is distinct from old.body then
      new.version := old.version + 1;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$f$;
revoke all on function private.guard_template_row() from public, anon, authenticated;
create trigger trg_guard_contract_templates before insert or update on public.contract_templates
for each row execute function private.guard_template_row();
create trigger trg_guard_contract_clauses before insert or update on public.contract_clauses
for each row execute function private.guard_template_row();

create or replace function private.render_template(p_body text, p_vars jsonb, p_values jsonb)
returns text language plpgsql immutable set search_path = ''
as $f$
declare v jsonb; k text; val text; out text := p_body;
begin
  for v in select * from jsonb_array_elements(coalesce(p_vars, '[]'::jsonb)) loop
    k := v->>'key';
    if k is null or k !~ '^[a-z][a-z0-9_]{0,40}$' then continue; end if;
    val := coalesce(nullif(btrim(p_values->>k), ''), nullif(btrim(v->>'default'), ''));
    if coalesce((v->>'required')::boolean, false) and val is null then
      raise exception 'Missing required value: %', coalesce(v->>'label', k) using errcode = '22023';
    end if;
    if val is not null then out := replace(out, '{{' || k || '}}', left(val, 2000)); end if;
  end loop;
  return out;
end;
$f$;
revoke all on function private.render_template(text, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.create_contract_from_template(
  p_template uuid, p_values jsonb, p_title text, p_counterparty text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $f$
declare
  v uuid := auth.uid();
  t public.contract_templates%rowtype;
  v_id uuid;
  v_body text;
begin
  if v is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into t from public.contract_templates where id = p_template;
  if not found then raise exception 'Template not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(t.organization_id, array['owner','admin','legal_manager','lawyer','contract_manager']) then
    raise exception 'Only legal and contract roles can create contracts' using errcode = '42501';
  end if;
  if t.status <> 'active' then
    raise exception 'Only active (reviewed) templates can be used' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_title, ''))) < 2 then
    raise exception 'A contract title is required' using errcode = '22023';
  end if;
  v_body := private.render_template(t.body, t.variables, coalesce(p_values, '{}'::jsonb));

  insert into public.contracts(organization_id, title, counterparty_name, contract_type, status, responsible_user_id, metadata)
  values (t.organization_id, btrim(p_title), nullif(btrim(coalesce(p_counterparty, '')), ''), t.contract_type, 'draft', v,
          jsonb_build_object('template_id', t.id, 'template_version', t.version))
  returning id into v_id;

  insert into public.contract_drafts(organization_id, contract_id, template_id, version_no, body, note, created_by)
  values (t.organization_id, v_id, t.id, 1, v_body, 'Generated from template: ' || t.name, v);

  insert into public.audit_events(organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (t.organization_id, v, 'contract.created_from_template', 'contract', v_id::text,
          jsonb_build_object('template_id', t.id, 'template_version', t.version));
  return v_id;
end;
$f$;
revoke all on function private.create_contract_from_template(uuid, jsonb, text, text) from public, anon;
grant execute on function private.create_contract_from_template(uuid, jsonb, text, text) to authenticated;

create or replace function private.save_contract_draft(p_contract uuid, p_body text, p_note text default null)
returns integer
language plpgsql security definer set search_path = ''
as $f$
declare v uuid := auth.uid(); c public.contracts%rowtype; v_next integer;
begin
  if v is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into c from public.contracts where id = p_contract;
  if not found then raise exception 'Contract not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(c.organization_id, array['owner','admin','legal_manager','lawyer','contract_manager']) then
    raise exception 'Only legal and contract roles can edit drafts' using errcode = '42501';
  end if;
  if length(coalesce(p_body, '')) < 1 or length(p_body) > 200000 then
    raise exception 'Draft text must be between 1 and 200000 characters' using errcode = '22023';
  end if;
  perform 1 from public.contracts where id = p_contract for update;
  select coalesce(max(version_no), 0) + 1 into v_next from public.contract_drafts where contract_id = p_contract;
  insert into public.contract_drafts(organization_id, contract_id, version_no, body, note, created_by,
                                     template_id)
  values (c.organization_id, p_contract, v_next, p_body, nullif(btrim(coalesce(p_note, '')), ''), v,
          (select template_id from public.contract_drafts where contract_id = p_contract order by version_no limit 1));
  insert into public.audit_events(organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (c.organization_id, v, 'contract.draft_saved', 'contract', p_contract::text, jsonb_build_object('version', v_next));
  return v_next;
end;
$f$;
revoke all on function private.save_contract_draft(uuid, text, text) from public, anon;
grant execute on function private.save_contract_draft(uuid, text, text) to authenticated;

create or replace function public.create_contract_from_template(p_template uuid, p_values jsonb, p_title text, p_counterparty text default null)
returns uuid language sql security invoker set search_path = ''
as $f$ select private.create_contract_from_template(p_template, p_values, p_title, p_counterparty); $f$;
create or replace function public.save_contract_draft(p_contract uuid, p_body text, p_note text default null)
returns integer language sql security invoker set search_path = ''
as $f$ select private.save_contract_draft(p_contract, p_body, p_note); $f$;
revoke all on function public.create_contract_from_template(uuid, jsonb, text, text) from public, anon;
revoke all on function public.save_contract_draft(uuid, text, text) from public, anon;
grant execute on function public.create_contract_from_template(uuid, jsonb, text, text) to authenticated;
grant execute on function public.save_contract_draft(uuid, text, text) to authenticated;
