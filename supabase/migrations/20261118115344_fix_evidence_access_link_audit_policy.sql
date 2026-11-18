drop policy if exists "authorized users can append evidence custody events" on public.investigation_evidence_events;

create policy "authorized users can append evidence custody events"
on public.investigation_evidence_events
for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and private.can_access_investigation(investigation_id)
  and (
    event_type = 'file_access_link_issued'
    or private.can_manage_investigation(investigation_id)
  )
);
