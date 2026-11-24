
create table public.outside_counsel (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 200),
  contact_name text check (contact_name is null or length(contact_name) <= 200),
  email text check (email is null or length(email) <= 254),
  phone text check (phone is null or length(phone) <= 40),
  specialties text check (specialties is null or length(specialties) <= 500),
  default_rate numeric(12,2) check (default_rate is null or default_rate >= 0),
  currency char(3) not null default 'EGP',
  notes text check (notes is null or length(notes) <= 2000),
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_outside_counsel_org on public.outside_counsel(organization_id, status);
create index idx_outside_counsel_created_by on public.outside_counsel(created_by);

alter table public.legal_matters
  add column if not exists budget_amount numeric(14,2) check (budget_amount is null or budget_amount >= 0),
  add column if not exists budget_currency char(3) not null default 'EGP';

create table public.matter_time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  matter_id uuid not null,
  user_id uuid not null references auth.users(id),
  outside_counsel_id uuid references public.outside_counsel(id) on delete set null,
  work_date date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  rate numeric(12,2) check (rate is null or rate >= 0),
  currency char(3) not null default 'EGP',
  billable boolean not null default true,
  description text not null check (length(btrim(description)) between 3 and 1000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matter_time_matter_same_org_fk foreign key (organization_id, matter_id)
    references public.legal_matters(organization_id, id) on delete cascade
);
create index idx_matter_time_matter on public.matter_time_entries(organization_id, matter_id, work_date desc);
create index idx_matter_time_user on public.matter_time_entries(user_id);
create index idx_matter_time_counsel on public.matter_time_entries(outside_counsel_id);
create index idx_matter_time_created_by on public.matter_time_entries(created_by);

create table public.matter_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  matter_id uuid not null,
  outside_counsel_id uuid references public.outside_counsel(id) on delete set null,
  expense_date date not null,
  category text not null check (category in ('outside_counsel_fees','court_fees','expert','travel','translation','filing','other')),
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'EGP',
  description text not null check (length(btrim(description)) between 3 and 1000),
  vendor text check (vendor is null or length(vendor) <= 200),
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matter_expense_matter_same_org_fk foreign key (organization_id, matter_id)
    references public.legal_matters(organization_id, id) on delete cascade
);
create index idx_matter_expenses_matter on public.matter_expenses(organization_id, matter_id, expense_date desc);
create index idx_matter_expenses_counsel on public.matter_expenses(outside_counsel_id);
create index idx_matter_expenses_created_by on public.matter_expenses(created_by);
create index idx_matter_expenses_decided_by on public.matter_expenses(decided_by);

alter table public.outside_counsel enable row level security;
alter table public.matter_time_entries enable row level security;
alter table public.matter_expenses enable row level security;
revoke all on public.outside_counsel, public.matter_time_entries, public.matter_expenses from public, anon, authenticated;
grant select, insert, update on public.outside_counsel to authenticated;
grant select, insert, update, delete on public.matter_time_entries, public.matter_expenses to authenticated;

create policy "legal roles read outside counsel" on public.outside_counsel for select to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']));
create policy "legal managers add outside counsel" on public.outside_counsel for insert to authenticated
  with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin','legal_manager']));
create policy "legal managers update outside counsel" on public.outside_counsel for update to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager']))
  with check (private.has_org_role(organization_id, array['owner','admin','legal_manager']));

create policy "legal roles read time entries" on public.matter_time_entries for select to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']));
create policy "legal roles log time" on public.matter_time_entries for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer'])
    and (user_id = (select auth.uid()) or private.has_org_role(organization_id, array['owner','admin','legal_manager']))
  );
create policy "owners or managers edit time" on public.matter_time_entries for update to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer'])
         and (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner','admin','legal_manager'])))
  with check (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']));
create policy "owners or managers delete time" on public.matter_time_entries for delete to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer'])
         and (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner','admin','legal_manager'])));

create policy "legal roles read expenses" on public.matter_expenses for select to authenticated
  using (private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer']));
create policy "legal roles add pending expenses" on public.matter_expenses for insert to authenticated
  with check (
    created_by = (select auth.uid()) and status = 'pending'
    and private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer'])
  );
create policy "edit own pending expenses" on public.matter_expenses for update to authenticated
  using (status = 'pending'
         and private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer'])
         and (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner','admin','legal_manager'])))
  with check (status = 'pending');
create policy "delete own pending expenses" on public.matter_expenses for delete to authenticated
  using (status = 'pending'
         and private.has_org_role(organization_id, array['owner','admin','legal_manager','lawyer'])
         and (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner','admin','legal_manager'])));

create or replace function private.guard_spend_row()
returns trigger language plpgsql set search_path = ''
as $f$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id or new.created_by is distinct from old.created_by then
      raise exception 'Ownership cannot be changed' using errcode = '23514';
    end if;
    if tg_table_name <> 'outside_counsel' and new.matter_id is distinct from old.matter_id then
      raise exception 'A record cannot be moved to another matter' using errcode = '23514';
    end if;
    if tg_table_name = 'matter_expenses' then
      if old.status <> 'pending' and current_setting('app.expense_rpc', true) is distinct from '1' then
        raise exception 'Decided expenses are immutable' using errcode = '23514';
      end if;
      if new.status is distinct from old.status and current_setting('app.expense_rpc', true) is distinct from '1' then
        raise exception 'Expense status can only change through approval' using errcode = '23514';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$f$;
revoke all on function private.guard_spend_row() from public, anon, authenticated;
create trigger trg_guard_outside_counsel before insert or update on public.outside_counsel for each row execute function private.guard_spend_row();
create trigger trg_guard_matter_time before insert or update on public.matter_time_entries for each row execute function private.guard_spend_row();
create trigger trg_guard_matter_expenses before insert or update on public.matter_expenses for each row execute function private.guard_spend_row();

create or replace function private.decide_expense(p_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = ''
as $f$
declare v uuid := auth.uid(); e public.matter_expenses%rowtype;
begin
  if v is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into e from public.matter_expenses where id = p_id for update;
  if not found then raise exception 'Expense not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(e.organization_id, array['owner','admin','legal_manager']) then
    raise exception 'Only legal managers can decide expenses' using errcode = '42501';
  end if;
  if p_decision not in ('approved','rejected','paid') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  if not ((e.status = 'pending' and p_decision in ('approved','rejected')) or (e.status = 'approved' and p_decision = 'paid')) then
    raise exception 'Cannot change an expense from % to %', e.status, p_decision using errcode = '22023';
  end if;
  perform set_config('app.expense_rpc', '1', true);
  update public.matter_expenses set status = p_decision, decided_by = v, decided_at = now() where id = p_id;
  perform set_config('app.expense_rpc', '0', true);
  insert into public.audit_events(organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (e.organization_id, v, 'matter_expense.' || p_decision, 'matter_expense', p_id::text,
          jsonb_build_object('amount', e.amount, 'currency', e.currency, 'matter_id', e.matter_id));
end;
$f$;
revoke all on function private.decide_expense(uuid, text) from public, anon;
grant execute on function private.decide_expense(uuid, text) to authenticated;

create or replace function private.legal_spend_report(p_org uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $f$
declare v_res jsonb;
begin
  if auth.uid() is null or not private.has_org_role(p_org, array['owner','admin','legal_manager']) then
    raise exception 'Only legal managers can view the spend report' using errcode = '42501';
  end if;
  with ledger as (
    select 'expense'::text as kind, e.matter_id, e.outside_counsel_id as counsel_id, e.category::text as category,
           date_trunc('month', e.expense_date)::date as mth, e.currency::text as currency, e.amount, 0::numeric as hours
    from public.matter_expenses e
    where e.organization_id = p_org and e.status in ('approved','paid') and e.expense_date between p_from and p_to
    union all
    select 'time', t.matter_id, t.outside_counsel_id, 'time', date_trunc('month', t.work_date)::date,
           t.currency::text, coalesce(t.rate, 0) * t.hours, t.hours
    from public.matter_time_entries t
    where t.organization_id = p_org and t.billable and t.work_date between p_from and p_to
  )
  select jsonb_build_object(
    'by_currency', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select currency, sum(amount) as total,
               coalesce(sum(amount) filter (where kind = 'expense'), 0) as expenses,
               coalesce(sum(amount) filter (where kind = 'time'), 0) as time_cost,
               sum(hours) as hours
        from ledger group by currency order by currency) x),
    'by_matter', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select l.matter_id, m.title, l.currency, sum(l.amount) as total, sum(l.hours) as hours,
               max(m.budget_amount) as budget, max(m.budget_currency::text) as budget_currency
        from ledger l join public.legal_matters m on m.id = l.matter_id
        group by l.matter_id, m.title, l.currency order by sum(l.amount) desc limit 50) x),
    'by_counsel', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select l.counsel_id, coalesce(c.name, '') as name, l.currency, sum(l.amount) as total, sum(l.hours) as hours
        from ledger l left join public.outside_counsel c on c.id = l.counsel_id
        where l.counsel_id is not null
        group by l.counsel_id, c.name, l.currency order by sum(l.amount) desc) x),
    'by_category', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select category, currency, sum(amount) as total from ledger group by category, currency order by sum(amount) desc) x),
    'by_month', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select mth, currency, sum(amount) as total from ledger group by mth, currency order by mth) x)
  ) into v_res;
  return v_res;
end;
$f$;
revoke all on function private.legal_spend_report(uuid, date, date) from public, anon;
grant execute on function private.legal_spend_report(uuid, date, date) to authenticated;

create or replace function public.decide_expense(p_id uuid, p_decision text)
returns void language sql security invoker set search_path = '' as $f$ select private.decide_expense(p_id, p_decision); $f$;
create or replace function public.legal_spend_report(p_org uuid, p_from date, p_to date)
returns jsonb language sql stable security invoker set search_path = '' as $f$ select private.legal_spend_report(p_org, p_from, p_to); $f$;
revoke all on function public.decide_expense(uuid, text) from public, anon;
revoke all on function public.legal_spend_report(uuid, date, date) from public, anon;
grant execute on function public.decide_expense(uuid, text) to authenticated;
grant execute on function public.legal_spend_report(uuid, date, date) to authenticated;
