create or replace function private.can_access_legal_request(target_request uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.legal_requests r
    where r.id = target_request
      and exists (
        select 1
        from public.organization_memberships m
        where m.organization_id = r.organization_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
      and (
        r.requester_user_id = auth.uid()
        or r.assigned_to = auth.uid()
        or private.has_legal_sensitive_role(r.organization_id)
      )
  );
$function$;
