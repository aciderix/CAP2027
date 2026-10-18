// Fiche programme d'un candidat, d'après Demos Kratos : vue d'ensemble, puis
// thème par thème la synthèse et toutes les mesures, chacune avec la citation
// exacte du programme et le lien vers la source officielle (exigences de
// l'export), ainsi que la page de la mesure sur demos-kratos.fr (où l'on peut
// signaler une erreur).

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import {
  fetchSyntheses, fetchThemeMeasures, type CompCandidate, type CompTheme,
} from '../lib/comparateurData';
import { DK_LICENCE_URL } from '../lib/dkShared';
import { openLink } from '../lib/openLink';
import { STABLE_STALE_MS } from '../lib/queryClient';
import { CandidateAvatar, DkCredit, centerInRow } from './comparateurUi';
import { Modal } from './ui/Modal';

const OVERVIEW = 'overview';

export function DkProgrammeSheet({
  candidate, initialThemeId, themes, attribution, generatedAt, onClose,
}: {
  candidate: CompCandidate | null;
  initialThemeId: string | null;
  themes: CompTheme[];
  attribution: string;
  generatedAt: string | null;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={!!candidate} onClose={onClose} title={candidate?.fullName ?? ''}>
      {candidate && (
        <DkProgrammeView
          key={`${candidate.id}|${initialThemeId ?? ''}`}
          candidate={candidate}
          initialThemeId={initialThemeId}
          themes={themes}
          attribution={attribution}
          generatedAt={generatedAt}
          stickyChips
        />
      )}
    </Modal>
  );
}

/** Contenu de la fiche, affiché dans la fenêtre du comparateur ou en pleine
 *  page depuis l'écran Programmes. */
export function DkProgrammeView({
  candidate, initialThemeId, themes, attribution, generatedAt, stickyChips = false, withName = false, children,
}: {
  candidate: CompCandidate;
  initialThemeId: string | null;
  themes: CompTheme[];
  attribution: string;
  generatedAt: string | null;
  /** Onglets de thèmes collés en haut de la fenêtre (marges du Modal). */
  stickyChips?: boolean;
  /** Nom du candidat dans l'en-tête (en pleine page ; le Modal l'a dans son titre). */
  withName?: boolean;
  /** Liens complémentaires sous l'en-tête. */
  children?: React.ReactNode;
}) {
  const [themeId, setThemeId] = useState<string>(initialThemeId ?? OVERVIEW);
  const covered = themes.filter((t) => (candidate.themeCounts[t.id] ?? 0) > 0);
  const activeChip = useRef<HTMLButtonElement>(null);

  useEffect(() => centerInRow(activeChip.current), [themeId]);

  const synQuery = useQuery({
    queryKey: ['dkSyntheses', [candidate.id]],
    queryFn: () => fetchSyntheses([candidate.id]),
    staleTime: STABLE_STALE_MS,
  });
  const measuresQuery = useQuery({
    queryKey: ['dkThemeMeasures', candidate.id, themeId],
    queryFn: () => fetchThemeMeasures(candidate.id, themeId),
    enabled: themeId !== OVERVIEW,
    staleTime: STABLE_STALE_MS,
    // Les mesures pèsent lourd : on ne les garde pas dans le cache persisté.
    gcTime: 5 * 60 * 1000,
  });

  const syn = (synQuery.data ?? []).find((s) => (s.themeId ?? OVERVIEW) === themeId);
  const keyIds = new Set(syn?.keyMeasureIds ?? []);
  const measures = [...(measuresQuery.data ?? [])].sort(
    (a, b) => Number(keyIds.has(b.id)) - Number(keyIds.has(a.id)),
  );
  const date = generatedAt ? new Date(generatedAt).toLocaleDateString('fr-FR') : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <CandidateAvatar c={candidate} className="w-14 h-14" />
        <div className="min-w-0">
          {withName && <h2 className="text-xl font-bold text-[#102a5c] leading-tight">{candidate.fullName}</h2>}
          {candidate.party && <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold truncate">{candidate.party}</div>}
          <div className="text-sm text-slate-600">{candidate.measureCount} mesures analysées</div>
        </div>
      </div>
      {children}

      <div className={stickyChips
        ? 'sticky -top-4 sm:-top-6 z-10 bg-white -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 border-b border-slate-100'
        : 'py-1'}
      >
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {[{ id: OVERVIEW, label: "Vue d'ensemble", n: null as number | null }, ...covered.map((t) => ({
            id: t.id, label: t.label, n: candidate.themeCounts[t.id] ?? 0,
          }))].map((t) => (
            <button
              key={t.id}
              ref={t.id === themeId ? activeChip : undefined}
              type="button"
              onClick={() => setThemeId(t.id)}
              className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold border whitespace-nowrap transition-all ${
                t.id === themeId ? 'bg-[#102a5c] text-white border-[#102a5c]' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {t.label}
              {t.n !== null && <span className={`text-[10px] font-bold ${t.id === themeId ? 'opacity-70' : 'text-slate-400'}`}>{t.n}</span>}
            </button>
          ))}
        </div>
      </div>

      {synQuery.isLoading && <div className="h-20 bg-slate-100 animate-pulse rounded-xl" />}
      {syn && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{syn.summary}</p>
          {syn.keyFigures.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {syn.keyFigures.map((f, n) => (
                <span key={n} className="text-[11px] bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-slate-600">
                  <span className="font-bold text-slate-800">{f.value}</span> {f.label}
                </span>
              ))}
            </div>
          )}
          <DkCredit url={syn.url} />
        </div>
      )}

      {themeId === OVERVIEW && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
          {candidate.officialSiteUrl && (
            <button type="button" onClick={() => void openLink(candidate.officialSiteUrl)} className="inline-flex items-center gap-1 text-[#1a56db]">
              Programme officiel <ExternalLink className="w-3 h-3" />
            </button>
          )}
          <DkCredit url={candidate.dkUrl} label="Fiche complète sur Demos Kratos" />
        </div>
      )}

      {themeId !== OVERVIEW && (
        <div className="flex flex-col gap-2">
          {measuresQuery.isLoading && [1, 2, 3].map((n) => <div key={n} className="h-28 bg-slate-100 animate-pulse rounded-xl" />)}
          {measuresQuery.error && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
              Impossible de charger les mesures : {(measuresQuery.error as Error).message}
            </div>
          )}
          {measures.map((m) => (
            <article key={m.id} className="border border-slate-100 rounded-xl p-3 flex flex-col gap-2">
              {keyIds.has(m.id) && (
                <span className="self-start text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
                  Mesure phare
                </span>
              )}
              <h4 className="font-bold text-sm text-[#102a5c] leading-snug">{m.title}</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{m.description}</p>
              <blockquote className="border-l-2 border-slate-300 pl-3 text-xs italic text-slate-600 leading-relaxed">
                « {m.exactQuote} »
              </blockquote>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <button
                  type="button"
                  onClick={() => void openLink(m.sourceUrl)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a56db]"
                >
                  Source officielle <ExternalLink className="w-3 h-3" />
                </button>
                <DkCredit url={m.url} label="Voir ou signaler sur Demos Kratos" />
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400 leading-snug border-t border-slate-100 pt-3">
        {attribution}{' '}
        <button type="button" onClick={() => void openLink(DK_LICENCE_URL)} className="underline">Licence CC BY-NC 4.0</button>
        {date && <> · export du {date}</>}
      </p>
    </div>
  );
}
