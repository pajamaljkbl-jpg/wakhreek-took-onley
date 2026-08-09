-- WAKH REEK — messages texte, image et audio.
-- À exécuter une fois dans Supabase > SQL Editor.

alter table messages add column if not exists message_type text not null default 'text';
alter table messages add column if not exists media_url text;
alter table messages add column if not exists duration_seconds integer;

do $$ begin
  alter table messages add constraint messages_message_type_check check (message_type in ('text', 'image', 'audio'));
exception when duplicate_object then null; end $$;
