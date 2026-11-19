
do $$
declare
  r record;
  v_has_policy boolean;
begin
  for r in
    select c.oid, n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
  loop
    execute format('revoke truncate, trigger, references on table %I.%I from authenticated',r.nspname,r.relname);

    select exists(select 1 from pg_policies p where p.schemaname=r.nspname and p.tablename=r.relname and p.cmd in ('DELETE','ALL')) into v_has_policy;
    if not v_has_policy then
      execute format('revoke delete on table %I.%I from authenticated',r.nspname,r.relname);
    end if;

    select exists(select 1 from pg_policies p where p.schemaname=r.nspname and p.tablename=r.relname and p.cmd in ('UPDATE','ALL')) into v_has_policy;
    if not v_has_policy then
      execute format('revoke update on table %I.%I from authenticated',r.nspname,r.relname);
    end if;

    select exists(select 1 from pg_policies p where p.schemaname=r.nspname and p.tablename=r.relname and p.cmd in ('INSERT','ALL')) into v_has_policy;
    if not v_has_policy then
      execute format('revoke insert on table %I.%I from authenticated',r.nspname,r.relname);
    end if;

    select exists(select 1 from pg_policies p where p.schemaname=r.nspname and p.tablename=r.relname and p.cmd in ('SELECT','ALL')) into v_has_policy;
    if not v_has_policy then
      execute format('revoke select on table %I.%I from authenticated',r.nspname,r.relname);
    end if;
  end loop;
end $$;
