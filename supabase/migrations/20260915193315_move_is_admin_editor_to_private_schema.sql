create schema if not exists private;

create or replace function private.is_admin_editor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.editors e
    where e.email = (auth.jwt() ->> 'email') and e.role = 'admin'
  );
$$;

revoke execute on function private.is_admin_editor() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin_editor() to authenticated;

drop policy if exists admins_read_all_editors on public.editors;
create policy admins_read_all_editors on public.editors
  for select to authenticated
  using (private.is_admin_editor());

drop policy if exists admins_insert_editors on public.editors;
create policy admins_insert_editors on public.editors
  for insert to authenticated
  with check (private.is_admin_editor());

drop policy if exists admins_update_editors on public.editors;
create policy admins_update_editors on public.editors
  for update to authenticated
  using (private.is_admin_editor())
  with check (private.is_admin_editor());

drop policy if exists admins_delete_editors on public.editors;
create policy admins_delete_editors on public.editors
  for delete to authenticated
  using (private.is_admin_editor());

drop function if exists public.is_admin_editor();
