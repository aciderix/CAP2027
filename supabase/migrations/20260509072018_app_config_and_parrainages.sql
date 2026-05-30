-- Generic key/value settings (election dates, feature flags, scraper URLs).
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
drop policy if exists "app_config_read_all" on public.app_config;
create policy "app_config_read_all" on public.app_config for select using (true);

-- Seed with placeholder election dates. is_official=false flags them as
-- estimates so the UI can render "Estimé".
insert into public.app_config (key, value) values
  ('election.round1', jsonb_build_object(
     'scheduled_at', '2027-04-11T08:00:00+02:00',
     'results_at',   '2027-04-11T20:00:00+02:00',
     'is_official',  false,
     'label',        'Estimé'
   )),
  ('election.round2', jsonb_build_object(
     'scheduled_at', '2027-04-25T08:00:00+02:00',
     'results_at',   '2027-04-25T20:00:00+02:00',
     'is_official',  false,
     'label',        'Estimé'
   )),
  ('parrainages.source', jsonb_build_object(
     'url',          'https://presidentielle2027.conseil-constitutionnel.fr/telechargement/parrainagestotal.json',
     'is_available', false,
     'note',         'L''URL exacte sera connue au lancement officiel de la collecte par le Conseil constitutionnel.'
   ))
on conflict (key) do nothing;

-- Tracks the daily snapshot of parrainages by candidate.
create table if not exists public.parrainages (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete set null,
  -- canonical name used in the source JSON, kept verbatim so we can ingest
  -- before all candidates exist in our DB
  source_name text not null,
  total integer not null check (total >= 0),
  snapshot_date date not null,
  created_at timestamptz not null default now(),
  unique (source_name, snapshot_date)
);

create index if not exists idx_parrainages_date on public.parrainages (snapshot_date desc);
create index if not exists idx_parrainages_candidate on public.parrainages (candidate_id);

alter table public.parrainages enable row level security;
drop policy if exists "parrainages_read_all" on public.parrainages;
create policy "parrainages_read_all" on public.parrainages for select using (true);

-- Convenience view: latest snapshot per candidate, joined to the candidate row.
create or replace view public.parrainages_latest as
select
  p.candidate_id,
  p.source_name,
  p.total,
  p.snapshot_date,
  c.first_name,
  c.last_name,
  c.photo_url,
  c.party_id
from public.parrainages p
left join public.candidates c on c.id = p.candidate_id
where p.snapshot_date = (
  select max(snapshot_date) from public.parrainages
);
