
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'request_created','request_status','request_assigned','approval_required','approval_decided',
    'request_comment','obligation_assigned','obligation_due','obligation_overdue','contract_expiring',
    'investigation_assigned','invitation_accepted','chat_message','system'
  )),
  subject text check (subject is null or length(subject) <= 300),
  meta jsonb not null default '{}'::jsonb,
  href text check (href is null or (href like '/workspace%' and length(href) <= 300)),
  related_type text,
  related_id uuid,
  dedupe_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create unique index uq_notifications_dedupe on public.notifications(user_id, dedupe_key) where dedupe_key is not null;
create index idx_notifications_user_unread on public.notifications(user_id, created_at desc) where read_at is null;
create index idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index idx_notifications_org on public.notifications(organization_id);

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- Core insert helper: never raises, never notifies non-members.
create or replace function private.notify(
  p_org uuid, p_user uuid, p_kind text, p_subject text, p_meta jsonb,
  p_href text, p_type text, p_id uuid, p_dedupe text default null
) returns void
language plpgsql security definer set search_path = ''
as $f$
begin
  if p_user is null then return; end if;
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_org and m.user_id = p_user and m.status = 'active'
  ) then return; end if;
  insert into public.notifications(organization_id, user_id, kind, subject, meta, href, related_type, related_id, dedupe_key)
  values (p_org, p_user, p_kind, left(p_subject, 300), coalesce(p_meta, '{}'::jsonb), p_href, p_type, p_id, p_dedupe)
  on conflict do nothing;
exception when others then
  null;
end;
$f$;
revoke all on function private.notify(uuid,uuid,text,text,jsonb,text,text,uuid,text) from public, anon, authenticated;

-- Legal requests: new request -> legal leadership; status change -> requester; assignment -> assignee.
create or replace function private.trg_notify_legal_request()
returns trigger language plpgsql security definer set search_path = ''
as $f$
declare r uuid;
begin
  begin
    if tg_op = 'INSERT' then
      for r in
        select m.user_id from public.organization_memberships m
        where m.organization_id = new.organization_id and m.status = 'active'
          and m.membership_role in ('owner','admin','legal_manager')
          and m.user_id is distinct from new.requester_user_id
      loop
        perform private.notify(new.organization_id, r, 'request_created', new.title,
          jsonb_build_object('urgency', new.urgency), '/workspace/requests/' || new.id::text, 'legal_request', new.id, null);
      end loop;
      if new.assigned_to is not null and new.assigned_to is distinct from auth.uid() then
        perform private.notify(new.organization_id, new.assigned_to, 'request_assigned', new.title,
          '{}'::jsonb, '/workspace/requests/' || new.id::text, 'legal_request', new.id, null);
      end if;
    elsif tg_op = 'UPDATE' then
      if new.status is distinct from old.status and new.requester_user_id is distinct from auth.uid() then
        perform private.notify(new.organization_id, new.requester_user_id, 'request_status', new.title,
          jsonb_build_object('status', new.status), '/workspace/requests/' || new.id::text, 'legal_request', new.id, null);
      end if;
      if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null
         and new.assigned_to is distinct from auth.uid() then
        perform private.notify(new.organization_id, new.assigned_to, 'request_assigned', new.title,
          '{}'::jsonb, '/workspace/requests/' || new.id::text, 'legal_request', new.id, null);
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$f$;
revoke all on function private.trg_notify_legal_request() from public, anon, authenticated;
create trigger trg_notify_legal_request after insert or update on public.legal_requests
for each row execute function private.trg_notify_legal_request();

-- Approvals: step created -> approver(s); decision -> requester and assignee.
create or replace function private.trg_notify_approval()
returns trigger language plpgsql security definer set search_path = ''
as $f$
declare
  v_org uuid; v_title text; v_requester uuid; v_assigned uuid; r uuid;
begin
  begin
    select organization_id, title, requester_user_id, assigned_to
      into v_org, v_title, v_requester, v_assigned
    from public.legal_requests where id = new.legal_request_id;
    if v_org is null then return new; end if;

    if tg_op = 'INSERT' then
      if new.approver_user_id is not null then
        perform private.notify(v_org, new.approver_user_id, 'approval_required', v_title, '{}'::jsonb,
          '/workspace/requests/' || new.legal_request_id::text, 'legal_request', new.legal_request_id,
          'appr-req:' || new.id::text);
      elsif new.approver_role is not null then
        for r in
          select m.user_id from public.organization_memberships m
          where m.organization_id = v_org and m.status = 'active' and m.membership_role = new.approver_role
        loop
          perform private.notify(v_org, r, 'approval_required', v_title, '{}'::jsonb,
            '/workspace/requests/' || new.legal_request_id::text, 'legal_request', new.legal_request_id,
            'appr-req:' || new.id::text);
        end loop;
      end if;
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved','rejected') then
      if v_requester is distinct from auth.uid() then
        perform private.notify(v_org, v_requester, 'approval_decided', v_title,
          jsonb_build_object('decision', new.status), '/workspace/requests/' || new.legal_request_id::text,
          'legal_request', new.legal_request_id, null);
      end if;
      if v_assigned is not null and v_assigned is distinct from auth.uid() and v_assigned is distinct from v_requester then
        perform private.notify(v_org, v_assigned, 'approval_decided', v_title,
          jsonb_build_object('decision', new.status), '/workspace/requests/' || new.legal_request_id::text,
          'legal_request', new.legal_request_id, null);
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$f$;
revoke all on function private.trg_notify_approval() from public, anon, authenticated;
create trigger trg_notify_approval after insert or update on public.legal_request_approvals
for each row execute function private.trg_notify_approval();

-- Comments: notify requester (if visible to them) and assignee, never the author.
create or replace function private.trg_notify_request_comment()
returns trigger language plpgsql security definer set search_path = ''
as $f$
declare v_org uuid; v_title text; v_requester uuid; v_assigned uuid;
begin
  begin
    select organization_id, title, requester_user_id, assigned_to
      into v_org, v_title, v_requester, v_assigned
    from public.legal_requests where id = new.legal_request_id;
    if v_org is null then return new; end if;
    if new.visibility = 'requester_visible' and v_requester is distinct from new.author_user_id then
      perform private.notify(v_org, v_requester, 'request_comment', v_title, '{}'::jsonb,
        '/workspace/requests/' || new.legal_request_id::text, 'legal_request', new.legal_request_id, null);
    end if;
    if v_assigned is not null and v_assigned is distinct from new.author_user_id and v_assigned is distinct from v_requester then
      perform private.notify(v_org, v_assigned, 'request_comment', v_title, '{}'::jsonb,
        '/workspace/requests/' || new.legal_request_id::text, 'legal_request', new.legal_request_id, null);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$f$;
revoke all on function private.trg_notify_request_comment() from public, anon, authenticated;
create trigger trg_notify_request_comment after insert on public.legal_request_comments
for each row execute function private.trg_notify_request_comment();

-- Obligations: responsible user assigned by someone else.
create or replace function private.trg_notify_obligation()
returns trigger language plpgsql security definer set search_path = ''
as $f$
begin
  begin
    if new.responsible_user_id is not null
       and new.responsible_user_id is distinct from auth.uid()
       and (tg_op = 'INSERT' or new.responsible_user_id is distinct from old.responsible_user_id) then
      perform private.notify(new.organization_id, new.responsible_user_id, 'obligation_assigned', new.title,
        jsonb_build_object('due_date', new.due_date), '/workspace/obligations', 'obligation', new.id, null);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$f$;
revoke all on function private.trg_notify_obligation() from public, anon, authenticated;
create trigger trg_notify_obligation after insert or update on public.obligations
for each row execute function private.trg_notify_obligation();

-- Investigations: assignment only; no case details are placed in the notification.
create or replace function private.trg_notify_investigation()
returns trigger language plpgsql security definer set search_path = ''
as $f$
begin
  begin
    if new.investigator_user_id is not null
       and new.investigator_user_id is distinct from auth.uid()
       and (tg_op = 'INSERT' or new.investigator_user_id is distinct from old.investigator_user_id) then
      perform private.notify(new.organization_id, new.investigator_user_id, 'investigation_assigned', null,
        '{}'::jsonb, '/workspace/investigations', 'investigation', new.id, null);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$f$;
revoke all on function private.trg_notify_investigation() from public, anon, authenticated;
create trigger trg_notify_investigation after insert or update on public.administrative_investigations
for each row execute function private.trg_notify_investigation();

-- Invitations: tell the inviter when accepted.
create or replace function private.trg_notify_invitation()
returns trigger language plpgsql security definer set search_path = ''
as $f$
begin
  begin
    if tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
      perform private.notify(new.organization_id, new.invited_by, 'invitation_accepted', new.invited_email,
        '{}'::jsonb, '/workspace/members', 'invitation', new.id, null);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$f$;
revoke all on function private.trg_notify_invitation() from public, anon, authenticated;
create trigger trg_notify_invitation after update on public.organization_invitations
for each row execute function private.trg_notify_invitation();

-- Due-date digest generated on demand for the signed-in user (deduplicated).
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
end;
$f$;
revoke all on function private.refresh_due_notifications(uuid) from public, anon;
grant execute on function private.refresh_due_notifications(uuid) to authenticated;

create or replace function private.mark_notifications_read(p_ids uuid[])
returns void language sql security definer set search_path = ''
as $f$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and id = any(p_ids);
$f$;
revoke all on function private.mark_notifications_read(uuid[]) from public, anon;
grant execute on function private.mark_notifications_read(uuid[]) to authenticated;

create or replace function private.mark_all_notifications_read(p_org uuid)
returns void language sql security definer set search_path = ''
as $f$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and organization_id = p_org and read_at is null;
$f$;
revoke all on function private.mark_all_notifications_read(uuid) from public, anon;
grant execute on function private.mark_all_notifications_read(uuid) to authenticated;

create or replace function public.refresh_due_notifications(p_org uuid)
returns void language sql security invoker set search_path = ''
as $f$ select private.refresh_due_notifications(p_org); $f$;
create or replace function public.mark_notifications_read(p_ids uuid[])
returns void language sql security invoker set search_path = ''
as $f$ select private.mark_notifications_read(p_ids); $f$;
create or replace function public.mark_all_notifications_read(p_org uuid)
returns void language sql security invoker set search_path = ''
as $f$ select private.mark_all_notifications_read(p_org); $f$;

revoke all on function public.refresh_due_notifications(uuid) from public, anon;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
revoke all on function public.mark_all_notifications_read(uuid) from public, anon;
grant execute on function public.refresh_due_notifications(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;
