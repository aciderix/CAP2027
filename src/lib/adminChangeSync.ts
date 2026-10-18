// Detect "something changed since the user's last visit" by comparing
// the server-side admin.last_change.counter to a value persisted in
// localStorage. When they diverge — i.e. one of the notify_* triggers
// has fired between the user's last app close and this open — invalidate
// every admin-driven TanStack Query cache so the user sees fresh
// content on the next tab they navigate to.
//
// Why this design:
//   - getDeliveredNotifications would also work but caused a hard-to-
//     reproduce white screen on Android (see commit 06b97b7).
//   - "Always invalidate on resume" was rejected as too aggressive
//     (would refetch even when nothing changed).
//   - This counter approach piggybacks on the existing useAppConfig
//     refetch — no extra network call, no platform-specific quirks.
//
// Flow:
//   1. Admin makes a change → notify_* trigger fires → bumps the counter
//      via _bump_admin_change_counter() then sends the FCM push.
//   2. User opens the app (foreground, tap, or launcher — any path).
//   3. useAppConfig refetches on mount (initialDataUpdatedAt: 0 forces
//      this even when initialData is provided from the localStorage cache).
//   4. The fresh counter arrives; this hook compares to the stored value.
//   5. If higher, invalidate admin-driven caches (the foreground push
//      already invalidated them in real time — this is the safety net
//      for the tap-skipped / launcher-open path).

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppConfig } from './appConfig';

const STORAGE_KEY = 'cap2027.adminChange.counter';

export function useAdminChangeSync() {
  const qc = useQueryClient();
  const { data: cfg } = useAppConfig();
  const serverCounter = cfg?.['admin.last_change']?.counter;

  useEffect(() => {
    if (typeof serverCounter !== 'number') return;
    if (typeof window === 'undefined') return;

    const storedRaw = localStorage.getItem(STORAGE_KEY);
    const stored = storedRaw ? Number.parseInt(storedRaw, 10) : null;

    // First run on this device: just record the current value so the
    // next admin change is detected against a known baseline.
    if (stored === null || Number.isNaN(stored)) {
      try { localStorage.setItem(STORAGE_KEY, String(serverCounter)); } catch { /* noop */ }
      return;
    }

    if (serverCounter > stored) {
      // An admin change (or several) happened while the app was closed.
      // Invalidate every cache whose source data an admin can change.
      // Articles are intentionally excluded — they have their own
      // refetchOnWindowFocus + 30 min staleTime + per-article push
      // (article_press / article_social) wiring in push.ts.
      qc.invalidateQueries({ queryKey: ['candidatesList'] });
      qc.invalidateQueries({ queryKey: ['candidateDetail'] });
      qc.invalidateQueries({ queryKey: ['dkComparateur'] });
      qc.invalidateQueries({ queryKey: ['candidatesByIds'] });
      qc.invalidateQueries({ queryKey: ['dkMatch'] });
      qc.invalidateQueries({ queryKey: ['ourProgrammes'] });
      qc.invalidateQueries({ queryKey: ['electionResults'] });
      qc.invalidateQueries({ queryKey: ['parrainagesLatest'] });
      qc.invalidateQueries({ queryKey: ['parrainagesAll'] });
      qc.invalidateQueries({ queryKey: ['parrainagesForCandidate'] });

      try { localStorage.setItem(STORAGE_KEY, String(serverCounter)); } catch { /* noop */ }
    }
  }, [serverCounter, qc]);
}
