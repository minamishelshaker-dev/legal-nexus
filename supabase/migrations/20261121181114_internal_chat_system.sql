
create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('channel','direct')),
  name text check (name is null or length(btrim(name)) between 2 and 80),
  topic text check (topic is null or length(topic) <= 240),
  is_private boolean not null default false,
  direct_key text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint chat_channel_shape check (
    (kind = 'channel' and name is not null and direct_key is null)
    or (kind = 'direct' and name is null and direct_key is not null and is_private)
  )
);
create unique index uq_chat_channels_direct on public.chat_channels(organization_id, direct_key) where direct_key is not null;
create unique index uq_chat_channels_name on public.chat_channels(organization_id, lower(name)) where kind = 'channel';
create index idx_chat_channels_org on public.chat_channels(organization_id, last_message_at desc nulls last);
create index idx_chat_channels_created_by on public.chat_channels(created_by);

create table public.chat_channel_members (
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','member')),
  muted boolean not null default false,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index idx_chat_members_user on public.chat_channel_members(user_id, organization_id);
create index idx_chat_members_org on public.chat_channel_members(organization_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check (length(body) <= 4000 and (deleted_at is not null or length(btrim(body)) >= 1)),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);
create index idx_chat_messages_channel on public.chat_messages(channel_id, created_at desc);
create index idx_chat_messages_org on public.chat_messages(organization_id);
create index idx_chat_messages_author on public.chat_messages(author_id);
create index idx_chat_messages_deleted_by on public.chat_messages(deleted_by) where deleted_by is not null;

-- Original text of deleted messages is kept out of reach of clients (audit/legal hold).
create table public.chat_deleted_bodies (
  message_id uuid primary key references public.chat_messages(id) on delete cascade,
  body text not null,
  deleted_by uuid not null references auth.users(id),
  deleted_at timestamptz not null default now()
);
create index idx_chat_deleted_bodies_by on public.chat_deleted_bodies(deleted_by);

alter table public.chat_channels enable row level security;
alter table public.chat_channel_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_deleted_bodies enable row level security;
revoke all on public.chat_channels, public.chat_channel_members, public.chat_messages, public.chat_deleted_bodies from public, anon, authenticated;
grant select on public.chat_channels, public.chat_channel_members, public.chat_messages to authenticated;

create or replace function private.is_chat_member(p_channel uuid)
returns boolean language sql stable security definer set search_path = ''
as $f$
  select exists (
    select 1
    from public.chat_channel_members m
    join public.organization_memberships om
      on om.organization_id = m.organization_id and om.user_id = m.user_id and om.status = 'active'
    where m.channel_id = p_channel and m.user_id = auth.uid()
  );
$f$;
revoke all on function private.is_chat_member(uuid) from public, anon;
grant execute on function private.is_chat_member(uuid) to authenticated;

create policy "members and public-channel viewers read channels" on public.chat_channels
  for select to authenticated
  using (
    private.is_chat_member(id)
    or (kind = 'channel' and not is_private and private.is_org_member(organization_id))
  );
create policy "chat members read membership" on public.chat_channel_members
  for select to authenticated using (private.is_chat_member(channel_id));
create policy "chat members read messages" on public.chat_messages
  for select to authenticated using (private.is_chat_member(channel_id));

do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.chat_channel_members;
exception when duplicate_object then null;
end $$;

-- Directory of active colleagues (names and emails of the caller's own organization only).
create or replace function private.list_org_directory(p_org uuid)
returns table(user_id uuid, display_name text, email text, membership_role text)
language plpgsql stable security definer set search_path = ''
as $f$
begin
  if auth.uid() is null or not private.is_org_member(p_org) then
    raise exception 'Not a member of this organization' using errcode = '42501';
  end if;
  return query
  select m.user_id,
         coalesce(nullif(btrim(p.full_name), ''), split_part(u.email, '@', 1))::text,
         u.email::text,
         m.membership_role::text
  from public.organization_memberships m
  join auth.users u on u.id = m.user_id
  left join public.user_profiles p on p.id = m.user_id
  where m.organization_id = p_org and m.status = 'active'
  order by 2;
end;
$f$;

create or replace function private.create_chat_channel(p_org uuid, p_name text, p_topic text, p_private boolean, p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = ''
as $f$
declare v uuid := auth.uid(); v_id uuid;
begin
  if v is null or not private.is_org_member(p_org) then
    raise exception 'Not a member of this organization' using errcode = '42501';
  end if;
  if p_name is null or length(btrim(p_name)) not between 2 and 80 then
    raise exception 'Channel name must be 2-80 characters' using errcode = '22023';
  end if;
  begin
    insert into public.chat_channels(organization_id, kind, name, topic, is_private, created_by)
    values (p_org, 'channel', btrim(p_name), nullif(btrim(p_topic), ''), coalesce(p_private, false), v)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A channel with this name already exists' using errcode = '23505';
  end;
  insert into public.chat_channel_members(channel_id, user_id, organization_id, member_role, last_read_at)
  values (v_id, v, p_org, 'owner', now());
  if p_member_ids is not null then
    insert into public.chat_channel_members(channel_id, user_id, organization_id)
    select v_id, om.user_id, p_org
    from public.organization_memberships om
    where om.organization_id = p_org and om.status = 'active' and om.user_id = any(p_member_ids) and om.user_id <> v
    on conflict do nothing;
  end if;
  return v_id;
end;
$f$;

create or replace function private.get_or_create_direct_chat(p_org uuid, p_other uuid)
returns uuid language plpgsql security definer set search_path = ''
as $f$
declare v uuid := auth.uid(); v_key text; v_id uuid;
begin
  if v is null or not private.is_org_member(p_org) then
    raise exception 'Not a member of this organization' using errcode = '42501';
  end if;
  if p_other is null or p_other = v then
    raise exception 'Choose another colleague' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organization_memberships om
                 where om.organization_id = p_org and om.user_id = p_other and om.status = 'active') then
    raise exception 'That user is not an active member of this organization' using errcode = '22023';
  end if;
  v_key := least(v::text, p_other::text) || ':' || greatest(v::text, p_other::text);
  select id into v_id from public.chat_channels where organization_id = p_org and direct_key = v_key;
  if v_id is null then
    insert into public.chat_channels(organization_id, kind, is_private, direct_key, created_by)
    values (p_org, 'direct', true, v_key, v)
    on conflict do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.chat_channels where organization_id = p_org and direct_key = v_key;
    end if;
    insert into public.chat_channel_members(channel_id, user_id, organization_id, last_read_at)
    values (v_id, v, p_org, now()), (v_id, p_other, p_org, null)
    on conflict do nothing;
  end if;
  return v_id;
end;
$f$;

create or replace function private.join_chat_channel(p_channel uuid)
returns void language plpgsql security definer set search_path = ''
as $f$
declare v uuid := auth.uid(); c public.chat_channels%rowtype;
begin
  select * into c from public.chat_channels where id = p_channel;
  if not found or c.kind <> 'channel' or c.is_private then
    raise exception 'Channel is not available to join' using errcode = '42501';
  end if;
  if v is null or not private.is_org_member(c.organization_id) then
    raise exception 'Not a member of this organization' using errcode = '42501';
  end if;
  insert into public.chat_channel_members(channel_id, user_id, organization_id, last_read_at)
  values (p_channel, v, c.organization_id, now()) on conflict do nothing;
end;
$f$;

create or replace function private.leave_chat_channel(p_channel uuid)
returns void language plpgsql security definer set search_path = ''
as $f$
begin
  delete from public.chat_channel_members m
  using public.chat_channels c
  where m.channel_id = p_channel and m.user_id = auth.uid() and c.id = m.channel_id and c.kind = 'channel';
end;
$f$;

create or replace function private.add_chat_members(p_channel uuid, p_user_ids uuid[])
returns void language plpgsql security definer set search_path = ''
as $f$
declare v uuid := auth.uid(); c public.chat_channels%rowtype;
begin
  select * into c from public.chat_channels where id = p_channel;
  if not found or c.kind <> 'channel' then
    raise exception 'Members can only be added to group channels' using errcode = '22023';
  end if;
  if v is null or not (
    exists (select 1 from public.chat_channel_members m where m.channel_id = p_channel and m.user_id = v and m.member_role = 'owner')
    or private.has_org_role(c.organization_id, array['owner','admin'])
  ) then
    raise exception 'Only the channel owner or an administrator can add members' using errcode = '42501';
  end if;
  insert into public.chat_channel_members(channel_id, user_id, organization_id)
  select p_channel, om.user_id, c.organization_id
  from public.organization_memberships om
  where om.organization_id = c.organization_id and om.status = 'active' and om.user_id = any(p_user_ids)
  on conflict do nothing;
end;
$f$;

create or replace function private.send_chat_message(p_channel uuid, p_body text)
returns uuid language plpgsql security definer set search_path = ''
as $f$
declare
  v uuid := auth.uid(); v_org uuid; v_kind text; v_name text; v_id uuid;
  v_body text := btrim(coalesce(p_body, '')); v_sender text; r record;
begin
  if v is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if length(v_body) not between 1 and 4000 then
    raise exception 'Message must be 1-4000 characters' using errcode = '22023';
  end if;
  select organization_id, kind, name into v_org, v_kind, v_name from public.chat_channels where id = p_channel;
  if v_org is null or not private.is_chat_member(p_channel) then
    raise exception 'You are not a member of this chat' using errcode = '42501';
  end if;
  insert into public.chat_messages(channel_id, organization_id, author_id, body)
  values (p_channel, v_org, v, v_body) returning id into v_id;
  update public.chat_channels set last_message_at = now() where id = p_channel;
  update public.chat_channel_members set last_read_at = now() where channel_id = p_channel and user_id = v;

  select coalesce(nullif(btrim(p.full_name), ''), split_part(u.email, '@', 1)) into v_sender
  from auth.users u left join public.user_profiles p on p.id = u.id where u.id = v;

  for r in
    select m.user_id
    from public.chat_channel_members m
    join public.organization_memberships om
      on om.organization_id = m.organization_id and om.user_id = m.user_id and om.status = 'active'
    where m.channel_id = p_channel and m.user_id <> v and not m.muted
  loop
    begin
      insert into public.notifications(organization_id, user_id, kind, subject, meta, href, related_type, related_id, dedupe_key)
      values (v_org, r.user_id, 'chat_message', v_sender,
              jsonb_build_object('channel', coalesce(v_name, ''), 'kind', v_kind, 'preview', left(v_body, 80)),
              '/workspace/chat?c=' || p_channel::text, 'chat_channel', p_channel, 'chat:' || p_channel::text)
      on conflict (user_id, dedupe_key) where dedupe_key is not null
      do update set created_at = now(), read_at = null, subject = excluded.subject, meta = excluded.meta;
    exception when others then null;
    end;
  end loop;
  return v_id;
end;
$f$;

create or replace function private.delete_chat_message(p_message uuid)
returns void language plpgsql security definer set search_path = ''
as $f$
declare v uuid := auth.uid(); msg public.chat_messages%rowtype;
begin
  select * into msg from public.chat_messages where id = p_message;
  if not found or msg.deleted_at is not null then return; end if;
  if v is null or not private.is_chat_member(msg.channel_id) then
    raise exception 'You are not a member of this chat' using errcode = '42501';
  end if;
  if not (
    msg.author_id = v
    or exists (select 1 from public.chat_channel_members m where m.channel_id = msg.channel_id and m.user_id = v and m.member_role = 'owner')
    or private.has_org_role(msg.organization_id, array['owner','admin'])
  ) then
    raise exception 'You cannot delete this message' using errcode = '42501';
  end if;
  insert into public.chat_deleted_bodies(message_id, body, deleted_by) values (msg.id, msg.body, v)
  on conflict do nothing;
  update public.chat_messages set body = '', deleted_at = now(), deleted_by = v where id = p_message;
end;
$f$;

create or replace function private.mark_chat_read(p_channel uuid)
returns void language sql security definer set search_path = ''
as $f$
  update public.chat_channel_members set last_read_at = now()
  where channel_id = p_channel and user_id = auth.uid();
$f$;

create or replace function private.set_chat_muted(p_channel uuid, p_muted boolean)
returns void language sql security definer set search_path = ''
as $f$
  update public.chat_channel_members set muted = coalesce(p_muted, false)
  where channel_id = p_channel and user_id = auth.uid();
$f$;

create or replace function private.list_my_chats(p_org uuid)
returns table(channel_id uuid, kind text, name text, topic text, is_private boolean, muted boolean,
              last_message_at timestamptz, last_preview text, unread_count bigint,
              other_user_id uuid, other_user_name text, member_count bigint)
language plpgsql stable security definer set search_path = ''
as $f$
declare v uuid := auth.uid();
begin
  if v is null or not private.is_org_member(p_org) then
    raise exception 'Not a member of this organization' using errcode = '42501';
  end if;
  return query
  select c.id, c.kind::text, c.name::text, c.topic::text, c.is_private, m.muted, c.last_message_at,
    (select case when x.deleted_at is not null then '' else left(x.body, 80) end
       from public.chat_messages x where x.channel_id = c.id order by x.created_at desc limit 1),
    (select count(*) from public.chat_messages x
       where x.channel_id = c.id and x.author_id <> v and x.deleted_at is null
         and x.created_at > coalesce(m.last_read_at, '-infinity'::timestamptz)),
    o.user_id,
    case when o.user_id is null then null::text else
      (select coalesce(nullif(btrim(p.full_name), ''), split_part(u.email, '@', 1))::text
         from auth.users u left join public.user_profiles p on p.id = u.id where u.id = o.user_id) end,
    (select count(*) from public.chat_channel_members cm where cm.channel_id = c.id)
  from public.chat_channel_members m
  join public.chat_channels c on c.id = m.channel_id
  left join lateral (
    select cm.user_id from public.chat_channel_members cm
    where cm.channel_id = c.id and cm.user_id <> v and c.kind = 'direct' limit 1
  ) o on true
  where m.user_id = v and c.organization_id = p_org
  order by c.last_message_at desc nulls last, c.created_at desc;
end;
$f$;

-- Grants and public API wrappers (security invoker; the private definers re-check membership).
revoke all on function private.list_org_directory(uuid) from public, anon;
revoke all on function private.create_chat_channel(uuid,text,text,boolean,uuid[]) from public, anon;
revoke all on function private.get_or_create_direct_chat(uuid,uuid) from public, anon;
revoke all on function private.join_chat_channel(uuid) from public, anon;
revoke all on function private.leave_chat_channel(uuid) from public, anon;
revoke all on function private.add_chat_members(uuid,uuid[]) from public, anon;
revoke all on function private.send_chat_message(uuid,text) from public, anon;
revoke all on function private.delete_chat_message(uuid) from public, anon;
revoke all on function private.mark_chat_read(uuid) from public, anon;
revoke all on function private.set_chat_muted(uuid,boolean) from public, anon;
revoke all on function private.list_my_chats(uuid) from public, anon;
grant execute on function private.list_org_directory(uuid) to authenticated;
grant execute on function private.create_chat_channel(uuid,text,text,boolean,uuid[]) to authenticated;
grant execute on function private.get_or_create_direct_chat(uuid,uuid) to authenticated;
grant execute on function private.join_chat_channel(uuid) to authenticated;
grant execute on function private.leave_chat_channel(uuid) to authenticated;
grant execute on function private.add_chat_members(uuid,uuid[]) to authenticated;
grant execute on function private.send_chat_message(uuid,text) to authenticated;
grant execute on function private.delete_chat_message(uuid) to authenticated;
grant execute on function private.mark_chat_read(uuid) to authenticated;
grant execute on function private.set_chat_muted(uuid,boolean) to authenticated;
grant execute on function private.list_my_chats(uuid) to authenticated;

create or replace function public.list_org_directory(p_org uuid)
returns table(user_id uuid, display_name text, email text, membership_role text)
language sql security invoker set search_path = '' as $f$ select * from private.list_org_directory(p_org); $f$;
create or replace function public.create_chat_channel(p_org uuid, p_name text, p_topic text, p_private boolean, p_member_ids uuid[])
returns uuid language sql security invoker set search_path = '' as $f$ select private.create_chat_channel(p_org, p_name, p_topic, p_private, p_member_ids); $f$;
create or replace function public.get_or_create_direct_chat(p_org uuid, p_other uuid)
returns uuid language sql security invoker set search_path = '' as $f$ select private.get_or_create_direct_chat(p_org, p_other); $f$;
create or replace function public.join_chat_channel(p_channel uuid)
returns void language sql security invoker set search_path = '' as $f$ select private.join_chat_channel(p_channel); $f$;
create or replace function public.leave_chat_channel(p_channel uuid)
returns void language sql security invoker set search_path = '' as $f$ select private.leave_chat_channel(p_channel); $f$;
create or replace function public.add_chat_members(p_channel uuid, p_user_ids uuid[])
returns void language sql security invoker set search_path = '' as $f$ select private.add_chat_members(p_channel, p_user_ids); $f$;
create or replace function public.send_chat_message(p_channel uuid, p_body text)
returns uuid language sql security invoker set search_path = '' as $f$ select private.send_chat_message(p_channel, p_body); $f$;
create or replace function public.delete_chat_message(p_message uuid)
returns void language sql security invoker set search_path = '' as $f$ select private.delete_chat_message(p_message); $f$;
create or replace function public.mark_chat_read(p_channel uuid)
returns void language sql security invoker set search_path = '' as $f$ select private.mark_chat_read(p_channel); $f$;
create or replace function public.set_chat_muted(p_channel uuid, p_muted boolean)
returns void language sql security invoker set search_path = '' as $f$ select private.set_chat_muted(p_channel, p_muted); $f$;
create or replace function public.list_my_chats(p_org uuid)
returns table(channel_id uuid, kind text, name text, topic text, is_private boolean, muted boolean,
              last_message_at timestamptz, last_preview text, unread_count bigint,
              other_user_id uuid, other_user_name text, member_count bigint)
language sql security invoker set search_path = '' as $f$ select * from private.list_my_chats(p_org); $f$;

revoke all on function public.list_org_directory(uuid) from public, anon;
revoke all on function public.create_chat_channel(uuid,text,text,boolean,uuid[]) from public, anon;
revoke all on function public.get_or_create_direct_chat(uuid,uuid) from public, anon;
revoke all on function public.join_chat_channel(uuid) from public, anon;
revoke all on function public.leave_chat_channel(uuid) from public, anon;
revoke all on function public.add_chat_members(uuid,uuid[]) from public, anon;
revoke all on function public.send_chat_message(uuid,text) from public, anon;
revoke all on function public.delete_chat_message(uuid) from public, anon;
revoke all on function public.mark_chat_read(uuid) from public, anon;
revoke all on function public.set_chat_muted(uuid,boolean) from public, anon;
revoke all on function public.list_my_chats(uuid) from public, anon;
grant execute on function public.list_org_directory(uuid) to authenticated;
grant execute on function public.create_chat_channel(uuid,text,text,boolean,uuid[]) to authenticated;
grant execute on function public.get_or_create_direct_chat(uuid,uuid) to authenticated;
grant execute on function public.join_chat_channel(uuid) to authenticated;
grant execute on function public.leave_chat_channel(uuid) to authenticated;
grant execute on function public.add_chat_members(uuid,uuid[]) to authenticated;
grant execute on function public.send_chat_message(uuid,text) to authenticated;
grant execute on function public.delete_chat_message(uuid) to authenticated;
grant execute on function public.mark_chat_read(uuid) to authenticated;
grant execute on function public.set_chat_muted(uuid,boolean) to authenticated;
grant execute on function public.list_my_chats(uuid) to authenticated;
