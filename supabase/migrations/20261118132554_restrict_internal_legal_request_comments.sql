drop policy if exists "authorized users can add request comments" on public.legal_request_comments;

create policy "authorized users can add request comments"
on public.legal_request_comments
for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and private.can_access_legal_request(legal_request_id)
  and (
    visibility = 'requester_visible'
    or exists (
      select 1
      from public.legal_requests r
      where r.id = legal_request_id
        and (
          private.has_legal_sensitive_role(r.organization_id)
          or private.has_org_role(r.organization_id, array['owner','admin','legal_manager'])
          or r.assigned_to = auth.uid()
        )
    )
  )
);
