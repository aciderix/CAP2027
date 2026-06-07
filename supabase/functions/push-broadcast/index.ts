// Sends a push notification to every device token in public.push_tokens
// via the FCM HTTP v1 API.
//
// Requires a Google service account JSON for the Firebase project,
// stored as the FCM_SERVICE_ACCOUNT_JSON edge-function secret.
//
// AUTHENTICATION (issue #5): this function is destructive (can push to
// every device) so it rejects unauthenticated callers. A request is
// authorized when EITHER:
//   - Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>  (the
//     notify-after-ingest / dispatch-election-reminders edge functions
//     already call with this), OR
//   - x-push-token: <push_broadcast_secret>  (the DB triggers send this;
//     the secret lives in Vault and is read via the
//     public.get_push_broadcast_secret() RPC).
// verify_jwt stays false because the publishable/secret key format isn't
// a JWT; we do our own check below.
//
// POST body: { title, body, url?, candidate_id?, orientation?, orientations?, type? }
//   - candidate_id wins; then orientations[]; then orientation; else broadcast
//   - type is a category tag forwarded as FCM data.type; the client
//     reads it on reception to invalidate the right TanStack Query
//     keys (see lib/push.ts pushNotificationReceived).
//
// Quiet hours: a guard at the top silences non-critical types between
// the configured Paris-time window (default 22h-7h). election_milestone
// and date_official bypass the filter. Configured via app_config
// row 'push.quiet_hours' = { enabled, start_paris, end_paris }.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SA = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Notification types that bypass the quiet-hours window. Reserved for
// payloads the user MUST receive in real time regardless of the hour:
// election-day reminders (eve/day/results), inscription/procuration
// deadlines, official date flips. Everything else (articles, candidate
// updates, programmes, etc.) is silenced during the nightly window.
const QUIET_BYPASS_TYPES = new Set(["election_milestone", "date_official"]);

// Mapping notif type -> canal mutable par l'utilisateur (table
// push_token_muted_channels). Un type absent de ce mapping (notamment
// les rappels électoraux: election_milestone, date_official,
// election_results_published, parrainages_update) n'est jamais filtré —
// il passe à tous les destinataires ciblés.
const TYPE_TO_CHANNEL: Record<string, string> = {
  article_press: "news_press",
  article_social: "candidates_followed",
  candidate_updated: "candidates_updates",
  new_programme: "candidates_updates",
  candidate_published: "candidates_updates",
  match_proposition_change: "candidates_updates",
};

// Shared secret expected in the x-push-token header, read from Vault via
// the get_push_broadcast_secret() RPC and cached for the lifetime of the
// (warm) function instance.
let cachedSecret: string | null = null;
async function getExpectedSecret(): Promise<string | null> {
  if (cachedSecret) return cachedSecret;
  const { data, error } = await supabase.rpc("get_push_broadcast_secret");
  if (error) return null;
  cachedSecret = typeof data === "string" && data.length > 0 ? data : null;
  return cachedSecret;
}

async function isAuthorized(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  if (bearer && bearer === SERVICE_ROLE_KEY) return true;
  const pushToken = req.headers.get("x-push-token");
  if (!pushToken) return false;
  const expected = await getExpectedSecret();
  return !!expected && pushToken === expected;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}
let cachedToken: { value: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };
  const header = { alg: "RS256", typ: "JWT" };
  const enc = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsigned = `${enc(header)}.${enc(claims)}`;
  const pem = sa.private_key.replace(/\\n/g, "\n");
  const der = pemToBin(pem);
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(unsigned));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${unsigned}.${sigB64}`;
  const r = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!r.ok) throw new Error(`token exchange ${r.status}: ${await r.text()}`);
  const j = await r.json();
  cachedToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cachedToken.value;
}

function pemToBin(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

function parseServiceAccount(): ServiceAccount | null {
  if (!FCM_SA) return null;
  try { return JSON.parse(FCM_SA); } catch { return null; }
}

interface SendInput {
  title?: string;
  body?: string;
  url?: string;
  candidate_id?: string;
  orientation?: string;
  orientations?: string[];
  type?: string;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Reject unauthenticated callers (issue #5). Applies to every mode,
  // including ?diag=1 which previously leaked project/token metadata.
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (url.searchParams.get("diag") === "1") {
    const sa = parseServiceAccount();
    const { count } = await supabase.from("push_tokens").select("token", { count: "exact", head: true });
    return Response.json({
      secret_present: !!FCM_SA,
      secret_parses: !!sa,
      project_id: sa?.project_id ?? null,
      client_email_domain: sa?.client_email ? sa.client_email.split("@")[1] : null,
      token_count: count ?? 0,
    });
  }

  const sa = parseServiceAccount();
  if (!sa) return Response.json({ error: "FCM_SERVICE_ACCOUNT_JSON edge-function secret not set or malformed" }, { status: 503 });

  let payload: SendInput = {};
  try { if (req.method !== "GET") payload = await req.json(); } catch { /* empty */ }
  const title = payload.title?.trim() || "Nouvelle actualité";
  const body = payload.body?.trim() || "Ouvrez CAP 2027 pour la consulter";

  // Quiet hours guard. Silences non-critical pushes during the
  // configured nightly window (Europe/Paris). election_milestone and
  // date_official bypass the filter — those carry voter-actionable
  // info that must reach the user even at night. All other types
  // (articles, candidate updates, programmes, results, etc.) are
  // dropped here; the content stays in DB and the user picks it up
  // via the resume-hook + admin-counter sync next time they open
  // the app. Configurable via app_config['push.quiet_hours'].
  if (!QUIET_BYPASS_TYPES.has(payload.type ?? "")) {
    const { data: qhRow } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "push.quiet_hours")
      .maybeSingle();
    const qh = (qhRow?.value ?? null) as
      | { enabled?: boolean; start_paris?: number; end_paris?: number }
      | null;
    if (qh?.enabled) {
      const start = typeof qh.start_paris === "number" ? qh.start_paris : 22;
      const end = typeof qh.end_paris === "number" ? qh.end_paris : 7;
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      const parisHour =
        Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
      const inQuietWindow = start > end
        ? parisHour >= start || parisHour < end
        : parisHour >= start && parisHour < end;
      if (inQuietWindow) {
        return Response.json({
          skipped: true,
          reason: "quiet_hours",
          type: payload.type ?? null,
          paris_hour: parisHour,
          window: { start_paris: start, end_paris: end },
        });
      }
    }
  }

  let accessToken: string;
  try { accessToken = await getAccessToken(sa); }
  catch (e: any) { return Response.json({ error: "oauth: " + (e?.message ?? e) }, { status: 502 }); }
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  let tokens: { token: string; platform: string }[] = [];
  if (payload.candidate_id) {
    const { data: follows, error: fErr } = await supabase
      .from("push_token_follows")
      .select("token, push_tokens!inner(platform)")
      .eq("candidate_id", payload.candidate_id);
    if (fErr) return Response.json({ error: "follows query: " + fErr.message }, { status: 500 });
    tokens = (follows ?? []).map((r: any) => ({ token: r.token, platform: r.push_tokens?.platform ?? "android" }));
  } else if (payload.orientations && payload.orientations.length > 0) {
    const { data, error: oErr } = await supabase.rpc("tokens_for_press_orientations", { orients: payload.orientations });
    if (oErr) return Response.json({ error: "orientations rpc: " + oErr.message }, { status: 500 });
    tokens = (data ?? []) as { token: string; platform: string }[];
  } else if (payload.orientation) {
    const { data, error: oErr } = await supabase.rpc("tokens_for_press_orientation", { orient: payload.orientation });
    if (oErr) return Response.json({ error: "orientation rpc: " + oErr.message }, { status: 500 });
    tokens = (data ?? []) as { token: string; platform: string }[];
  } else {
    const { data } = await supabase.from("push_tokens").select("token, platform");
    tokens = (data ?? []) as { token: string; platform: string }[];
  }

  // Toggle maître: exclure les tokens dont l'utilisateur a coupé toutes
  // les notifs (push_tokens.enabled = false). S'applique à TOUS les types,
  // rappels électoraux compris — couper le maître = opt-out total. Lenient:
  // en cas d'erreur, on n'exclut personne.
  if (tokens.length > 0) {
    const { data: disabled, error: dErr } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("enabled", false);
    if (!dErr && disabled && disabled.length > 0) {
      const disabledSet = new Set(disabled.map((r: any) => r.token));
      tokens = tokens.filter((t) => !disabledSet.has(t.token));
    }
  }

  // Filtre par canal: si ce type de notif correspond à un canal mutable,
  // on retire les tokens qui ont coupé ce canal. Lenient: en cas
  // d'erreur de lecture, on n'exclut personne (aucune notif perdue).
  const channel = payload.type ? TYPE_TO_CHANNEL[payload.type] : undefined;
  if (channel && tokens.length > 0) {
    const { data: muted, error: mErr } = await supabase
      .from("push_token_muted_channels")
      .select("token")
      .eq("channel", channel);
    if (!mErr && muted) {
      const mutedSet = new Set(muted.map((r: any) => r.token));
      if (mutedSet.size > 0) tokens = tokens.filter((t) => !mutedSet.has(t.token));
    }
  }

  let sent = 0, failed = 0;
  const errors: string[] = [];
  for (const t of tokens) {
    const fcmData: Record<string, string> = {};
    if (payload.url) fcmData.url = payload.url;
    if (payload.type) fcmData.type = payload.type;
    if (payload.candidate_id) fcmData.candidate_id = payload.candidate_id;

    // Per-platform payload using the FCM v1 platform-specific overrides
    // (`webpush.notification` / `android.notification`). This is the
    // clean FCM v1 way: one logical message, each platform picks the
    // block that fits.
    // - Web tokens: `webpush.notification` makes FCM emit a standard
    //   Web Push payload that the browser renders natively. No reliance
    //   on our SW's onBackgroundMessage, so no double-notif on Firefox
    //   AND Chrome Android actually gets the push (the previous
    //   data-only approach caused "push service error / code 20" on
    //   Chrome Android because the SW push-event path was broken).
    // - Native Android tokens (Capacitor): keep the legacy `notification`
    //   block + `android.notification` so the OS renders the notif when
    //   the app is killed.
    // deno-lint-ignore no-explicit-any
    let message: any;
    if (t.platform === "web") {
      // deno-lint-ignore no-explicit-any
      const webNotif: any = {
        title,
        body,
        icon: "/icon-192.png",
        badge: "/favicon-32.png",
      };
      if (payload.type) webNotif.tag = payload.type;
      message = {
        message: {
          token: t.token,
          data: Object.keys(fcmData).length > 0 ? fcmData : undefined,
          webpush: { notification: webNotif },
        },
      };
    } else {
      message = {
        message: {
          token: t.token,
          notification: { title, body },
          data: Object.keys(fcmData).length > 0 ? fcmData : undefined,
          android: { priority: "HIGH", notification: { channel_id: "default", color: "#102a5c", icon: "ic_stat_cap2027" } },
        },
      };
    }
    try {
      const r = await fetch(fcmUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      if (r.ok) { sent++; }
      else {
        failed++;
        const txt = await r.text().catch(() => "");
        const errSummary = `HTTP ${r.status} platform=${t.platform} token=${t.token.slice(0, 24)}… body=${txt.slice(0, 300)}`;
        console.error("[push-broadcast] FCM send failed", errSummary);
        if (errors.length < 10) errors.push(errSummary);
        if (r.status === 404 || r.status === 400) {
          await supabase.from("push_tokens").delete().eq("token", t.token);
        }
      }
    } catch (e: any) {
      failed++;
      if (errors.length < 5) errors.push("net: " + (e?.message ?? e));
    }
  }

  console.log(`[push-broadcast] type=${payload.type ?? "?"} totalTokens=${tokens.length} sent=${sent} failed=${failed}`);
  return Response.json({
    sent, failed,
    totalTokens: tokens.length,
    candidate_id: payload.candidate_id ?? null,
    orientation: payload.orientation ?? null,
    orientations: payload.orientations ?? null,
    type: payload.type ?? null,
    sample_errors: errors,
  });
});
