// Anonymous device push registration. Marries Capacitor's
// PushNotifications plugin with Supabase: we capture the FCM token
// once, upsert it into public.push_tokens, and refresh last_seen_at
// every time the app starts.
//
// FCM service-account credentials live ONLY on the server (in the
// push-broadcast edge function). Clients never see them.
//
// IMPORTANT: PushNotifications.register() throws a NATIVE
// IllegalStateException on Android when google-services.json is not
// shipped with the APK ("Default FirebaseApp is not initialized").
// That exception escapes JS try/catch on some Capacitor versions and
// surfaces as a "the app has stopped" system dialog. We therefore
// gate the register() call behind an explicit user opt-in flag.
// Default: OFF. The toggle in Settings asks the user to confirm
// Firebase is configured before flipping it on.

import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

const VERSION = '1.0.0';
const ENABLED_KEY = 'cap2027.push.fcm_optin';

export function getPushEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ENABLED_KEY) === 'true';
}

export function setPushEnabled(v: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENABLED_KEY, v ? 'true' : 'false');
}

let registered = false;

/**
 * Lazily import the plugin so Capacitor's native bridge isn't even
 * touched until the user has opted in. Prevents crashes on builds
 * that ship without google-services.json.
 */
async function getPlugin() {
  const mod = await import('@capacitor/push-notifications');
  return mod.PushNotifications;
}

/**
 * Idempotent: safe to call multiple times. Subsequent calls just
 * refresh last_seen_at on the existing token. No-op if the user
 * hasn't explicitly enabled FCM push from the Settings panel.
 */
export async function registerPushNotifications(): Promise<{ ok: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) return { ok: false, error: 'native-only' };
  if (!getPushEnabled()) return { ok: false, error: 'opt-in required' };

  try {
    const PushNotifications = await getPlugin();

    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      const ask = await PushNotifications.requestPermissions();
      if (ask.receive !== 'granted') return { ok: false, error: 'permission denied' };
    }

    if (!registered) {
      registered = true;
      PushNotifications.addListener('registration', async (token) => {
        try {
          await supabase.from('push_tokens').upsert(
            {
              token: token.value,
              platform: Capacitor.getPlatform(),
              app_version: VERSION,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: 'token' },
          );
        } catch { /* best-effort */ }
      });
      PushNotifications.addListener('registrationError', () => {
        // Surfaced in OS logs; nothing actionable client-side.
      });
    }

    await PushNotifications.register();
    return { ok: true };
  } catch (err: any) {
    // Most common: Firebase not initialized -> we surface a clean
    // message back to the caller and let them disable the opt-in.
    return { ok: false, error: String(err?.message ?? err) };
  }
}
