select cron.schedule(
  'rss-ingest-hourly',
  '15 * * * *',
  $$
  select net.http_post(
    url := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/ingest-rss',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 240000
  ) as request_id;
  $$
);
