// Hook around the get_election_results_for_round RPC.
//
// The RPC is SECURITY DEFINER so it bypasses the candidates is_published
// filter — once publish_round_results(1) has auto-unpublished eliminated
// candidates from every other view, their scores are still surfaced here
// (and only here) so the results card/list remain complete.

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface ElectionResultRow {
  round: number;
  candidate_id: string;
  percentage: number;
  votes: number | null;
  is_qualified: boolean;
  is_winner: boolean;
  rank: number | null;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  slug: string;
  gender: 'M' | 'F' | null;
  party_name: string | null;
  party_abbreviation: string | null;
  party_color: string | null;
}

const STALE_MS = 15 * 60 * 1000; // 15 min — results don't move once published

export function useElectionResults(round: 1 | 2, enabled = true) {
  return useQuery({
    queryKey: ['electionResults', round],
    enabled,
    staleTime: STALE_MS,
    queryFn: async (): Promise<ElectionResultRow[]> => {
      const { data, error } = await supabase.rpc('get_election_results_for_round', { p_round: round });
      if (error) throw error;
      return (data ?? []) as ElectionResultRow[];
    },
  });
}
