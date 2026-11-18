create or replace function private.guard_legal_request_identity()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_has_approvals boolean;
  v_pending_approvals boolean;
  v_unresolved_approvals boolean;
  v_rejected_approval boolean;
begin
  if old.organization_id is distinct from new.organization_id
     or old.requester_user_id is distinct from new.requester_user_id
     or old.requester_department_id is distinct from new.requester_department_id
     or old.corporate_entity_id is distinct from new.corporate_entity_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Request origin and organization context are immutable';
  end if;

  if new.assigned_to is not null and not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.assigned_to
      and m.status = 'active'
  ) then
    raise exception 'Assigned user must be an active member of the same organization';
  end if;

  select
    count(*) > 0,
    coalesce(bool_or(a.status = 'pending'), false),
    coalesce(bool_or(a.status not in ('approved','skipped')), false),
    coalesce(bool_or(a.status = 'rejected'), false)
  into v_has_approvals, v_pending_approvals, v_unresolved_approvals, v_rejected_approval
  from public.legal_request_approvals a
  where a.legal_request_id = old.id;

  if old.status in ('completed','cancelled','rejected') and new.status is distinct from old.status then
    raise exception 'A terminal legal request cannot be reopened';
  end if;

  if old.status = 'pending_approval' and new.status not in ('pending_approval','approved','rejected','cancelled') then
    raise exception 'A request in approval cannot bypass its approval workflow';
  end if;

  if v_has_approvals and new.status = 'approved' and old.status is distinct from 'approved' and v_unresolved_approvals then
    raise exception 'All approval steps must be approved or skipped before the request can be approved';
  end if;

  if v_has_approvals and new.status = 'rejected' and old.status is distinct from 'rejected' and not v_rejected_approval then
    raise exception 'A request with approval steps can only be rejected through an approval decision';
  end if;

  if new.status = 'completed' and v_pending_approvals then
    raise exception 'A request cannot be completed while approval steps are pending';
  end if;

  new.updated_at := now();
  if new.status in ('completed','cancelled') and old.status not in ('completed','cancelled') then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end;
$function$;

create or replace function private.can_act_on_approval(target_approval uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.legal_request_approvals a
    join public.legal_requests r on r.id = a.legal_request_id
    where a.id = target_approval
      and a.status = 'pending'
      and r.status not in ('completed','cancelled','rejected')
      and (
        a.approver_user_id = auth.uid()
        or (
          a.approver_role is not null
          and private.has_org_role(r.organization_id, array[a.approver_role])
        )
        or private.has_org_role(r.organization_id, array['owner','admin','legal_manager'])
      )
      and not exists (
        select 1
        from public.legal_request_approvals prior
        where prior.legal_request_id = a.legal_request_id
          and prior.step_no < a.step_no
          and prior.status not in ('approved','skipped')
      )
  );
$function$;

create or replace function private.sync_legal_request_approval_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request uuid;
  v_rejected boolean;
  v_pending boolean;
  v_total integer;
  v_completed integer;
begin
  v_request := coalesce(new.legal_request_id, old.legal_request_id);
  select
    coalesce(bool_or(status='rejected'),false),
    coalesce(bool_or(status='pending'),false),
    count(*),
    count(*) filter (where status in ('approved','skipped'))
  into v_rejected,v_pending,v_total,v_completed
  from public.legal_request_approvals
  where legal_request_id = v_request;

  if v_rejected then
    update public.legal_requests set status='rejected' where id=v_request and status not in ('completed','cancelled','rejected');
  elsif v_total > 0 and v_completed = v_total then
    update public.legal_requests set status='approved' where id=v_request and status not in ('completed','cancelled','rejected');
  elsif v_total > 0 and v_pending then
    update public.legal_requests set status='pending_approval' where id=v_request and status not in ('completed','cancelled','rejected');
  end if;

  if tg_op='DELETE' then return old; else return new; end if;
end;
$function$;
