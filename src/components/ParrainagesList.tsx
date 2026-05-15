import { useMemo, useState } from 'react';
import { Stamp, Search, Info, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppConfig } from '../lib/appConfig';
import { openLink } from '../lib/openLink';

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
const HIDE_THRESHOLD = 100;

/** Lowercase + strip diacritics so "Pecresse" matches "Pécresse". */
function normaliseSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function ParrainagesList() {
  const { data: cfg } = useAppConfig();
  const isAvailable = cfg?.['parrainages.source']?.is_available === true;

  const [search, setSearch] = useState('');
  const [hideSmall, setHideSmall] = useState(false);

  const query = useQuery({
    queryKey: ['parrainagesAll'],
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
  const snapshot = rows[0]?.snapshot_date;

  const filtered = useMemo(() => {
    let out = rows;
    if (hideSmall) out = out.filter((r) => r.total >= HIDE_THRESHOLD);
    const q = normaliseSearch(search);
    if (q) {
      out = out.filter((r) => {
        const display = r.candidate_id
          ? `${r.first_name ?? ''} ${r.last_name ?? ''}`
          : r.source_name;
        return normaliseSearch(display).includes(q)
          || normaliseSearch(r.source_name).includes(q);
      });
    }
    return out;
  }, [rows, search, hideSmall]);

  const totalShown = filtered.length;
  const totalAll = rows.length;
  const reachedCount = useMemo(() => rows.filter((r) => r.total >= REQUIRED).length, [rows]);

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full animate-in fade-in duration-300">
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[24px] p-5 sm:p-6 text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-90 mb-1.5">
            <Stamp className="w-3.5 h-3.5" />
            Parrainages
          </div>
          <h2 className="text-xl sm:text-2xl font-bold leading-tight">
            500 signatures d'élus pour se présenter
          </h2>
          <p className="text-sm opacity-90 mt-1.5">
            {isAvailable
              ? `${totalAll} candidat${totalAll > 1 ? 's' : ''} référencé${totalAll > 1 ? 's' : ''} · ${reachedCount} ${reachedCount > 1 ? 'ont' : 'a'} atteint le seuil`
              : "Le compteur s'activera à l'ouverture officielle de la collecte par le Conseil constitutionnel."}
          </p>
        </div>
        <Stamp className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" strokeWidth={1.5} />
      </div>

      {/* Source link */}
      <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[#1a56db] shrink-0">
          <Info className="w-4 h-4" />
        </div>
        <div className="text-xs text-slate-600 leading-relaxed">
          Les parrainages sont publiés par le <b>Conseil constitutionnel</b> en cours de campagne.
          Un candidat doit recueillir <b>500 signatures d'élus</b> issus d'au moins 30 départements
          ou collectivités, sans qu'aucun département ne fournisse plus de 50 signatures.
          {' '}
          <a
            href="https://www.conseil-constitutionnel.fr"
            onClick={(e) => { e.preventDefault(); void openLink('https://www.conseil-constitutionnel.fr'); }}
            className="text-[#1a56db] hover:underline inline-flex items-center gap-0.5 font-semibold"
          >
            Source officielle <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {!isAvailable && (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-500">
          Aucune donnée disponible pour l'instant. Cette section se remplira automatiquement
          dès que le Conseil constitutionnel mettra le flux en ligne.
        </div>
      )}

      {isAvailable && (
        <>
          {/* Search + filter */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white rounded-full border border-slate-100 shadow-sm px-3 py-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un candidat…"
                className="flex-1 bg-transparent outline-none text-sm py-0.5 min-w-0"
              />
            </div>
            <button
              onClick={() => setHideSmall((v) => !v)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border transition-all ${
                hideSmall
                  ? 'bg-[#102a5c] text-white border-[#102a5c]'
                  : 'bg-white text-slate-700 border-slate-100 hover:border-slate-300'
              }`}
              title={`${hideSmall ? 'Afficher' : 'Masquer'} les candidats avec moins de ${HIDE_THRESHOLD} signatures`}
            >
              ≥ {HIDE_THRESHOLD}
            </button>
          </div>

          <div className="text-[11px] text-slate-500 px-1">
            {query.isLoading
              ? 'Chargement…'
              : `${totalShown} ${totalShown !== totalAll ? `sur ${totalAll}` : ''} candidat${totalShown > 1 ? 's' : ''}`}
          </div>

          {query.isLoading && (
            <div className="flex flex-col gap-2.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-3 flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 bg-slate-100 rounded-full" />
                    <div className="h-1.5 w-full bg-slate-100 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!query.isLoading && filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-500">
              Aucun candidat ne correspond.
            </div>
          )}

          {!query.isLoading && filtered.length > 0 && (
            <ul className="flex flex-col gap-2 pb-4">
              {filtered.map((row, idx) => {
                const name = row.candidate_id
                  ? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()
                  : row.source_name;
                const ratio = Math.min(1, row.total / REQUIRED);
                const reached = row.total >= REQUIRED;
                return (
                  <li
                    key={`${row.source_name}-${row.snapshot_date}`}
                    className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 font-bold w-5 text-center text-sm tabular-nums shrink-0">
                        {idx + 1}
                      </span>
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                        {row.photo_url ? (
                          <img decoding="async" src={row.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">
                            {name.replace(/[^A-Za-zÀ-ÿ ]/g, '').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`font-bold text-sm truncate ${row.candidate_id ? 'text-[#102a5c]' : 'text-slate-500 italic'}`}>
                            {name}
                          </span>
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
          )}

          {snapshot && (
            <div className="text-[10px] text-slate-400 text-center pb-4">
              Dernier snapshot : {new Date(snapshot).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              {' · '}prochain rafraîchissement quotidien (~07 h 30 heure de Paris)
            </div>
          )}
        </>
      )}
    </div>
  );
}
