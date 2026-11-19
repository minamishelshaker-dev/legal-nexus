
create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  legal_name text,
  country_code char(2) not null default 'EG',
  deployment_mode text not null default 'cloud' check (deployment_mode in ('cloud','on_premises')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  preferred_language text not null default 'ar' check (preferred_language in ('ar','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null default 'member' check (membership_role in ('owner','admin','legal_manager','lawyer','contract_manager','hr_investigator','employee','auditor','member')),
  status text not null default 'active' check (status in ('invited','active','suspended')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.corporate_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_entity_id uuid references public.corporate_entities(id) on delete set null,
  name text not null,
  entity_type text not null default 'company',
  registration_number text,
  country_code char(2) not null default 'EG',
  status text not null default 'active' check (status in ('active','inactive','dissolved')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_department_id uuid references public.departments(id) on delete set null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.legal_matters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  corporate_entity_id uuid,
  reference_no text,
  title text not null,
  matter_type text not null default 'general',
  status text not null default 'open' check (status in ('open','pending','on_hold','closed','archived')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  description text,
  owner_user_id uuid references auth.users(id) on delete set null,
  opened_at date not null default current_date,
  closed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, corporate_entity_id) references public.corporate_entities(organization_id, id)
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  corporate_entity_id uuid,
  contract_number text,
  title text not null,
  counterparty_name text,
  contract_type text,
  status text not null default 'draft' check (status in ('draft','in_review','approved','signed','active','expired','terminated','archived')),
  start_date date,
  end_date date,
  value_amount numeric(18,2),
  currency_code char(3) not null default 'EGP',
  responsible_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, corporate_entity_id) references public.corporate_entities(organization_id, id)
);

create table public.administrative_investigations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  corporate_entity_id uuid,
  case_number text,
  subject_employee_name text not null,
  subject_employee_ref text,
  incident_date date,
  reported_at timestamptz not null default now(),
  allegation_summary text not null,
  status text not null default 'reported' check (status in ('reported','under_review','investigation_open','awaiting_evidence','legal_review','decision_pending','appeal_pending','closed','archived')),
  confidentiality_level text not null default 'restricted' check (confidentiality_level in ('confidential','restricted','highly_restricted')),
  investigator_user_id uuid references auth.users(id) on delete set null,
  recommendation text,
  final_decision text,
  decision_maker_user_id uuid references auth.users(id) on delete set null,
  decision_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, corporate_entity_id) references public.corporate_entities(organization_id, id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  storage_key text not null,
  mime_type text,
  file_size_bytes bigint,
  classification text not null default 'internal' check (classification in ('public','internal','confidential','restricted','highly_restricted')),
  related_record_type text,
  related_record_id uuid,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, storage_key)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index idx_memberships_user on public.organization_memberships(user_id, status);
create index idx_entities_org on public.corporate_entities(organization_id);
create index idx_departments_org on public.departments(organization_id);
create index idx_matters_org_status on public.legal_matters(organization_id, status);
create index idx_contracts_org_status on public.contracts(organization_id, status);
create index idx_contracts_end_date on public.contracts(organization_id, end_date);
create index idx_investigations_org_status on public.administrative_investigations(organization_id, status);
create index idx_documents_org on public.documents(organization_id);
create index idx_audit_org_time on public.audit_events(organization_id, occurred_at desc);

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

alter table public.organizations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.corporate_entities enable row level security;
alter table public.departments enable row level security;
alter table public.legal_matters enable row level security;
alter table public.contracts enable row level security;
alter table public.administrative_investigations enable row level security;
alter table public.documents enable row level security;
alter table public.audit_events enable row level security;

create policy "members can view their organizations" on public.organizations
for select to authenticated using (public.is_org_member(id));
create policy "users can view own profile" on public.user_profiles
for select to authenticated using (id = auth.uid());
create policy "users can insert own profile" on public.user_profiles
for insert to authenticated with check (id = auth.uid());
create policy "users can update own profile" on public.user_profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members can view organization memberships" on public.organization_memberships
for select to authenticated using (public.is_org_member(organization_id));
create policy "members can view entities" on public.corporate_entities
for select to authenticated using (public.is_org_member(organization_id));
create policy "members can manage entities" on public.corporate_entities
for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can view departments" on public.departments
for select to authenticated using (public.is_org_member(organization_id));
create policy "members can manage departments" on public.departments
for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can view legal matters" on public.legal_matters
for select to authenticated using (public.is_org_member(organization_id));
create policy "members can manage legal matters" on public.legal_matters
for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can view contracts" on public.contracts
for select to authenticated using (public.is_org_member(organization_id));
create policy "members can manage contracts" on public.contracts
for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can view investigations" on public.administrative_investigations
for select to authenticated using (public.is_org_member(organization_id));
create policy "members can manage investigations" on public.administrative_investigations
for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can view documents" on public.documents
for select to authenticated using (public.is_org_member(organization_id));
create policy "members can manage documents" on public.documents
for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can view audit events" on public.audit_events
for select to authenticated using (public.is_org_member(organization_id));
create policy "members can append audit events" on public.audit_events
for insert to authenticated with check (public.is_org_member(organization_id) and actor_user_id = auth.uid());
