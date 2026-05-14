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
async function pushOneFollowToDb(candidateId: string) {
  const token = getPushToken();
  if (!token) return;
  try {
    await supabase
      .from('push_token_follows')
      .upsert({ token, candidate_id: candidateId }, { onConflict: 'token,candidate_id' });
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
  try {
    await supabase
      .from('push_token_follows')
      .upsert(
        all.map((cid) => ({ token, candidate_id: cid })),
        { onConflict: 'token,candidate_id' },
      );
  } catch {
    // best-effort
  }
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
    // Full re-sync: upsert the new set, then drop anything stale.
    void (async () => {
      const token = getPushToken();
      if (!token) return;
      try {
        if (next.size > 0) {
          await supabase
            .from('push_token_follows')
            .upsert(
              [...next].map((cid) => ({ token, candidate_id: cid })),
              { onConflict: 'token,candidate_id' },
            );
        }
        // Remove rows that are no longer in the new set.
        const stillThere = [...next];
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
