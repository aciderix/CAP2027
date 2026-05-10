-- Push delivery is now decoupled from ingest-rss. Companion function
-- notify-after-ingest runs 1 minute after ingest-rss finishes (with
-- a 90-min lookback window that covers slow ingests) and triggers
-- push-broadcast → FCM if anything new came in.

select cron.schedule(
  'notify-after-ingest-hourly',
  '16 * * * *',
  $$
  select net.http_post(
    url := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/notify-after-ingest',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);
