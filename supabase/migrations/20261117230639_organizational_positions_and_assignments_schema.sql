
create table public.job_positions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 department_id uuid,
 parent_position_id uuid,
 title text not null check (length(btrim(title)) between 2 and 160),
 position_code text,
 description text,
 responsibilities jsonb not null default '[]'::jsonb check (jsonb_typeof(responsibilities) = 'array'),
 authority_level text not null default 'standard' check (authority_level in ('executive','senior_management','management','supervisory','standard')),
 status text not null default 'active' check (status in ('active','inactive','archived')),
 display_order integer not null default 0,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint job_positions_department_same_org_fkey foreign key (department_id, organization_id)
   references public.departments(id, organization_id) on delete set null (department_id),
 constraint job_positions_parent_same_org_fkey foreign key (parent_position_id, organization_id)
   references public.job_positions(id, organization_id) on delete set null (parent_position_id),
 constraint job_positions_id_org_unique unique (id, organization_id),
 constraint job_positions_not_own_parent check (parent_position_id is null or parent_position_id <> id),
 constraint job_positions_code_unique_per_org unique (organization_id, position_code)
);

create table public.position_assignments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 position_id uuid not null,
 user_id uuid not null references auth.users(id),
 start_date date not null default current_date,
 end_date date,
 status text not null default 'active' check (status in ('active','ended','revoked')),
 is_primary boolean not null default false,
 assignment_notes text,
 assigned_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint position_assignments_position_same_org_fkey foreign key (position_id, organization_id)
   references public.job_positions(id, organization_id) on delete cascade,
 constraint position_assignments_membership_same_org_fkey foreign key (organization_id, user_id)
   references public.organization_memberships(organization_id, user_id) on delete cascade,
 constraint position_assignments_valid_dates check (end_date is null or end_date >= start_date),
 constraint position_assignments_id_org_unique unique (id, organization_id)
);

create index idx_job_positions_org_department on public.job_positions(organization_id, department_id, status);
create index idx_job_positions_parent_org on public.job_positions(parent_position_id, organization_id) where parent_position_id is not null;
create index idx_position_assignments_org_position on public.position_assignments(organization_id, position_id, status);
create index idx_position_assignments_user_status on public.position_assignments(user_id, status);
create unique index uq_position_primary_active_per_user_org on public.position_assignments(organization_id, user_id) where is_primary and status = 'active';
create unique index uq_position_active_user_per_position on public.position_assignments(organization_id, position_id, user_id) where status = 'active';
