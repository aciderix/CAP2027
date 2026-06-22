// Per-device subscription to news CATEGORIES (themes.slug: "ecologie",
// "economie", "institutions" [= Institutions & Politique], "immigration",
// "securite", "international", "societe"/"social", etc.). Filters the PRESS
// push notifications by topic, exactly like orientationFollows filters them
// by political leaning.
//
// Semantics: opt-in restrictif but lenient default (identical to
// orientationFollows):
//   - Empty set    → receive ALL press notifs (no topic filter).
//   - Non-empty    → receive only press notifs whose articles carry one of
//                    the selected themes.
//
// Architecture mirrors lib/orientationFollows.ts: localStorage source of
// truth, Capacitor Preferences mirror (for the background runner), and a
// server-side mirror in public.push_token_themes so the FCM broadcast can
// fan out correctly. Plain INSERT only (RLS) + SECURITY DEFINER RPCs
// (unfollow_theme / clear_themes) for deletion.

import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { getPushToken } from './push';
import { getWebPushToken } from './pushWeb';

const KEY = 'cap2027.followedThemes';

// Slug of the "politics" theme used by the "actualités politiques
// uniquement" shortcut (themes.name = "Institutions & Politique").
export const POLITICS_THEME_SLUG = 'institutions';

function getActivePushToken(): string | null {
  return getPushToken() ?? getWebPushToken();
}

function read(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function mirrorToPreferences(arr: string[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: KEY, value: JSON.stringify(arr) });
  } catch {
    // best-effort
  }
}

async function pushOneThemeToDb(theme: string) {
  const token = getActivePushToken();
  if (!token) return;
  try {
    const { error } = await supabase
      .from('push_token_themes')
      .insert({ token, theme });
    if (error && (error as any).code !== '23505') {
      // best-effort; the next syncAllToDb run will retry
    }
  } catch {
    // best-effort
  }
}

async function deleteOneThemeFromDb(theme: string) {
  const token = getActivePushToken();
  if (!token) return;
  // SECURITY DEFINER RPC — without a SELECT policy a plain DELETE by anon
  // matches 0 rows under RLS (see orientationFollows.ts).
  try {
    await supabase.rpc('unfollow_theme', { p_token: token, p_theme: theme });
  } catch {
    // best-effort
  }
}

async function clearThemesInDb() {
  const token = getActivePushToken();
  if (!token) return;
  try {
    await supabase.rpc('clear_themes', { p_token: token });
  } catch {
    // best-effort
  }
}

async function syncAllThemesToDb() {
  const token = getActivePushToken();
  if (!token) return;
  const all = [...read()];
  if (all.length === 0) return;
  await Promise.all(all.map((t) => pushOneThemeToDb(t)));
}

function write(set: Set<string>) {
  if (typeof window === 'undefined') return;
  const arr = [...set];
  localStorage.setItem(KEY, JSON.stringify(arr));
  void mirrorToPreferences(arr);
  window.dispatchEvent(new Event('cap2027:themes-changed'));
}

export function useFollowedThemes() {
  const [followed, setFollowed] = useState<Set<string>>(read);

  useEffect(() => {
    void mirrorToPreferences([...read()]);
    void syncAllThemesToDb();
  }, []);

  useEffect(() => {
    const sync = () => setFollowed(read());
    const onTokenReady = () => { void syncAllThemesToDb(); };
    window.addEventListener('storage', sync);
    window.addEventListener('cap2027:themes-changed', sync);
    window.addEventListener('cap2027:push-token-ready', onTokenReady);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('cap2027:themes-changed', sync);
      window.removeEventListener('cap2027:push-token-ready', onTokenReady);
    };
  }, []);

  const isFollowed = useCallback(
    (theme: string) => followed.has(theme),
    [followed],
  );

  const toggle = useCallback((theme: string) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      const was = next.has(theme);
      if (was) next.delete(theme);
      else next.add(theme);
      write(next);
      if (was) void deleteOneThemeFromDb(theme);
      else void pushOneThemeToDb(theme);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setFollowed(new Set());
    write(new Set());
    void clearThemesInDb();
  }, []);

  // Replace the whole selection with exactly `slugs`. Used by the
  // "actualités politiques uniquement" shortcut. Reconciles the DB by
  // clearing then re-inserting (cheap: at most a handful of rows).
  const setOnly = useCallback((slugs: string[]) => {
    const next = new Set(slugs);
    setFollowed(next);
    write(next);
    void (async () => {
      await clearThemesInDb();
      await Promise.all(slugs.map((s) => pushOneThemeToDb(s)));
    })();
  }, []);

  return { followed, isFollowed, toggle, clear, setOnly };
}
