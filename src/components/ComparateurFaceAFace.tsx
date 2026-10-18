// « Le face-à-face » : un thème à la fois (balayage, flèches, clavier), avec
// la comparaison de chaque paire sur ce thème et, pour chaque candidat, sa
// synthèse et ses mesures phares. L'utilisateur désigne le plus convaincant ;
// à la fin, « Votre verdict ». Les choix restent sur l'appareil.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, RotateCcw, Trophy } from 'lucide-react';
import {
  UNCLASSIFIED_THEME_SLUG, fetchMeasuresByIds, pairKey, pairsOf,
  type Affinity, type CompCandidate, type CompTheme, type Synthesis,
} from '../lib/comparateurData';
import { STABLE_STALE_MS } from '../lib/queryClient';
import {
  CandidateAvatar, DkCredit, Expandable, ProximityBar, ProximityLegend, SLOT_COLORS, VERDICTS, VerdictBadge, centerInRow,
} from './comparateurUi';
import { Button } from './ui/Button';

const NONE = 'none';
/** id de thème → id du candidat le plus convaincant, ou NONE (« sans préférence »). */
type Choices = Record<string, string>;

const KEY_MEASURES_SHOWN = 3;

function choicesKey(ids: string[]) {
  return `cap2027.comparateur.v2.choices.${[...ids].sort().join(',')}`;
}

function loadChoices(ids: string[]): Choices {
  try {
    const raw = localStorage.getItem(choicesKey(ids));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Choices) : {};
  } catch {
    return {};
  }
}

function saveChoices(ids: string[], c: Choices) {
  try { localStorage.setItem(choicesKey(ids), JSON.stringify(c)); } catch { /* best-effort */ }
}

export function ComparateurFaceAFace({
  selected, themes, affinities, syntheses, focus, onOpenSheet,
}: {
  selected: CompCandidate[];
  themes: CompTheme[];
  affinities: Affinity[];
  syntheses: Synthesis[];
  /** Thème à afficher (choisi depuis « Ces candidats sont-ils proches ? ») ; n change à chaque demande. */
  focus: { themeId: string; n: number } | null;
  onOpenSheet: (candidateId: string, themeId: string) => void;
}) {
  const ids = selected.map((c) => c.id);
  const idsKey = ids.join(',');
  const rootRef = useRef<HTMLDivElement>(null);
  const activeChip = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Thèmes abordés par au moins deux des candidats sélectionnés.
  const faThemes = useMemo(() => themes.filter((t) =>
    t.slug !== UNCLASSIFIED_THEME_SLUG
    && selected.filter((c) => (c.themeCounts[t.id] ?? 0) > 0).length >= 2,
  ), [themes, selected]);

  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<Choices>(() => loadChoices(ids));
  const [showVerdict, setShowVerdict] = useState(false);

  useEffect(() => {
    setChoices(loadChoices(idsKey.split(',')));
    setIndex(0);
    setShowVerdict(false);
  }, [idsKey]);

  useEffect(() => {
    if (!focus) return;
    const j = faThemes.findIndex((t) => t.id === focus.themeId);
    if (j >= 0) { setIndex(j); setShowVerdict(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n]);

  const i = Math.max(0, Math.min(index, faThemes.length - 1));
  const theme = faThemes[i] as CompTheme | undefined;

  useEffect(() => centerInRow(activeChip.current), [i, showVerdict]);
  const decided = faThemes.filter((t) => choices[t.id]).length;

  const synByKey = useMemo(
    () => new Map(syntheses.map((s) => [`${s.candidateId}|${s.themeId ?? ''}`, s])),
    [syntheses],
  );
  const themeSyn = selected.map((c) => (theme ? synByKey.get(`${c.id}|${theme.id}`) : undefined));
  const keyIds = themeSyn.flatMap((s) => s?.keyMeasureIds.slice(0, KEY_MEASURES_SHOWN) ?? []);
  const keyQuery = useQuery({
    queryKey: ['dkMeasuresByIds', keyIds],
    queryFn: () => fetchMeasuresByIds(keyIds),
    enabled: keyIds.length > 0,
    staleTime: STABLE_STALE_MS,
    gcTime: 10 * 60 * 1000,
  });
  const measureById = new Map((keyQuery.data ?? []).map((m) => [m.id, m]));

  function goTo(j: number) {
    setIndex(Math.max(0, Math.min(j, faThemes.length - 1)));
    setShowVerdict(false);
    const el = rootRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function choose(value: string) {
    if (!theme) return;
    const next = { ...choices, [theme.id]: value };
    setChoices(next);
    saveChoices(ids, next);
    const nextUndecided = faThemes.findIndex((t, j) => j > i && !next[t.id]);
    if (nextUndecided >= 0) goTo(nextUndecided);
    else if (faThemes.every((t) => next[t.id])) {
      setShowVerdict(true);
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (i < faThemes.length - 1) goTo(i + 1);
  }

  function reset() {
    setChoices({});
    saveChoices(ids, {});
    goTo(0);
  }

  // Flèches du clavier (version web).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (showVerdict || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') setIndex((j) => Math.max(0, j - 1));
      if (e.key === 'ArrowRight') setIndex((j) => Math.min(faThemes.length - 1, j + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showVerdict, faThemes.length]);

  if (!theme) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center text-sm text-slate-500">
        Ces candidats n'abordent pas encore de thème en commun.
      </div>
    );
  }

  if (showVerdict) {
    return (
      <div ref={rootRef} className="scroll-mt-24">
        <VerdictView
          selected={selected}
          themes={faThemes}
          choices={choices}
          onGoTo={goTo}
          onReset={reset}
        />
      </div>
    );
  }

  const pairs = pairsOf(ids)
    .map(([x, y]) => ({
      x, y,
      aff: affinities.find((a) => a.themeId === theme.id && pairKey(a.a, a.b) === pairKey(x, y)),
    }))
    .filter((p): p is typeof p & { aff: Affinity } => !!p.aff);
  const byId = new Map(selected.map((c) => [c.id, c]));

  return (
    <div
      ref={rootRef}
      className="scroll-mt-24 flex flex-col gap-3"
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) goTo(dx < 0 ? i + 1 : i - 1);
      }}
    >
      {/* Progression + accès direct aux thèmes */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-500">Thème {i + 1} / {faThemes.length}</span>
          <span className="text-slate-500">
            <span className="font-bold text-slate-800">{decided}</span> thème{decided > 1 ? 's' : ''} tranché{decided > 1 ? 's' : ''} sur {faThemes.length}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#102a5c] rounded-full transition-all" style={{ width: `${(decided / faThemes.length) * 100}%` }} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {faThemes.map((t, j) => (
            <button
              key={t.id}
              ref={j === i ? activeChip : undefined}
              type="button"
              onClick={() => goTo(j)}
              className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border whitespace-nowrap transition-all ${
                j === i ? 'bg-[#102a5c] text-white border-[#102a5c]' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {choices[t.id] && <Check className="w-3 h-3" strokeWidth={3} />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-4">
        <h3 className="text-lg font-bold text-[#102a5c] flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.color || '#94a3b8' }} />
          {theme.label}
        </h3>

        {pairs.length > 0 && (
          <div className="flex flex-col gap-2">
            {pairs.map(({ x, y, aff }) => (
              <div key={pairKey(x, y)} className="rounded-xl bg-slate-50 p-3 flex flex-col gap-2">
                <div className="text-xs font-bold text-[#102a5c]">
                  {byId.get(x)!.fullName} <span className="text-slate-400 font-normal">↔</span> {byId.get(y)!.fullName}
                </div>
                {aff.distribution && (
                  <>
                    <ProximityBar d={aff.distribution} className="h-2" />
                    <ProximityLegend d={aff.distribution} />
                  </>
                )}
                {aff.commentary && <Expandable text={aff.commentary} lines={3} />}
                {aff.points.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {aff.points.map((p, k) => (
                      <li key={k} className="flex items-start gap-2 text-sm text-slate-700 leading-snug">
                        <VerdictBadge v={p.verdict} />
                        <span>
                          {p.sujet}
                          <span className="text-[11px] text-slate-400"> · {(VERDICTS[p.verdict] ?? VERDICTS.divergents).label}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <DkCredit url={aff.url} />
              </div>
            ))}
          </div>
        )}

        <div className={`grid grid-cols-1 gap-3 ${selected.length === 2 ? 'sm:grid-cols-2' : 'lg:grid-cols-3'}`}>
          {selected.map((c, k) => {
            const count = c.themeCounts[theme.id] ?? 0;
            const syn = themeSyn[k];
            const chosen = choices[theme.id] === c.id;
            const keys = (syn?.keyMeasureIds ?? []).slice(0, KEY_MEASURES_SHOWN);
            return (
              <div
                key={c.id}
                className={`rounded-2xl border overflow-hidden flex flex-col transition-all ${
                  chosen ? 'border-[#102a5c] ring-2 ring-[#102a5c]/15' : 'border-slate-100'
                }`}
              >
                <div className="h-1 w-full" style={{ backgroundColor: SLOT_COLORS[k] }} />
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <CandidateAvatar c={c} className="w-9 h-9" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#102a5c] truncate">{c.fullName}</div>
                      <div className="text-[11px] text-slate-500">
                        {count > 0 ? `${count} mesure${count > 1 ? 's' : ''} sur ce thème` : 'Aucune mesure sur ce thème'}
                      </div>
                    </div>
                  </div>

                  {count === 0 ? (
                    <p className="text-sm text-slate-500 italic">Ne s'exprime pas sur ce thème.</p>
                  ) : (
                    <>
                      {syn ? <Expandable text={syn.summary} lines={5} /> : (
                        <p className="text-sm text-slate-500">Pas encore de synthèse pour ce thème.</p>
                      )}
                      {syn && syn.keyFigures.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {syn.keyFigures.slice(0, 3).map((f, n) => (
                            <span key={n} className="text-[11px] bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-slate-600">
                              <span className="font-bold text-slate-800">{f.value}</span> {f.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {keys.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mesures phares</div>
                          <ul className="flex flex-col gap-1">
                            {keys.map((id) => {
                              const m = measureById.get(id);
                              return (
                                <li key={id} className="flex items-start gap-2 text-sm text-slate-700 leading-snug">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ backgroundColor: SLOT_COLORS[k] }} />
                                  {m ? <span>{m.title}</span> : <span className="h-3 w-3/4 mt-1 bg-slate-100 animate-pulse rounded-full" />}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenSheet(c.id, theme.id)}
                        className="self-start inline-flex items-center gap-1 text-xs font-bold text-[#1a56db] hover:underline"
                      >
                        Tout voir ({count}) <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  <div className="mt-auto pt-1 flex flex-col gap-2">
                    {count > 0 && (
                      <Button
                        onClick={() => choose(c.id)}
                        variant={chosen ? 'primary' : 'outline'}
                        className="w-full rounded-xl gap-1.5 text-sm"
                      >
                        {chosen && <Check className="w-4 h-4" strokeWidth={3} />} Le plus convaincant
                      </Button>
                    )}
                    {syn && <DkCredit url={syn.url} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(i - 1)}
            disabled={i === 0}
            aria-label="Thème précédent"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <Button
            onClick={() => choose(NONE)}
            variant="outline"
            className={`flex-1 py-2 rounded-xl text-sm ${choices[theme.id] === NONE ? 'border-[#102a5c] text-[#102a5c] font-bold' : ''}`}
          >
            {choices[theme.id] === NONE && <Check className="w-4 h-4 mr-1" strokeWidth={3} />} Sans préférence
          </Button>
          <button
            type="button"
            onClick={() => goTo(i + 1)}
            disabled={i === faThemes.length - 1}
            aria-label="Thème suivant"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {decided > 0 && (
          <Button
            onClick={() => { setShowVerdict(true); rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            className="w-full bg-[#102a5c] hover:bg-[#153b82] text-white py-2.5 rounded-xl gap-2"
          >
            <Trophy className="w-4 h-4" /> Voir mon verdict
          </Button>
        )}
      </div>
    </div>
  );
}

function VerdictView({
  selected, themes, choices, onGoTo, onReset,
}: {
  selected: CompCandidate[];
  themes: CompTheme[];
  choices: Choices;
  onGoTo: (j: number) => void;
  onReset: () => void;
}) {
  const tally = selected.map((c, k) => ({ c, k, n: themes.filter((t) => choices[t.id] === c.id).length }));
  const none = themes.filter((t) => choices[t.id] === NONE).length;
  const decided = themes.filter((t) => choices[t.id]).length;
  const best = Math.max(0, ...tally.map((t) => t.n));
  const winners = best > 0 ? tally.filter((t) => t.n === best) : [];
  const firstOpen = themes.findIndex((t) => !choices[t.id]);
  const byId = new Map(selected.map((c) => [c.id, c]));
  const plural = (n: number) => (n > 1 ? 's' : '');

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-4">
      <div className="text-center flex flex-col items-center gap-2">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Votre verdict</div>
        {winners.length === 1 && (
          <>
            <CandidateAvatar c={winners[0].c} className="w-16 h-16" />
            <div className="text-lg font-bold text-[#102a5c]">{winners[0].c.fullName}</div>
            <p className="text-sm text-slate-600">
              l'emporte sur {best} thème{plural(best)} sur {decided} tranché{plural(decided)}.
            </p>
          </>
        )}
        {winners.length > 1 && (
          <>
            <div className="text-lg font-bold text-[#102a5c]">Égalité</div>
            <p className="text-sm text-slate-600">
              {winners.map((w) => w.c.fullName).join(' et ')} : {best} thème{plural(best)} chacun.
            </p>
          </>
        )}
        {winners.length === 0 && (
          <p className="text-sm text-slate-600">Aucune préférence exprimée pour l'instant.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {tally.map(({ c, k, n }) => (
          <div key={c.id} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: SLOT_COLORS[k] }} />
            <span className="flex-1 text-slate-700 truncate">{c.fullName}</span>
            <span className="font-bold text-slate-800 tabular-nums">{n} thème{plural(n)}</span>
          </div>
        ))}
        {none > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0 bg-slate-200" />
            <span className="flex-1 text-slate-500">Sans préférence</span>
            <span className="font-bold text-slate-800 tabular-nums">{none} thème{plural(none)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vos choix, thème par thème</div>
        {themes.map((t, j) => {
          const v = choices[t.id];
          const label = !v ? 'Non tranché' : v === NONE ? 'Sans préférence' : byId.get(v)?.fullName ?? '—';
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onGoTo(j)}
              className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-50 text-left text-sm hover:bg-slate-50 -mx-1 px-1 rounded"
            >
              <span className="text-slate-700">{t.label}</span>
              <span className={`text-xs font-semibold ${v && v !== NONE ? 'text-[#102a5c]' : 'text-slate-400'}`}>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {firstOpen >= 0 && (
          <Button onClick={() => onGoTo(firstOpen)} className="flex-1 bg-[#102a5c] hover:bg-[#153b82] text-white py-2.5 rounded-xl gap-2">
            <ChevronRight className="w-4 h-4" /> Continuer ({themes.length - decided} thème{plural(themes.length - decided)})
          </Button>
        )}
        <Button onClick={onReset} variant="outline" className="flex-1 py-2.5 rounded-xl gap-2">
          <RotateCcw className="w-4 h-4" /> Recommencer
        </Button>
      </div>
      <p className="text-[11px] text-slate-400 text-center">Vos choix restent sur cet appareil : rien n'est envoyé.</p>
    </div>
  );
}
