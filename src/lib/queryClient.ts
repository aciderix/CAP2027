import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Bumped on cache-incompatible schema changes. Increment to invalidate
// every persisted query at once on the next app start.
export const QUERY_CACHE_BUSTER = 'v1';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Articles refresh every 5 min, the rest can sit on cache much longer.
      staleTime: 5 * 60 * 1000,
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
