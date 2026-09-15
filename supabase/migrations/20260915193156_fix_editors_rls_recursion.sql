create or replace function public.is_admin_editor()
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

drop policy if exists admins_read_all_editors on public.editors;
create policy admins_read_all_editors on public.editors
  for select to authenticated
  using (public.is_admin_editor());

drop policy if exists admins_insert_editors on public.editors;
create policy admins_insert_editors on public.editors
  for insert to authenticated
  with check (public.is_admin_editor());

drop policy if exists admins_update_editors on public.editors;
create policy admins_update_editors on public.editors
  for update to authenticated
  using (public.is_admin_editor())
  with check (public.is_admin_editor());

drop policy if exists admins_delete_editors on public.editors;
create policy admins_delete_editors on public.editors
  for delete to authenticated
  using (public.is_admin_editor());
