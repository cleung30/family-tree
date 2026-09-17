
-- The tree holds a lot of personal information (contact details, birth
-- dates, photos), so viewing it now requires signing in — the UI already
-- gates this, but that's cosmetic without also locking down reads here,
-- since the anon key is public in the client bundle regardless.
drop policy "public_read_people" on people;
create policy "authenticated_read_people" on people
  for select to authenticated using (true);

drop policy "public_read_relationships" on relationships;
create policy "authenticated_read_relationships" on relationships
  for select to authenticated using (true);

drop policy "public_read_family_events" on family_events;
create policy "authenticated_read_family_events" on family_events
  for select to authenticated using (true);

drop policy "public_read_photos" on storage.objects;
create policy "authenticated_read_photos" on storage.objects
  for select to authenticated using (bucket_id = 'photos');
