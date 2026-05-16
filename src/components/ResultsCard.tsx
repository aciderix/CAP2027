import { useMemo } from 'react';
import { Crown, BarChart3, ArrowRight, Info } from 'lucide-react';
import { useAppConfig } from '../lib/appConfig';
import { useElectionResults } from '../lib/electionResults';

interface ResultsCardProps {
  onSeeAll?: () => void;
}

export function ResultsCard({ onSeeAll }: ResultsCardProps) {
  const { data: cfg } = useAppConfig();
  const round1Published = cfg?.['election.results']?.round1_published === true;
  const round2Published = cfg?.['election.results']?.round2_published === true;

  // After round 2, that's the headline; otherwise round 1.
  const activeRound: 1 | 2 = round2Published ? 2 : 1;
  const r1 = useElectionResults(1, round1Published);
  const r2 = useElectionResults(2, round2Published);
  const query = activeRound === 2 ? r2 : r1;

  const rows = query.data ?? [];
  const top = useMemo(() => rows.slice(0, 8), [rows]);
  const winner = activeRound === 2 ? rows.find((r) => r.is_winner) : null;

  if (!round1Published) return null;

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#102a5c] flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#1a56db]" />
          Résultats — {activeRound === 1 ? '1er tour' : '2nd tour'}
        </h2>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="text-[11px] font-bold text-slate-400 hover:text-[#1a56db] hover:underline whitespace-nowrap inline-flex items-center gap-1"
          >
            Voir tout <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {query.isLoading && (
        <div className="p-5 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse shrink-0" />
              <div className="flex-1 h-3 bg-slate-100 rounded-full animate-pulse" />
              <div className="w-16 h-3 bg-slate-200 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!query.isLoading && top.length === 0 && (
        <div className="p-6 flex items-start gap-3 bg-slate-50 text-xs text-slate-600 leading-relaxed">
          <Info className="w-4 h-4 text-[#1a56db] shrink-0 mt-0.5" />
          <p>Résultats annoncés mais pas encore détaillés. Ils apparaîtront ici sous peu.</p>
        </div>
      )}

      {!query.isLoading && top.length > 0 && (
        <>
          {winner && (
            <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-white border-b border-amber-100 flex items-center gap-3">
              <Crown className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest font-bold text-amber-700">Président·e élu·e</div>
                <div className="font-bold text-[#102a5c] truncate">
                  {winner.first_name} {winner.last_name}
                  {winner.party_abbreviation && (
                    <span className="ml-2 text-xs font-normal text-slate-500">({winner.party_abbreviation})</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {top.map((row) => {
              const name = `${row.first_name} ${row.last_name}`.trim();
              const barColor = row.is_winner
                ? 'bg-amber-500'
                : row.is_qualified
                ? 'bg-emerald-500'
                : 'bg-[#1a56db]';
              return (
                <li key={row.candidate_id} className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                      {row.photo_url ? (
                        <img decoding="async" src={row.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-[#102a5c] text-sm truncate flex items-center gap-1.5">
                          {name}
                          {row.is_winner && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          {!row.is_winner && row.is_qualified && activeRound === 1 && (
                            <span className="text-[9px] uppercase tracking-widest font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                              Qualifié·e
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-slate-700">
                          {row.percentage.toFixed(2)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${Math.min(100, row.percentage)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
