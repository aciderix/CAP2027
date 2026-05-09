import { Stamp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppConfig } from '../lib/appConfig';

const REQUIRED = 500;

interface Props {
  candidateId: string;
}

export function CandidateParrainagesInline({ candidateId }: Props) {
  const { data: cfg } = useAppConfig();
  const isAvailable = cfg?.['parrainages.source']?.is_available === true;

  const query = useQuery({
    queryKey: ['parrainagesForCandidate', candidateId],
    enabled: isAvailable && !!candidateId,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parrainages_latest')
        .select('total, snapshot_date')
        .eq('candidate_id', candidateId)
        .maybeSingle();
      if (error) throw error;
      return data as { total: number; snapshot_date: string } | null;
    },
  });

  // Hide entirely until the Conseil constitutionnel publishes data,
  // so the fiche stays clean during the long pre-publication window.
  if (!isAvailable) return null;
  if (query.isLoading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 animate-pulse">
        <div className="h-3 w-1/3 bg-slate-200 rounded-full" />
        <div className="h-2 w-full bg-slate-200 rounded-full mt-3" />
      </div>
    );
  }
  if (!query.data) return null;

  const { total, snapshot_date } = query.data;
  const reached = total >= REQUIRED;
  const ratio = Math.min(1, total / REQUIRED);

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-bold text-[#102a5c] text-sm flex items-center gap-1.5">
          <Stamp className="w-4 h-4 text-amber-600" />
          Parrainages
        </h4>
        <span className={`text-xs font-bold tabular-nums ${reached ? 'text-emerald-700' : 'text-slate-700'}`}>
          {total}{reached ? ' ✓' : ` / ${REQUIRED}`}
        </span>
      </div>
      <div className="h-1.5 bg-white rounded-full overflow-hidden border border-amber-100">
        <div
          className={`h-full rounded-full transition-all ${reached ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="text-[11px] text-slate-500 leading-snug">
        Au {new Date(snapshot_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}.
        500 signatures d'élus issues d'au moins 30 départements requises pour se présenter.
      </p>
    </div>
  );
}
