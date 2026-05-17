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
const VERSION = '1.0.0';

export function getWebPushToken(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

let initialized = false;

export async function registerPushWeb(): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined') return { ok: false, error: 'no-window' };
  if (Capacitor.isNativePlatform()) return { ok: false, error: 'native-platform' };
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    return { ok: false, error: 'browser-unsupported' };
  }
  if (!getNotificationsEnabled()) return { ok: false, error: 'opt-in-required' };
  if (initialized) return { ok: true };

  try {
    // Browser permission. If already denied or default, the prompt will
    // open. Some browsers (Firefox, Safari) require this to be triggered
    // by a user gesture — if it fails silently here, the user can retry
    // via the Settings panel.
    let perm: NotificationPermission = Notification.permission;
    if (perm === 'default') {
      try { perm = await Notification.requestPermission(); }
      catch { return { ok: false, error: 'permission-prompt-failed' }; }
    }
    if (perm !== 'granted') return { ok: false, error: 'permission-' + perm };

    // Register the SW that handles background pushes.
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Lazy-load firebase only when we actually need it (mobile path
    // never reaches this line so the modules stay unfetched).
    const { initializeApp } = await import('firebase/app');
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

    const app = initializeApp(FIREBASE_CONFIG);
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return { ok: false, error: 'no-token' };

    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* noop */ }

    // Mirror in push_tokens — same shape as the native upsert in
    // src/lib/push.ts. platform='web' so the server can distinguish if
    // needed (the broadcast function currently treats them the same).
    await supabase.from('push_tokens').upsert(
      {
        token,
        platform: 'web',
        app_version: VERSION,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
    try { window.dispatchEvent(new Event('cap2027:push-token-ready')); }
    catch { /* noop */ }

    onMessage(messaging, (payload) => {
      const t = (payload.data?.type as string | undefined) ?? '';
      void invalidateForPushType(t);

      // The browser doesn't render a system notification for foreground
      // FCM messages by default — we do it manually so the user notices
      // even when buried in another tab inside the same window.
      try {
        if (Notification.permission === 'granted') {
          const title = (payload.notification?.title)
            || (payload.data?.title as string | undefined)
            || 'CAP 2027';
          const body = (payload.notification?.body)
            || (payload.data?.body as string | undefined)
            || '';
          new Notification(title, { body, icon: '/icon-192.png' });
        }
      } catch { /* noop */ }
    });

    initialized = true;
    return { ok: true };
  } catch (e: any) {
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
