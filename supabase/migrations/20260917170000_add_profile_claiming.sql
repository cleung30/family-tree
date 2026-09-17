
-- Links a signed-in account to the person record that represents them,
-- so the app can recognize "this is you" instead of everyone browsing
-- anonymously. Null means the person hasn't been claimed by anyone yet.
alter table people add column claimed_by text;
create unique index people_claimed_by_key on people (claimed_by) where claimed_by is not null;

-- Any signed-in user can claim an unclaimed profile as their own (self
-- link only — never on someone else's behalf, and never on an already-
-- claimed profile, which the "claimed_by is null" precondition rules
-- out). Separate from editors_write_people, which still covers
-- everything else about editing people.
create policy "self_claim_people" on people
  for update to authenticated
  using (claimed_by is null)
  with check (claimed_by = auth.jwt()->>'email');

-- Anyone signed in can create their own profile if they're not already
-- in the tree, same self-only constraint as claiming.
create policy "self_insert_people" on people
  for insert to authenticated
  with check (claimed_by = auth.jwt()->>'email');

-- Lets someone connect their own (newly created or just-claimed) profile
-- to an existing relative, without needing editor rights — but only
-- when one side of the relationship is a person they actually own, so
-- they can't invent a relationship between two other people.
create policy "self_insert_relationships" on relationships
  for insert to authenticated
  with check (
    exists (
      select 1 from people p
      where p.id in (person1_id, person2_id) and p.claimed_by = auth.jwt()->>'email'
    )
  );
