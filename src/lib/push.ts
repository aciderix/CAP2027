// Anonymous device push registration. Marries Capacitor's
// PushNotifications plugin with Supabase: we capture the FCM token
// once, upsert it into public.push_tokens, and refresh last_seen_at
// every time the app starts.
//
// FCM service-account credentials live ONLY on the server (in the
// push-broadcast edge function). Clients never see them.

import { Capacitor } from '@capacitor/core';
import { PushNotifications, type Token } from '@capacitor/push-notifications';
import { supabase } from './supabase';

const VERSION = '1.0.0';
const ENABLED_KEY = 'cap2027.push.enabled';

export function getPushEnabled(): boolean {
  if (typeof window === 'undefined') return true; // default ON
  const v = localStorage.getItem(ENABLED_KEY);
  return v === null ? true : v === 'true';
}

export function setPushEnabled(v: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENABLED_KEY, v ? 'true' : 'false');
}

let registered = false;

/**
 * Idempotent: safe to call multiple times. Subsequent calls just
 * refresh last_seen_at on the existing token.
 */
export async function registerPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!getPushEnabled()) return;

  // Permission check / request — Android 13+ requires a runtime grant.
  try {
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      const ask = await PushNotifications.requestPermissions();
      if (ask.receive !== 'granted') return;
    }
  } catch {
    return;
  }

  if (!registered) {
    registered = true;
    PushNotifications.addListener('registration', async (token: Token) => {
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
      } catch {
        // best-effort
      }
    });
    PushNotifications.addListener('registrationError', () => {
      // surfaced in OS logs; nothing actionable client-side
    });
  }

  try {
    await PushNotifications.register();
  } catch {
    // best-effort
  }
}
