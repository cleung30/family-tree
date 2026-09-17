
-- Private family groups: any signed-in user can start one, and any
-- member can invite more members in (like a group chat); only the
-- creator or an editor can rename/delete the group or remove a member.
create table groups (
  id serial primary key,
  name text not null,
  created_by text not null,
  created_at timestamptz default now()
);

create table group_members (
  group_id integer not null references groups(id) on delete cascade,
  person_id integer not null references people(id) on delete cascade,
  added_by text,
  created_at timestamptz default now(),
  primary key (group_id, person_id)
);

alter table groups enable row level security;
alter table group_members enable row level security;

-- Group names/rosters are visible to any signed-in family member (same
-- posture as the rest of the tree) — what's actually private is who can
-- see an event invited to the group, enforced on family_events below.
create policy "read_groups" on groups
  for select to authenticated using (true);

create policy "insert_groups" on groups
  for insert to authenticated
  with check (created_by = auth.jwt()->>'email');

create policy "update_delete_groups" on groups
  for all to authenticated
  using (
    created_by = auth.jwt()->>'email'
    or exists (select 1 from editors e where e.email = auth.jwt()->>'email')
  )
  with check (
    created_by = auth.jwt()->>'email'
    or exists (select 1 from editors e where e.email = auth.jwt()->>'email')
  );

create policy "read_group_members" on group_members
  for select to authenticated using (true);

create policy "insert_group_members" on group_members
  for insert to authenticated
  with check (
    exists (select 1 from groups g where g.id = group_id and g.created_by = auth.jwt()->>'email')
    or exists (
      select 1 from group_members gm
      join people p on p.id = gm.person_id
      where gm.group_id = group_members.group_id and p.claimed_by = auth.jwt()->>'email'
    )
    or exists (select 1 from editors e where e.email = auth.jwt()->>'email')
  );

create policy "delete_group_members" on group_members
  for delete to authenticated
  using (
    exists (select 1 from groups g where g.id = group_id and g.created_by = auth.jwt()->>'email')
    or exists (select 1 from editors e where e.email = auth.jwt()->>'email')
  );

-- Event visibility: 'everyone' keeps the current behavior (any signed-in
-- family member can see it); 'invited' restricts it to the creator plus
-- whoever/whichever groups were explicitly invited — needed once the
-- tree gets big enough that not every event is relevant to everyone.
alter table family_events add column visibility text not null default 'everyone'
  check (visibility in ('everyone', 'invited'));

create table event_invited_people (
  event_id integer not null references family_events(id) on delete cascade,
  person_id integer not null references people(id) on delete cascade,
  primary key (event_id, person_id)
);

create table event_invited_groups (
  event_id integer not null references family_events(id) on delete cascade,
  group_id integer not null references groups(id) on delete cascade,
  primary key (event_id, group_id)
);

alter table event_invited_people enable row level security;
alter table event_invited_groups enable row level security;

-- Replace the old blanket read policy with one that respects visibility.
drop policy "authenticated_read_family_events" on family_events;
create policy "visible_read_family_events" on family_events
  for select to authenticated using (
    visibility = 'everyone'
    or created_by = auth.jwt()->>'email'
    or exists (
      select 1 from event_invited_people eip
      join people p on p.id = eip.person_id
      where eip.event_id = family_events.id and p.claimed_by = auth.jwt()->>'email'
    )
    or exists (
      select 1 from event_invited_groups eig
      join group_members gm on gm.group_id = eig.group_id
      join people p on p.id = gm.person_id
      where eig.event_id = family_events.id and p.claimed_by = auth.jwt()->>'email'
    )
  );

-- Invite rosters are readable by any signed-in user (so an invitee can
-- see who else is invited); only the event's creator or an editor can
-- change who's invited, matching who can edit the event itself.
create policy "read_event_invited_people" on event_invited_people
  for select to authenticated using (true);

create policy "manage_event_invited_people" on event_invited_people
  for insert to authenticated
  with check (
    exists (
      select 1 from family_events fe where fe.id = event_id and (
        fe.created_by = auth.jwt()->>'email'
        or exists (select 1 from editors e where e.email = auth.jwt()->>'email')
      )
    )
  );

create policy "delete_event_invited_people" on event_invited_people
  for delete to authenticated
  using (
    exists (
      select 1 from family_events fe where fe.id = event_id and (
        fe.created_by = auth.jwt()->>'email'
        or exists (select 1 from editors e where e.email = auth.jwt()->>'email')
      )
    )
  );

create policy "read_event_invited_groups" on event_invited_groups
  for select to authenticated using (true);

create policy "manage_event_invited_groups" on event_invited_groups
  for insert to authenticated
  with check (
    exists (
      select 1 from family_events fe where fe.id = event_id and (
        fe.created_by = auth.jwt()->>'email'
        or exists (select 1 from editors e where e.email = auth.jwt()->>'email')
      )
    )
  );

create policy "delete_event_invited_groups" on event_invited_groups
  for delete to authenticated
  using (
    exists (
      select 1 from family_events fe where fe.id = event_id and (
        fe.created_by = auth.jwt()->>'email'
        or exists (select 1 from editors e where e.email = auth.jwt()->>'email')
      )
    )
  );
