// Companion to ingest-rss: looks at news_articles inserted in the
// recent ingest window, and if any, triggers push-broadcast with a
// notification body tailored to what just landed.
//
// Heuristic for the title:
//   - 1 X post linked to a single candidate → "Nouveau post de <Nom>"
//   - 1 YouTube video linked to a single candidate → "Nouvelle vidéo de <Nom>"
//   - otherwise → generic "X nouvelles actualités"
//
// Per-user filtering (followed candidates) still happens client-side
// in the WorkManager runner / foreground hook. The push title is the
// best we can do without keeping per-user state on the server.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function stripRetweetPrefix(s: string): string {
  return s.replace(/^RT by @[\w-]+:\s*/, '').replace(/\s*\b(?:Video|Image)\s*$/i, '').trim();
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const minutes = Number(url.searchParams.get("window_min") ?? "90");
  const dryRun = url.searchParams.get("dry") === "1";

  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();

  const { data: newArticles, error } = await supabase
    .from("news_articles")
    .select(`
      id, title, summary, url, published_at, kind,
      article_candidates(candidate:candidates(id, first_name, last_name))
    `)
    .gt("fetched_at", since)
    .order("published_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const articles = (newArticles ?? []) as any[];
  const count = articles.length;
  if (count === 0) {
    return Response.json({ count: 0, since, skipped: true });
  }

  // Pick a title + body that's specific when possible.
  const sample = articles[0];
  const sampleCandidates = (sample.article_candidates ?? [])
    .map((x: any) => x.candidate)
    .filter((c: any) => !!c);
  const sampleCandidate = sampleCandidates.length === 1 ? sampleCandidates[0] : null;

  let title: string;
  let body: string;
  if (count === 1 && sampleCandidate && sample.kind === "twitter_post") {
    title = `Nouveau post de ${sampleCandidate.first_name} ${sampleCandidate.last_name}`.trim();
    body = stripRetweetPrefix(sample.summary || sample.title || "").slice(0, 140)
      || "Ouvrez CAP 2027 pour le consulter";
  } else if (count === 1 && sampleCandidate && sample.kind === "youtube_video") {
    title = `Nouvelle vidéo de ${sampleCandidate.first_name} ${sampleCandidate.last_name}`.trim();
    body = (sample.title || "").slice(0, 140) || "Ouvrez CAP 2027 pour la voir";
  } else if (count === 1) {
    title = "Une nouvelle actualité";
    body = (sample.title || "").slice(0, 140) || "Ouvrez CAP 2027 pour la consulter";
  } else {
    title = `${count} nouvelles actualités`;
    body = (sample.title || "").slice(0, 140) || "Ouvrez CAP 2027 pour les consulter";
  }

  const payload = { title, body, url: sample.url ?? null };

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
    title,
    sent: broadcastResult?.sent ?? null,
    failed: broadcastResult?.failed ?? null,
    broadcast_status: r.status,
  });
});
