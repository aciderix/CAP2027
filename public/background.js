// Background runner — wakes ~hourly even with the app killed and asks
// Supabase for new content since `lastSeenAt`. If yes, fires a local
// OS notification.
//
// Two notif paths handled here:
//   1. New articles (or YouTube videos / X posts via news_sources).
//      If the user follows specific candidates, the query is scoped
//      to those candidates only — they don't get pinged about the
//      whole campaign. If they follow nobody, fall back to global.
//   2. New candidate published in the admin console.
//
// Lives in /public so Vite copies it to /dist, which Capacitor then
// mirrors into the Android assets bundle. Reference path in
// capacitor.config.ts is "background.js".
//
// Runtime: separate isolated JS context (no DOM, no module imports,
// no localStorage). Available globals (per @capacitor/background-runner
// docs): fetch, crypto, console, setTimeout/Interval, addEventListener,
// CapacitorKV (string KV), CapacitorNotifications (schedule).

// Hardcoded Supabase coords. Publishable key, designed to be embedded
// in the client; RLS guards the data. Same values as the GitHub Actions
// workflow and admin/src/lib/supabase.ts.
const SUPABASE_URL = 'https://oyvqvfawcxlnvpgloicx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nycw__S1NdZYIVyu4LH4SQ_830IdXPA';

const LAST_SEEN_KEY = 'cap2027.notifications.lastSeenAt';
const LAST_FIRED_KEY = 'cap2027.notifications.lastResumeFiredAt';
const PREF_KEY = 'cap2027.notifications.enabled';
const FOLLOWS_KEY = 'cap2027.followedCandidates';

// New-candidate detection state. Tracks the most recent
// candidates.created_at we've already notified about, plus a 24 h
// throttle so a batch admin import never fires more than one notif.
const LAST_CAND_CHECK_KEY = 'cap2027.notifications.lastCandidateCreatedAt';
const LAST_CAND_FIRED_KEY = 'cap2027.notifications.lastCandidateFiredAt';
const CANDIDATE_THROTTLE_MS = 24 * 60 * 60 * 1000;

const ARTICLE_NOTIF_ID = 9000001;
const CANDIDATE_NOTIF_ID = 9000002;

const SMALL_ICON = 'ic_stat_cap2027';
const LARGE_ICON = 'ic_notif_cap2027';

// Mirrors the foreground throttle exactly so we never double-notify
// when the runner fires and the user opens the app a few seconds later.
const THROTTLE_MS = 5 * 60 * 1000;

// ---------- KV helpers ----------

function kvGet(key) {
  try {
    const r = CapacitorKV.get(key);
    return r && r.value ? r.value : null;
  } catch (e) {
    return null;
  }
}

function kvSet(key, value) {
  try {
    CapacitorKV.set(key, value);
  } catch (e) {
    // best-effort
  }
}

function isEnabled() {
  // Default ON, matches getNotificationsEnabled() on the foreground side.
  const v = kvGet(PREF_KEY);
  return v === null ? true : v === 'true';
}

function getLastSeen() {
  return kvGet(LAST_SEEN_KEY) || new Date(0).toISOString();
}

function getLastFired() {
  return Number(kvGet(LAST_FIRED_KEY) || '0');
}

function setLastFired(ts) {
  kvSet(LAST_FIRED_KEY, String(ts));
}

function getFollowedIds() {
  // Mirror written by src/lib/follows.ts. JSON-encoded array of UUIDs.
  const raw = kvGet(FOLLOWS_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function getLastCandidateCheck() {
  return kvGet(LAST_CAND_CHECK_KEY);
}

function setLastCandidateCheck(iso) {
  kvSet(LAST_CAND_CHECK_KEY, iso);
}

function getLastCandidateFired() {
  return Number(kvGet(LAST_CAND_FIRED_KEY) || '0');
}

function setLastCandidateFired(ts) {
  kvSet(LAST_CAND_FIRED_KEY, String(ts));
}

// ---------- Supabase REST helpers ----------

const baseHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + SUPABASE_KEY,
};

async function sbGet(path) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: baseHeaders });
  if (!res.ok) {
    console.warn('[bg] sbGet ' + path + ' → HTTP ' + res.status);
    return null;
  }
  return res.json();
}

// ---------- Articles check ----------

async function checkArticles(lastSeen, followedIds) {
  if (followedIds.length > 0) {
    // Scoped to the candidates the user follows. We hit
    // article_candidates with an inner join filter, so PostgREST
    // returns only rows whose related news_articles.published_at is
    // newer than lastSeen.
    const inList = followedIds
      .map((id) => '"' + id.replace(/"/g, '\\"') + '"')
      .join(',');
    const rows = await sbGet(
      'article_candidates'
        + '?candidate_id=in.(' + encodeURIComponent(inList) + ')'
        + '&select=candidate_id,article:news_articles!inner(id,title,url,published_at,kind)'
        + '&article.published_at=gt.' + encodeURIComponent(lastSeen)
        + '&order=article(published_at).desc'
        + '&limit=20',
    );
    if (!Array.isArray(rows)) return null;
    // Dedupe — an article tagged on N followed candidates returns N rows.
    const seen = new Set();
    const articles = [];
    let firstFollowedCandidateId = null;
    for (const r of rows) {
      const a = r && r.article;
      if (!a || !a.id || seen.has(a.id)) continue;
      seen.add(a.id);
      articles.push(a);
      if (!firstFollowedCandidateId) firstFollowedCandidateId = r.candidate_id;
    }
    return { articles: articles.slice(0, 5), scoped: true, firstFollowedCandidateId };
  }

  // No follows → global. Pre-check max(published_at) first to avoid
  // a heavier query when nothing is new.
  const head = await sbGet(
    'news_articles?select=published_at&order=published_at.desc&limit=1',
  );
  if (!Array.isArray(head)) return null;
  const max = head[0] && head[0].published_at;
  if (!max || Date.parse(max) <= Date.parse(lastSeen)) {
    return { articles: [], scoped: false, firstFollowedCandidateId: null };
  }
  const articles = await sbGet(
    'news_articles'
      + '?select=id,title,url,published_at,kind'
      + '&published_at=gt.' + encodeURIComponent(lastSeen)
      + '&order=published_at.desc&limit=5',
  );
  if (!Array.isArray(articles)) return null;
  return { articles, scoped: false, firstFollowedCandidateId: null };
}

async function getCandidateLastName(id) {
  const rows = await sbGet(
    'candidates?select=last_name&id=eq.' + encodeURIComponent(id) + '&limit=1',
  );
  return Array.isArray(rows) && rows[0] ? rows[0].last_name : null;
}

// ---------- New-candidate check ----------

async function checkNewCandidates() {
  if (Date.now() - getLastCandidateFired() < CANDIDATE_THROTTLE_MS) {
    return null;
  }

  // First run: bootstrap from the latest published candidate so we
  // don't notify retroactively about the entire seed list.
  let lastCheck = getLastCandidateCheck();
  if (!lastCheck) {
    const seedRows = await sbGet(
      'candidates?select=created_at&is_published=eq.true&order=created_at.desc&limit=1',
    );
    const seed = Array.isArray(seedRows) && seedRows[0]
      ? seedRows[0].created_at
      : new Date().toISOString();
    setLastCandidateCheck(seed);
    return null;
  }

  const rows = await sbGet(
    'candidates'
      + '?is_published=eq.true'
      + '&created_at=gt.' + encodeURIComponent(lastCheck)
      + '&select=id,first_name,last_name,created_at,parties(name,abbreviation)'
      + '&order=created_at.desc&limit=5',
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return rows;
}

function buildCandidateNotif(candidates) {
  if (candidates.length === 1) {
    const c = candidates[0];
    const name = (c.first_name + ' ' + c.last_name).trim();
    const partyName = c.parties && (c.parties.name || c.parties.abbreviation);
    const body = partyName
      ? "Découvrez sa fiche dans CAP 2027 — " + partyName
      : "Découvrez sa fiche dans CAP 2027.";
    return {
      title: 'Nouveau candidat publié : ' + name,
      body: body,
    };
  }
  // Multiple at once (admin batch). Keep it generic.
  const names = candidates
    .slice(0, 3)
    .map((c) => (c.last_name || '').trim())
    .filter(Boolean)
    .join(', ');
  return {
    title: candidates.length + ' nouveaux candidats publiés',
    body: names ? names + ' — découvrez leurs fiches dans CAP 2027.' : 'Découvrez leurs fiches dans CAP 2027.',
  };
}

function articleKindLabel(kind) {
  if (kind === 'youtube_video') return 'vidéo';
  if (kind === 'mastodon_post' || kind === 'bluesky_post') return 'publication';
  return 'actualité';
}

async function buildArticleNotif(check) {
  const count = check.articles.length;
  if (count === 0) return null;
  const sample = check.articles[0];
  const sampleTitle = (sample && sample.title ? String(sample.title) : '').slice(0, 140);

  if (check.scoped) {
    // We know the user follows these candidates. Try to mention the
    // first followed candidate by name to make the notif specific.
    const lastName = check.firstFollowedCandidateId
      ? await getCandidateLastName(check.firstFollowedCandidateId)
      : null;
    const kind = articleKindLabel(sample && sample.kind);
    const title = lastName
      ? (count === 1
          ? 'Nouvelle ' + kind + ' : ' + lastName
          : count + ' nouveautés de vos candidats suivis')
      : (count === 1 ? 'Une nouveauté de vos candidats suivis' : count + ' nouveautés de vos candidats suivis');
    const body = sampleTitle || 'Ouvrez CAP 2027 pour les consulter';
    return { title: title, body: body };
  }

  // Unfiltered (no follows).
  return {
    title: count === 1 ? 'Une nouvelle actualité' : count + ' nouvelles actualités',
    body: sampleTitle || 'Ouvrez CAP 2027 pour les consulter',
  };
}

function fireNotification(id, title, body) {
  CapacitorNotifications.schedule([
    {
      id: id,
      title: title,
      body: body,
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
    },
  ]);
}

// ---------- Event entrypoint ----------

addEventListener('checkArticles', async (resolve, reject) => {
  try {
    if (!isEnabled()) {
      console.log('[bg] notifications disabled, skipping');
      resolve();
      return;
    }

    // 1. New-candidate check first — independent from the article
    // throttle, since it has its own 24 h cooldown and is much rarer.
    const newCandidates = await checkNewCandidates();
    if (newCandidates && newCandidates.length > 0) {
      const candNotif = buildCandidateNotif(newCandidates);
      fireNotification(CANDIDATE_NOTIF_ID, candNotif.title, candNotif.body);
      setLastCandidateFired(Date.now());
      // Advance the high-water mark so we don't re-notify next wake.
      setLastCandidateCheck(newCandidates[0].created_at);
      console.log('[bg] notified about ' + newCandidates.length + ' new candidate(s)');
      // Don't also fire an article notif in the same wake — keep the
      // user's notification shade clean.
      resolve();
      return;
    }

    // 2. Article check, throttled to avoid double-notifying with the
    // foreground hook.
    if (Date.now() - getLastFired() < THROTTLE_MS) {
      console.log('[bg] articles throttled (recent notif)');
      resolve();
      return;
    }

    const lastSeen = getLastSeen();
    const followedIds = getFollowedIds();

    const check = await checkArticles(lastSeen, followedIds);
    if (!check || check.articles.length === 0) {
      console.log('[bg] nothing new for user' + (followedIds.length ? ' (scoped)' : ' (global)'));
      resolve();
      return;
    }

    const notif = await buildArticleNotif(check);
    if (notif) {
      fireNotification(ARTICLE_NOTIF_ID, notif.title, notif.body);
      setLastFired(Date.now());
      console.log('[bg] notified about ' + check.articles.length + ' articles ' + (check.scoped ? '(scoped)' : '(global)'));
    }

    resolve();
  } catch (err) {
    console.error('[bg] error', String(err));
    reject(err);
  }
});
