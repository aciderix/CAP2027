// Lightweight notification layer that doesn't require any backend.
//
// - Tracks the timestamp of the last article a user has seen, in localStorage.
// - Exposes a useUnseenArticles hook returning a fresh count + recent list.
// - Triggers a local OS notification (Capacitor) when the app comes to the
//   foreground and there is at least one new article since the last visit.
//
// True push notifications when the app is closed need FCM + a backend; we
// intentionally stay local-only here so the project remains free to host.

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from './supabase';

const LAST_SEEN_KEY = 'cap2027.notifications.lastSeenAt';
const PERM_KEY = 'cap2027.notifications.enabled';
const LAST_FIRED_KEY = 'cap2027.notifications.lastResumeFiredAt';

// Stable IDs for our system notifications. Using a fixed ID for the
// "resume" alert means Android replaces the previous one instead of
// stacking duplicates — even if the listener somehow runs twice.
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

export function getLastSeenAt(): string {
  if (typeof window === 'undefined') return new Date(0).toISOString();
  return localStorage.getItem(LAST_SEEN_KEY) || new Date(0).toISOString();
}

export function markAllSeen() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  window.dispatchEvent(new Event('cap2027:notifications-seen'));
}

export function getNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PERM_KEY) === 'true';
}

export function setNotificationsEnabled(v: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PERM_KEY, v ? 'true' : 'false');
}

export async function requestOsNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const status = await LocalNotifications.requestPermissions();
    return status.display === 'granted';
  } catch {
    return false;
  }
}

function getLastFiredAt(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(LAST_FIRED_KEY) || '0');
}

function setLastFiredAt(ts: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_FIRED_KEY, String(ts));
}

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
          // Stable ID: scheduling a new one with the same ID replaces the
          // existing notification rather than adding a duplicate.
          id: RESUME_NOTIF_ID,
          title: count === 1 ? 'Une nouvelle actualité' : `${count} nouvelles actualités`,
          body: sample?.title?.slice(0, 140) ?? 'Ouvrir CAP 2027 pour les voir',
          smallIcon: SMALL_ICON,
          largeIcon: LARGE_ICON,
          iconColor: ICON_COLOR,
          schedule: { at: new Date(Date.now() + 200) },
        } as any,
      ],
    });
  } catch {
    // best-effort, swallow
  }
}

// Hook used by the bell icon: query for unseen articles since the local
// "last seen" cursor. Refetched as part of the regular article cache.
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

// Wire global app-resume handler. Designed to be safe even if the hook
// happens to mount twice (HMR, fast-refresh, accidental remounts):
//   - the listener is properly cleaned up on unmount
//   - the throttle is shared across instances via localStorage
//   - the resulting OS notification uses a stable ID so duplicates merge.
export function useResumeNotificationsHook() {
  const qc = useQueryClient();
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onResume = async () => {
      // Throttle to one resume notif per 5 min, shared across all listeners.
      if (Date.now() - getLastFiredAt() < 5 * 60 * 1000) return;
      await qc.invalidateQueries({ queryKey: ['unseenArticles'] });
      const data = qc.getQueryData<UnseenArticle[]>(['unseenArticles', getLastSeenAt()]);
      const count = data?.length ?? 0;
      if (count > 0) {
        setLastFiredAt(Date.now());
        fireResumeNotification(count, data?.[0] ?? null);
      }
    };

    const handler = () => {
      if (document.visibilityState === 'visible') void onResume();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [qc]);
}
