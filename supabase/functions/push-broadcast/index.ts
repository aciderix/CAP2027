// Sends a push notification to every device token in public.push_tokens
// via the FCM HTTP v1 API.
//
// Requires a Google service account JSON for the Firebase project,
// stored as the FCM_SERVICE_ACCOUNT_JSON edge-function secret. The
// service account needs the "Firebase Cloud Messaging API" enabled
// and the firebaseadmin role.
//
// POST body: { title: string, body: string, url?: string }
// Response: { sent: int, failed: int, totalTokens: int }

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

// ---- Send loop ----

interface SendInput {
  title: string;
  body: string;
  url?: string;
}

Deno.serve(async (req) => {
  if (!FCM_SA) {
    return Response.json(
      { error: "FCM_SERVICE_ACCOUNT_JSON edge function secret not set" },
      { status: 503 },
    );
  }

  let payload: SendInput;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!payload.title || !payload.body) {
    return Response.json({ error: "title and body required" }, { status: 400 });
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(FCM_SA);
  } catch {
    return Response.json({ error: "FCM_SERVICE_ACCOUNT_JSON malformed" }, { status: 500 });
  }

  const accessToken = await getAccessToken(sa);
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token, platform");

  let sent = 0, failed = 0;
  for (const t of (tokens ?? []) as { token: string; platform: string }[]) {
    const message = {
      message: {
        token: t.token,
        notification: { title: payload.title, body: payload.body },
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
        // Permanent invalid token → drop it from the table to keep
        // future sends fast.
        if (r.status === 404 || r.status === 400) {
          await supabase.from("push_tokens").delete().eq("token", t.token);
        }
      }
    } catch {
      failed++;
    }
  }

  await supabase.from("push_broadcasts").insert({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? null,
    sent_count: sent,
    failed_count: failed,
  });

  return Response.json({ sent, failed, totalTokens: tokens?.length ?? 0 });
});
