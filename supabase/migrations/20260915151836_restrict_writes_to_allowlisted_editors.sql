
-- Allow-list of email addresses permitted to edit the tree. Adding more
-- people later is just an insert into this table.
create table editors (
  email text primary key
);
alter table editors enable row level security;

-- A signed-in user may check only their own row (to drive UI state),
-- never the full list.
create policy "read_own_editor_row" on editors
  for select
  to authenticated
  using (auth.jwt()->>'email' = email);

insert into editors (email) values ('calvin.leung.3@gmail.com');

-- Replace the fully-public write policies with ones that require the
-- caller to be signed in AND on the editors allow-list. Reads stay
-- public so the tree is still viewable without signing in.
drop policy "public_write_people" on people;
create policy "editors_write_people" on people
  for all
  to authenticated
  using (exists (select 1 from editors e where e.email = auth.jwt()->>'email'))
  with check (exists (select 1 from editors e where e.email = auth.jwt()->>'email'));

drop policy "public_write_relationships" on relationships;
create policy "editors_write_relationships" on relationships
  for all
  to authenticated
  using (exists (select 1 from editors e where e.email = auth.jwt()->>'email'))
  with check (exists (select 1 from editors e where e.email = auth.jwt()->>'email'));

drop policy "public_write_photos" on storage.objects;
create policy "editors_write_photos" on storage.objects
  for all
  to authenticated
  using (bucket_id = 'photos' and exists (select 1 from editors e where e.email = auth.jwt()->>'email'))
  with check (bucket_id = 'photos' and exists (select 1 from editors e where e.email = auth.jwt()->>'email'));
