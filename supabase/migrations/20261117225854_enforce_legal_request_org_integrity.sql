
create index if not exists idx_legal_request_approvals_created_by on public.legal_request_approvals(created_by);
create index if not exists idx_legal_request_comments_author on public.legal_request_comments(author_user_id);

alter table public.departments
  add constraint uq_departments_id_org unique(id,organization_id);
alter table public.corporate_entities
  add constraint uq_corporate_entities_id_org unique(id,organization_id);

alter table public.legal_requests
  add constraint fk_legal_requests_department_org
  foreign key(requester_department_id,organization_id)
  references public.departments(id,organization_id);
alter table public.legal_requests
  add constraint fk_legal_requests_entity_org
  foreign key(corporate_entity_id,organization_id)
  references public.corporate_entities(id,organization_id);

alter table public.legal_request_approvals
  add constraint chk_legal_request_approver_role
  check (approver_role is null or approver_role in ('owner','admin','legal_manager','lawyer','contract_manager','hr_investigator','employee','auditor','member'));

create or replace function private.guard_legal_request_approval()
returns trigger language plpgsql set search_path=''
as $function$
declare v_org uuid;
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
 select organization_id into v_org from public.legal_requests where id=new.legal_request_id;
 if new.approver_user_id is not null and not exists(
   select 1 from public.organization_memberships m
   where m.organization_id=v_org and m.user_id=new.approver_user_id and m.status='active'
 ) then
   raise exception 'Assigned approver must be an active member of the same organization';
 end if;
 return new;
end;
$function$;
