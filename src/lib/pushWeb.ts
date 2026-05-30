// Web Push registration via Firebase JS SDK. Mirror of src/lib/push.ts
// for the web platform.
//
// On Android Capacitor this module is an idempotent no-op (early-return
// guarded by isNativePlatform). All firebase modules are dynamically
// imported so they're not even fetched on mobile — saves ~80 KB gzipped.
//
// The Web Push token is stored in the SAME public.push_tokens table as
// native tokens, just with platform='web'. The push-broadcast edge
// function loops over every token regardless of platform — FCM HTTP v1
// accepts both, the same RPCs (push_token_follows,
// push_token_orientations) gate which devices receive each push, and
// the quiet-hours / type filters apply identically.
//
// Foreground onMessage runs the same data.type switch as push.ts so
// cache invalidation behaves the same way. Background notifs (closed
// tab / minimized window) are rendered by /firebase-messaging-sw.js;
// the resume hook + admin-counter sync already cover the "user opens
// the tab without clicking the notif" case.

import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { getNotificationsEnabled } from './notifications';
import { queryClient } from './queryClient';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD1QptOBNFbJgeX9Ilg4K7_6Ztfp7vmEi4',
  authDomain: 'cap2027-app.firebaseapp.com',
  projectId: 'cap2027-app',
  storageBucket: 'cap2027-app.firebasestorage.app',
  messagingSenderId: '762607884594',
  appId: '1:762607884594:web:cc4eb1734a0eeaf309df2b',
};
const VAPID_KEY = 'BKMqQ0WoNk3--CAmgZVchbQhI3J-XNvdAmEmL-dpb-Dar0ceFFx1iKSdt3s5QCMZCLAgfH10s2BhacXL7ewbtfc';

const TOKEN_KEY = 'cap2027.pushWeb.token';
const DIAG_KEY = 'cap2027.pushWeb.diag';
const VERSION = '1.0.0';

// Diagnostic ring kept in localStorage so users can paste their state
// from Settings or DevTools when reporting "no notif received".
function writeDiag(patch: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    const prev = JSON.parse(localStorage.getItem(DIAG_KEY) || '{}');
    localStorage.setItem(DIAG_KEY, JSON.stringify({ ...prev, ...patch, at: new Date().toISOString() }));
  } catch { /* noop */ }
}

export function readWebPushDiag(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(DIAG_KEY) || '{}'); }
  catch { return {}; }
}

export function getWebPushToken(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

let initialized = false;

export async function registerPushWeb(): Promise<{ ok: boolean; error?: string }> {
  writeDiag({ step: 'entered' });
  if (typeof window === 'undefined') return { ok: false, error: 'no-window' };
  if (Capacitor.isNativePlatform()) { writeDiag({ step: 'native-platform-skip' }); return { ok: false, error: 'native-platform' }; }
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    writeDiag({ step: 'browser-unsupported' });
    return { ok: false, error: 'browser-unsupported' };
  }
  if (!getNotificationsEnabled()) { writeDiag({ step: 'opt-in-required' }); return { ok: false, error: 'opt-in-required' }; }
  if (initialized) return { ok: true };

  try {
    // Browser permission. If already denied or default, the prompt will
    // open. Some browsers (Firefox, Safari) require this to be triggered
    // by a user gesture — if it fails silently here, the user can retry
    // via the Settings panel.
    let perm: NotificationPermission = Notification.permission;
    writeDiag({ step: 'permission-check', permission: perm });
    if (perm === 'default') {
      try { perm = await Notification.requestPermission(); }
      catch (e) { console.error('[pushWeb] permission prompt failed', e); writeDiag({ step: 'permission-prompt-failed', error: String(e) }); return { ok: false, error: 'permission-prompt-failed' }; }
    }
    if (perm !== 'granted') { writeDiag({ step: 'permission-denied', permission: perm }); return { ok: false, error: 'permission-' + perm }; }

    // Register the SW that handles background pushes.
    writeDiag({ step: 'sw-registering' });
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    writeDiag({ step: 'sw-registered', swScope: swReg.scope });

    // Lazy-load firebase only when we actually need it (mobile path
    // never reaches this line so the modules stay unfetched).
    writeDiag({ step: 'firebase-import' });
    const { initializeApp } = await import('firebase/app');
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

    writeDiag({ step: 'firebase-init' });
    const app = initializeApp(FIREBASE_CONFIG);
    const messaging = getMessaging(app);

    writeDiag({ step: 'getToken-start' });
    let token: string;
    try {
      token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });
    } catch (e: any) {
      // Chrome (especially on Xiaomi/MIUI) sometimes keeps a stale
      // PushSubscription cached at the browser level that's no longer
      // valid for the push service. The classic symptom is `getToken`
      // throwing AbortError code 20 "Registration failed - push service
      // error" with no way to recover other than unsubscribing the old
      // sub first. We try that once, then retry getToken.
      console.warn('[pushWeb] getToken first attempt failed, clearing stale subscription and retrying', e);
      writeDiag({ step: 'getToken-retry', firstError: String(e?.message ?? e), firstCode: e?.code });
      try {
        const existing = await swReg.pushManager.getSubscription();
        if (existing) {
          await existing.unsubscribe();
          writeDiag({ step: 'unsubscribed-stale' });
        } else {
          writeDiag({ step: 'no-stale-sub-found' });
        }
      } catch (uErr: any) {
        writeDiag({ step: 'unsubscribe-failed', error: String(uErr?.message ?? uErr) });
      }
      try {
        token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });
      } catch (e2: any) {
        console.error('[pushWeb] getToken failed after retry', e2);
        writeDiag({ step: 'getToken-failed', error: String(e2?.message ?? e2), code: e2?.code });
        return { ok: false, error: 'getToken: ' + String(e2?.message ?? e2) };
      }
    }
    if (!token) { writeDiag({ step: 'getToken-empty' }); return { ok: false, error: 'no-token' }; }
    writeDiag({ step: 'token-acquired', tokenPreview: token.slice(0, 24) });

    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* noop */ }

    // Mirror in push_tokens via the SECURITY DEFINER RPC — same path as
    // the native registration in src/lib/push.ts. We go through the RPC
    // (not a direct upsert) because the hardened RLS policies on
    // push_tokens expose INSERT/UPDATE only, with no SELECT — an
    // `upsert ... onConflict` would need to read the conflicting row and
    // fail. The RPC performs the `insert ... on conflict do update`
    // server-side. platform='web' so the broadcast can distinguish.
    const { error: rpcError } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: 'web',
      p_app_version: VERSION,
    });
    if (rpcError) { console.error('[pushWeb] RPC register_push_token failed', rpcError); writeDiag({ step: 'rpc-failed', error: rpcError.message }); return { ok: false, error: rpcError.message }; }
    writeDiag({ step: 'rpc-ok' });
    try { window.dispatchEvent(new Event('cap2027:push-token-ready')); }
    catch { /* noop */ }

    onMessage(messaging, (payload) => {
      const t = (payload.data?.type as string | undefined) ?? '';
      void invalidateForPushType(t);

      // The browser doesn't render a system notification for foreground
      // FCM messages by default — we do it manually so the user notices
      // even when buried in another tab inside the same window. Tagged
      // by type to de-duplicate with the SW's onBackgroundMessage if
      // both fire (some browsers do, others don't).
      try {
        if (Notification.permission === 'granted') {
          const title = (payload.notification?.title)
            || (payload.data?.title as string | undefined)
            || 'CAP 2027';
          const body = (payload.notification?.body)
            || (payload.data?.body as string | undefined)
            || '';
          const tag = (payload.data?.type as string | undefined) || 'cap2027';
          new Notification(title, { body, icon: '/icon-192.png', tag });
        }
      } catch { /* noop */ }
    });

    initialized = true;
    writeDiag({ step: 'initialized' });
    return { ok: true };
  } catch (e: any) {
    console.error('[pushWeb] unexpected error', e);
    writeDiag({ step: 'unexpected-error', error: String(e?.message ?? e) });
    return { ok: false, error: String(e?.message ?? e) };
  }
}

async function invalidateForPushType(t: string): Promise<void> {
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
      case 'match_proposition_change':
        await queryClient.invalidateQueries({ queryKey: ['matchPropositions'] });
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
      default:
        break;
    }
  } catch { /* noop */ }
}
