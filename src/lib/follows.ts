import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { getPushToken } from './push';

const KEY = 'cap2027.followedCandidates';

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

// Mirror to Capacitor Preferences so the background runner (separate
// JS context, no localStorage) can scope its notif queries to the
// candidates the user follows.
async function mirrorToPreferences(arr: string[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: KEY, value: JSON.stringify(arr) });
  } catch {
    // best-effort
  }
}

// Mirror follows to public.push_token_follows so the server can target
// "Nouveau post de X" notifs to followers only (see push-broadcast).
// The token is the implicit device bearer; rows are anonymous (no
// user_id). Skipped silently when no token is registered (web, native
// where registration hasn't happened yet — the cap2027:push-token-ready
// event will trigger a full re-sync once it does).
//
// We deliberately use plain INSERT (not upsert) and swallow duplicate
// errors (PG code 23505). The reason: upsert lands on the
// INSERT ... ON CONFLICT DO UPDATE path, which requires a SELECT
// policy to read the conflicting row — that policy would leak the
// full (token, candidate_id) list to anyone holding the publishable
// key. Plain INSERT only needs INSERT, keeping the table read-only
// for service_role on the server.
async function pushOneFollowToDb(candidateId: string) {
  const token = getPushToken();
  if (!token) return;
  try {
    const { error } = await supabase
      .from('push_token_follows')
      .insert({ token, candidate_id: candidateId });
    // 23505 = unique_violation — the row was already there from a
    // previous toggle or sync; nothing to do.
    if (error && (error as any).code !== '23505') {
      // best-effort: leave it; next syncAllFollowsToDb run retries.
    }
  } catch {
    // best-effort
  }
}

async function deleteOneFollowFromDb(candidateId: string) {
  const token = getPushToken();
  if (!token) return;
  try {
    await supabase
      .from('push_token_follows')
      .delete()
      .eq('token', token)
      .eq('candidate_id', candidateId);
  } catch {
    // best-effort
  }
}

async function syncAllFollowsToDb() {
  const token = getPushToken();
  if (!token) return;
  const all = [...read()];
  if (all.length === 0) return;
  // Insert each row individually so a duplicate on one candidate
  // doesn't fail the whole batch. Fire in parallel — at most a
  // handful of follows per device.
  await Promise.all(all.map((cid) => pushOneFollowToDb(cid)));
}

function write(set: Set<string>) {
  if (typeof window === 'undefined') return;
  const arr = [...set];
  localStorage.setItem(KEY, JSON.stringify(arr));
  void mirrorToPreferences(arr);
  // Notify other listeners in the same tab
  window.dispatchEvent(new Event('cap2027:follows-changed'));
}

export function useFollowedCandidates() {
  const [followed, setFollowed] = useState<Set<string>>(read);

  // On first mount, ensure Preferences + server follow mirror are in
  // sync with whatever localStorage already has (covers existing
  // installs upgrading to the server mirror, and re-installs where the
  // FCM token changed).
  useEffect(() => {
    void mirrorToPreferences([...read()]);
    void syncAllFollowsToDb();
  }, []);

  useEffect(() => {
    const sync = () => setFollowed(read());
    const onTokenReady = () => { void syncAllFollowsToDb(); };
    window.addEventListener('storage', sync);
    window.addEventListener('cap2027:follows-changed', sync);
    window.addEventListener('cap2027:push-token-ready', onTokenReady);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('cap2027:follows-changed', sync);
      window.removeEventListener('cap2027:push-token-ready', onTokenReady);
    };
  }, []);

  const isFollowed = useCallback(
    (candidateId: string) => followed.has(candidateId),
    [followed],
  );

  const toggle = useCallback((candidateId: string) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      const wasFollowed = next.has(candidateId);
      if (wasFollowed) next.delete(candidateId);
      else next.add(candidateId);
      write(next);
      if (wasFollowed) void deleteOneFollowFromDb(candidateId);
      else void pushOneFollowToDb(candidateId);
      return next;
    });
  }, []);

  const setMany = useCallback((ids: Iterable<string>) => {
    const next = new Set(ids);
    setFollowed(next);
    write(next);
    // Full re-sync: insert each new follow ignoring duplicates,
    // then drop anything that's no longer in the set.
    void (async () => {
      const token = getPushToken();
      if (!token) return;
      try {
        const stillThere = [...next];
        await Promise.all(stillThere.map((cid) => pushOneFollowToDb(cid)));
        // Remove rows that are no longer in the new set.
        let q = supabase.from('push_token_follows').delete().eq('token', token);
        if (stillThere.length > 0) q = q.not('candidate_id', 'in', `(${stillThere.join(',')})`);
        await q;
      } catch {
        // best-effort
      }
    })();
  }, []);

  return { followed, isFollowed, toggle, setMany };
}
