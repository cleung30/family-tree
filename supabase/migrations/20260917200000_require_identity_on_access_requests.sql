
-- A self-submitted access request needs enough identity for an admin to
-- actually evaluate it — who is this, how do they relate to the family —
-- so name and relation are now required. Contact info stays optional: a
-- family member may already know how to reach the requester even
-- without an email or phone captured here, and the email a requester
-- types to check their own status shouldn't force them to hand one over
-- just to ask to be let in.
alter table access_requests add column first_name text;
alter table access_requests add column last_name text;
alter table access_requests add column relation text;
alter table access_requests add column phone text;
alter table access_requests alter column email drop not null;
alter table access_requests drop column note;

drop policy "self_request_access" on access_requests;
create policy "self_request_access" on access_requests
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and invited_by is null and decided_by is null and decided_at is null
    and coalesce(trim(first_name), '') <> ''
    and coalesce(trim(last_name), '') <> ''
    and coalesce(trim(relation), '') <> ''
  );
