import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Bumped on cache-incompatible schema changes. Increment to invalidate
// every persisted query at once on the next app start.
export const QUERY_CACHE_BUSTER = 'v2';

// Tuning policy (server cron schedule):
//   - ingest-rss runs at xx:15, notify-after-ingest at xx:16
//   - parrainages-daily runs at 06:30 UTC
//
// Refresh policy used by the app (override per query as needed):
//
//   STABLE_STALE_MS (24 h)
//     Reference data that only changes when an admin edits something:
//     candidates, parties, themes, programs, news sources, comparateur
//     propositions. Refetch on focus stays enabled so an in-session
//     admin edit still propagates within seconds, but background polling
//     stops.
//
//   ARTICLE_STALE_MS (30 min)
//     Article-bearing queries (news feed, my feed, hero carousel). The
//     server cron runs hourly, so 30 min staleness covers at most one
//     missed cycle. refetchOnWindowFocus reliably catches the rest when
//     the user re-opens the app.
//
//   useUnseenArticles keeps its own 5 min staleTime (small query that
//   drives the bell badge; we want it snappier than the rest).
export const STABLE_STALE_MS = 24 * 60 * 60 * 1000;
export const ARTICLE_STALE_MS = 30 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Conservative fallback. Most queries set their own staleTime.
      staleTime: 60 * 60 * 1000, // 1 h
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

export const persister =
  typeof window !== 'undefined'
    ? createSyncStoragePersister({
        storage: window.localStorage,
        key: `cap2027.tquery.${QUERY_CACHE_BUSTER}`,
        throttleTime: 1000,
      })
    : null;
