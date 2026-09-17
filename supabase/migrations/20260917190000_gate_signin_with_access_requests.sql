
-- Access control: signing in is now gated instead of open to any email.
-- An email may sign in only if it's already an editor, already claimed a
-- profile on the tree, or has an approved row here — reached either by a
-- signed-in, verified (already-claimed) family member vouching for them
-- (auto-approved, no queue) or by an admin approving their own
-- self-submitted request.
create table access_requests (
  id serial primary key,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  note text,
  invited_by text,
  requested_at timestamptz default now(),
  decided_by text,
  decided_at timestamptz
);
alter table access_requests enable row level security;

-- Only one outstanding self-request per email at a time.
create unique index access_requests_pending_email_idx on access_requests (email) where status = 'pending';

-- Self-service: anyone can submit a request, signed in or not — this is
-- the path someone takes before they're able to sign in at all. It
-- always starts pending and can't masquerade as an invite or a decision
-- that's already been made.
create policy "self_request_access" on access_requests
  for insert to anon, authenticated
  with check (status = 'pending' and invited_by is null and decided_by is null and decided_at is null);

-- A signed-in family member who has already claimed their own profile
-- (i.e. verified) can vouch for someone else — an immediate approval,
-- no admin queue involved.
create policy "invite_family_member" on access_requests
  for insert to authenticated
  with check (
    status = 'approved'
    and invited_by = (auth.jwt()->>'email')
    and decided_by is null and decided_at is null
    and exists (select 1 from people p where p.claimed_by = (auth.jwt()->>'email'))
  );

-- Only admins manage the queue: see every request, approve or deny.
create policy "admins_read_access_requests" on access_requests
  for select to authenticated using (private.is_admin_editor());

create policy "admins_update_access_requests" on access_requests
  for update to authenticated
  using (private.is_admin_editor())
  with check (private.is_admin_editor());

-- Central allow-check. Used from RLS policies (as `authenticated`) and
-- called directly by the client before sign-in (as `anon`) without
-- exposing any table contents beyond a plain yes/no.
create or replace function private.is_allowed_email()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.people where claimed_by = (auth.jwt()->>'email')
    union
    select 1 from public.editors where email = (auth.jwt()->>'email')
    union
    select 1 from public.access_requests where email = (auth.jwt()->>'email') and status = 'approved'
  );
$$;
revoke execute on function private.is_allowed_email() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_allowed_email() to authenticated;

-- Same check, keyed by an arbitrary email instead of the caller's own
-- JWT, richer than a boolean so the landing page can tell "pending"
-- and "denied" apart from "never asked". Runs pre-auth (anon).
create or replace function public.check_access_status(check_email text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when exists (select 1 from public.people where claimed_by = check_email) then 'allowed'
    when exists (select 1 from public.editors where email = check_email) then 'allowed'
    when exists (select 1 from public.access_requests where email = check_email and status = 'approved') then 'allowed'
    when exists (select 1 from public.access_requests where email = check_email and status = 'pending') then 'pending'
    when exists (select 1 from public.access_requests where email = check_email and status = 'denied') then 'denied'
    else 'none'
  end;
$$;
revoke execute on function public.check_access_status(text) from public;
grant execute on function public.check_access_status(text) to anon, authenticated;

-- Gate every authenticated read behind is_allowed_email(), not just
-- "signed in" — otherwise the allow-list would be cosmetic, since the
-- anon key is public and anyone could still open a Supabase auth session
-- directly against the API for any email.
drop policy "authenticated_read_people" on people;
create policy "authenticated_read_people" on people
  for select to authenticated using (private.is_allowed_email());

drop policy "authenticated_read_relationships" on relationships;
create policy "authenticated_read_relationships" on relationships
  for select to authenticated using (private.is_allowed_email());

drop policy "visible_read_family_events" on family_events;
create policy "visible_read_family_events" on family_events
  for select to authenticated using (
    private.is_allowed_email() and (
      visibility = 'everyone'
      or created_by = (auth.jwt()->>'email')
      or exists (
        select 1 from event_invited_people eip
        join people p on p.id = eip.person_id
        where eip.event_id = family_events.id and p.claimed_by = (auth.jwt()->>'email')
      )
      or exists (
        select 1 from event_invited_groups eig
        join group_members gm on gm.group_id = eig.group_id
        join people p on p.id = gm.person_id
        where eig.event_id = family_events.id and p.claimed_by = (auth.jwt()->>'email')
      )
    )
  );

drop policy "read_groups" on groups;
create policy "read_groups" on groups
  for select to authenticated using (private.is_allowed_email());

drop policy "read_group_members" on group_members;
create policy "read_group_members" on group_members
  for select to authenticated using (private.is_allowed_email());

drop policy "read_event_invited_people" on event_invited_people;
create policy "read_event_invited_people" on event_invited_people
  for select to authenticated using (private.is_allowed_email());

drop policy "read_event_invited_groups" on event_invited_groups;
create policy "read_event_invited_groups" on event_invited_groups
  for select to authenticated using (private.is_allowed_email());

drop policy "authenticated_read_photos" on storage.objects;
create policy "authenticated_read_photos" on storage.objects
  for select to authenticated using (bucket_id = 'photos' and private.is_allowed_email());

-- Gate the self-initiated writes that don't already imply the actor was
-- already allow-listed (ownership/editor-gated writes elsewhere are
-- unaffected, since only an already-allowed user could ever become an
-- owner once these are in place).
drop policy "self_claim_people" on people;
create policy "self_claim_people" on people
  for update to authenticated
  using (claimed_by is null and private.is_allowed_email())
  with check (claimed_by = (auth.jwt()->>'email') and private.is_allowed_email());

drop policy "self_insert_people" on people;
create policy "self_insert_people" on people
  for insert to authenticated
  with check (claimed_by = (auth.jwt()->>'email') and private.is_allowed_email());

drop policy "self_insert_relationships" on relationships;
create policy "self_insert_relationships" on relationships
  for insert to authenticated
  with check (
    private.is_allowed_email()
    and exists (
      select 1 from people p
      where p.id in (person1_id, person2_id) and p.claimed_by = (auth.jwt()->>'email')
    )
  );

drop policy "authenticated_insert_family_events" on family_events;
create policy "authenticated_insert_family_events" on family_events
  for insert to authenticated
  with check (created_by = (auth.jwt()->>'email') and private.is_allowed_email());

drop policy "insert_groups" on groups;
create policy "insert_groups" on groups
  for insert to authenticated
  with check (created_by = (auth.jwt()->>'email') and private.is_allowed_email());

drop policy "insert_group_members" on group_members;
create policy "insert_group_members" on group_members
  for insert to authenticated
  with check (
    private.is_allowed_email() and (
      exists (select 1 from groups g where g.id = group_id and g.created_by = (auth.jwt()->>'email'))
      or exists (
        select 1 from group_members gm
        join people p on p.id = gm.person_id
        where gm.group_id = group_members.group_id and p.claimed_by = (auth.jwt()->>'email')
      )
      or exists (select 1 from editors e where e.email = (auth.jwt()->>'email'))
    )
  );

drop policy "manage_event_invited_people" on event_invited_people;
create policy "manage_event_invited_people" on event_invited_people
  for insert to authenticated
  with check (
    private.is_allowed_email() and exists (
      select 1 from family_events fe where fe.id = event_id and (
        fe.created_by = (auth.jwt()->>'email')
        or exists (select 1 from editors e where e.email = (auth.jwt()->>'email'))
      )
    )
  );

drop policy "manage_event_invited_groups" on event_invited_groups;
create policy "manage_event_invited_groups" on event_invited_groups
  for insert to authenticated
  with check (
    private.is_allowed_email() and exists (
      select 1 from family_events fe where fe.id = event_id and (
        fe.created_by = (auth.jwt()->>'email')
        or exists (select 1 from editors e where e.email = (auth.jwt()->>'email'))
      )
    )
  );
