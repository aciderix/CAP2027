// Companion to ingest-rss: looks at news_articles inserted in the
// recent ingest window and dispatches FCM notifications.
//
// Two notif paths:
//   1. Per-candidate (targeted): for each candidate with a fresh
//      twitter_post / youtube_video in the window, post to
//      push-broadcast?candidate_id=... — only followers of that
//      candidate receive it.
//   2. Generic broadcast (all tokens): if any 'article' (press) is
//      fresh, send a single "N nouvelles actualités" notif to every
//      device, so users who don't follow a specific candidate still
//      get told the feed has updated.
//
// Per-user filtering for social posts now happens server-side via
// push_token_follows. Local follows on the device are mirrored to that
// table whenever the user toggles (see lib/follows.ts).

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function stripRetweetPrefix(s: string): string {
  return s.replace(/^RT by @[\w-]+:\s*/, '').replace(/\s*\b(?:Video|Image)\s*$/i, '').trim();
}

interface Candidate { id: string; first_name: string; last_name: string }

interface ArticleRow {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  published_at: string;
  kind: string;
  source?: { orientation: string | null } | null;
  article_candidates?: Array<{ candidate: Candidate | null }>;
}

interface PostPayload {
  title: string;
  body: string;
  url?: string;
  candidate_id?: string;
  orientation?: string;
  orientations?: string[];
  type?: string;
}

async function callBroadcast(payload: PostPayload, dryRun: boolean) {
  if (dryRun) return { dry: true, payload };
  const r = await fetch(`${SUPABASE_URL}/functions/v1/push-broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  let result: any = null;
  try { result = await r.json(); } catch { /* ignore */ }
  return { status: r.status, payload, sent: result?.sent ?? null, failed: result?.failed ?? null };
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
      source:news_sources(orientation),
      article_candidates(candidate:candidates(id, first_name, last_name))
    `)
    .gt("fetched_at", since)
    .order("published_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const articles = (newArticles ?? []) as ArticleRow[];
  const count = articles.length;
  if (count === 0) {
    return Response.json({ count: 0, since, skipped: true });
  }

  const dispatched: any[] = [];

  // ---- 1. Per-candidate notifs for fresh social posts ----------------
  //
  // Build a map: candidate_id → { candidate, twitter[], youtube[] }.
  // Press articles are intentionally excluded here — they go through
  // the generic broadcast path below.
  const perCandidate = new Map<string, {
    candidate: Candidate;
    twitter: ArticleRow[];
    youtube: ArticleRow[];
  }>();

  for (const a of articles) {
    if (a.kind !== "twitter_post" && a.kind !== "youtube_video") continue;
    for (const link of a.article_candidates ?? []) {
      const c = link.candidate;
      if (!c) continue;
      let bucket = perCandidate.get(c.id);
      if (!bucket) {
        bucket = { candidate: c, twitter: [], youtube: [] };
        perCandidate.set(c.id, bucket);
      }
      if (a.kind === "twitter_post") bucket.twitter.push(a);
      else bucket.youtube.push(a);
    }
  }

  for (const { candidate, twitter, youtube } of perCandidate.values()) {
    const name = `${candidate.first_name} ${candidate.last_name}`.trim();
    if (twitter.length === 1 && youtube.length === 0) {
      const a = twitter[0];
      dispatched.push(await callBroadcast({
        title: `Nouveau post de ${name}`,
        body: stripRetweetPrefix(a.summary || a.title || "").slice(0, 140)
          || "Ouvrez CAP 2027 pour le consulter",
        url: a.url,
        candidate_id: candidate.id,
        type: "article_social",
      }, dryRun));
    } else if (youtube.length === 1 && twitter.length === 0) {
      const a = youtube[0];
      dispatched.push(await callBroadcast({
        title: `Nouvelle vidéo de ${name}`,
        body: (a.title || "").slice(0, 140) || "Ouvrez CAP 2027 pour la voir",
        url: a.url,
        candidate_id: candidate.id,
        type: "article_social",
      }, dryRun));
    } else {
      // Multiple posts/videos for the same candidate in the same window
      // — aggregate. The body picks the most recent item's title.
      const total = twitter.length + youtube.length;
      const latest = (twitter[0] ?? youtube[0]);
      let title: string;
      if (twitter.length > 0 && youtube.length === 0) {
        title = `${total} nouveaux posts de ${name}`;
      } else if (youtube.length > 0 && twitter.length === 0) {
        title = `${total} nouvelles vidéos de ${name}`;
      } else {
        title = `${total} nouvelles publications de ${name}`;
      }
      dispatched.push(await callBroadcast({
        title,
        body: (latest.title || "").slice(0, 140) || "Ouvrez CAP 2027 pour les consulter",
        url: latest.url,
        candidate_id: candidate.id,
        type: "article_social",
      }, dryRun));
    }
  }

  // ---- 2. Consolidated press notif --------------------------------
  //
  // Press articles can land from sources of different orientations,
  // but the user expects ONE notif total — not one per bord. We
  // collect all orientations represented in the batch and dispatch a
  // single push-broadcast call with the orientations array; the RPC
  // tokens_for_press_orientations handles the opt-in restrictif rule
  // (no rows = lenient default, rows = match at least one orientation).
  const pressArticles = articles.filter((a) => a.kind === "article");
  // Aussi inclure les twitter_post / youtube_video qui ne sont liés à
  // aucun candidat (ex: chaîne YouTube de Brut, post X d'un média
  // généraliste). Ils tombent comme la presse dans le broadcast par
  // orientation pour que les utilisateurs reçoivent quand même la
  // notif. Les vidéos / posts liés à un candidat ont déjà été traités
  // dans la boucle perCandidate ci-dessus.
  const orphanMedia = articles.filter((a) => {
    if (a.kind !== "twitter_post" && a.kind !== "youtube_video") return false;
    const linked = (a.article_candidates ?? []).some((l) => !!l.candidate);
    return !linked;
  });
  const pressItems = [...pressArticles, ...orphanMedia];
  const pressOrientations = new Set<string>();
  for (const a of pressItems) {
    pressOrientations.add(a.source?.orientation ?? "transverse");
  }
  if (pressItems.length > 0) {
    const sample = pressItems[0];
    const pressTitle =
      pressItems.length === 1
        ? "Une nouvelle actualité"
        : `${pressItems.length} nouvelles actualités`;
    dispatched.push(await callBroadcast({
      title: pressTitle,
      body: (sample.title || "").slice(0, 140) || "Ouvrez CAP 2027 pour les consulter",
      url: sample.url,
      orientations: [...pressOrientations],
      type: "article_press",
    }, dryRun));
  }

  return Response.json({
    count,
    since,
    per_candidate: perCandidate.size,
    press_articles: pressArticles.length,
    orphan_media: orphanMedia.length,
    press_orientations: [...pressOrientations],
    dispatched,
  });
});
