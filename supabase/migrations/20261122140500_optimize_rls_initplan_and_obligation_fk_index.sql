
alter policy "members can add appropriately classified documents" on public.documents
  with check (
    private.is_org_member(organization_id)
    and uploaded_by = (select auth.uid())
    and (classification = any (array['public'::text, 'internal'::text]) or private.has_legal_sensitive_role(organization_id))
  );

alter policy "members can log own document access request" on public.audit_events
  with check (
    actor_user_id = (select auth.uid())
    and action = 'document.download_requested'
    and resource_type = 'document'
    and exists (
      select 1 from public.documents d
      where d.id::text = audit_events.resource_id
        and d.organization_id = audit_events.organization_id
        and d.classification = (audit_events.metadata ->> 'classification')
    )
  );

alter policy "authorized users can add request comments" on public.legal_request_comments
  with check (
    author_user_id = (select auth.uid())
    and private.can_access_legal_request(legal_request_id)
    and (
      visibility = 'requester_visible'
      or exists (
        select 1 from public.legal_requests r
        where r.id = legal_request_comments.legal_request_id
          and (
            private.has_legal_sensitive_role(r.organization_id)
            or private.has_org_role(r.organization_id, array['owner'::text, 'admin'::text, 'legal_manager'::text])
            or r.assigned_to = (select auth.uid())
          )
      )
    )
  );

alter policy "authorized members can view obligations" on public.obligations
  using (
    private.is_org_member(organization_id)
    and (
      responsible_user_id = (select auth.uid())
      or private.has_legal_sensitive_role(organization_id)
      or private.has_org_role(organization_id, array['owner'::text, 'admin'::text, 'legal_manager'::text, 'contract_manager'::text])
    )
  );

alter policy "legal roles can create obligations" on public.obligations
  with check (
    created_by = (select auth.uid())
    and private.has_org_role(organization_id, array['owner'::text, 'admin'::text, 'legal_manager'::text, 'lawyer'::text, 'contract_manager'::text])
  );

create index if not exists idx_obligations_created_by on public.obligations(created_by);
