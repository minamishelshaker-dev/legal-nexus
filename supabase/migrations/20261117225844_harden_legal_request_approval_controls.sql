
create or replace function private.can_act_on_approval(target_approval uuid)
returns boolean
language sql stable security definer set search_path=''
as $function$
 select exists(
  select 1
  from public.legal_request_approvals a
  join public.legal_requests r on r.id=a.legal_request_id
  where a.id=target_approval
   and a.status='pending'
   and (
    a.approver_user_id=auth.uid()
    or (
      a.approver_role is not null
      and private.has_org_role(r.organization_id,array[a.approver_role])
    )
    or private.has_org_role(r.organization_id,array['owner','admin','legal_manager'])
   )
   and not exists(
    select 1 from public.legal_request_approvals prior
    where prior.legal_request_id=a.legal_request_id
      and prior.step_no<a.step_no
      and prior.status not in ('approved','skipped')
   )
 );
$function$;
revoke all on function private.can_act_on_approval(uuid) from public,anon;
grant execute on function private.can_act_on_approval(uuid) to authenticated;

drop policy if exists "assigned approver can decide approval" on public.legal_request_approvals;
create policy "authorized approver can decide approval"
on public.legal_request_approvals for update to authenticated
using (private.can_act_on_approval(id))
with check (private.can_act_on_approval(id) or status in ('approved','rejected'));

drop policy if exists "legal team can update requests" on public.legal_requests;
create policy "legal team can update requests"
on public.legal_requests for update to authenticated
using (
 private.has_legal_sensitive_role(organization_id)
 or private.has_org_role(organization_id,array['owner','admin','legal_manager'])
)
with check (
 private.has_legal_sensitive_role(organization_id)
 or private.has_org_role(organization_id,array['owner','admin','legal_manager'])
);

create or replace function private.guard_legal_request_approval()
returns trigger language plpgsql set search_path=''
as $function$
begin
 if old.legal_request_id is distinct from new.legal_request_id
    or old.step_no is distinct from new.step_no
    or old.approver_user_id is distinct from new.approver_user_id
    or old.approver_role is distinct from new.approver_role
    or old.created_by is distinct from new.created_by then
   raise exception 'Approval routing and authorship are immutable';
 end if;
 if old.status <> 'pending' then
   raise exception 'A completed approval step cannot be changed';
 end if;
 if new.status not in ('approved','rejected') then
   raise exception 'Approval can only be approved or rejected';
 end if;
 if new.decided_at is null then new.decided_at:=now(); end if;
 return new;
end;
$function$;
revoke all on function private.guard_legal_request_approval() from public,anon,authenticated;
create trigger trg_guard_legal_request_approval
before update on public.legal_request_approvals
for each row execute function private.guard_legal_request_approval();

create or replace function private.guard_legal_request_identity()
returns trigger language plpgsql set search_path=''
as $function$
begin
 if old.organization_id is distinct from new.organization_id
    or old.requester_user_id is distinct from new.requester_user_id
    or old.requester_department_id is distinct from new.requester_department_id
    or old.corporate_entity_id is distinct from new.corporate_entity_id
    or old.created_at is distinct from new.created_at then
   raise exception 'Request origin and organization context are immutable';
 end if;
 new.updated_at:=now();
 if new.status in ('completed','cancelled') and old.status not in ('completed','cancelled') then
  new.completed_at:=coalesce(new.completed_at,now());
 end if;
 return new;
end;
$function$;
revoke all on function private.guard_legal_request_identity() from public,anon,authenticated;
create trigger trg_guard_legal_request_identity
before update on public.legal_requests
for each row execute function private.guard_legal_request_identity();

-- No edits or deletion of the conversation history after submission.
revoke update,delete on public.legal_request_comments from authenticated;
revoke delete on public.legal_requests, public.legal_request_approvals from authenticated;
