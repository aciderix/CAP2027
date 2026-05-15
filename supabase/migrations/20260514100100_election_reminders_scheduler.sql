-- Server-driven election reminders. Each milestone (J-1 18 h, J-day
-- 8 h, results, inscription J-42 10 h, procuration J-21/J-7, Boussole
-- J-30 11 h) is materialised as a one-off pg_cron job named
-- 'election_<key>'. Times are computed from app_config.election.round{1,2}
-- in Europe/Paris and converted to UTC for the cron expression.
--
-- When admin changes the dates in app_config, a trigger rebuilds the
-- whole set of jobs. The dispatch-election-reminders edge function
-- consults election_reminders_sent to avoid double-firing on cron
-- retries.

create table if not exists public.election_reminders_sent (
  milestone_key text primary key,
  sent_at timestamptz not null default now()
);
alter table public.election_reminders_sent enable row level security;
-- Service role only — no anon policies needed.

-- Helper: schedule a single milestone job if its target instant is in
-- the future. Cron expression uses UTC (Supabase default).
create or replace function public._schedule_election_milestone(
  job_name text,
  milestone_qs text,
  target_ts timestamptz
) returns void
language plpgsql
security definer
set search_path = public, cron, net
as $$
declare
  cron_expr text;
  url text;
  cmd text;
  utc_ts timestamp;
begin
  if target_ts is null or target_ts <= now() then
    return;
  end if;
  utc_ts := target_ts at time zone 'UTC';
  cron_expr :=
    extract(minute from utc_ts)::int::text || ' ' ||
    extract(hour   from utc_ts)::int::text || ' ' ||
    extract(day    from utc_ts)::int::text || ' ' ||
    extract(month  from utc_ts)::int::text || ' *';
  url := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/dispatch-election-reminders?milestone='
       || milestone_qs;
  cmd := format(
    'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json''), timeout_milliseconds := 60000);',
    url
  );
  perform cron.schedule(job_name, cron_expr, cmd);
end;
$$;

-- Drops every 'election_*' job and rebuilds them from current app_config.
create or replace function public.reschedule_election_reminders()
returns void
language plpgsql
security definer
set search_path = public, cron, net
as $$
declare
  rec record;
  r1 jsonb;
  r2 jsonb;
  r1_sched timestamptz;
  r2_sched timestamptz;
  r1_results timestamptz;
  r2_results timestamptz;
  r1_official boolean;
  r2_official boolean;
  r1_day_paris date;
  r2_day_paris date;
begin
  -- 1. Drop existing election_* jobs (idempotent rebuild)
  for rec in select jobname from cron.job where jobname like 'election\_%' escape '\'
  loop
    perform cron.unschedule(rec.jobname);
  end loop;

  -- 2. Also clear the sent log so newly-scheduled jobs can fire even
  -- if a previous run with identical key had already been recorded.
  delete from public.election_reminders_sent;

  select value into r1 from public.app_config where key = 'election.round1';
  select value into r2 from public.app_config where key = 'election.round2';

  if r1 is not null then
    r1_sched := (r1->>'scheduled_at')::timestamptz;
    r1_results := (r1->>'results_at')::timestamptz;
    r1_official := coalesce((r1->>'is_official')::boolean, false);
    r1_day_paris := (r1_sched at time zone 'Europe/Paris')::date;
    if r1_official and r1_sched is not null then
      perform _schedule_election_milestone(
        'election_r1_eve', 'eve&round=1',
        ((r1_day_paris - 1)::timestamp + interval '18 hours') at time zone 'Europe/Paris');
      perform _schedule_election_milestone(
        'election_r1_day', 'day&round=1',
        (r1_day_paris::timestamp + interval '8 hours') at time zone 'Europe/Paris');
      perform _schedule_election_milestone(
        'election_r1_results', 'results&round=1', r1_results);
      perform _schedule_election_milestone(
        'election_r1_inscription', 'inscription&round=1',
        ((r1_day_paris - 42)::timestamp + interval '10 hours') at time zone 'Europe/Paris');
      perform _schedule_election_milestone(
        'election_r1_proc_3w', 'proc_3w&round=1',
        ((r1_day_paris - 21)::timestamp + interval '10 hours') at time zone 'Europe/Paris');
      perform _schedule_election_milestone(
        'election_r1_proc_1w', 'proc_1w&round=1',
        ((r1_day_paris - 7)::timestamp + interval '10 hours') at time zone 'Europe/Paris');
      perform _schedule_election_milestone(
        'election_r1_boussole_30', 'boussole_30&round=1',
        ((r1_day_paris - 30)::timestamp + interval '11 hours') at time zone 'Europe/Paris');
    end if;
  end if;

  if r2 is not null then
    r2_sched := (r2->>'scheduled_at')::timestamptz;
    r2_results := (r2->>'results_at')::timestamptz;
    r2_official := coalesce((r2->>'is_official')::boolean, false);
    r2_day_paris := (r2_sched at time zone 'Europe/Paris')::date;
    if r2_official and r2_sched is not null then
      perform _schedule_election_milestone(
        'election_r2_eve', 'eve&round=2',
        ((r2_day_paris - 1)::timestamp + interval '18 hours') at time zone 'Europe/Paris');
      perform _schedule_election_milestone(
        'election_r2_day', 'day&round=2',
        (r2_day_paris::timestamp + interval '8 hours') at time zone 'Europe/Paris');
      perform _schedule_election_milestone(
        'election_r2_results', 'results&round=2', r2_results);
      perform _schedule_election_milestone(
        'election_r2_proc_3w', 'proc_3w&round=2',
        ((r2_day_paris - 21)::timestamp + interval '10 hours') at time zone 'Europe/Paris');
      perform _schedule_election_milestone(
        'election_r2_proc_1w', 'proc_1w&round=2',
        ((r2_day_paris - 7)::timestamp + interval '10 hours') at time zone 'Europe/Paris');
    end if;
  end if;
end;
$$;

-- Trigger: when admin edits any election.* row, rebuild the cron set.
create or replace function public._app_config_election_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.key like 'election.%' then
    perform public.reschedule_election_reminders();
  end if;
  return new;
end;
$$;

drop trigger if exists app_config_election_reschedule on public.app_config;
create trigger app_config_election_reschedule
  after insert or update on public.app_config
  for each row execute function public._app_config_election_trigger();

-- Initial call so the current app_config dates are wired up.
select public.reschedule_election_reminders();
