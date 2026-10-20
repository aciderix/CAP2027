// Per-device subscription to news_sources.orientation buckets (see
// ORIENTATION_ORDER). Drives both the in-app NewsFeed filter and the
// push-broadcast filter for press notifs.
//
// Semantics: opt-in restrictif but lenient default.
//   - Empty set    → receive ALL press notifs / no in-app filter.
//   - Non-empty    → receive only the selected orientations / feed
//                    restricted to them.
//
// Architecture mirrors lib/follows.ts: localStorage source of truth,
// Capacitor Preferences mirror (for the background runner), and a
// server-side mirror in public.push_token_orientations so the FCM
// broadcast can fan out correctly. Plain INSERT/DELETE only — no
// SELECT/UPDATE policy needed (see follows.ts for the rationale).

import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { getPushToken } from './push';
import { getWebPushToken } from './pushWeb';

// Left to right, then the off-axis buckets. Media are placed from how
// their Wikipedia article describes them (see the Méthodologie modal).
export const ORIENTATION_ORDER = [
  'extreme-gauche', 'gauche', 'centre-gauche', 'centre', 'centre-droit', 'droite', 'extreme-droite',
  'transverse', 'factcheck',
];

const KEY = 'cap2027.followedOrientations';

// October 2026: "extreme-gauche", "centre-gauche" and "extreme-droite"
// were split out of "gauche", "centre" and "droite". A device that
// followed one of the old buckets also follows the new one once, so it
// keeps receiving the sources it chose (Le Monde, Valeurs actuelles…).
const SPLIT_KEY = 'cap2027.followedOrientations.split2026';
const SPLITS: Record<string, string> = {
  gauche: 'extreme-gauche',
  centre: 'centre-gauche',
  droite: 'extreme-droite',
};

// Native FCM token (Android) when present, otherwise the web FCM token,
// so orientation follow/unfollow targeting works on both platforms.
function getActivePushToken(): string | null {
  return getPushToken() ?? getWebPushToken();
}

function read(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const set = new Set<string>(Array.isArray(arr) ? arr : []);
    if (!localStorage.getItem(SPLIT_KEY)) {
      const before = set.size;
      for (const [from, to] of Object.entries(SPLITS)) if (set.has(from)) set.add(to);
      if (set.size !== before) localStorage.setItem(KEY, JSON.stringify([...set]));
      localStorage.setItem(SPLIT_KEY, '1');
    }
    return set;
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

async function pushOneOrientationToDb(orientation: string) {
  const token = getActivePushToken();
  if (!token) return;
  try {
    const { error } = await supabase
      .from('push_token_orientations')
      .insert({ token, orientation });
    if (error && (error as any).code !== '23505') {
      // best-effort; the next syncAllToDb run will retry
    }
  } catch {
    // best-effort
  }
}

async function deleteOneOrientationFromDb(orientation: string) {
  const token = getActivePushToken();
  if (!token) return;
  // SECURITY DEFINER RPC — see follows.ts for the rationale (no
  // SELECT policy means a plain DELETE matches 0 rows under RLS).
  try {
    await supabase.rpc('unfollow_orientation', {
      p_token: token,
      p_orientation: orientation,
    });
  } catch {
    // best-effort
  }
}

async function syncAllOrientationsToDb() {
  const token = getActivePushToken();
  if (!token) return;
  const all = [...read()];
  if (all.length === 0) return;
  await Promise.all(all.map((o) => pushOneOrientationToDb(o)));
}

function write(set: Set<string>) {
  if (typeof window === 'undefined') return;
  const arr = [...set];
  localStorage.setItem(KEY, JSON.stringify(arr));
  void mirrorToPreferences(arr);
  window.dispatchEvent(new Event('cap2027:orientations-changed'));
}

export function useFollowedOrientations() {
  const [followed, setFollowed] = useState<Set<string>>(read);

  useEffect(() => {
    void mirrorToPreferences([...read()]);
    void syncAllOrientationsToDb();
  }, []);

  useEffect(() => {
    const sync = () => setFollowed(read());
    const onTokenReady = () => { void syncAllOrientationsToDb(); };
    window.addEventListener('storage', sync);
    window.addEventListener('cap2027:orientations-changed', sync);
    window.addEventListener('cap2027:push-token-ready', onTokenReady);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('cap2027:orientations-changed', sync);
      window.removeEventListener('cap2027:push-token-ready', onTokenReady);
    };
  }, []);

  const isFollowed = useCallback(
    (orientation: string) => followed.has(orientation),
    [followed],
  );

  const toggle = useCallback((orientation: string) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      const was = next.has(orientation);
      if (was) next.delete(orientation);
      else next.add(orientation);
      write(next);
      if (was) void deleteOneOrientationFromDb(orientation);
      else void pushOneOrientationToDb(orientation);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setFollowed(new Set());
    write(new Set());
    void (async () => {
      const token = getActivePushToken();
      if (!token) return;
      try {
        await supabase.rpc('clear_orientations', { p_token: token });
      } catch {
        // best-effort
      }
    })();
  }, []);

  return { followed, isFollowed, toggle, clear };
}
