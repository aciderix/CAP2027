// « Ces candidats sont-ils proches ? » : une carte par paire de candidats
// sélectionnés, avec la comparaison globale puis le détail par thème.

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { pairKey, pairsOf, type Affinity, type CompCandidate, type CompTheme } from '../lib/comparateurData';
import { CandidateAvatar, DkCredit, Expandable, ProximityBar, ProximityLegend, pct } from './comparateurUi';

const THEMES_SHOWN = 5;

export function ComparateurProximite({
  selected, affinities, themes, loading, onPickTheme,
}: {
  selected: CompCandidate[];
  affinities: Affinity[];
  themes: CompTheme[];
  loading: boolean;
  /** Ouvre le face-à-face sur ce thème. */
  onPickTheme: (themeId: string) => void;
}) {
  const byId = new Map(selected.map((c) => [c.id, c]));
  const byPair = new Map<string, Affinity[]>();
  for (const a of affinities) {
    const k = pairKey(a.a, a.b);
    if (!byPair.has(k)) byPair.set(k, []);
    byPair.get(k)!.push(a);
  }

  return (
    <div className="flex flex-col gap-3">
      {pairsOf(selected.map((c) => c.id)).map(([x, y]) => (
        <PairCard
          key={pairKey(x, y)}
          a={byId.get(x)!}
          b={byId.get(y)!}
          rows={byPair.get(pairKey(x, y)) ?? []}
          themes={themes}
          loading={loading}
          onPickTheme={onPickTheme}
        />
      ))}
    </div>
  );
}

function PairCard({
  a, b, rows, themes, loading, onPickTheme,
}: {
  a: CompCandidate;
  b: CompCandidate;
  rows: Affinity[];
  themes: CompTheme[];
  loading: boolean;
  onPickTheme: (themeId: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const global = rows.find((r) => r.themeId === null);
  const themeById = new Map(themes.map((t) => [t.id, t]));
  const byTheme = rows
    .filter((r): r is Affinity & { themeId: string; distribution: NonNullable<Affinity['distribution']> } =>
      r.themeId !== null && r.distribution !== null && themeById.has(r.themeId))
    .sort((r, s) => s.distribution.convergent - r.distribution.convergent
      || s.distribution.different - r.distribution.different);
  const shown = showAll ? byTheme : byTheme.slice(0, THEMES_SHOWN);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <CandidateAvatar c={a} className="w-9 h-9" />
        <div className="min-w-0 flex-1 text-sm font-bold text-[#102a5c] leading-tight">
          {a.fullName} <span className="text-slate-400 font-normal">↔</span> {b.fullName}
        </div>
        <CandidateAvatar c={b} className="w-9 h-9" />
      </div>

      {loading && !global && <div className="h-3 rounded-[4px] bg-slate-100 animate-pulse" />}

      {!loading && !global && (
        <p className="text-sm text-slate-500">Comparaison pas encore disponible pour ces deux programmes.</p>
      )}

      {global?.distribution && (
        <>
          <ProximityBar d={global.distribution} />
          <ProximityLegend d={global.distribution} />
        </>
      )}
      {global?.commentary && <Expandable text={global.commentary} lines={4} />}

      {byTheme.length > 0 && (
        <div className="flex flex-col gap-1 pt-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Thème par thème · {byTheme.length} thème{byTheme.length > 1 ? 's' : ''}
          </div>
          {shown.map((r) => {
            const t = themeById.get(r.themeId)!;
            return (
              <button
                key={r.themeId}
                type="button"
                onClick={() => onPickTheme(r.themeId)}
                className="flex items-center gap-2 py-1.5 -mx-1 px-1 rounded-lg hover:bg-slate-50 text-left"
              >
                <span className="w-24 sm:w-32 shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 truncate">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.color || '#94a3b8' }} />
                  <span className="truncate">{t.label}</span>
                </span>
                <ProximityBar d={r.distribution} className="h-2 flex-1" />
                <span className="w-10 text-right text-[11px] font-bold text-slate-700 tabular-nums">{pct(r.distribution.convergent)} %</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              </button>
            );
          })}
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>% = part des mesures convergentes</span>
            {byTheme.length > THEMES_SHOWN && (
              <button type="button" onClick={() => setShowAll((s) => !s)} className="font-bold text-[#1a56db]">
                {showAll ? 'Réduire' : `Voir les ${byTheme.length} thèmes`}
              </button>
            )}
          </div>
        </div>
      )}

      {global && <DkCredit url={global.url} />}
    </div>
  );
}
