import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

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

  // On first mount, ensure Preferences is in sync with whatever
  // localStorage already has — covers existing installs upgrading
  // to the new mirror.
  useEffect(() => {
    void mirrorToPreferences([...read()]);
  }, []);

  useEffect(() => {
    const sync = () => setFollowed(read());
    window.addEventListener('storage', sync);
    window.addEventListener('cap2027:follows-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('cap2027:follows-changed', sync);
    };
  }, []);

  const isFollowed = useCallback(
    (candidateId: string) => followed.has(candidateId),
    [followed],
  );

  const toggle = useCallback((candidateId: string) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      write(next);
      return next;
    });
  }, []);

  const setMany = useCallback((ids: Iterable<string>) => {
    const next = new Set(ids);
    setFollowed(next);
    write(next);
  }, []);

  return { followed, isFollowed, toggle, setMany };
}
