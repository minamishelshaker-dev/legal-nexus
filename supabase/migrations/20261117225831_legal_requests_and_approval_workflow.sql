
create table public.legal_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_number text,
  request_type text not null check (request_type in ('legal_opinion','contract_review','litigation_support','regulatory_query','policy_review','investigation_referral','other')),
  title text not null,
  description text not null,
  urgency text not null default 'normal' check (urgency in ('low','normal','high','urgent')),
  status text not null default 'submitted' check (status in ('submitted','under_review','awaiting_information','pending_approval','approved','rejected','completed','cancelled')),
  requester_user_id uuid not null references auth.users(id),
  requester_department_id uuid references public.departments(id) on delete restrict,
  corporate_entity_id uuid references public.corporate_entities(id) on delete restrict,
  assigned_to uuid references auth.users(id),
  due_at timestamptz,
  resolution_summary text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_legal_requests_org_status on public.legal_requests(organization_id,status,created_at desc);
create index idx_legal_requests_requester on public.legal_requests(requester_user_id,created_at desc);
create index idx_legal_requests_assignee on public.legal_requests(assigned_to,status);
create index idx_legal_requests_department on public.legal_requests(requester_department_id);
create index idx_legal_requests_entity on public.legal_requests(corporate_entity_id);

create table public.legal_request_approvals (
  id uuid primary key default gen_random_uuid(),
  legal_request_id uuid not null references public.legal_requests(id) on delete restrict,
  step_no integer not null check(step_no > 0),
  approver_user_id uuid references auth.users(id),
  approver_role text,
  status text not null default 'pending' check(status in ('pending','approved','rejected','skipped')),
  decision_note text,
  decided_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(legal_request_id,step_no),
  check (approver_user_id is not null or approver_role is not null)
);
create index idx_legal_request_approvals_request on public.legal_request_approvals(legal_request_id,step_no);
create index idx_legal_request_approvals_approver on public.legal_request_approvals(approver_user_id,status);

create table public.legal_request_comments (
  id uuid primary key default gen_random_uuid(),
  legal_request_id uuid not null references public.legal_requests(id) on delete restrict,
  author_user_id uuid not null references auth.users(id),
  body text not null,
  visibility text not null default 'internal' check(visibility in ('internal','requester_visible')),
  created_at timestamptz not null default now()
);
create index idx_legal_request_comments_request on public.legal_request_comments(legal_request_id,created_at);

alter table public.legal_requests enable row level security;
alter table public.legal_request_approvals enable row level security;
alter table public.legal_request_comments enable row level security;

create or replace function private.can_access_legal_request(target_request uuid)
returns boolean
language sql stable security definer set search_path=''
as $function$
 select exists (
  select 1 from public.legal_requests r
  where r.id=target_request
    and (
      r.requester_user_id=auth.uid()
      or r.assigned_to=auth.uid()
      or private.has_legal_sensitive_role(r.organization_id)
      or private.has_org_role(r.organization_id,array['owner','admin','employee','auditor','member'])
    )
 );
$function$;
revoke all on function private.can_access_legal_request(uuid) from public,anon;
grant execute on function private.can_access_legal_request(uuid) to authenticated;

create policy "organization members can create legal requests"
on public.legal_requests for insert to authenticated
with check (
 requester_user_id=(select auth.uid())
 and private.is_org_member(organization_id)
);
create policy "authorized users can view legal requests"
on public.legal_requests for select to authenticated
using (private.can_access_legal_request(id));
create policy "legal team can update requests"
on public.legal_requests for update to authenticated
using (
 private.has_legal_sensitive_role(organization_id)
 or private.has_org_role(organization_id,array['owner','admin','legal_manager'])
 or assigned_to=(select auth.uid())
)
with check (
 private.has_legal_sensitive_role(organization_id)
 or private.has_org_role(organization_id,array['owner','admin','legal_manager'])
 or assigned_to=(select auth.uid())
);

create policy "authorized users can view request approvals"
on public.legal_request_approvals for select to authenticated
using (private.can_access_legal_request(legal_request_id));
create policy "legal team can create approval steps"
on public.legal_request_approvals for insert to authenticated
with check (
 private.has_legal_sensitive_role((select organization_id from public.legal_requests where id=legal_request_id))
 or private.has_org_role((select organization_id from public.legal_requests where id=legal_request_id),array['owner','admin','legal_manager'])
);
create policy "assigned approver can decide approval"
on public.legal_request_approvals for update to authenticated
using (
 approver_user_id=(select auth.uid())
 or private.has_org_role((select organization_id from public.legal_requests where id=legal_request_id),array['owner','admin','legal_manager'])
)
with check (
 approver_user_id=(select auth.uid())
 or private.has_org_role((select organization_id from public.legal_requests where id=legal_request_id),array['owner','admin','legal_manager'])
);

create policy "authorized users can view request comments"
on public.legal_request_comments for select to authenticated
using (
 private.can_access_legal_request(legal_request_id)
 and (
   visibility='requester_visible'
   or exists(select 1 from public.legal_requests r
     where r.id=legal_request_id
       and (private.has_legal_sensitive_role(r.organization_id)
         or private.has_org_role(r.organization_id,array['owner','admin','legal_manager'])
         or r.assigned_to=(select auth.uid())))
 )
);
create policy "authorized users can add request comments"
on public.legal_request_comments for insert to authenticated
with check (
 author_user_id=(select auth.uid())
 and private.can_access_legal_request(legal_request_id)
);

grant select,insert,update on public.legal_requests to authenticated;
grant select,insert,update on public.legal_request_approvals to authenticated;
grant select,insert on public.legal_request_comments to authenticated;

-- Audit every request, approval and comment change; preserve authorship and request linkage.
create or replace function private.audit_legal_request_change()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_request uuid; v_org uuid; v_id text; v_action text;
begin
 if tg_op='DELETE' then
  v_request:=old.legal_request_id; v_id:=old.id::text; v_action:='legal_request.'||tg_table_name||'.deleted';
 else
  if tg_table_name='legal_requests' then
   v_request:=new.id;
  else
   v_request:=new.legal_request_id;
  end if;
  v_id:=new.id::text; v_action:='legal_request.'||tg_table_name||'.'||lower(tg_op);
 end if;
 if tg_table_name='legal_requests' then
  v_org:=coalesce(new.organization_id,old.organization_id);
 else
  select organization_id into v_org from public.legal_requests where id=v_request;
 end if;
 insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
 values(v_org,auth.uid(),v_action,tg_table_name,v_id,jsonb_build_object('legal_request_id',v_request));
 if tg_op='DELETE' then return old; else return new; end if;
end;
$function$;
revoke all on function private.audit_legal_request_change() from public,anon,authenticated;

create trigger trg_audit_legal_requests after insert or update on public.legal_requests
for each row execute function private.audit_legal_request_change();
create trigger trg_audit_legal_request_approvals after insert or update on public.legal_request_approvals
for each row execute function private.audit_legal_request_change();
create trigger trg_audit_legal_request_comments after insert on public.legal_request_comments
for each row execute function private.audit_legal_request_change();
