// Anonymous device push registration. Marries Capacitor's
// PushNotifications plugin with Supabase: we capture the FCM token
// once, upsert it into public.push_tokens, and refresh last_seen_at
// every time the app starts.

import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

const VERSION = '1.0.0';

import { getNotificationsEnabled } from './notifications';
export const getPushEnabled = getNotificationsEnabled;
export function setPushEnabled(_v: boolean) { /* no-op */ }

// Diagnostic state surfaced to Settings. Updated from listeners so we
// can tell the user *why* a token didn't show up in the DB.
const DIAG_KEY = 'cap2027.push.diag';

export interface PushDiag {
  permission?: 'granted' | 'denied' | 'prompt' | 'unknown';
  registerCalledAt?: string;
  tokenAt?: string;
  tokenPreview?: string;
  upsertOk?: boolean;
  upsertError?: string;
  registrationError?: string;
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

export async function registerPushNotifications(): Promise<{ ok: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    writeDiag({ lastError: 'native-only' });
    return { ok: false, error: 'native-only' };
  }
  if (!getPushEnabled()) {
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
