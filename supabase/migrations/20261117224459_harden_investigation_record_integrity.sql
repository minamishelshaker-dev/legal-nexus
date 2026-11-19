
-- Cover foreign keys on the new investigation workflow tables.
create index if not exists idx_inv_sessions_created_by on public.investigation_sessions(created_by);
create index if not exists idx_inv_statements_session on public.investigation_statements(session_id);
create index if not exists idx_inv_statements_recorded_by on public.investigation_statements(recorded_by);
create index if not exists idx_inv_statements_verified_by on public.investigation_statements(verified_by);
create index if not exists idx_inv_evidence_document on public.investigation_evidence(document_id);
create index if not exists idx_inv_evidence_submitted_by on public.investigation_evidence(submitted_by);
create index if not exists idx_inv_minutes_created_by on public.investigation_minutes(created_by);
create index if not exists idx_inv_minutes_approved_by on public.investigation_minutes(approved_by);
create index if not exists idx_inv_minutes_supersedes on public.investigation_minutes(supersedes_id);
create index if not exists idx_inv_recommendations_prepared_by on public.investigation_recommendations(prepared_by);
create index if not exists idx_inv_decisions_recommendation on public.investigation_decisions(recommendation_id);
create index if not exists idx_inv_decisions_decided_by on public.investigation_decisions(decided_by);
create index if not exists idx_inv_appeals_decision on public.investigation_appeals(decision_id);
create index if not exists idx_inv_appeals_submitted_by on public.investigation_appeals(submitted_by);
create index if not exists idx_inv_appeals_reviewed_by on public.investigation_appeals(reviewed_by);

-- Enforce that linked sessions and recommendations belong to the same investigation.
alter table public.investigation_sessions
  add constraint uq_investigation_sessions_id_parent unique (id, investigation_id);
alter table public.investigation_statements
  add constraint fk_inv_statements_session_parent
  foreign key (session_id, investigation_id)
  references public.investigation_sessions(id, investigation_id);
alter table public.investigation_minutes
  add constraint fk_inv_minutes_session_parent
  foreign key (session_id, investigation_id)
  references public.investigation_sessions(id, investigation_id);
alter table public.investigation_recommendations
  add constraint uq_investigation_recommendations_id_parent unique (id, investigation_id);
alter table public.investigation_decisions
  add constraint fk_inv_decisions_recommendation_parent
  foreign key (recommendation_id, investigation_id)
  references public.investigation_recommendations(id, investigation_id);

-- Decision records are append-only; superseding decisions are new records.
drop policy if exists "authorized decision makers can update decisions" on public.investigation_decisions;

-- Prevent reassignment of workflow records to another investigation and protect author attribution.
create or replace function private.guard_investigation_workflow_record()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if to_jsonb(new) ? 'investigation_id'
     and (to_jsonb(new)->>'investigation_id') is distinct from (to_jsonb(old)->>'investigation_id') then
    raise exception 'An investigation workflow record cannot be moved to another investigation';
  end if;
  if to_jsonb(new) ? 'created_by'
     and (to_jsonb(new)->>'created_by') is distinct from (to_jsonb(old)->>'created_by') then
    raise exception 'Record creator cannot be changed';
  end if;
  if to_jsonb(new) ? 'recorded_by'
     and (to_jsonb(new)->>'recorded_by') is distinct from (to_jsonb(old)->>'recorded_by') then
    raise exception 'Statement recorder cannot be changed';
  end if;
  if to_jsonb(new) ? 'prepared_by'
     and (to_jsonb(new)->>'prepared_by') is distinct from (to_jsonb(old)->>'prepared_by') then
    raise exception 'Recommendation author cannot be changed';
  end if;
  if to_jsonb(new) ? 'decided_by'
     and (to_jsonb(new)->>'decided_by') is distinct from (to_jsonb(old)->>'decided_by') then
    raise exception 'Decision maker cannot be changed';
  end if;
  if to_jsonb(new) ? 'submitted_by'
     and (to_jsonb(new)->>'submitted_by') is distinct from (to_jsonb(old)->>'submitted_by') then
    raise exception 'Appeal or evidence submitter cannot be changed';
  end if;
  return new;
end;
$function$;
revoke all on function private.guard_investigation_workflow_record() from public, anon, authenticated;

create trigger trg_guard_inv_sessions before update on public.investigation_sessions
for each row execute function private.guard_investigation_workflow_record();
create trigger trg_guard_inv_statements before update on public.investigation_statements
for each row execute function private.guard_investigation_workflow_record();
create trigger trg_guard_inv_evidence before update on public.investigation_evidence
for each row execute function private.guard_investigation_workflow_record();
create trigger trg_guard_inv_minutes before update on public.investigation_minutes
for each row execute function private.guard_investigation_workflow_record();
create trigger trg_guard_inv_recommendations before update on public.investigation_recommendations
for each row execute function private.guard_investigation_workflow_record();
create trigger trg_guard_inv_decisions before update on public.investigation_decisions
for each row execute function private.guard_investigation_workflow_record();
create trigger trg_guard_inv_appeals before update on public.investigation_appeals
for each row execute function private.guard_investigation_workflow_record();

create or replace function private.guard_investigation_minutes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid;
begin
  if old.status = 'approved' then
    raise exception 'Approved investigation minutes are immutable; create a new version';
  end if;
  if new.status = 'approved' then
    select organization_id into v_org
    from public.administrative_investigations
    where id = new.investigation_id;
    if not private.has_org_role(v_org, array['owner','admin','legal_manager']) then
      raise exception 'Only legal leadership can approve investigation minutes';
    end if;
    if new.approved_by is distinct from auth.uid() then
      raise exception 'Approver must be the authenticated user';
    end if;
    if new.approved_at is null then
      new.approved_at := now();
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.guard_investigation_minutes() from public, anon, authenticated;

create trigger trg_guard_investigation_minutes
before update on public.investigation_minutes
for each row execute function private.guard_investigation_minutes();

create or replace function private.guard_investigation_recommendations()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.submitted_at is not null then
    raise exception 'Submitted recommendations are immutable; create a new recommendation';
  end if;
  return new;
end;
$function$;
revoke all on function private.guard_investigation_recommendations() from public, anon, authenticated;

create trigger trg_guard_investigation_recommendations
before update on public.investigation_recommendations
for each row execute function private.guard_investigation_recommendations();
