-- VetMaster: disease-level importance (1-5 stars)
-- Safe to run more than once.
-- This migration does not insert, delete, move, or duplicate questions.

begin;

alter table public.subtopics
  add column if not exists importance integer not null default 3;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subtopics_importance_check'
      and conrelid = 'public.subtopics'::regclass
  ) then
    alter table public.subtopics
      add constraint subtopics_importance_check
      check (importance between 1 and 5);
  end if;
end
$$;

drop table if exists pg_temp.vetmaster_disease_importance_map;

create temporary table vetmaster_disease_importance_map (
  scope text not null,
  disease_name text not null,
  importance integer not null check (importance between 1 and 5),
  primary key (scope, disease_name)
) on commit preserve rows;

insert into vetmaster_disease_importance_map (scope, disease_name, importance)
values
  -- Cattle bacterial diseases
  ('cattle', 'Bovine Tuberculosis (TB)', 5),
  ('cattle', 'Bovine Brucellosis', 5),
  ('cattle', 'Johne''s Disease', 5),
  ('cattle', 'Bovine Anthrax', 5),
  ('cattle', 'Blackleg', 5),
  ('cattle', 'Bovine Salmonellosis', 5),
  ('cattle', 'Bovine Leptospirosis', 5),
  ('cattle', 'Bovine Listeriosis', 4),
  ('cattle', 'Bovine Mastitis', 5),
  ('cattle', 'Bovine Genital Campylobacteriosis (Vibriosis)', 4),
  ('cattle', 'Bovine Bacterial Diseases — Mixed Review', 4),
  ('cattle', 'Bovine Respiratory Disease (Shipping Fever)', 5),
  ('cattle', 'Bacillary Hemoglobinuria (Red Water Disease)', 4),
  ('cattle', 'Actinomycosis (Lumpy Jaw)', 4),
  ('cattle', 'Actinobacillosis (Wooden Tongue)', 4),
  ('cattle', 'Infectious Bovine Keratoconjunctivitis (Pinkeye)', 4),
  ('cattle', 'Bovine Foot Rot', 4),
  ('cattle', 'Bovine Botulism', 4),
  ('cattle', 'Bovine Tetanus', 4),
  ('cattle', 'Malignant Edema', 4),
  ('cattle', 'Mycoplasma bovis Infection', 4),
  ('cattle', 'Digital Dermatitis (Hairy Heel Wart)', 3),
  ('cattle', 'Necrotic Laryngitis (Calf Diphtheria)', 4),

  -- Equine bacterial diseases
  ('equine', 'Strangles', 5),
  ('equine', 'Rhodococcosis', 5),
  ('equine', 'Glanders', 5),
  ('equine', 'Potomac Horse Fever', 4),
  ('equine', 'Guttural Pouch Empyema', 4),
  ('equine', 'Equine Salmonellosis', 4),
  ('equine', 'Tetanus', 5),
  ('equine', 'Botulism', 5),
  ('equine', 'Ulcerative Lymphangitis (Pigeon Fever)', 4),
  ('equine', 'Equine Proliferative Enteropathy', 4),
  ('equine', 'Equine Leptospirosis', 4),
  ('equine', 'Nocardioform Placentitis', 3),
  ('equine', 'Clostridium perfringens Enterocolitis in Foals', 4),
  ('equine', 'Clostridial Myositis (Gas Gangrene)', 4),
  ('equine', 'Equine Pleuropneumonia (Shipping Fever)', 5),
  ('equine', 'Clostridium difficile Enterocolitis', 4),
  ('equine', 'Dermatophilosis (Rain Scald)', 3),
  ('equine', 'Equine Lyme Disease', 3),
  ('equine', 'Equine Endometritis', 5),
  ('equine', 'Sleepy Foal Disease (Actinobacillus equuli)', 5),

  -- Sheep and goat bacterial diseases
  ('sheep-goat', 'Brucellosis', 5),
  ('sheep-goat', 'Caseous Lymphadenitis (CLA)', 5),
  ('sheep-goat', 'Contagious Agalactia', 5),
  ('sheep-goat', 'Johne''s Disease', 4),
  ('sheep-goat', 'Salmonellosis', 4),
  ('sheep-goat', 'Enterotoxemia (Pulpy Kidney Disease)', 5),
  ('sheep-goat', 'Mannheimiosis', 5),
  ('sheep-goat', 'Campylobacteriosis (Vibriosis)', 5),
  ('sheep-goat', 'Foot Rot', 5),
  ('sheep-goat', 'Tetanus', 4),
  ('sheep-goat', 'Anthrax', 4),
  ('sheep-goat', 'Tuberculosis', 3),
  ('sheep-goat', 'Actinobacillosis (Wooden Tongue)', 3),
  ('sheep-goat', 'Dermatophilosis', 3),
  ('sheep-goat', 'Nocardiosis', 2),
  ('sheep-goat', 'Contagious Ovine Digital Dermatitis (CODD)', 4),
  ('sheep-goat', 'Mastitis', 5),
  ('sheep-goat', 'Lamb Dysentery', 5),
  ('sheep-goat', 'Q Fever', 4),
  ('sheep-goat', 'Leptospirosis', 4),

  -- Viral diseases (the approved VetMaster weights)
  ('viral', 'Foot-and-Mouth Disease (FMD)', 5),
  ('viral', 'Peste des Petits Ruminants (PPR)', 5),
  ('viral', 'Lumpy Skin Disease (LSD)', 5),
  ('viral', 'Sheep & Goat Pox', 5),
  ('viral', 'Bluetongue', 4),
  ('viral', 'Infectious Bovine Rhinotracheitis (IBR)', 4),
  ('viral', 'Bovine Viral Diarrhea (BVD)', 4),
  ('viral', 'Equine Influenza', 4),
  ('viral', 'Equine Herpesvirus (EHV-1 & EHV-4)', 4),
  ('viral', 'Rabies', 4),
  ('viral', 'Orf (Contagious Ecthyma)', 3),
  ('viral', 'African Horse Sickness (AHS)', 3),
  ('viral', 'Rift Valley Fever (RVF)', 3),
  ('viral', 'Maedi-Visna', 3),
  ('viral', 'Bovine Ephemeral Fever (BEF)', 3),

  -- Parasitic, protozoal, and fungal diseases
  ('parasitic', 'Ringworm (Dermatophytosis)', 3),
  ('parasitic', 'Echinococcosis (Hydatidosis)', 5),
  ('parasitic', 'Tropical Theileriosis', 5),
  ('parasitic', 'Babesiosis', 5),
  ('parasitic', 'Coccidiosis', 5),
  ('parasitic', 'Fasciolosis', 5),
  ('parasitic', 'Toxoplasmosis', 5),
  ('parasitic', 'Neosporosis', 5),
  ('parasitic', 'Cryptosporidiosis', 5),
  ('parasitic', 'Haemonchosis', 5),
  ('parasitic', 'Dictyocaulosis', 4),
  ('parasitic', 'Sarcoptic Mange', 4),
  ('parasitic', 'Surra (Trypanosomiasis)', 4),
  ('parasitic', 'Sarcocystosis', 3),
  ('parasitic', 'Dicrocoeliasis', 3),
  ('parasitic', 'Monieziasis', 3);

with classified_subtopics as (
  select
    s.id,
    s.name as disease_name,
    case
      when t.slug = 'viral-diseases'
        or lower(t.name) = lower('Viral Diseases') then 'viral'
      when t.slug = 'parasitic-diseases'
        or lower(t.name) = lower('Parasitic Diseases') then 'parasitic'
      when s.slug ilike 'cattle-%'
        or lower(t.name) = lower('Cattle Diseases')
        or exists (
          select 1 from public.questions q
          where q.subtopic_id = s.id
            and coalesce(q.source_note, '') ilike '%Bovine Bacterial Diseases%'
        ) then 'cattle'
      when s.slug ilike 'equine-%'
        or lower(t.name) = lower('Equine Diseases')
        or exists (
          select 1 from public.questions q
          where q.subtopic_id = s.id
            and coalesce(q.source_note, '') ilike '%Equine Bacterial Diseases%'
        ) then 'equine'
      when s.slug ilike 'sheep-goat-%'
        or lower(t.name) = lower('Sheep & Goat Diseases')
        or exists (
          select 1 from public.questions q
          where q.subtopic_id = s.id
            and coalesce(q.source_note, '') ilike '%Sheep & Goat Bacterial Diseases%'
        ) then 'sheep-goat'
    end as scope
  from public.subtopics s
  join public.topics t on t.id = s.topic_id
), matched_subtopics as (
  select cs.id, ratings.importance
  from classified_subtopics cs
  join vetmaster_disease_importance_map ratings
    on ratings.scope = cs.scope
   and lower(trim(ratings.disease_name)) = lower(trim(cs.disease_name))
)
update public.subtopics s
set importance = matches.importance,
    updated_at = now()
from matched_subtopics matches
where s.id = matches.id
  and s.importance is distinct from matches.importance;

commit;

-- Verification report: every row should show OK and a positive question count.
with classified_subtopics as (
  select
    s.id,
    s.name as disease_name,
    s.importance,
    case
      when t.slug = 'viral-diseases'
        or lower(t.name) = lower('Viral Diseases') then 'viral'
      when t.slug = 'parasitic-diseases'
        or lower(t.name) = lower('Parasitic Diseases') then 'parasitic'
      when s.slug ilike 'cattle-%'
        or lower(t.name) = lower('Cattle Diseases')
        or exists (
          select 1 from public.questions q
          where q.subtopic_id = s.id
            and coalesce(q.source_note, '') ilike '%Bovine Bacterial Diseases%'
        ) then 'cattle'
      when s.slug ilike 'equine-%'
        or lower(t.name) = lower('Equine Diseases')
        or exists (
          select 1 from public.questions q
          where q.subtopic_id = s.id
            and coalesce(q.source_note, '') ilike '%Equine Bacterial Diseases%'
        ) then 'equine'
      when s.slug ilike 'sheep-goat-%'
        or lower(t.name) = lower('Sheep & Goat Diseases')
        or exists (
          select 1 from public.questions q
          where q.subtopic_id = s.id
            and coalesce(q.source_note, '') ilike '%Sheep & Goat Bacterial Diseases%'
        ) then 'sheep-goat'
    end as scope
  from public.subtopics s
  join public.topics t on t.id = s.topic_id
), disease_report as (
  select
    ratings.scope,
    ratings.disease_name,
    ratings.importance as expected_importance,
    cs.importance as actual_importance,
    count(q.id) as question_count
  from vetmaster_disease_importance_map ratings
  left join classified_subtopics cs
    on cs.scope = ratings.scope
   and lower(trim(cs.disease_name)) = lower(trim(ratings.disease_name))
  left join public.questions q on q.subtopic_id = cs.id
  group by
    ratings.scope,
    ratings.disease_name,
    ratings.importance,
    cs.importance
)
select
  scope,
  disease_name,
  repeat('★', expected_importance) || repeat('☆', 5 - expected_importance) as rating,
  question_count,
  case
    when actual_importance is null then 'CHECK NAME'
    when actual_importance <> expected_importance then 'CHECK RATING'
    when question_count = 0 then 'CHECK QUESTIONS'
    else 'OK'
  end as status
from disease_report
order by scope, expected_importance desc, disease_name;
