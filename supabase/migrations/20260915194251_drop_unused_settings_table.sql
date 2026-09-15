-- Leftover from a pre-magic-link PIN auth scheme; unused by the app and
-- was publicly writable by anyone (no RLS restriction at all).
drop table if exists settings;
