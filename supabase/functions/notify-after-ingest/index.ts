// Companion to ingest-rss: dispatches FCM notifs after each ingest cycle.
//   1. Per-candidate (twitter_post / youtube_video from the candidate's own source) → candidate_id targeting
//   2. Consolidated press notif (press articles + orphan twitter/youtube) → orientations[] targeting
//
// Each call tags data.type so the client can invalidate the right caches.
//
// AUTHENTICATION (issue #7): rejects unauthenticated callers (an open
// ?window_min=N could be abused to replay notifs over the whole history).
// Authorized when EITHER Authorization: Bearer <service_role_key> OR
// x-ingest-token: <ingest_secret> (sent by the pg_cron job; the secret
// lives in Vault, read via public.get_ingest_secret()). window_min is
// also clamped to [1, 1440] minutes.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let cachedSecret: string | null = null;
async function getExpectedSecret(): Promise<string | null> {
  if (cachedSecret) return cachedSecret;
  const { data, error } = await supabase.rpc("get_ingest_secret");
  if (error) return null;
  cachedSecret = typeof data === "string" && data.length > 0 ? data : null;
  return cachedSecret;
}
async function isAuthorized(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  if (bearer && bearer === SERVICE_ROLE_KEY) return true;
  const token = req.headers.get("x-ingest-token");
  if (!token) return false;
  const expected = await getExpectedSecret();
  return !!expected && token === expected;
}

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
  article_candidates?: Array<{ score: number | null; candidate: Candidate | null }>;
  article_themes?: Array<{ theme: { slug: string | null } | null }>;
}

// Un élément publié il y a plus longtemps n'est pas une nouveauté : c'est
// l'arriéré d'une source qu'on vient d'ajouter ou de réactiver (les 15
// dernières vidéos d'une chaîne YouTube, les 20 derniers posts d'un compte X).
const MAX_ITEM_AGE_HOURS = 6;

// Le cron passe à xx:16. Chaque passage traite le créneau horaire fixe qui
// se termine à la dernière minute 16 (ex. 15:16 → 16:16) : un article n'est
// vu que par un seul passage, même si le cron démarre avec du retard.
// L'ancienne fenêtre glissante de 90 min notifiait deux fois les articles
// récupérés dans la demi-heure précédant chaque passage.
const SLOT_MINUTE = 16;
function currentSlot(now: Date): { since: Date; until: Date } {
  const until = new Date(now);
  until.setUTCSeconds(0, 0);
  if (until.getUTCMinutes() < SLOT_MINUTE) until.setUTCHours(until.getUTCHours() - 1);
  until.setUTCMinutes(SLOT_MINUTE);
  return { since: new Date(until.getTime() - 3600 * 1000), until };
}

// ingest-rss / ingest-from-xml donnent ce score au candidat propriétaire de
// la source (son compte X, sa chaîne YouTube). Les autres liens viennent des
// alias : un post qui *cite* un candidat n'est pas un post *de* ce candidat.
const OWNER_SCORE = 100;
const isOwner = (l: { score: number | null; candidate: Candidate | null }) =>
  !!l.candidate && (l.score ?? 0) >= OWNER_SCORE;

interface PostPayload {
  title: string;
  body: string;
  url?: string;
  candidate_id?: string;
  orientation?: string;
  orientations?: string[];
  themes?: string[];
  type?: string;
}

async function callBroadcast(payload: PostPayload, dryRun: boolean) {
  if (dryRun) return { dry: true, payload };
  const r = await fetch(`${SUPABASE_URL}/functions/v1/push-broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify(payload),
  });
  let result: any = null;
  try { result = await r.json(); } catch { /* ignore */ }
  return { status: r.status, payload, sent: result?.sent ?? null, failed: result?.failed ?? null };
}

Deno.serve(async (req) => {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";

  // Par défaut (cron) : le créneau horaire fixe. ?window_min=N (appel manuel)
  // garde l'ancienne fenêtre glissante, bornée à [1, 1440] min pour qu'un
  // appelant ne puisse pas rejouer les notifications sur tout l'historique.
  const windowParam = url.searchParams.get("window_min");
  let sinceDate: Date;
  let untilDate: Date;
  if (windowParam !== null) {
    const rawWindow = Number(windowParam);
    const minutes = Number.isFinite(rawWindow) ? Math.min(Math.max(rawWindow, 1), 1440) : 60;
    untilDate = new Date();
    sinceDate = new Date(untilDate.getTime() - minutes * 60 * 1000);
  } else {
    ({ since: sinceDate, until: untilDate } = currentSlot(new Date()));
  }
  const since = sinceDate.toISOString();
  const until = untilDate.toISOString();
  const publishedSince = new Date(Date.now() - MAX_ITEM_AGE_HOURS * 3600 * 1000).toISOString();

  const { data: newArticles, error } = await supabase
    .from("news_articles")
    .select(`
      id, title, summary, url, published_at, kind,
      source:news_sources(orientation),
      article_candidates(score, candidate:candidates(id, first_name, last_name)),
      article_themes(theme:themes(slug))
    `)
    .gte("fetched_at", since)
    .lt("fetched_at", until)
    .gt("published_at", publishedSince)
    .order("published_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const articles = (newArticles ?? []) as unknown as ArticleRow[];
  const count = articles.length;
  if (count === 0) return Response.json({ count: 0, since, until, skipped: true });

  const dispatched: any[] = [];

  const perCandidate = new Map<string, { candidate: Candidate; twitter: ArticleRow[]; youtube: ArticleRow[] }>();
  for (const a of articles) {
    if (a.kind !== "twitter_post" && a.kind !== "youtube_video") continue;
    for (const link of a.article_candidates ?? []) {
      if (!isOwner(link)) continue;
      const c = link.candidate!;
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
        body: stripRetweetPrefix(a.summary || a.title || "").slice(0, 140) || "Ouvrez CAP 2027 pour le consulter",
        url: a.url, candidate_id: candidate.id, type: "article_social",
      }, dryRun));
    } else if (youtube.length === 1 && twitter.length === 0) {
      const a = youtube[0];
      dispatched.push(await callBroadcast({
        title: `Nouvelle vidéo de ${name}`,
        body: (a.title || "").slice(0, 140) || "Ouvrez CAP 2027 pour la voir",
        url: a.url, candidate_id: candidate.id, type: "article_social",
      }, dryRun));
    } else {
      const total = twitter.length + youtube.length;
      const latest = (twitter[0] ?? youtube[0]);
      let title: string;
      if (twitter.length > 0 && youtube.length === 0) title = `${total} nouveaux posts de ${name}`;
      else if (youtube.length > 0 && twitter.length === 0) title = `${total} nouvelles vidéos de ${name}`;
      else title = `${total} nouvelles publications de ${name}`;
      dispatched.push(await callBroadcast({
        title,
        body: (latest.title || "").slice(0, 140) || "Ouvrez CAP 2027 pour les consulter",
        url: latest.url, candidate_id: candidate.id, type: "article_social",
      }, dryRun));
    }
  }

  const pressArticles = articles.filter((a) => a.kind === "article");
  // Inclure aussi les twitter/youtube SANS candidat propriétaire (ex:
  // chaîne YouTube de Brut, post X d'un média généraliste, même s'ils
  // citent un candidat). Ils tombent comme la presse dans le broadcast par
  // orientation.
  const orphanMedia = articles.filter((a) => {
    if (a.kind !== "twitter_post" && a.kind !== "youtube_video") return false;
    return !(a.article_candidates ?? []).some(isOwner);
  });
  const pressItems = [...pressArticles, ...orphanMedia];
  const pressOrientations = new Set<string>();
  for (const a of pressItems) pressOrientations.add(a.source?.orientation ?? "transverse");
  // Union des thèmes (themes.slug) des nouvelles actus presse. Permet à
  // push-broadcast de filtrer par catégorie suivie (opt-in lenient :
  // un token sans thème suivi reçoit tout).
  const pressThemes = new Set<string>();
  for (const a of pressItems) {
    for (const link of a.article_themes ?? []) {
      const slug = link.theme?.slug;
      if (slug) pressThemes.add(slug);
    }
  }
  if (pressItems.length > 0) {
    const sample = pressItems[0];
    const pressTitle = pressItems.length === 1
      ? "Une nouvelle actualité"
      : `${pressItems.length} nouvelles actualités`;
    dispatched.push(await callBroadcast({
      title: pressTitle,
      body: (sample.title || "").slice(0, 140) || "Ouvrez CAP 2027 pour les consulter",
      url: sample.url,
      orientations: [...pressOrientations],
      themes: [...pressThemes],
      type: "article_press",
    }, dryRun));
  }

  return Response.json({
    count, since, until,
    per_candidate: perCandidate.size,
    press_articles: pressArticles.length,
    orphan_media: orphanMedia.length,
    press_orientations: [...pressOrientations],
    press_themes: [...pressThemes],
    dispatched,
  });
});
