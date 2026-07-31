-- VetMaster: one Bacterial Diseases topic with three species folders in the UI.
-- Safe to run more than once. It moves questions; it does not delete or duplicate them.

begin;

insert into public.topics (name, slug, description, sort_order, is_active)
values (
  'Bacterial Diseases',
  'bacterial-diseases',
  'Bacterial diseases grouped by animal species.',
  20,
  true
)
on conflict (slug) do update
set name = excluded.name,
    description = coalesce(public.topics.description, excluded.description),
    is_active = true,
    updated_at = now();

do $$
declare
  bacterial_topic_id uuid;
  destination_subtopic_id uuid;
  destination_slug text;
  canonical_source text;
  item record;
begin
  select id
    into bacterial_topic_id
  from public.topics
  where slug = 'bacterial-diseases';

  create temporary table vetmaster_bacterial_move_map
  on commit drop
  as
  select
    q.id as question_id,
    s.name as subtopic_name,
    s.slug as subtopic_slug,
    s.description as subtopic_description,
    s.sort_order as subtopic_sort_order,
    case
      when coalesce(q.source_note, '') ilike '%Bovine Bacterial Diseases%'
        or lower(t.name) = lower('Cattle Diseases')
        then 'cattle'
      when coalesce(q.source_note, '') ilike '%Equine Bacterial Diseases%'
        or lower(t.name) = lower('Equine Diseases')
        then 'equine'
      when coalesce(q.source_note, '') ilike '%Sheep & Goat Bacterial Diseases%'
        or lower(t.name) = lower('Sheep & Goat Diseases')
        then 'sheep-goat'
    end as species_key
  from public.questions q
  join public.topics t on t.id = q.topic_id
  left join public.subtopics s on s.id = q.subtopic_id
  where
    coalesce(q.source_note, '') ilike any (array[
      '%Bovine Bacterial Diseases%',
      '%Equine Bacterial Diseases%',
      '%Sheep & Goat Bacterial Diseases%'
    ])
    or lower(t.name) in (
      lower('Cattle Diseases'),
      lower('Equine Diseases'),
      lower('Sheep & Goat Diseases')
    );

  for item in
    select *
    from vetmaster_bacterial_move_map
    where species_key is not null
  loop
    destination_slug := item.species_key || '-' || coalesce(
      nullif(
        regexp_replace(
          coalesce(item.subtopic_slug, ''),
          '^(cattle|equine|sheep-goat)-',
          '',
          'i'
        ),
        ''
      ),
      'general'
    );

    insert into public.subtopics (
      topic_id,
      name,
      slug,
      description,
      sort_order,
      is_active
    )
    values (
      bacterial_topic_id,
      coalesce(item.subtopic_name, 'General'),
      destination_slug,
      item.subtopic_description,
      coalesce(item.subtopic_sort_order, 0),
      true
    )
    on conflict (topic_id, slug) do update
    set name = excluded.name,
        description = coalesce(public.subtopics.description, excluded.description),
        is_active = true,
        updated_at = now()
    returning id into destination_subtopic_id;

    canonical_source := case item.species_key
      when 'cattle' then 'Bovine Bacterial Diseases'
      when 'equine' then 'Equine Bacterial Diseases'
      when 'sheep-goat' then 'Sheep & Goat Bacterial Diseases'
    end;

    update public.questions
    set topic_id = bacterial_topic_id,
        subtopic_id = destination_subtopic_id,
        source_note = case
          when coalesce(source_note, '') ilike '%' || canonical_source || '%'
            then source_note
          else concat_ws(' — ', nullif(source_note, ''), canonical_source)
        end,
        updated_at = now()
    where id = item.question_id;
  end loop;

  update public.topics t
  set is_active = false,
      updated_at = now()
  where lower(t.name) in (
      lower('Cattle Diseases'),
      lower('Equine Diseases'),
      lower('Sheep & Goat Diseases')
    )
    and t.id <> bacterial_topic_id
    and not exists (
      select 1
      from public.questions q
      where q.topic_id = t.id
    );
end
$$;

commit;

-- Verification result: one row per species and its question count.
select
  case
    when q.source_note ilike '%Bovine Bacterial Diseases%' then 'Cattle Diseases'
    when q.source_note ilike '%Equine Bacterial Diseases%' then 'Equine Diseases'
    when q.source_note ilike '%Sheep & Goat Bacterial Diseases%' then 'Sheep & Goat Diseases'
  end as species_folder,
  count(*) as question_count
from public.questions q
join public.topics t on t.id = q.topic_id
where t.slug = 'bacterial-diseases'
  and q.source_note ilike any (array[
    '%Bovine Bacterial Diseases%',
    '%Equine Bacterial Diseases%',
    '%Sheep & Goat Bacterial Diseases%'
  ])
group by 1
order by 1;
