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
import { App as CapApp } from '@capacitor/app';
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
// Maps a notification payload `type` to the TanStack Query keys that
// should be invalidated. Called from both `pushNotificationReceived`
// (foreground delivery) and `pushNotificationActionPerformed` (user tap,
// including cold start from a killed app). Without the second
// entry point the in-app data lagged a full staleTime cycle behind
// the notification.
async function invalidateForNotificationType(t: string | undefined): Promise<void> {
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
        break;
    }
  } catch {
    // best-effort — invalidate failures don't affect the notif itself
  }
}

let appStateListenerInstalled = false;
let lastInactiveAt: number | null = null;
const RESUME_INVALIDATE_THRESHOLD_MS = 30 * 1000; // ignore <30s blur/focus flicker

// Installs a single Capacitor App.appStateChange listener that
// invalidates every TanStack Query when the app becomes active again
// after being backgrounded for more than 30 s. Covers the gap left by
// push listeners (which only fire while the OS still has the JS thread
// alive) and by refetchOnWindowFocus (unreliable on Android WebView
// cold-resume from the launcher or a notification tap).
export function installAppStateInvalidator() {
  if (appStateListenerInstalled) return;
  appStateListenerInstalled = true;
  void CapApp.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      lastInactiveAt = Date.now();
      return;
    }
    const wasBackgroundedFor = lastInactiveAt ? Date.now() - lastInactiveAt : Infinity;
    lastInactiveAt = null;
    if (wasBackgroundedFor < RESUME_INVALIDATE_THRESHOLD_MS) return;
    writeDiag({ resumeInvalidateAt: new Date().toISOString(), bgMs: wasBackgroundedFor });
    // Invalidate everything — mounted observers refetch immediately,
    // unmounted ones refetch on next mount. Cheap because most queries
    // already have appropriate staleTime defaults.
    queryClient.invalidateQueries();
  });
}

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
        await invalidateForNotificationType((notif?.data as { type?: string } | undefined)?.type);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', async (action) => {
        // Fires when the user taps a system notification — including cold
        // start cases where pushNotificationReceived never fired (app
        // killed/backgrounded). Without this, the in-app data stays
        // stale even though the notification was acted on.
        writeDiag({ lastTapAt: new Date().toISOString() });
        const t = (action?.notification?.data as { type?: string } | undefined)?.type;
        await invalidateForNotificationType(t);
      });

      // Catch-all for cases the push listeners miss: app resumed from
      // background after a notif was handled entirely by the system,
      // or after a long sleep. WebView focus events on Android Capacitor
      // are unreliable, so refetchOnWindowFocus alone isn't enough.
      installAppStateInvalidator();
    }

    writeDiag({ registerCalledAt: new Date().toISOString(), step: 'register' });
    await withTimeout(PushNotifications.register(), NATIVE_CALL_TIMEOUT_MS, 'register');
    writeDiag({ step: 'register call returned' });
    return { ok: true };
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    writeDiag({ lastError: msg });
    return { ok: false, error: msg };
  }
}
