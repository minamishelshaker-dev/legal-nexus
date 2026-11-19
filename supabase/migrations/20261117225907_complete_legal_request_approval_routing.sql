
create index if not exists idx_legal_requests_department_org on public.legal_requests(requester_department_id,organization_id);
create index if not exists idx_legal_requests_entity_org on public.legal_requests(corporate_entity_id,organization_id);

create or replace function private.validate_legal_request_approval_assignment()
returns trigger language plpgsql set search_path=''
as $function$
declare v_org uuid;
begin
 select organization_id into v_org from public.legal_requests where id=new.legal_request_id;
 if v_org is null then raise exception 'Legal request not found'; end if;
 if new.approver_user_id is not null and not exists(
  select 1 from public.organization_memberships m
  where m.organization_id=v_org and m.user_id=new.approver_user_id and m.status='active'
 ) then
  raise exception 'Assigned approver must be an active member of the same organization';
 end if;
 if new.approver_role is not null and not exists(
  select 1 from public.organization_memberships m
  where m.organization_id=v_org and m.membership_role=new.approver_role and m.status='active'
 ) then
  raise exception 'No active organization member currently holds the assigned approval role';
 end if;
 return new;
end;
$function$;
revoke all on function private.validate_legal_request_approval_assignment() from public,anon,authenticated;
create trigger trg_validate_legal_request_approval_assignment
before insert on public.legal_request_approvals
for each row execute function private.validate_legal_request_approval_assignment();

create or replace function private.sync_legal_request_approval_state()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare
 v_request uuid;
 v_rejected boolean;
 v_pending boolean;
 v_total integer;
 v_approved integer;
begin
 v_request:=coalesce(new.legal_request_id,old.legal_request_id);
 select
  coalesce(bool_or(status='rejected'),false),
  coalesce(bool_or(status='pending'),false),
  count(*),
  count(*) filter(where status='approved')
 into v_rejected,v_pending,v_total,v_approved
 from public.legal_request_approvals
 where legal_request_id=v_request;

 if v_rejected then
  update public.legal_requests set status='rejected' where id=v_request and status not in ('completed','cancelled');
 elsif v_total>0 and v_approved=v_total then
  update public.legal_requests set status='approved' where id=v_request and status not in ('completed','cancelled');
 elsif v_total>0 and v_pending then
  update public.legal_requests set status='pending_approval' where id=v_request and status not in ('completed','cancelled');
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end;
$function$;
revoke all on function private.sync_legal_request_approval_state() from public,anon,authenticated;
create trigger trg_sync_legal_request_approval_state
after insert or update on public.legal_request_approvals
for each row execute function private.sync_legal_request_approval_state();
