
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "public_read_photos" on storage.objects
  for select to public
  using (bucket_id = 'photos');

create policy "public_write_photos" on storage.objects
  for all to public
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');
