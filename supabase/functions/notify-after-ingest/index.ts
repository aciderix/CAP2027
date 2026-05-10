// Companion to ingest-rss: looks at news_articles inserted in the
// recent ingest window, and if any, triggers push-broadcast with a
// generic notification body.
//
// Decoupled from ingest-rss so we don't have to redeploy the heavy
// ingest function every time the push logic evolves. Called by a
// cron job 1 minute after ingest-rss to give DB inserts time to
// settle.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Default window: 90 minutes back. The hourly ingest cron runs at
  // xx:15 and we run at xx:16, so 90 minutes covers the previous run
  // plus a little slack for slow ingests.
  const minutes = Number(url.searchParams.get("window_min") ?? "90");
  const dryRun = url.searchParams.get("dry") === "1";

  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();

  const { data: newArticles, error } = await supabase
    .from("news_articles")
    .select("id, title, url, published_at")
    .gt("fetched_at", since)
    .order("published_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const count = newArticles?.length ?? 0;
  if (count === 0) {
    return Response.json({ count: 0, since, skipped: true });
  }

  const sample = newArticles![0];
  const payload = {
    title: count === 1 ? "Une nouvelle actualité" : `${count} nouvelles actualités`,
    body: sample.title?.slice(0, 140) ?? "Ouvrez CAP 2027 pour les consulter",
    url: sample.url ?? null,
  };

  if (dryRun) {
    return Response.json({ count, since, would_send: payload });
  }

  const r = await fetch(`${SUPABASE_URL}/functions/v1/push-broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  let broadcastResult: any = null;
  try { broadcastResult = await r.json(); } catch { /* ignore */ }

  return Response.json({
    count,
    since,
    sent: broadcastResult?.sent ?? null,
    failed: broadcastResult?.failed ?? null,
    broadcast_status: r.status,
    sample_errors: broadcastResult?.sample_errors ?? null,
  });
});
