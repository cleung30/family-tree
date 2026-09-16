
-- The column has held a Supabase Storage public URL since photo uploads
-- moved off base64, but kept its old name. Rename it to match reality.
alter table people rename column photo_base64 to photo_url;
