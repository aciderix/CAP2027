// Lightweight notification layer with two trigger paths:
//
//   1. Foreground / resume — fires a local OS notif when the app comes
//      back to the user (cold launch, multitask resume, browser focus).
//   2. Background — see `background.js` (the `@capacitor/background-runner`
//      worker), which polls Supabase ~hourly even with the app killed.
//
// Both share the same throttle key (LAST_FIRED_KEY), mirrored to
// Capacitor Preferences so the worker (separate JS context, no
// localStorage) can read foreground state and vice-versa.
//
// Default user preference: notifications ON. The OS prompt is asked
// once after onboarding completes (see maybeAskFirstLaunchPermission).

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from './supabase';

const LAST_SEEN_KEY = 'cap2027.notifications.lastSeenAt';
const PREF_KEY = 'cap2027.notifications.enabled';
const FIRST_ASK_KEY = 'cap2027.notifications.firstAskDone';
const LAST_FIRED_KEY = 'cap2027.notifications.lastResumeFiredAt';

const RESUME_NOTIF_ID = 9_000_001;
const SMALL_ICON = 'ic_stat_cap2027';
const LARGE_ICON = 'ic_notif_cap2027';
const ICON_COLOR = '#102a5c';

export interface UnseenArticle {
  id: string;
  title: string;
  url: string;
  published_at: string;
  source_name: string | null;
  source_color: string | null;
  is_factcheck: boolean;
}

// ---------------- Preferences mirror -----------------------------------
//
// Background runner can only read Capacitor Preferences (no DOM /
// localStorage). We keep localStorage as the sync source of truth for
// the React UI but mirror writes to Preferences so the worker stays in
// sync. On foreground startup we also read Preferences and reconcile
// (take MAX of any timestamps) so a notif fired by the runner doesn't
// trigger a duplicate when the user opens the app a few seconds later.

async function prefSet(key: string, value: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
  } catch {
    // best-effort
  }
}

async function prefGet(key: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key });
    return value;
  } catch {
    return null;
  }
}

// ---------------- Last-seen marker -------------------------------------

export function getLastSeenAt(): string {
  if (typeof window === 'undefined') return new Date(0).toISOString();
  return localStorage.getItem(LAST_SEEN_KEY) || new Date(0).toISOString();
}

export function markAllSeen() {
  if (typeof window === 'undefined') return;
  const now = new Date().toISOString();
  localStorage.setItem(LAST_SEEN_KEY, now);
  void prefSet(LAST_SEEN_KEY, now);
  window.dispatchEvent(new Event('cap2027:notifications-seen'));
}

// ---------------- User preference --------------------------------------

/** Master notif preference. Default ON. */
export function getNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(PREF_KEY);
  return v === null ? true : v === 'true';
}

export function setNotificationsEnabled(v: boolean) {
  if (typeof window === 'undefined') return;
  const s = v ? 'true' : 'false';
  localStorage.setItem(PREF_KEY, s);
  void prefSet(PREF_KEY, s);
}

// ---------------- Resume throttle --------------------------------------

function getLastFiredAt(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(LAST_FIRED_KEY) || '0');
}

function setLastFiredAt(ts: number) {
  if (typeof window === 'undefined') return;
  const s = String(ts);
  localStorage.setItem(LAST_FIRED_KEY, s);
  void prefSet(LAST_FIRED_KEY, s);
}

/** On startup, pull any newer values written by the background runner. */
async function reconcileFromPreferences(): Promise<void> {
  if (!Capacitor.isNativePlatform() || typeof window === 'undefined') return;
  const [firedRaw, seenRaw] = await Promise.all([
    prefGet(LAST_FIRED_KEY),
    prefGet(LAST_SEEN_KEY),
  ]);
  if (firedRaw) {
    const remote = Number(firedRaw);
    if (Number.isFinite(remote) && remote > getLastFiredAt()) {
      localStorage.setItem(LAST_FIRED_KEY, String(remote));
    }
  }
  if (seenRaw) {
    const remote = Date.parse(seenRaw);
    const local = Date.parse(getLastSeenAt());
    if (Number.isFinite(remote) && remote > local) {
      localStorage.setItem(LAST_SEEN_KEY, seenRaw);
    }
  }
}

// ---------------- First-launch permission prompt -----------------------

/**
 * Ask for notification permission once, on the first app launch
 * after onboarding completes. Re-asking on subsequent launches is
 * intrusive; if the user denied, they need to toggle in Settings,
 * which triggers a fresh prompt.
 */
export async function maybeAskFirstLaunchPermission(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!Capacitor.isNativePlatform()) return;
  if (localStorage.getItem(FIRST_ASK_KEY) === 'true') return;
  localStorage.setItem(FIRST_ASK_KEY, 'true');
  try {
    await LocalNotifications.requestPermissions();
  } catch {
    // best-effort
  }
}

/** Returns true if both the user pref AND the OS permission are granted. */
export async function notificationsActive(): Promise<boolean> {
  if (!getNotificationsEnabled()) return false;
  if (!Capacitor.isNativePlatform()) return true; // web fallback uses bell
  try {
    const perm = await LocalNotifications.checkPermissions();
    return perm.display === 'granted';
  } catch {
    return false;
  }
}

// ---------------- Notification firing ----------------------------------

export async function fireResumeNotification(count: number, sample: UnseenArticle | null) {
  if (!getNotificationsEnabled()) return;
  if (!Capacitor.isNativePlatform()) return;
  if (count <= 0) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: RESUME_NOTIF_ID,
          title: count === 1 ? 'Une nouvelle actualité' : `${count} nouvelles actualités`,
          body: sample?.title?.slice(0, 140) ?? 'Ouvrez CAP 2027 pour les consulter',
          smallIcon: SMALL_ICON,
          largeIcon: LARGE_ICON,
          iconColor: ICON_COLOR,
          schedule: { at: new Date(Date.now() + 200) },
        } as any,
      ],
    });
  } catch {
    // best-effort
  }
}

// ---------------- React hooks ------------------------------------------

export function useUnseenArticles() {
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => qc.invalidateQueries({ queryKey: ['unseenArticles'] });
    window.addEventListener('cap2027:notifications-seen', handler);
    return () => window.removeEventListener('cap2027:notifications-seen', handler);
  }, [qc]);

  const lastSeen = getLastSeenAt();

  const query = useQuery({
    queryKey: ['unseenArticles', lastSeen],
    queryFn: async (): Promise<UnseenArticle[]> => {
      const { data, error } = await supabase
        .from('news_articles')
        .select('id, title, url, published_at, is_factcheck, source:news_sources(name, color)')
        .gt('published_at', lastSeen)
        .order('published_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        published_at: r.published_at,
        source_name: r.source?.name ?? null,
        source_color: r.source?.color ?? null,
        is_factcheck: r.is_factcheck,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const count = useMemo(() => query.data?.length ?? 0, [query.data]);
  return { count, articles: query.data ?? [], isLoading: query.isLoading };
}

/**
 * Fires the foreground "you missed N articles" notif on:
 *   - cold launch (mount)
 *   - app resume (Capacitor App.appStateChange — more reliable than
 *     visibilitychange on Android WebView)
 *   - browser tab visibilitychange (web/PWA fallback)
 *
 * Throttled by LAST_FIRED_KEY (5 min), shared with the background
 * runner via Preferences so we never fire two notifs back-to-back.
 */
export function useResumeNotificationsHook() {
  const qc = useQueryClient();
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const checkAndNotify = async () => {
      if (cancelled) return;
      // appConfig drives useAdminChangeSync — refresh it on every resume
      // so the counter check sees the latest server value, even if the
      // 5 min staleTime would otherwise skip the refetch. Cheap query
      // (3-4 rows). Fire-and-forget; useAdminChangeSync's useEffect
      // re-runs automatically when its data changes.
      void qc.refetchQueries({ queryKey: ['appConfig'] });
      // Throttle: 5 min between any resume/background notifs
      if (Date.now() - getLastFiredAt() < 5 * 60 * 1000) return;
      try {
        // Force a fresh fetch — don't trust stale cache for the
        // gating decision since this drives an OS notification.
        await qc.refetchQueries({ queryKey: ['unseenArticles'] });
        const data = qc.getQueryData<UnseenArticle[]>(['unseenArticles', getLastSeenAt()]);
        const count = data?.length ?? 0;
        if (count > 0) {
          setLastFiredAt(Date.now());
          await fireResumeNotification(count, data?.[0] ?? null);
        }
      } catch {
        // best-effort
      }
    };

    // 1. Cold launch: reconcile state from Preferences (the runner may
    // have fired while we were closed) and run a check.
    void (async () => {
      await reconcileFromPreferences();
      void checkAndNotify();
    })();

    // 2. Capacitor App lifecycle: more reliable than visibilitychange
    // on Android WebView for resume-from-background.
    let removeAppListener: (() => void) | null = null;
    if (Capacitor.isNativePlatform()) {
      void import('@capacitor/app').then(async ({ App }) => {
        if (cancelled) return;
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            void (async () => {
              await reconcileFromPreferences();
              void checkAndNotify();
            })();
          }
        });
        removeAppListener = () => { void handle.remove(); };
      });
    }

    // 3. Browser fallback (PWA / dev).
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') void checkAndNotify();
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', visibilityHandler);
      if (removeAppListener) removeAppListener();
    };
  }, [qc]);
}
