-- Quiet hours: silence FCM push notifications during a configurable
-- nightly window. The check lives in the push-broadcast edge function
-- — every notification goes through it, so a single guard covers
-- every emitter (notify-after-ingest, the trigger pipeline,
-- dispatch-election-reminders, manual broadcasts).
--
-- Hours are expressed as 24h integers in Europe/Paris. start>end means
-- "wraps over midnight" (22..7 → 22:00 Paris through 06:59 Paris).
--
-- Election milestones (J-day, results, eve) bypass the filter by
-- carrying an allowlisted `type`. Articles, candidate updates, etc.
-- are silenced; the content stays in DB and surfaces when the user
-- next opens the app (useResumeNotificationsHook + admin counter sync).

insert into public.app_config (key, value)
values ('push.quiet_hours', jsonb_build_object(
  'enabled', true,
  'start_paris', 22,
  'end_paris', 7
))
on conflict (key) do nothing;
