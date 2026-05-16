// Anonymous device push registration + foreground listener.
//
// Architecture:
//   1. On app start (post-permission), Capacitor PushNotifications
//      registers with FCM and surfaces a token → upserted in
//      public.push_tokens.
//   2. The push-broadcast edge function (called by notify-after-ingest
//      after each ingest) iterates all tokens and sends a notification
//      payload via FCM HTTP v1.
//   3. On Android, the FCM payload includes a notification block so
//      it always renders even if the app is in "stopped" state.
//
// This is layered on top of the WorkManager background runner
// (public/background.js) which still acts as the fallback when FCM
// is unreachable (Huawei without GMS, custom ROMs, etc.).
//
// Defensive: every step writes a progress checkpoint to the diag
// before/after, every native call has a 10 s timeout. If the native
// bridge is missing (cap sync didn't run, plugin not in
// capacitor.plugins.json, etc.) we surface "step X timed out" in the
// Settings panel rather than leaving the user staring at empty rows.

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';
import { getNotificationsEnabled } from './notifications';
import { queryClient } from './queryClient';

const VERSION = '1.0.0';
const DIAG_KEY = 'cap2027.push.diag';
const TOKEN_KEY = 'cap2027.push.token';
const NATIVE_CALL_TIMEOUT_MS = 10_000;

/** Latest FCM device token, set after a successful registration. Used
 *  by lib/follows.ts to mirror per-candidate follows into the
 *  push_token_follows table so the server can target push notifs. */
export function getPushToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export interface PushDiag {
  step?: string;
  permission?: 'granted' | 'denied' | 'prompt' | 'unknown';
  registerCalledAt?: string;
  tokenAt?: string;
  tokenPreview?: string;
  upsertOk?: boolean;
  upsertError?: string;
  registrationError?: string;
  lastNotifAt?: string;
  lastError?: string;
}

export function readPushDiag(): PushDiag {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(DIAG_KEY) || '{}'); }
  catch { return {}; }
}

function writeDiag(patch: Partial<PushDiag>) {
  if (typeof window === 'undefined') return;
  const cur = readPushDiag();
  const next = { ...cur, ...patch };
  try { localStorage.setItem(DIAG_KEY, JSON.stringify(next)); } catch { /* noop */ }
}

let listenersInstalled = false;

// Map a push payload's `data.type` to the TanStack Query keys that should
// be invalidated when the notification is received OR acted upon. Shared
// between `pushNotificationReceived` (foreground), `pushNotificationAction-
// Performed` (tap on system tray notif), and the cold-start replay that
// processes `getDeliveredNotifications()` for notifs that arrived while
// the app was killed.
//
// Without this, the persisted TanStack cache (24 h staleTime on reference
// data, 1 h on appConfig) would keep showing pre-notification content
// until the user manually clears app storage.
async function invalidateForPushType(t: string | undefined): Promise<void> {
  try {
    switch (t) {
      case 'candidate_published':
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['candidatesList'] }),
          queryClient.invalidateQueries({ queryKey: ['comparateurCandidates'] }),
          queryClient.invalidateQueries({ queryKey: ['candidatesByIds'] }),
          queryClient.invalidateQueries({ queryKey: ['matchPropositions'] }),
        ]);
        break;
      case 'candidate_updated':
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['candidatesList'] }),
          queryClient.invalidateQueries({ queryKey: ['candidateDetail'] }),
          queryClient.invalidateQueries({ queryKey: ['comparateurCandidates'] }),
          queryClient.invalidateQueries({ queryKey: ['candidatesByIds'] }),
        ]);
        break;
      case 'new_programme':
        await queryClient.invalidateQueries({ queryKey: ['candidateDetail'] });
        break;
      case 'date_official':
        await queryClient.invalidateQueries({ queryKey: ['appConfig'] });
        break;
      case 'parrainages_update':
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['parrainagesLatest'] }),
          queryClient.invalidateQueries({ queryKey: ['parrainagesAll'] }),
          queryClient.invalidateQueries({ queryKey: ['parrainagesForCandidate'] }),
          queryClient.invalidateQueries({ queryKey: ['appConfig'] }),
        ]);
        break;
      case 'election_results_published':
        // Round 1 or round 2 results just landed. Invalidate the results
        // queries, the app_config (controls visibility), and the candidate
        // lists (eliminated candidates were auto-unpublished server-side
        // by publish_round_results).
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['electionResults'] }),
          queryClient.invalidateQueries({ queryKey: ['appConfig'] }),
          queryClient.invalidateQueries({ queryKey: ['candidatesList'] }),
          queryClient.invalidateQueries({ queryKey: ['comparateurCandidates'] }),
          queryClient.invalidateQueries({ queryKey: ['candidatesByIds'] }),
          queryClient.invalidateQueries({ queryKey: ['matchPropositions'] }),
        ]);
        break;
      case 'article_press':
      case 'article_social':
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['articles'] }),
          queryClient.invalidateQueries({ queryKey: ['myFeedArticles'] }),
          queryClient.invalidateQueries({ queryKey: ['featuredHero'] }),
          queryClient.invalidateQueries({ queryKey: ['unseenArticles'] }),
        ]);
        break;
      case 'election_milestone':
      default:
        // Election milestone notifs (eve/day/results/proc/etc.) carry no
        // in-app data change beyond appConfig timing, which is already
        // covered by the date_official path when the date flips.
        break;
    }
  } catch {
    // best-effort — invalidate failures don't affect the notif itself
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timed out: ' + label)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/**
 * Idempotent. Safe to call from multiple places (App mount + Settings
 * toggle) — duplicate listeners are guarded by `listenersInstalled`.
 *
 * Returns { ok, error } so the caller can surface the failure mode in
 * UI without throwing.
 */
export async function registerPushNotifications(): Promise<{ ok: boolean; error?: string }> {
  writeDiag({ step: 'entered', lastError: undefined });

  if (!Capacitor.isNativePlatform()) {
    writeDiag({ step: 'web — skipping', lastError: 'native-only' });
    return { ok: false, error: 'native-only' };
  }
  if (!getNotificationsEnabled()) {
    writeDiag({ step: 'opt-in required', lastError: 'opt-in required' });
    return { ok: false, error: 'opt-in required' };
  }

  try {
    writeDiag({ step: 'checkPermissions' });
    let perm = await withTimeout(
      PushNotifications.checkPermissions(),
      NATIVE_CALL_TIMEOUT_MS,
      'checkPermissions',
    );
    writeDiag({ permission: perm.receive as any, step: 'checkPermissions ok' });

    if (perm.receive !== 'granted') {
      writeDiag({ step: 'requestPermissions' });
      const ask = await withTimeout(
        PushNotifications.requestPermissions(),
        NATIVE_CALL_TIMEOUT_MS,
        'requestPermissions',
      );
      writeDiag({ permission: ask.receive as any, step: 'requestPermissions ok' });
      if (ask.receive !== 'granted') {
        writeDiag({ lastError: 'permission denied' });
        return { ok: false, error: 'permission denied' };
      }
      perm = ask;
    }

    if (!listenersInstalled) {
      listenersInstalled = true;
      writeDiag({ step: 'installing listeners' });

      PushNotifications.addListener('registration', async (token) => {
        const preview = token.value.slice(0, 16) + '…';
        writeDiag({ tokenAt: new Date().toISOString(), tokenPreview: preview, step: 'token received' });
        try {
          localStorage.setItem(TOKEN_KEY, token.value);
        } catch { /* noop */ }
        try {
          const { error } = await supabase.from('push_tokens').upsert(
            {
              token: token.value,
              platform: Capacitor.getPlatform(),
              app_version: VERSION,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: 'token' },
          );
          if (error) {
            writeDiag({ upsertOk: false, upsertError: error.message });
          } else {
            writeDiag({ upsertOk: true, upsertError: undefined });
          }
        } catch (e: any) {
          writeDiag({ upsertOk: false, upsertError: String(e?.message ?? e) });
        }
        // Tell lib/follows.ts a token is now available so it can mirror
        // any locally-stored follows into push_token_follows. Fired even
        // on token refresh: the row's PK is (token, candidate_id), so a
        // refreshed token will start an empty server-side follow set
        // and this re-sync repopulates it.
        try { window.dispatchEvent(new Event('cap2027:push-token-ready')); }
        catch { /* noop */ }
      });

      PushNotifications.addListener('registrationError', (err: any) => {
        writeDiag({ registrationError: String(err?.error ?? err?.message ?? err) });
      });

      PushNotifications.addListener('pushNotificationReceived', async (notif) => {
        writeDiag({ lastNotifAt: new Date().toISOString() });
        const t = (notif?.data as { type?: string } | undefined)?.type;
        await invalidateForPushType(t);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', async (action) => {
        // Fired when the user taps a notification that was shown by the
        // system while the app was in background or killed. Without this,
        // tapping a "Résultats du 1er tour" notif opens the app on the
        // stale persisted TanStack cache (staleTime 1 h–24 h) and the
        // user has to clear app data to see the new content. Same
        // invalidation as the foreground listener.
        const t = (action?.notification?.data as { type?: string } | undefined)?.type;
        await invalidateForPushType(t);
      });
    }

    writeDiag({ registerCalledAt: new Date().toISOString(), step: 'register' });
    await withTimeout(PushNotifications.register(), NATIVE_CALL_TIMEOUT_MS, 'register');
    writeDiag({ step: 'register call returned' });

    // Catch the "app killed when notif arrived, user opened the app
    // afterwards without tapping the notif" case. Read every delivered
    // notification still in the system tray, invalidate caches matching
    // their data.type, then dismiss them so we don't re-process on the
    // next cold launch.
    try {
      const delivered = await PushNotifications.getDeliveredNotifications();
      const types = new Set<string>();
      for (const n of delivered?.notifications ?? []) {
        const t = (n.data as { type?: string } | undefined)?.type;
        if (t) types.add(t);
      }
      for (const t of types) await invalidateForPushType(t);
      if (delivered?.notifications?.length) {
        await PushNotifications.removeDeliveredNotifications({ notifications: delivered.notifications });
      }
    } catch {
      // best-effort — failure here doesn't affect registration
    }

    return { ok: true };
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    writeDiag({ lastError: msg });
    return { ok: false, error: msg };
  }
}
