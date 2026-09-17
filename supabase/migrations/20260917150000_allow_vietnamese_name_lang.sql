
-- The "Chinese name" field is also used for a Vietnamese name when that's
-- what a family member goes by instead, so it needs a matching voice for
-- pronunciation.
alter table people drop constraint people_chinese_name_lang_check;
alter table people add constraint people_chinese_name_lang_check
  check (chinese_name_lang in ('yue', 'cmn', 'vi'));
