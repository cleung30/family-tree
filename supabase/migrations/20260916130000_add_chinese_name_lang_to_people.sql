
-- Cantonese and Mandarin readings of a Chinese name share the same
-- characters, so the correct pronunciation can't be detected from the
-- text — it has to be recorded per person. Values are the ISO 639-3
-- codes used to pick a speech-synthesis voice (yue -> zh-HK, cmn -> zh-CN).
alter table people add column chinese_name_lang text not null default 'yue' check (chinese_name_lang in ('yue', 'cmn'));
