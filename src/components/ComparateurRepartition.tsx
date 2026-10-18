// « Répartition des mesures par thème » : part de chaque thème dans le
// programme de chaque candidat sélectionné (barres groupées, une couleur par
// candidat), avec une vue tableau qui donne toutes les valeurs.

import { useMemo, useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { themeShares, type CompCandidate, type CompTheme } from '../lib/comparateurData';
import { SLOT_COLORS, pct } from './comparateurUi';

const ROWS_SHOWN = 8;

export function ComparateurRepartition({
  selected, themes,
}: {
  selected: CompCandidate[];
  themes: CompTheme[];
}) {
  const [sortBy, setSortBy] = useState(0);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const sortIdx = Math.min(sortBy, selected.length - 1);

  const { rows, max } = useMemo(() => {
    const shares = selected.map(themeShares);
    const list = themes
      .map((t) => ({ theme: t, values: shares.map((s) => s.get(t.id) ?? 0) }))
      .filter((r) => r.values.some((v) => v > 0))
      .sort((r, s) => s.values[sortIdx] - r.values[sortIdx] || Math.max(...s.values) - Math.max(...r.values));
    return { rows: list, max: Math.max(0.0001, ...list.flatMap((r) => r.values)) };
  }, [selected, themes, sortIdx]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-slate-500 leading-snug">
          Part de chaque thème dans le programme, en % des mesures.
          {view === 'chart' && ' Touchez un thème pour voir les valeurs.'}
        </p>
        <div className="inline-flex items-center bg-slate-100 rounded-full p-0.5 text-xs shrink-0">
          {([['chart', BarChart3, 'Graphique'], ['table', Table2, 'Tableau']] as const).map(([v, Icon, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-label={label}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold transition-all ${
                view === v ? 'bg-white text-[#102a5c] shadow-sm' : 'text-slate-500'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Légende, qui sert aussi à choisir le tri. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Trier par</span>
        {selected.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSortBy(i)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border transition-all ${
              i === sortIdx ? 'border-[#102a5c] text-[#102a5c] bg-slate-50' : 'border-slate-200 text-slate-600'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: SLOT_COLORS[i] }} />
            {c.fullName}
            <span className="text-[10px] text-slate-400 font-normal">{c.measureCount} mesures</span>
          </button>
        ))}
      </div>

      {view === 'chart' ? (
        <div className="flex flex-col">
          {(showAll ? rows : rows.slice(0, ROWS_SHOWN)).map((r) => {
            const open = openRow === r.theme.id;
            return (
              <button
                key={r.theme.id}
                type="button"
                onClick={() => setOpenRow(open ? null : r.theme.id)}
                aria-expanded={open}
                className={`text-left py-1.5 -mx-1 px-1 rounded-lg transition-colors ${open ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
              >
                <div className="text-xs font-semibold text-slate-700 mb-1">{r.theme.label}</div>
                <div className="flex flex-col gap-[2px]">
                  {r.values.map((v, i) => (
                    <div key={selected[i].id} className="h-2 w-full">
                      {v > 0 && (
                        <div
                          className="h-full rounded-r-[4px]"
                          style={{ width: `${Math.max(1, (v / max) * 100)}%`, backgroundColor: SLOT_COLORS[i] }}
                        />
                      )}
                    </div>
                  ))}
                </div>
                {open && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-slate-600">
                    {selected.map((c, i) => (
                      <span key={c.id} className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: SLOT_COLORS[i] }} />
                        {c.fullName} : <span className="font-bold text-slate-800">{pct(r.values[i])} %</span>
                        <span className="text-slate-400">({c.themeCounts[r.theme.id] ?? 0})</span>
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
          {rows.length > ROWS_SHOWN && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="self-start mt-1 text-[11px] font-bold text-[#1a56db]">
              {showAll ? 'Réduire' : `Voir les ${rows.length} thèmes`}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                <th className="font-bold py-1.5 px-1">Thème</th>
                {selected.map((c, i) => (
                  <th key={c.id} className="font-bold py-1.5 px-1 text-right leading-tight normal-case tracking-normal text-[11px] text-slate-500">
                    <span className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ backgroundColor: SLOT_COLORS[i] }} />
                    {c.fullName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.theme.id} className="border-t border-slate-100">
                  <td className="py-1.5 px-1 text-slate-700 font-semibold">{r.theme.label}</td>
                  {r.values.map((v, i) => (
                    <td key={selected[i].id} className="py-1.5 px-1 text-right tabular-nums text-slate-700 whitespace-nowrap">
                      {pct(v)} % <span className="text-slate-400">({selected[i].themeCounts[r.theme.id] ?? 0})</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
