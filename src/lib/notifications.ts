// Lightweight notification layer that doesn't require any backend.
//
// Single source of truth for the user's notif preference. ALL notif
// channels (in-app bell, local OS notif on resume, J-day reminders,
// remote FCM push) are gated by the same flag so the UX is one toggle
// in Settings instead of three.
//
// Default: ON (the user is asked for the OS permission on first launch
// after onboarding completes — see useFirstLaunchPermission).

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

export function getLastSeenAt(): string {
  if (typeof window === 'undefined') return new Date(0).toISOString();
  return localStorage.getItem(LAST_SEEN_KEY) || new Date(0).toISOString();
}

export function markAllSeen() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  window.dispatchEvent(new Event('cap2027:notifications-seen'));
}

/** Master notif preference. Default ON. */
export function getNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(PREF_KEY);
  return v === null ? true : v === 'true';
}

export function setNotificationsEnabled(v: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREF_KEY, v ? 'true' : 'false');
}

function getLastFiredAt(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(LAST_FIRED_KEY) || '0');
}

function setLastFiredAt(ts: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_FIRED_KEY, String(ts));
}

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

export function useResumeNotificationsHook() {
  const qc = useQueryClient();
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onResume = async () => {
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
