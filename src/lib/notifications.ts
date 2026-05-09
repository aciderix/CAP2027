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
const NEXT_ID_KEY = 'cap2027.notifications.nextId';

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
  // Notify other components that the unseen state changed.
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

function nextNotifId(): number {
  if (typeof window === 'undefined') return Math.floor(Math.random() * 1e9);
  const cur = Number(localStorage.getItem(NEXT_ID_KEY) || '1');
  const next = cur >= 2_000_000_000 ? 1 : cur + 1;
  localStorage.setItem(NEXT_ID_KEY, String(next));
  return cur;
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
          id: nextNotifId(),
          title: count === 1 ? 'Une nouvelle actualité' : `${count} nouvelles actualités`,
          body: sample?.title?.slice(0, 140) ?? 'Ouvrir CAP 2027 pour les voir',
          smallIcon: 'ic_stat_icon_config_sample',
          schedule: { at: new Date(Date.now() + 200) },
        },
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

  // Re-render when markAllSeen is called elsewhere
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

// Wire global app-resume handler: every time the app comes back to the
// foreground, refresh our unseen count and fire a local OS notification
// if there's anything new.
export function useResumeNotificationsHook() {
  const qc = useQueryClient();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastFiredAt = 0;

    const onResume = async () => {
      // Force the cache to refetch articles + unseen list now.
      await qc.invalidateQueries({ queryKey: ['unseenArticles'] });
      const data = qc.getQueryData<UnseenArticle[]>(['unseenArticles', getLastSeenAt()]);
      const count = data?.length ?? 0;
      // Don't spam: throttle to one resume notif per 5 minutes.
      if (Date.now() - lastFiredAt < 5 * 60 * 1000) return;
      if (count > 0) {
        lastFiredAt = Date.now();
        fireResumeNotification(count, data?.[0] ?? null);
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void onResume();
    });
  }, [qc]);
}
