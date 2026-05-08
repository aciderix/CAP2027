import { useEffect, useState, useCallback } from 'react';

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

function write(set: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify([...set]));
  // Notify other listeners in the same tab
  window.dispatchEvent(new Event('cap2027:follows-changed'));
}

export function useFollowedCandidates() {
  const [followed, setFollowed] = useState<Set<string>>(read);

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
