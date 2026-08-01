-- VetMaster 2.0 database schema
-- Run this file in Supabase SQL Editor for a new project.

create extension if not exists pgcrypto;

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  importance integer not null default 3,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_id, slug),
  constraint subtopics_importance_check check (importance between 1 and 5)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete restrict,
  subtopic_id uuid references public.subtopics(id) on delete set null,
  question_text text not null,
  options jsonb not null,
  correct_index integer not null,
  explanation text not null default '',
  difficulty text not null default 'medium',
  priority integer not null default 3,
  image_url text,
  source_note text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_four_options_check
    check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  constraint questions_correct_index_check
    check (correct_index between 0 and 3),
  constraint questions_difficulty_check
    check (difficulty in ('easy', 'medium', 'hard')),
  constraint questions_priority_check
    check (priority between 1 and 5)
);

create index if not exists subtopics_topic_id_idx
  on public.subtopics(topic_id);
create index if not exists questions_topic_id_idx
  on public.questions(topic_id);
create index if not exists questions_subtopic_id_idx
  on public.questions(subtopic_id);
create index if not exists questions_difficulty_idx
  on public.questions(difficulty);
create index if not exists questions_active_idx
  on public.questions(is_active);
create index if not exists questions_created_at_idx
  on public.questions(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists topics_set_updated_at on public.topics;
create trigger topics_set_updated_at
before update on public.topics
for each row execute function public.set_updated_at();

drop trigger if exists subtopics_set_updated_at on public.subtopics;
create trigger subtopics_set_updated_at
before update on public.subtopics
for each row execute function public.set_updated_at();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

alter table public.topics enable row level security;
alter table public.subtopics enable row level security;
alter table public.questions enable row level security;

drop policy if exists "Public can read active topics" on public.topics;
create policy "Public can read active topics"
on public.topics
for select
to anon
using (is_active = true);

drop policy if exists "Authenticated users manage topics" on public.topics;
create policy "Authenticated users manage topics"
on public.topics
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read active subtopics" on public.subtopics;
create policy "Public can read active subtopics"
on public.subtopics
for select
to anon
using (
  is_active = true
  and exists (
    select 1
    from public.topics
    where topics.id = subtopics.topic_id
      and topics.is_active = true
  )
);

drop policy if exists "Authenticated users manage subtopics" on public.subtopics;
create policy "Authenticated users manage subtopics"
on public.subtopics
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read active questions" on public.questions;
create policy "Public can read active questions"
on public.questions
for select
to anon
using (
  is_active = true
  and exists (
    select 1
    from public.topics
    where topics.id = questions.topic_id
      and topics.is_active = true
  )
  and (
    subtopic_id is null
    or exists (
      select 1
      from public.subtopics
      where subtopics.id = questions.subtopic_id
        and subtopics.is_active = true
    )
  )
);

drop policy if exists "Authenticated users manage questions" on public.questions;
create policy "Authenticated users manage questions"
on public.questions
for all
to authenticated
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.topics, public.subtopics, public.questions to anon;
grant select, insert, update, delete
  on public.topics, public.subtopics, public.questions
  to authenticated;

insert into public.topics (name, slug, sort_order)
values
  ('Viral Diseases', 'viral-diseases', 10),
  ('Bacterial Diseases', 'bacterial-diseases', 20),
  ('Parasitic Diseases', 'parasitic-diseases', 30),
  ('Veterinary Drugs', 'veterinary-drugs', 40),
  ('Public Health', 'public-health', 50),
  ('Veterinary Immunology', 'veterinary-immunology', 60),
  ('Microbiology Laboratory', 'microbiology-laboratory', 70),
  ('Diagnostic Techniques', 'diagnostic-techniques', 80),
  ('General Veterinary Knowledge', 'general-veterinary-knowledge', 90),
  ('Meat Hygiene & Inspection', 'meat-hygiene-inspection', 100),
  ('Arabic Language', 'arabic-language', 110),
  ('English Language', 'english-language', 120),
  ('General Aptitude', 'general-aptitude', 130)
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;
