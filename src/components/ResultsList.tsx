import { useState } from 'react';
import { Crown, BarChart3 } from 'lucide-react';
import { useAppConfig } from '../lib/appConfig';
import { useElectionResults, type ElectionResultRow } from '../lib/electionResults';

export function ResultsList() {
  const { data: cfg } = useAppConfig();
  const round1Published = cfg?.['election.results']?.round1_published === true;
  const round2Published = cfg?.['election.results']?.round2_published === true;
  const [activeRound, setActiveRound] = useState<1 | 2>(round2Published ? 2 : 1);

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-[#102a5c] flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#1a56db]" />
          Résultats officiels
        </h2>
        {round1Published && round2Published && (
          <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs font-bold">
            <button
              onClick={() => setActiveRound(1)}
              className={`px-3 py-1 rounded-full transition-colors ${activeRound === 1 ? 'bg-white text-[#102a5c] shadow-sm' : 'text-slate-500'}`}
            >
              1er tour
            </button>
            <button
              onClick={() => setActiveRound(2)}
              className={`px-3 py-1 rounded-full transition-colors ${activeRound === 2 ? 'bg-white text-[#102a5c] shadow-sm' : 'text-slate-500'}`}
            >
              2nd tour
            </button>
          </div>
        )}
      </div>

      {!round1Published && (
        <div className="p-6 text-sm text-center text-slate-500">
          Les résultats ne sont pas encore publiés. Cette page se remplira automatiquement dès la
          publication officielle.
        </div>
      )}

      {round1Published && <RoundResults round={activeRound} />}
    </div>
  );
}

function RoundResults({ round }: { round: 1 | 2 }) {
  const query = useElectionResults(round, true);
  const rows = query.data ?? [];
  const winner = round === 2 ? rows.find((r) => r.is_winner) : null;

  if (query.isLoading) {
    return (
      <div className="p-5 space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 animate-pulse shrink-0" />
            <div className="flex-1 h-3 bg-slate-100 rounded-full animate-pulse" />
            <div className="w-16 h-3 bg-slate-200 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-6 text-sm text-center text-slate-500">
        Aucun résultat pour ce tour.
      </div>
    );
  }

  return (
    <>
      {winner && (
        <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-white border-b border-amber-100 flex items-center gap-3">
          <Crown className="w-6 h-6 text-amber-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-bold text-amber-700">Président·e élu·e</div>
            <div className="font-bold text-[#102a5c] text-lg">
              {winner.first_name} {winner.last_name}
              {winner.party_abbreviation && (
                <span className="ml-2 text-sm font-normal text-slate-500">({winner.party_abbreviation})</span>
              )}
            </div>
            <div className="text-sm text-slate-600 mt-0.5">{winner.percentage.toFixed(2)} %</div>
          </div>
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {rows.map((row, idx) => (
          <ResultRow key={row.candidate_id} row={row} rank={idx + 1} round={round} />
        ))}
      </ul>
    </>
  );
}

function ResultRow({ row, rank, round }: { row: ElectionResultRow; rank: number; round: 1 | 2 }) {
  const name = `${row.first_name} ${row.last_name}`.trim();
  const barColor = row.is_winner
    ? 'bg-amber-500'
    : row.is_qualified
    ? 'bg-emerald-500'
    : 'bg-[#1a56db]';
  return (
    <li className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="w-6 text-xs font-bold text-slate-400 tabular-nums shrink-0">
          {row.rank ?? rank}
        </span>
        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
          {row.photo_url ? (
            <img decoding="async" src={row.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
              {name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-bold text-[#102a5c] text-sm truncate flex items-center gap-1.5">
              {name}
              {row.is_winner && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              {!row.is_winner && row.is_qualified && round === 1 && (
                <span className="text-[9px] uppercase tracking-widest font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                  Qualifié·e
                </span>
              )}
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums text-slate-700">
              {row.percentage.toFixed(2)} %
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(100, row.percentage)}%` }}
            />
          </div>
          {row.party_name && (
            <div className="text-[11px] text-slate-500 mt-1.5 truncate">
              {row.party_name}
              {row.votes != null && <> · {row.votes.toLocaleString('fr-FR')} voix</>}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
