
create table public.matter_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null,
  event_type text not null check (event_type in ('hearing','deadline','filing','meeting','other')),
  title text not null check (length(btrim(title)) between 2 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  court_name text check (court_name is null or length(court_name) <= 200),
  location text check (location is null or length(location) <= 200),
  notes text check (notes is null or length(notes) <= 4000),
  status text not null default 'scheduled' check (status in ('scheduled','completed','postponed','cancelled')),
  responsible_user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matter_events_matter_same_org_fk foreign key (organization_id, matter_id)
    references public.legal_matters(organization_id, id) on delete cascade,
  constraint matter_events_time_order check (ends_at is null or ends_at >= starts_at)
);
create index idx_matter_events_org_time on public.matter_events(organization_id, starts_at);
create index idx_matter_events_matter on public.matter_events(organization_id, matter_id, starts_at);
create index idx_matter_events_responsible on public.matter_events(responsible_user_id);
create index idx_matter_events_created_by on public.matter_events(created_by);

alter table public.matter_events enable row level security;
revoke all on public.matter_events from public, anon, authenticated;
grant select, insert, update, delete on public.matter_events to authenticated;

create policy "legal roles view matter events" on public.matter_events
  for select to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']));
create policy "legal roles create matter events" on public.matter_events
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer'])
  );
create policy "legal roles update matter events" on public.matter_events
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']))
  with check (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']));
create policy "legal managers delete matter events" on public.matter_events
  for delete to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager']));

create or replace function private.guard_matter_event()
returns trigger language plpgsql set search_path = ''
as $f$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
       or new.matter_id is distinct from old.matter_id
       or new.created_by is distinct from old.created_by then
      raise exception 'Event ownership cannot be changed' using errcode = '23514';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$f$;
revoke all on function private.guard_matter_event() from public, anon, authenticated;
create trigger trg_guard_matter_event before insert or update on public.matter_events
for each row execute function private.guard_matter_event();

-- Allow new notification kinds.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'request_created','request_status','request_assigned','approval_required','approval_decided',
  'request_comment','obligation_assigned','obligation_due','obligation_overdue','contract_expiring',
  'investigation_assigned','invitation_accepted','chat_message','event_assigned','event_soon','system'
));

create or replace function private.trg_notify_matter_event()
returns trigger language plpgsql security definer set search_path = ''
as $f$
begin
  begin
    if new.responsible_user_id is not null
       and new.responsible_user_id is distinct from auth.uid()
       and (tg_op = 'INSERT' or new.responsible_user_id is distinct from old.responsible_user_id) then
      perform private.notify(new.organization_id, new.responsible_user_id, 'event_assigned', new.title,
        jsonb_build_object('starts_at', new.starts_at, 'event_type', new.event_type),
        '/workspace/calendar', 'matter_event', new.id, null);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$f$;
revoke all on function private.trg_notify_matter_event() from public, anon, authenticated;
create trigger trg_notify_matter_event after insert or update on public.matter_events
for each row execute function private.trg_notify_matter_event();

-- Extend the on-demand digest with upcoming hearings/deadlines (next 3 days).
create or replace function private.refresh_due_notifications(p_org uuid)
returns void
language plpgsql security definer set search_path = ''
as $f$
declare
  v uuid := auth.uid();
  rec record;
  v_leader boolean;
begin
  if v is null or not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_org and m.user_id = v and m.status = 'active'
  ) then return; end if;

  for rec in
    select o.id, o.title, o.due_date, (o.due_date < current_date) as overdue
    from public.obligations o
    where o.organization_id = p_org
      and o.status in ('open','in_progress')
      and o.due_date <= current_date + 7
      and coalesce(o.responsible_user_id, o.created_by) = v
  loop
    perform private.notify(p_org, v,
      case when rec.overdue then 'obligation_overdue' else 'obligation_due' end,
      rec.title, jsonb_build_object('due_date', rec.due_date), '/workspace/obligations', 'obligation', rec.id,
      case when rec.overdue then 'obl-overdue:' else 'obl-due:' end || rec.id::text);
  end loop;

  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_org and m.user_id = v and m.status = 'active'
      and m.membership_role in ('owner','admin','legal_manager','lawyer','contract_manager')
  ) into v_leader;

  if v_leader then
    for rec in
      select c.id, c.title, c.end_date
      from public.contracts c
      where c.organization_id = p_org
        and c.status in ('approved','signed','active')
        and c.end_date between current_date and current_date + 30
        and (c.responsible_user_id = v
             or exists (select 1 from public.organization_memberships m
                        where m.organization_id = p_org and m.user_id = v and m.status = 'active'
                          and m.membership_role in ('owner','admin','legal_manager')))
    loop
      perform private.notify(p_org, v, 'contract_expiring', rec.title,
        jsonb_build_object('end_date', rec.end_date), '/workspace/contracts/' || rec.id::text, 'contract', rec.id,
        'contract-exp:' || rec.id::text);
    end loop;
  end if;

  if private.has_org_role(p_org, array['owner','admin','legal_manager','lawyer']) then
    for rec in
      select e.id, e.title, e.starts_at, e.event_type
      from public.matter_events e
      where e.organization_id = p_org
        and e.status = 'scheduled'
        and e.starts_at >= now()
        and e.starts_at <= now() + interval '3 days'
        and (e.responsible_user_id = v
             or (e.responsible_user_id is null and private.has_org_role(p_org, array['owner','admin','legal_manager'])))
    loop
      perform private.notify(p_org, v, 'event_soon', rec.title,
        jsonb_build_object('starts_at', rec.starts_at, 'event_type', rec.event_type),
        '/workspace/calendar', 'matter_event', rec.id, 'event-soon:' || rec.id::text);
    end loop;
  end if;
end;
$f$;
