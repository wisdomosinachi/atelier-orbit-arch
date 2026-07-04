
-- ============= Portal RPCs (SECURITY DEFINER) =============

-- 1. Start a client project
create or replace function public.portal_start(
  p_message text,
  p_name text default '',
  p_email text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_project public.projects%rowtype;
begin
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'message required';
  end if;
  if length(p_message) > 4000 then
    raise exception 'message too long';
  end if;

  v_name := split_part(p_message, E'\n', 1);
  v_name := trim(v_name);
  if length(v_name) > 60 then
    v_name := left(v_name, 57) || '…';
  end if;
  if length(v_name) = 0 then
    v_name := 'New inquiry';
  end if;

  insert into public.projects (client_name, client_email, project_name, brief)
  values (
    coalesce(nullif(trim(p_name), ''), 'Guest'),
    coalesce(trim(p_email), ''),
    v_name,
    p_message
  )
  returning * into v_project;

  insert into public.messages (project_id, sender, body)
  values (v_project.id, 'client', p_message);

  return v_project.share_token;
end $$;

grant execute on function public.portal_start(text, text, text) to anon, authenticated;

-- 2. Get portal state
create or replace function public.portal_get_state(p_token uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
begin
  select * into v_project from public.projects where share_token = p_token;
  if not found then raise exception 'project not found'; end if;

  return jsonb_build_object(
    'project', to_jsonb(v_project),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at)
      from public.messages m where m.project_id = v_project.id
    ), '[]'::jsonb),
    'approvals', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at)
      from public.approvals a where a.project_id = v_project.id
    ), '[]'::jsonb),
    'files', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.created_at)
      from public.project_files f where f.project_id = v_project.id
    ), '[]'::jsonb)
  );
end $$;

grant execute on function public.portal_get_state(uuid) to anon, authenticated;

-- 3. Send message from client
create or replace function public.portal_send_message(p_token uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'body required';
  end if;
  if length(p_body) > 4000 then
    raise exception 'body too long';
  end if;

  select id into v_project_id from public.projects where share_token = p_token;
  if not found then raise exception 'project not found'; end if;

  insert into public.messages (project_id, sender, body)
  values (v_project_id, 'client', p_body);
end $$;

grant execute on function public.portal_send_message(uuid, text) to anon, authenticated;

-- 4. Decide approval
create or replace function public.portal_decide_approval(
  p_token uuid,
  p_approval_id uuid,
  p_decision text,
  p_note text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  if p_decision not in ('approved', 'changes_requested') then
    raise exception 'invalid decision';
  end if;

  select id into v_project_id from public.projects where share_token = p_token;
  if not found then raise exception 'project not found'; end if;

  update public.approvals
     set status = p_decision::approval_status,
         decision_note = nullif(trim(p_note), ''),
         decided_at = now()
   where id = p_approval_id and project_id = v_project_id;

  insert into public.messages (project_id, sender, body)
  values (
    v_project_id,
    'client',
    case when p_decision = 'approved'
         then '✓ Approved' || case when nullif(trim(p_note), '') is not null then ': ' || p_note else '' end
         else '↻ Changes requested' || case when nullif(trim(p_note), '') is not null then ': ' || p_note else '' end
    end
  );
end $$;

grant execute on function public.portal_decide_approval(uuid, uuid, text, text) to anon, authenticated;

-- 5. Resolve project_id from token (used before generating storage upload path)
create or replace function public.portal_project_id(p_token uuid)
returns uuid
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.projects where share_token = p_token;
  if not found then raise exception 'project not found'; end if;
  return v_id;
end $$;

grant execute on function public.portal_project_id(uuid) to anon, authenticated;

-- 6. Finalize upload — record file row and post a message
create or replace function public.portal_finalize_upload(
  p_token uuid,
  p_storage_path text,
  p_filename text,
  p_size_bytes bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  if p_size_bytes < 0 or p_size_bytes > 50 * 1024 * 1024 then
    raise exception 'invalid size';
  end if;

  select id into v_project_id from public.projects where share_token = p_token;
  if not found then raise exception 'project not found'; end if;

  -- storage path MUST live under this project's folder
  if position((v_project_id::text || '/') in p_storage_path) <> 1 then
    raise exception 'invalid storage path';
  end if;

  insert into public.project_files (project_id, uploaded_by, filename, storage_path, size_bytes)
  values (v_project_id, 'client', p_filename, p_storage_path, p_size_bytes);

  insert into public.messages (project_id, sender, body)
  values (v_project_id, 'client', '📎 Uploaded ' || p_filename);
end $$;

grant execute on function public.portal_finalize_upload(uuid, text, text, bigint) to anon, authenticated;

-- ============= Storage policies for project-files bucket =============
-- Guests need read + insert on this bucket; delete stays staff-only.
-- Access to a specific object relies on the unpredictable project UUID
-- in the object path (guests only learn it through the share token).

drop policy if exists "portal_files_select" on storage.objects;
create policy "portal_files_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'project-files');

drop policy if exists "portal_files_insert" on storage.objects;
create policy "portal_files_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'project-files');

drop policy if exists "portal_files_delete" on storage.objects;
create policy "portal_files_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-files');

-- ============= Grants for staff (authenticated) reads via Data API =============
-- Existing policies already allow all authenticated access; ensure GRANTs exist.
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.approvals to authenticated;
grant select, insert, update, delete on public.project_files to authenticated;
