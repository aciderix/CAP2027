// Background runner — wakes ~hourly even with the app killed and asks
// Supabase if there are new articles since `lastSeenAt`. If yes, fires
// a local OS notification.
//
// Lives in /public so Vite copies it to /dist, which Capacitor then
// mirrors into the Android assets bundle. Reference path in
// capacitor.config.ts is "background.js".
//
// Runtime: separate isolated JS context (no DOM, no module imports,
// no localStorage). Available globals (per @capacitor/background-runner
// docs): fetch, crypto, console, setTimeout/Interval, addEventListener,
// CapacitorKV (string KV), CapacitorNotifications (schedule).
//
// Each event call instantiates a fresh context — no state persists
// between calls. State must come from CapacitorKV (Capacitor
// Preferences on the foreground side, mirrored from src/lib/notifications.ts).

// Hardcoded Supabase coords. Publishable key, designed to be embedded
// in the client; RLS guards the data. Same values as the GitHub Actions
// workflow and admin/src/lib/supabase.ts.
const SUPABASE_URL = 'https://oyvqvfawcxlnvpgloicx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nycw__S1NdZYIVyu4LH4SQ_830IdXPA';

const LAST_SEEN_KEY = 'cap2027.notifications.lastSeenAt';
const LAST_FIRED_KEY = 'cap2027.notifications.lastResumeFiredAt';
const PREF_KEY = 'cap2027.notifications.enabled';

const RESUME_NOTIF_ID = 9000001;
const SMALL_ICON = 'ic_stat_cap2027';
const LARGE_ICON = 'ic_notif_cap2027';

// Mirrors the foreground throttle exactly so we never double-notify
// when the runner fires and the user opens the app a few seconds later.
const THROTTLE_MS = 5 * 60 * 1000;

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

addEventListener('checkArticles', async (resolve, reject) => {
  try {
    if (!isEnabled()) {
      console.log('[bg] notifications disabled, skipping');
      resolve();
      return;
    }

    if (Date.now() - getLastFired() < THROTTLE_MS) {
      console.log('[bg] throttled (recent notif)');
      resolve();
      return;
    }

    const lastSeen = getLastSeen();

    // Pre-check: ask Supabase for the single most recent published_at.
    // If <= lastSeen, no new articles — bail out. The query hits the
    // existing news_articles_published_idx index, costs <1ms.
    const headRes = await fetch(
      SUPABASE_URL + '/rest/v1/news_articles?select=published_at&order=published_at.desc&limit=1',
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY,
        },
      },
    );
    if (!headRes.ok) {
      console.warn('[bg] head check HTTP ' + headRes.status);
      resolve();
      return;
    }
    const headRows = await headRes.json();
    const head = headRows && headRows[0] ? headRows[0].published_at : null;
    if (!head || Date.parse(head) <= Date.parse(lastSeen)) {
      console.log('[bg] nothing new since ' + lastSeen);
      resolve();
      return;
    }

    // There IS new stuff — fetch the top 5 unseen for a meaningful title.
    const url = SUPABASE_URL + '/rest/v1/news_articles'
      + '?select=id,title,url,published_at'
      + '&published_at=gt.' + encodeURIComponent(lastSeen)
      + '&order=published_at.desc&limit=5';
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
      },
    });
    if (!res.ok) {
      console.warn('[bg] articles fetch HTTP ' + res.status);
      resolve();
      return;
    }
    const articles = await res.json();
    if (!Array.isArray(articles) || articles.length === 0) {
      resolve();
      return;
    }

    const count = articles.length;
    const sample = articles[0];
    const title = count === 1
      ? 'Une nouvelle actualité'
      : count + ' nouvelles actualités';
    const body = (sample && sample.title ? String(sample.title) : '').slice(0, 140)
      || 'Ouvrez CAP 2027 pour les consulter';

    CapacitorNotifications.schedule([
      {
        id: RESUME_NOTIF_ID,
        title: title,
        body: body,
        smallIcon: SMALL_ICON,
        largeIcon: LARGE_ICON,
      },
    ]);

    setLastFired(Date.now());
    console.log('[bg] notified about ' + count + ' articles');
    resolve();
  } catch (err) {
    console.error('[bg] error', String(err));
    reject(err);
  }
});
