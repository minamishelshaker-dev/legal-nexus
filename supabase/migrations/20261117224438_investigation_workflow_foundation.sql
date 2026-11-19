
create or replace function private.can_access_investigation(target_investigation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.administrative_investigations i
    where i.id = target_investigation
      and (
        private.has_legal_sensitive_role(i.organization_id)
        or i.investigator_user_id = auth.uid()
        or i.decision_maker_user_id = auth.uid()
      )
  );
$function$;

create or replace function private.can_manage_investigation(target_investigation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.administrative_investigations i
    where i.id = target_investigation
      and (
        private.has_legal_sensitive_role(i.organization_id)
        or i.investigator_user_id = auth.uid()
      )
  );
$function$;

create or replace function private.can_decide_investigation(target_investigation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.administrative_investigations i
    where i.id = target_investigation
      and (
        i.decision_maker_user_id = auth.uid()
        or private.has_org_role(i.organization_id, array['owner','admin'])
      )
  );
$function$;

revoke all on function private.can_access_investigation(uuid) from public, anon;
revoke all on function private.can_manage_investigation(uuid) from public, anon;
revoke all on function private.can_decide_investigation(uuid) from public, anon;
grant execute on function private.can_access_investigation(uuid) to authenticated;
grant execute on function private.can_manage_investigation(uuid) to authenticated;
grant execute on function private.can_decide_investigation(uuid) to authenticated;

create table public.investigation_sessions (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.administrative_investigations(id) on delete restrict,
  session_type text not null default 'interview'
    check (session_type in ('interview','hearing','evidence_review','committee','other')),
  scheduled_at timestamptz,
  location text,
  status text not null default 'scheduled'
    check (status in ('scheduled','completed','postponed','cancelled')),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_investigation_sessions_parent on public.investigation_sessions(investigation_id, scheduled_at);

create table public.investigation_statements (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.administrative_investigations(id) on delete restrict,
  session_id uuid references public.investigation_sessions(id) on delete restrict,
  participant_name text not null,
  participant_role text not null
    check (participant_role in ('subject_employee','complainant','witness','investigator','representative','other')),
  statement_text text not null,
  status text not null default 'draft'
    check (status in ('draft','recorded','verified')),
  recorded_by uuid not null references auth.users(id),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_investigation_statements_parent on public.investigation_statements(investigation_id, created_at);

create table public.investigation_evidence (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.administrative_investigations(id) on delete restrict,
  document_id uuid references public.documents(id) on delete restrict,
  evidence_type text not null
    check (evidence_type in ('document','email','image','audio','video','physical','system_record','other')),
  title text not null,
  description text,
  submitted_by uuid references auth.users(id),
  collected_at timestamptz,
  confidentiality_level text not null default 'restricted'
    check (confidentiality_level in ('confidential','restricted','highly_restricted')),
  chain_of_custody jsonb not null default '[]'::jsonb,
  status text not null default 'submitted'
    check (status in ('submitted','under_review','accepted','rejected','returned')),
  created_at timestamptz not null default now()
);
create index idx_investigation_evidence_parent on public.investigation_evidence(investigation_id, created_at);

create table public.investigation_minutes (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.administrative_investigations(id) on delete restrict,
  session_id uuid not null references public.investigation_sessions(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  content text not null,
  status text not null default 'draft'
    check (status in ('draft','submitted','approved')),
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  supersedes_id uuid references public.investigation_minutes(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(session_id, version_no)
);
create index idx_investigation_minutes_parent on public.investigation_minutes(investigation_id, session_id);

create table public.investigation_recommendations (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.administrative_investigations(id) on delete restrict,
  recommended_outcome text not null
    check (recommended_outcome in ('close_no_violation','warning','penalty','refer_external','further_investigation','other')),
  rationale text not null,
  legal_basis text,
  prepared_by uuid not null references auth.users(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_investigation_recommendations_parent on public.investigation_recommendations(investigation_id, created_at);

create table public.investigation_decisions (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.administrative_investigations(id) on delete restrict,
  recommendation_id uuid references public.investigation_recommendations(id) on delete restrict,
  final_outcome text not null
    check (final_outcome in ('close_no_violation','warning','penalty','refer_external','further_investigation','other')),
  decision_reason text not null,
  legal_basis text,
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  status text not null default 'final'
    check (status in ('final','superseded','revoked'))
);
create index idx_investigation_decisions_parent on public.investigation_decisions(investigation_id, decided_at desc);

create table public.investigation_appeals (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.administrative_investigations(id) on delete restrict,
  decision_id uuid not null references public.investigation_decisions(id) on delete restrict,
  grounds text not null,
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','partially_accepted')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  outcome_notes text
);
create index idx_investigation_appeals_parent on public.investigation_appeals(investigation_id, submitted_at desc);

-- RLS is enabled on every newly exposed investigation table.
alter table public.investigation_sessions enable row level security;
alter table public.investigation_statements enable row level security;
alter table public.investigation_evidence enable row level security;
alter table public.investigation_minutes enable row level security;
alter table public.investigation_recommendations enable row level security;
alter table public.investigation_decisions enable row level security;
alter table public.investigation_appeals enable row level security;

-- Read access follows the parent investigation's strict confidentiality boundary.
create policy "authorized users can view investigation sessions" on public.investigation_sessions
for select to authenticated using (private.can_access_investigation(investigation_id));
create policy "authorized users can view investigation statements" on public.investigation_statements
for select to authenticated using (private.can_access_investigation(investigation_id));
create policy "authorized users can view investigation evidence" on public.investigation_evidence
for select to authenticated using (private.can_access_investigation(investigation_id));
create policy "authorized users can view investigation minutes" on public.investigation_minutes
for select to authenticated using (private.can_access_investigation(investigation_id));
create policy "authorized users can view investigation recommendations" on public.investigation_recommendations
for select to authenticated using (private.can_access_investigation(investigation_id));
create policy "authorized users can view investigation decisions" on public.investigation_decisions
for select to authenticated using (private.can_access_investigation(investigation_id));
create policy "authorized users can view investigation appeals" on public.investigation_appeals
for select to authenticated using (private.can_access_investigation(investigation_id));

-- Investigator/legal team can manage the investigation file; no hard-delete policies are provided.
create policy "investigation team can create sessions" on public.investigation_sessions
for insert to authenticated with check (
  private.can_manage_investigation(investigation_id) and created_by = (select auth.uid())
);
create policy "investigation team can update sessions" on public.investigation_sessions
for update to authenticated using (private.can_manage_investigation(investigation_id))
with check (private.can_manage_investigation(investigation_id));

create policy "investigation team can create statements" on public.investigation_statements
for insert to authenticated with check (
  private.can_manage_investigation(investigation_id) and recorded_by = (select auth.uid())
);
create policy "investigation team can update statements" on public.investigation_statements
for update to authenticated using (private.can_manage_investigation(investigation_id))
with check (private.can_manage_investigation(investigation_id));

create policy "investigation team can create evidence" on public.investigation_evidence
for insert to authenticated with check (
  private.can_manage_investigation(investigation_id)
  and (submitted_by is null or submitted_by = (select auth.uid()))
);
create policy "investigation team can update evidence" on public.investigation_evidence
for update to authenticated using (private.can_manage_investigation(investigation_id))
with check (private.can_manage_investigation(investigation_id));

create policy "investigation team can create minutes" on public.investigation_minutes
for insert to authenticated with check (
  private.can_manage_investigation(investigation_id) and created_by = (select auth.uid())
);
create policy "investigation team can update draft minutes" on public.investigation_minutes
for update to authenticated using (
  private.can_manage_investigation(investigation_id) and status <> 'approved'
)
with check (private.can_manage_investigation(investigation_id));

create policy "investigation team can create recommendations" on public.investigation_recommendations
for insert to authenticated with check (
  private.can_manage_investigation(investigation_id) and prepared_by = (select auth.uid())
);
create policy "investigation team can update unsubmitted recommendations" on public.investigation_recommendations
for update to authenticated using (
  private.can_manage_investigation(investigation_id) and submitted_at is null
)
with check (private.can_manage_investigation(investigation_id));

-- Final decisions are separate from the investigator's recommendation.
create policy "authorized decision makers can create decisions" on public.investigation_decisions
for insert to authenticated with check (
  private.can_decide_investigation(investigation_id) and decided_by = (select auth.uid())
);
create policy "authorized decision makers can update decisions" on public.investigation_decisions
for update to authenticated using (private.can_decide_investigation(investigation_id))
with check (private.can_decide_investigation(investigation_id));

create policy "investigation team can submit appeals" on public.investigation_appeals
for insert to authenticated with check (
  private.can_access_investigation(investigation_id) and submitted_by = (select auth.uid())
);
create policy "authorized decision makers can review appeals" on public.investigation_appeals
for update to authenticated using (private.can_decide_investigation(investigation_id))
with check (private.can_decide_investigation(investigation_id));

-- Append-only audit trail for investigation workflow changes.
create or replace function private.audit_investigation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_investigation uuid;
  v_org uuid;
  v_record_id text;
  v_action text;
begin
  if tg_op = 'DELETE' then
    v_investigation := old.investigation_id;
    v_record_id := old.id::text;
    v_action := 'investigation.' || tg_table_name || '.deleted';
  else
    v_investigation := new.investigation_id;
    v_record_id := new.id::text;
    v_action := 'investigation.' || tg_table_name || '.' || lower(tg_op);
  end if;
  select organization_id into v_org
  from public.administrative_investigations
  where id = v_investigation;
  insert into public.audit_events
    (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values
    (v_org, auth.uid(), v_action, tg_table_name, v_record_id,
     jsonb_build_object('investigation_id', v_investigation));
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;
revoke all on function private.audit_investigation_change() from public, anon, authenticated;

create trigger trg_audit_investigation_sessions
after insert or update or delete on public.investigation_sessions
for each row execute function private.audit_investigation_change();
create trigger trg_audit_investigation_statements
after insert or update or delete on public.investigation_statements
for each row execute function private.audit_investigation_change();
create trigger trg_audit_investigation_evidence
after insert or update or delete on public.investigation_evidence
for each row execute function private.audit_investigation_change();
create trigger trg_audit_investigation_minutes
after insert or update or delete on public.investigation_minutes
for each row execute function private.audit_investigation_change();
create trigger trg_audit_investigation_recommendations
after insert or update or delete on public.investigation_recommendations
for each row execute function private.audit_investigation_change();
create trigger trg_audit_investigation_decisions
after insert or update or delete on public.investigation_decisions
for each row execute function private.audit_investigation_change();
create trigger trg_audit_investigation_appeals
after insert or update or delete on public.investigation_appeals
for each row execute function private.audit_investigation_change();
