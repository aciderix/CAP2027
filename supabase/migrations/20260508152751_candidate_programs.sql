-- Long-form program content per candidate per theme
create table public.candidate_programs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete restrict,
  intro text,
  content text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, theme_id)
);
create index candidate_programs_candidate_id_idx on public.candidate_programs(candidate_id);
create index candidate_programs_theme_id_idx on public.candidate_programs(theme_id);

create trigger candidate_programs_updated_at before update on public.candidate_programs
  for each row execute function public.set_updated_at();

alter table public.candidate_programs enable row level security;

create policy "candidate_programs_public_read" on public.candidate_programs
  for select to anon, authenticated using (
    exists (
      select 1 from public.candidates c
      where c.id = candidate_programs.candidate_id and c.is_published = true
    )
  );
