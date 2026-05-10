// Anonymous device push registration + foreground listener.
//
// Architecture:
//   1. On app start (post-permission), Capacitor PushNotifications
//      registers with FCM and surfaces a token → upserted in
//      public.push_tokens.
//   2. The push-broadcast edge function (called by ingest-rss after
//      new inserts) iterates all tokens and sends a notification
//      payload via FCM HTTP v1.
//   3. On Android, the FCM payload includes a notification block so
//      it always renders even if the app is in "stopped" state. The
//      data block carries optional candidate hints; the foreground
//      pushNotificationReceived listener only re-fires a polished
//      LocalNotification when the app is in foreground (Android
//      otherwise renders the system notif itself).
//
// This is layered on top of the WorkManager background runner
// (public/background.js) which still acts as the fallback when FCM
// is unreachable (Huawei without GMS, custom ROMs, etc.).

import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { getNotificationsEnabled } from './notifications';

const VERSION = '1.0.0';
const DIAG_KEY = 'cap2027.push.diag';

export interface PushDiag {
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

let registered = false;

async function getPlugin() {
  const mod = await import('@capacitor/push-notifications');
  return mod.PushNotifications;
}

/**
 * Idempotent. Safe to call from multiple places (App mount + Settings
 * toggle) — duplicate listeners are guarded by the `registered` flag.
 *
 * Returns { ok, error } so the caller can surface the failure mode in
 * UI without throwing.
 */
export async function registerPushNotifications(): Promise<{ ok: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    writeDiag({ lastError: 'native-only' });
    return { ok: false, error: 'native-only' };
  }
  if (!getNotificationsEnabled()) {
    writeDiag({ lastError: 'opt-in required' });
    return { ok: false, error: 'opt-in required' };
  }

  try {
    const PushNotifications = await getPlugin();

    let perm = await PushNotifications.checkPermissions();
    writeDiag({ permission: perm.receive as any });
    if (perm.receive !== 'granted') {
      const ask = await PushNotifications.requestPermissions();
      writeDiag({ permission: ask.receive as any });
      if (ask.receive !== 'granted') {
        writeDiag({ lastError: 'permission denied' });
        return { ok: false, error: 'permission denied' };
      }
      perm = ask;
    }

    if (!registered) {
      registered = true;

      PushNotifications.addListener('registration', async (token) => {
        const preview = token.value.slice(0, 16) + '…';
        writeDiag({ tokenAt: new Date().toISOString(), tokenPreview: preview });
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
      });

      PushNotifications.addListener('registrationError', (err: any) => {
        writeDiag({ registrationError: String(err?.error ?? err?.message ?? err) });
      });

      // Foreground notif arrives — Android by default does NOT render
      // the system notif when the app is in foreground; we'd just see
      // it appear in the bell on next refresh. For a more visible UX,
      // re-fire a LocalNotification ourselves so the user sees a banner.
      PushNotifications.addListener('pushNotificationReceived', async (notif) => {
        writeDiag({ lastNotifAt: new Date().toISOString() });
        // Bell will refresh on the next visibility / focus event;
        // nothing else to do — the OS already handled the notif when
        // the app was in background. In foreground, a banner via
        // LocalNotifications would feel intrusive (the user is
        // looking at the app), so we skip.
        void notif;
      });

      // Tap: nothing to do beyond the OS opening the app. We keep the
      // listener so Capacitor doesn't warn about missing handlers.
      PushNotifications.addListener('pushNotificationActionPerformed', () => {
        /* noop — opening the app is enough */
      });
    }

    writeDiag({ registerCalledAt: new Date().toISOString(), lastError: undefined });
    await PushNotifications.register();
    return { ok: true };
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    writeDiag({ lastError: msg });
    return { ok: false, error: msg };
  }
}
