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

interface AppConfigShape {
  'election.round1'?: ElectionRound;
  'election.round2'?: ElectionRound;
  'parrainages.source'?: ParrainagesSource;
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
    staleTime: 60 * 60 * 1000, // 1 h: dates change rarely
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
