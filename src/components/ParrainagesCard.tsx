import { useMemo } from 'react';
import { Stamp, ExternalLink, Info, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppConfig } from '../lib/appConfig';

interface ParrainageRow {
  candidate_id: string | null;
  source_name: string;
  total: number;
  snapshot_date: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
}

const REQUIRED = 500;

interface ParrainagesCardProps {
  onSeeAll?: () => void;
}

export function ParrainagesCard({ onSeeAll }: ParrainagesCardProps) {
  const { data: cfg } = useAppConfig();
  const source = cfg?.['parrainages.source'];
  const isAvailable = source?.is_available === true;

  const query = useQuery({
    queryKey: ['parrainagesLatest'],
    enabled: isAvailable,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<ParrainageRow[]> => {
      const { data, error } = await supabase
        .from('parrainages_latest')
        .select('candidate_id, source_name, total, snapshot_date, first_name, last_name, photo_url')
        .order('total', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ParrainageRow[];
    },
  });

  const rows = query.data ?? [];
  const top = useMemo(() => rows.slice(0, 8), [rows]);
  const snapshot = rows[0]?.snapshot_date;

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#102a5c] flex items-center gap-2">
          <Stamp className="w-4 h-4 text-amber-600" />
          Parrainages
        </h2>
        <a
          href="https://www.conseil-constitutionnel.fr/elections/election-presidentielle"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-bold text-slate-400 hover:text-[#1a56db] hover:underline whitespace-nowrap inline-flex items-center gap-1"
        >
          Source <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {!isAvailable && (
        <div className="p-5 sm:p-6 flex flex-col items-start gap-3">
          <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-600 leading-relaxed">
            <Info className="w-4 h-4 text-[#1a56db] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#102a5c] mb-0.5">Pas encore disponible</p>
              <p>
                Le Conseil constitutionnel publie les parrainages collectés à partir du
                lancement officiel de la collecte (généralement quelques mois avant le
                scrutin). Cette section se remplira automatiquement dès la mise en ligne
                des données.
              </p>
              <p className="mt-2 text-slate-500">
                <b>Rappel</b> : un candidat doit recueillir au moins 500 parrainages
                d'élus issus d'au moins 30 départements ou collectivités, sans qu'aucun
                département ne fournisse plus de 50 signatures.
              </p>
            </div>
          </div>
        </div>
      )}

      {isAvailable && query.isLoading && (
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

      {isAvailable && !query.isLoading && top.length === 0 && (
        <div className="p-6 text-center text-sm text-slate-500">
          Aucun parrainage publié pour le moment.
        </div>
      )}

      {isAvailable && top.length > 0 && (
        <>
          {onSeeAll && rows.length > top.length && (
            <div className="px-4 py-2 border-b border-slate-100 text-right">
              <button
                onClick={onSeeAll}
                className="text-sm font-semibold text-[#1a56db] hover:underline inline-flex items-center gap-1"
              >
                Voir tout les parrainages <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {top.map((row) => {
              const name = row.candidate_id
                ? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()
                : row.source_name;
              const ratio = Math.min(1, row.total / REQUIRED);
              const reached = row.total >= REQUIRED;
              return (
                <li key={`${row.source_name}-${row.snapshot_date}`} className="p-3 sm:p-4">
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
                        <span className="font-bold text-[#102a5c] text-sm truncate">{name}</span>
                        <span className={`shrink-0 text-xs font-bold tabular-nums ${reached ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {row.total}{reached ? ' ✓' : ` / ${REQUIRED}`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${reached ? 'bg-emerald-500' : 'bg-[#1a56db]'}`}
                          style={{ width: `${ratio * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {snapshot && (
            <div className="px-4 py-2 text-[10px] text-slate-400 text-center border-t border-slate-100">
              Snapshot du {new Date(snapshot).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
