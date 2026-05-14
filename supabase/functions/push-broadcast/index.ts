// Sends a push notification to every device token in public.push_tokens
// via the FCM HTTP v1 API.
//
// Requires a Google service account JSON for the Firebase project,
// stored as the FCM_SERVICE_ACCOUNT_JSON edge-function secret.
//
// POST body: { title, body, url?, candidate_id?, orientation? }
//   - candidate_id: when present, only tokens that follow this candidate
//     (per public.push_token_follows) receive the notification. Lets
//     notify-after-ingest dispatch "Nouveau post de X" only to followers.
//   - orientation: when present, only tokens that either have an
//     explicit subscription to this orientation OR have no orientation
//     rows at all (legacy default = receive everything) get the notif.
//     Routed through the tokens_for_press_orientation RPC.
//   - candidate_id wins over orientation if both are set.
//
// GET ?diag=1 returns a non-secret status report (no values leaked):
//   { secret_present, project_id, token_count }.
//
// Response: { sent, failed, totalTokens } on success.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SA = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---- Google service-account → OAuth bearer token (cached in memory) ----

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

  const enc = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsigned = `${enc(header)}.${enc(claims)}`;

  const pem = sa.private_key.replace(/\\n/g, "\n");
  const der = pemToBin(pem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsigned),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsigned}.${sigB64}`;

  const r = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!r.ok) throw new Error(`token exchange ${r.status}: ${await r.text()}`);
  const j = await r.json();
  cachedToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cachedToken.value;
}

function pemToBin(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
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

// ---- Send loop ----

interface SendInput {
  title?: string;
  body?: string;
  url?: string;
  candidate_id?: string;
  orientation?: string;          // single — legacy / per-orientation calls
  orientations?: string[];       // array — single consolidated press notif
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Diag mode: report secret + token state without leaking values.
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
  if (!sa) {
    return Response.json(
      { error: "FCM_SERVICE_ACCOUNT_JSON edge-function secret not set or malformed" },
      { status: 503 },
    );
  }

  let payload: SendInput = {};
  try {
    if (req.method !== "GET") payload = await req.json();
  } catch {
    // empty body is fine; defaults below
  }
  const title = payload.title?.trim() || "Nouvelle actualité";
  const body = payload.body?.trim() || "Ouvrez CAP 2027 pour la consulter";

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e: any) {
    return Response.json({ error: "oauth: " + (e?.message ?? e) }, { status: 502 });
  }
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  // Token selection. Priority:
  //   1. candidate_id      → tokens that follow that candidate
  //   2. orientations[]    → union of all matched orientations (single
  //                           consolidated press notif spanning bords)
  //   3. orientation       → single orientation (legacy / per-bord)
  //   4. (neither)         → broadcast to every registered token
  let tokens: { token: string; platform: string }[] = [];
  if (payload.candidate_id) {
    const { data: follows, error: fErr } = await supabase
      .from("push_token_follows")
      .select("token, push_tokens!inner(platform)")
      .eq("candidate_id", payload.candidate_id);
    if (fErr) {
      return Response.json({ error: "follows query: " + fErr.message }, { status: 500 });
    }
    tokens = (follows ?? []).map((r: any) => ({
      token: r.token,
      platform: r.push_tokens?.platform ?? "android",
    }));
  } else if (payload.orientations && payload.orientations.length > 0) {
    const { data, error: oErr } = await supabase.rpc(
      "tokens_for_press_orientations",
      { orients: payload.orientations },
    );
    if (oErr) {
      return Response.json({ error: "orientations rpc: " + oErr.message }, { status: 500 });
    }
    tokens = (data ?? []) as { token: string; platform: string }[];
  } else if (payload.orientation) {
    const { data, error: oErr } = await supabase.rpc(
      "tokens_for_press_orientation",
      { orient: payload.orientation },
    );
    if (oErr) {
      return Response.json({ error: "orientation rpc: " + oErr.message }, { status: 500 });
    }
    tokens = (data ?? []) as { token: string; platform: string }[];
  } else {
    const { data } = await supabase.from("push_tokens").select("token, platform");
    tokens = (data ?? []) as { token: string; platform: string }[];
  }

  let sent = 0, failed = 0;
  const errors: string[] = [];
  for (const t of tokens) {
    const message = {
      message: {
        token: t.token,
        notification: { title, body },
        data: payload.url ? { url: payload.url } : undefined,
        android: {
          priority: "HIGH",
          notification: {
            channel_id: "default",
            color: "#102a5c",
            icon: "ic_stat_cap2027",
          },
        },
      },
    };
    try {
      const r = await fetch(fcmUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
      if (r.ok) {
        sent++;
      } else {
        failed++;
        const txt = await r.text().catch(() => "");
        if (errors.length < 5) errors.push(`HTTP ${r.status}: ${txt.slice(0, 200)}`);
        // Permanent invalid token → drop from the table to keep future
        // sends fast.
        if (r.status === 404 || r.status === 400) {
          await supabase.from("push_tokens").delete().eq("token", t.token);
        }
      }
    } catch (e: any) {
      failed++;
      if (errors.length < 5) errors.push("net: " + (e?.message ?? e));
    }
  }

  return Response.json({
    sent,
    failed,
    totalTokens: tokens.length,
    candidate_id: payload.candidate_id ?? null,
    orientation: payload.orientation ?? null,
    orientations: payload.orientations ?? null,
    sample_errors: errors,
  });
});
