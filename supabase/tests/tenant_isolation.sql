-- Repeatable multi-tenant isolation test.
-- Creates a second organization and user, seeds private data in the first organization,
-- then tries to read, write, update, delete and call RPCs against it as the second user.
-- Everything is rolled back: the block always ends by raising ISOLATION_RESULT with a JSON summary.
--
-- Expected result: every see_* value is 0 (except organizations/organization_memberships = 1 for the
-- tester's own rows), every write/RPC against the first organization is blocked or rejected, and the
-- B_own_* controls succeed. Any "ALLOWED!!" or a non-zero see_* value is a tenant-isolation failure.
-- Requires at least one existing organization membership. Run in the Supabase SQL editor.
do $$
declare
  a_user uuid; a_org uuid; b_user uuid := gen_random_uuid(); b_org uuid; doc_id uuid := gen_random_uuid();
  res jsonb := '{}'::jsonb; n bigint; ch uuid; t text;
begin
  select user_id, organization_id into a_user, a_org from public.organization_memberships limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub',a_user,'role','authenticated')::text, true);
  insert into auth.users(id,email,aud,role,instance_id)
  values (b_user,'tenant-b-test@example.invalid','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
  insert into public.organizations(name,slug,created_by) values ('Tenant B test','tenant-b-test',b_user) returning id into b_org;

  insert into public.legal_requests(organization_id,request_type,title,description,requester_user_id) values (a_org,'other','A secret request','x',a_user);
  insert into public.contracts(organization_id,title) values (a_org,'A secret contract');
  insert into public.legal_matters(organization_id,title) values (a_org,'A secret matter');
  insert into public.documents(id,organization_id,title,storage_key,uploaded_by) values (doc_id,a_org,'A secret doc',a_org::text||'/'||doc_id::text||'/f.pdf',a_user);
  insert into public.employee_records(organization_id,employee_number,full_name,created_by) values (a_org,'A-1','A Employee',a_user);
  insert into public.administrative_investigations(organization_id,subject_employee_name,allegation_summary) values (a_org,'A Subject','A allegation text long enough');
  insert into public.chat_channels(organization_id,kind,name,created_by) values (a_org,'channel','a-private',a_user) returning id into ch;
  insert into public.chat_messages(channel_id,organization_id,author_id,body) values (ch,a_org,a_user,'A secret chat');
  insert into public.notifications(organization_id,user_id,kind,subject) values (a_org,a_user,'system','A notif');
  insert into public.obligations(organization_id,title,obligation_type,due_date,created_by) values (a_org,'A secret obligation','other',current_date,a_user);

  perform set_config('request.jwt.claims', json_build_object('sub',b_user,'role','authenticated','email','tenant-b-test@example.invalid')::text, true);
  execute 'set local role authenticated';

  foreach t in array array['legal_requests','contracts','legal_matters','documents','obligations','administrative_investigations','chat_channels','chat_messages','notifications','organizations','organization_memberships','audit_events','job_positions','departments','corporate_entities','legal_request_comments','legal_request_approvals']
  loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      res := res || jsonb_build_object('see_'||t, n);
    exception when others then
      res := res || jsonb_build_object('see_'||t, 'ERR:'||sqlerrm);
    end;
  end loop;
  begin
    execute 'select count(*) from public.employee_records' into n; res := res || jsonb_build_object('see_employee_records', n);
  exception when others then res := res || jsonb_build_object('see_employee_records','ERR:'||sqlerrm); end;

  begin insert into public.legal_requests(organization_id,request_type,title,description,requester_user_id) values (a_org,'other','intrusion','x',b_user); res := res || jsonb_build_object('write_request_into_A','ALLOWED!!'); exception when others then res := res || jsonb_build_object('write_request_into_A','blocked'); end;
  begin update public.legal_requests set title='hacked' where organization_id=a_org; get diagnostics n = row_count; res := res || jsonb_build_object('update_A_requests_rows', n); exception when others then res := res || jsonb_build_object('update_A_requests','blocked'); end;
  begin delete from public.contracts where organization_id=a_org; get diagnostics n = row_count; res := res || jsonb_build_object('delete_A_contracts_rows', n); exception when others then res := res || jsonb_build_object('delete_A_contracts','blocked'); end;
  begin perform public.hire_employee(a_org,'X1','Intruder'); res := res || jsonb_build_object('rpc_hire_A','ALLOWED!!'); exception when others then res := res || jsonb_build_object('rpc_hire_A',sqlerrm); end;
  begin perform public.list_employee_records(a_org); res := res || jsonb_build_object('rpc_list_employees_A','ALLOWED!!'); exception when others then res := res || jsonb_build_object('rpc_list_employees_A',sqlerrm); end;
  begin perform public.list_my_chats(a_org); res := res || jsonb_build_object('rpc_chats_A','ALLOWED!!'); exception when others then res := res || jsonb_build_object('rpc_chats_A',sqlerrm); end;
  begin perform public.list_org_directory(a_org); res := res || jsonb_build_object('rpc_directory_A','ALLOWED!!'); exception when others then res := res || jsonb_build_object('rpc_directory_A',sqlerrm); end;
  begin perform public.send_chat_message(ch,'intrusion'); res := res || jsonb_build_object('rpc_send_chat_A','ALLOWED!!'); exception when others then res := res || jsonb_build_object('rpc_send_chat_A',sqlerrm); end;
  begin perform public.lookup_employees_for_investigation(a_org,'Em'); res := res || jsonb_build_object('rpc_lookup_A','ALLOWED!!'); exception when others then res := res || jsonb_build_object('rpc_lookup_A',sqlerrm); end;
  begin perform public.join_chat_channel(ch); res := res || jsonb_build_object('rpc_join_A_channel','ALLOWED!!'); exception when others then res := res || jsonb_build_object('rpc_join_A_channel',sqlerrm); end;
  begin perform public.create_org_invitation(a_org,'x@y.zz','member'); res := res || jsonb_build_object('rpc_invite_into_A','ALLOWED!!'); exception when others then res := res || jsonb_build_object('rpc_invite_into_A',sqlerrm); end;

  begin insert into public.legal_requests(organization_id,request_type,title,description,requester_user_id) values (b_org,'other','B request','x',b_user); select count(*) into n from public.legal_requests; res := res || jsonb_build_object('B_own_requests_visible', n); exception when others then res := res || jsonb_build_object('B_own_requests','ERR:'||sqlerrm); end;
  begin perform public.send_chat_message(public.create_chat_channel(b_org,'b-general',null,false,null),'hello'); res := res || jsonb_build_object('B_own_chat','works'); exception when others then res := res || jsonb_build_object('B_own_chat','ERR:'||sqlerrm); end;

  execute 'reset role';
  raise exception 'ISOLATION_RESULT %', res::text;
end $$;
