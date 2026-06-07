// Per-device opt-out of notification CHANNELS.
//
// The user can mute whole categories of push notifs from Settings.
// Model is OPT-OUT (lenient): a device with NO muted rows receives
// everything (legacy behaviour). A muted channel = that category is
// silenced for this device.
//
// Mutable channels:
//   news_press          -> "N nouvelles actualités" (press articles)
//   candidates_followed -> posts/videos from followed candidates
//   candidates_updates  -> candidate bio/programme/proposition updates
//
// Election reminders are NOT a channel here — they always go through
// (civic deadlines), so there is nothing to toggle for them server-side.
//
// Architecture mirrors lib/orientationFollows.ts exactly: localStorage
// source of truth, Capacitor Preferences mirror (background runner),
// and a server mirror in public.push_token_muted_channels so the FCM
// broadcast can exclude muted devices. Plain INSERT to mute, SECURITY
// DEFINER RPC (unmute_channel) to un-mute — no SELECT policy needed.

import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { getPushToken } from './push';
import { getWebPushToken } from './pushWeb';

const KEY = 'cap2027.mutedChannels';

export type NotifChannel =
  | 'news_press'
  | 'candidates_followed'
  | 'candidates_updates';

export const MUTABLE_CHANNELS: NotifChannel[] = [
  'news_press',
  'candidates_followed',
  'candidates_updates',
];

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

async function muteOneInDb(channel: string) {
  const token = getActivePushToken();
  if (!token) return;
  try {
    const { error } = await supabase
      .from('push_token_muted_channels')
      .insert({ token, channel });
    if (error && (error as any).code !== '23505') {
      // best-effort; the next syncAllToDb run will retry
    }
  } catch {
    // best-effort
  }
}

async function unmuteOneInDb(channel: string) {
  const token = getActivePushToken();
  if (!token) return;
  // SECURITY DEFINER RPC — without a SELECT policy a plain DELETE by
  // anon matches 0 rows under RLS (see orientationFollows.ts).
  try {
    await supabase.rpc('unmute_channel', { p_token: token, p_channel: channel });
  } catch {
    // best-effort
  }
}

async function syncAllMutedToDb() {
  const token = getActivePushToken();
  if (!token) return;
  const all = [...read()];
  if (all.length === 0) return;
  await Promise.all(all.map((c) => muteOneInDb(c)));
}

function write(set: Set<string>) {
  if (typeof window === 'undefined') return;
  const arr = [...set];
  localStorage.setItem(KEY, JSON.stringify(arr));
  void mirrorToPreferences(arr);
  window.dispatchEvent(new Event('cap2027:channels-changed'));
}

export function useMutedChannels() {
  const [muted, setMuted] = useState<Set<string>>(read);

  useEffect(() => {
    void mirrorToPreferences([...read()]);
    void syncAllMutedToDb();
  }, []);

  useEffect(() => {
    const sync = () => setMuted(read());
    const onTokenReady = () => { void syncAllMutedToDb(); };
    window.addEventListener('storage', sync);
    window.addEventListener('cap2027:channels-changed', sync);
    window.addEventListener('cap2027:push-token-ready', onTokenReady);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('cap2027:channels-changed', sync);
      window.removeEventListener('cap2027:push-token-ready', onTokenReady);
    };
  }, []);

  // A channel is "enabled" when it is NOT in the muted set.
  const isEnabled = useCallback(
    (channel: NotifChannel) => !muted.has(channel),
    [muted],
  );

  // Toggle the user-facing ENABLED state: enabling un-mutes, disabling mutes.
  const toggle = useCallback((channel: NotifChannel) => {
    setMuted((prev) => {
      const next = new Set(prev);
      const wasMuted = next.has(channel);
      if (wasMuted) next.delete(channel);
      else next.add(channel);
      write(next);
      if (wasMuted) void unmuteOneInDb(channel);
      else void muteOneInDb(channel);
      return next;
    });
  }, []);

  return { muted, isEnabled, toggle };
}
