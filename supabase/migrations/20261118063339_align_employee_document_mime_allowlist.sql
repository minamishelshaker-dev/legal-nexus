
do $$
declare
  v_def text;
  v_old text := $old$  if p_mime_type not in (
    'application/pdf','image/jpeg','image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) then$old$;
  v_new text := $new$  if p_mime_type not in (
    'application/pdf','image/jpeg','image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) then$new$;
begin
  v_def := pg_get_functiondef(
    'private.register_employee_document_version(uuid,uuid,text,text,text,text,text,text,bigint,text,text,text,uuid)'::regprocedure
  );
  if position(v_old in v_def) = 0 then
    raise exception 'Expected MIME allowlist block was not found; migration aborted';
  end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end $$;
