
do $$
declare
  t record;
begin
  for t in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('revoke all privileges on table %I.%I from anon', t.schemaname, t.tablename);
  end loop;
end
$$;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;
