// Helpers around app_config rows (election dates, feature flags…).
//
// Values come from Supabase but we cache them in localStorage so the
// app remains functional offline (key requirement for the countdown
// banner: even with no network on election day, it should still
// know the dates).

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface ElectionRound {
  scheduled_at: string;       // ISO with timezone
  results_at: string;         // ISO with timezone
  is_official: boolean;
  label: string;
}

export interface ParrainagesSource {
  url: string;
  is_available: boolean;
  note?: string;
}

export interface ElectionResultsConfig {
  round1_published: boolean;
  round2_published: boolean;
}

export interface AdminLastChange {
  counter: number;
  at?: string;
}

export interface AppConfigShape {
  'election.round1'?: ElectionRound;
  'election.round2'?: ElectionRound;
  'parrainages.source'?: ParrainagesSource;
  'election.results'?: ElectionResultsConfig;
  'admin.last_change'?: AdminLastChange;
}

const CACHE_KEY = 'cap2027.appConfig.cache';

function readCache(): AppConfigShape | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(cfg: AppConfigShape) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cfg));
  } catch {
    // best-effort
  }
}

/**
 * Read app_config. Returns the in-localStorage cache immediately as
 * initialData so the countdown banner shows without a flash, then
 * Supabase refreshes in the background once connectivity allows.
 */
export function useAppConfig() {
  const cached = readCache();
  return useQuery({
    queryKey: ['appConfig'],
    initialData: cached ?? undefined,
    // initialDataUpdatedAt: 0 marks the cached value as immediately stale
    // so the query refetches on mount (cold launch). Without this,
    // TanStack treats initialData as "just fetched" and skips the refetch
    // until staleTime elapses — which would defeat useAdminChangeSync's
    // ability to detect new content on cold launch.
    initialDataUpdatedAt: 0,
    // 5 min: this query gates major UI features (Results card, parrainages
    // banner, election dates, election results visibility flag). Short
    // enough that opening the app via launcher after an admin flip
    // refreshes the gate without needing a push notif tap.
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AppConfigShape> => {
      const { data, error } = await supabase.from('app_config').select('key, value');
      if (error) throw error;
      const out: AppConfigShape = {};
      for (const row of data ?? []) {
        (out as any)[row.key] = row.value;
      }
      writeCache(out);
      return out;
    },
  });
}
