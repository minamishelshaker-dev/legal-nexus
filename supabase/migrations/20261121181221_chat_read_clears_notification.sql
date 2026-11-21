
create or replace function private.mark_chat_read(p_channel uuid)
returns void language plpgsql security definer set search_path = ''
as $f$
begin
  update public.chat_channel_members set last_read_at = now()
  where channel_id = p_channel and user_id = auth.uid();
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and dedupe_key = 'chat:' || p_channel::text;
end;
$f$;
revoke all on function private.mark_chat_read(uuid) from public, anon;
grant execute on function private.mark_chat_read(uuid) to authenticated;
