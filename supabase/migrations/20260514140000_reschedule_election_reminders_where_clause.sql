-- Supabase blocks unqualified DELETE/UPDATE as a safety. The reschedule
-- function did `delete from election_reminders_sent;` (no WHERE), which
-- aborted the whole trigger and prevented admins from updating dates
-- in app_config. Add a tautological WHERE so the wipe still does what
-- we want without tripping the safety.

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
  -- Tautological WHERE to satisfy Supabase's "DELETE requires a WHERE
  -- clause" safety net.
  delete from public.election_reminders_sent where milestone_key is not null;

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
