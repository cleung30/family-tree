
alter table editors add column role text not null default 'editor' check (role in ('admin','editor'));
update editors set role = 'admin' where email = 'calvin.leung.3@gmail.com';

-- Admins can see the full editor list (needed to manage it); a
-- regular editor can still only see their own row.
create policy "admins_read_all_editors" on editors
  for select
  to authenticated
  using (exists (select 1 from editors e where e.email = auth.jwt()->>'email' and e.role = 'admin'));

-- Only admins can invite (insert) or revoke (delete) editors.
create policy "admins_insert_editors" on editors
  for insert
  to authenticated
  with check (exists (select 1 from editors e where e.email = auth.jwt()->>'email' and e.role = 'admin'));

create policy "admins_delete_editors" on editors
  for delete
  to authenticated
  using (exists (select 1 from editors e where e.email = auth.jwt()->>'email' and e.role = 'admin'));

create policy "admins_update_editors" on editors
  for update
  to authenticated
  using (exists (select 1 from editors e where e.email = auth.jwt()->>'email' and e.role = 'admin'))
  with check (exists (select 1 from editors e where e.email = auth.jwt()->>'email' and e.role = 'admin'));
