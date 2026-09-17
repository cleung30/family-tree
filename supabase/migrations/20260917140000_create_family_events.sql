
create table family_events (
  id serial primary key,
  title text not null,
  description text,
  event_date date not null,
  event_time time,
  location text,
  created_by text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table family_events enable row level security;

-- Anyone can browse the shared calendar, signed in or not, same as the tree.
create policy "public_read_family_events" on family_events
  for select using (true);

-- Any signed-in visitor can add a family event, not just allow-listed tree
-- editors — this is a lower-stakes, additive action than editing the tree.
create policy "authenticated_insert_family_events" on family_events
  for insert
  to authenticated
  with check (created_by = auth.jwt()->>'email');

-- Only the event's creator, or an allow-listed tree editor, can change or
-- remove it.
create policy "owner_or_editor_update_family_events" on family_events
  for update
  to authenticated
  using (
    created_by = auth.jwt()->>'email'
    or exists (select 1 from editors e where e.email = auth.jwt()->>'email')
  )
  with check (
    created_by = auth.jwt()->>'email'
    or exists (select 1 from editors e where e.email = auth.jwt()->>'email')
  );

create policy "owner_or_editor_delete_family_events" on family_events
  for delete
  to authenticated
  using (
    created_by = auth.jwt()->>'email'
    or exists (select 1 from editors e where e.email = auth.jwt()->>'email')
  );
