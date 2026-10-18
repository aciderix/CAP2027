// Comparateur v2, sur les programmes analysés par Demos Kratos (interface
// reprise de demos-kratos.fr/comparateur) : sélection de 2 à 3 candidats,
// proximité des programmes, répartition des mesures par thème, face-à-face
// thème par thème, et fiche programme de chaque candidat.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Pencil, Scale, X } from 'lucide-react';
import {
  COMPARATEUR_QUERY_KEY, fetchAffinities, fetchComparateurBase, fetchSyntheses, type CompCandidate,
} from '../lib/comparateurData';
import { DK_LICENCE_URL } from '../lib/dkShared';
import { openLink } from '../lib/openLink';
import { STABLE_STALE_MS } from '../lib/queryClient';
import { ComparateurFaceAFace } from './ComparateurFaceAFace';
import { ComparateurProximite } from './ComparateurProximite';
import { ComparateurRepartition } from './ComparateurRepartition';
import { CandidateAvatar, DkCredit, SLOT_COLORS } from './comparateurUi';
import { DkProgrammeSheet } from './DkProgrammeSheet';
import { Button } from './ui/Button';

const MAX_SELECTED = 3;
const SELECTED_KEY = 'cap2027.comparateur.v2.selected';

function readSelected(): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(SELECTED_KEY) ?? '[]');
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function Comparateur() {
  const baseQuery = useQuery({
    queryKey: COMPARATEUR_QUERY_KEY,
    queryFn: fetchComparateurBase,
    staleTime: STABLE_STALE_MS,
  });
  const base = baseQuery.data;

  const [selectedIds, setSelectedIds] = useState<string[]>(readSelected);
  // Grille ouverte tant que la sélection n'est pas validée (« Comparer ») ou complète.
  const [pickerOpen, setPickerOpen] = useState(() => readSelected().length < 2);
  const [sheet, setSheet] = useState<{ candidateId: string; themeId: string | null } | null>(null);
  const [focus, setFocus] = useState<{ themeId: string; n: number } | null>(null);
  const faceRef = useRef<HTMLElement>(null);

  // Candidats comparables : ceux dont Demos Kratos a analysé le programme.
  const byId = useMemo(() => new Map((base?.candidates ?? []).map((c) => [c.id, c])), [base]);
  const selected = useMemo(
    () => selectedIds.map((id) => byId.get(id)).filter((c): c is CompCandidate => !!c && c.measureCount > 0),
    [selectedIds, byId],
  );
  const ids = selected.map((c) => c.id);
  const sortedIds = [...ids].sort();

  useEffect(() => {
    try { localStorage.setItem(SELECTED_KEY, JSON.stringify(selectedIds)); } catch { /* best-effort */ }
  }, [selectedIds]);

  // Un candidat retiré de l'export (ou sans programme) sort de la sélection.
  useEffect(() => {
    if (!base || selected.length === selectedIds.length) return;
    setSelectedIds(selected.map((c) => c.id));
    if (selected.length < 2) setPickerOpen(true);
  }, [base, selected, selectedIds.length]);

  const showPicker = pickerOpen || selected.length < 2;
  const comparing = !showPicker;

  const affQuery = useQuery({
    queryKey: ['dkAffinities', sortedIds],
    queryFn: () => fetchAffinities(sortedIds),
    enabled: comparing,
    staleTime: STABLE_STALE_MS,
  });
  const synQuery = useQuery({
    queryKey: ['dkSyntheses', sortedIds],
    queryFn: () => fetchSyntheses(sortedIds),
    enabled: comparing,
    staleTime: STABLE_STALE_MS,
  });

  function toggle(c: CompCandidate) {
    if (c.measureCount === 0) return;
    if (ids.includes(c.id)) {
      setSelectedIds(ids.filter((id) => id !== c.id));
      return;
    }
    if (ids.length >= MAX_SELECTED) return;
    const next = [...ids, c.id];
    setSelectedIds(next);
    if (next.length === MAX_SELECTED) setPickerOpen(false);
  }

  function remove(id: string) {
    const next = ids.filter((x) => x !== id);
    setSelectedIds(next);
    if (next.length < 2) setPickerOpen(true);
  }

  function pickTheme(themeId: string) {
    setFocus((f) => ({ themeId, n: (f?.n ?? 0) + 1 }));
    faceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const error = baseQuery.error || affQuery.error || synQuery.error;
  const withProgramme = (base?.candidates ?? []).filter((c) => c.measureCount > 0);
  const withoutProgramme = (base?.candidates ?? []).filter((c) => c.measureCount === 0);
  const sheetCandidate = sheet ? byId.get(sheet.candidateId) ?? null : null;

  return (
    <div className="flex flex-col gap-4 w-full animate-in fade-in duration-300">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-[#102a5c] flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-600" />
          Comparateur
        </h2>
        <p className="text-sm text-slate-600">
          Choisissez 2 ou 3 candidats : proximité de leurs programmes, thèmes privilégiés, et face-à-face thème par thème.
        </p>
        {base && <DkCredit url={base.sourceUrl} />}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
          Impossible de charger les données : {(error as Error).message}
        </div>
      )}

      {baseQuery.isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 8 }, (_, n) => (
            <div key={n} className="h-[132px] bg-white rounded-2xl border border-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {base && showPicker && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Candidats · {selected.length}/{MAX_SELECTED}
            </span>
            {selected.length >= 2 && (
              <Button size="sm" onClick={() => setPickerOpen(false)} className="rounded-full">
                Comparer ({selected.length})
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {withProgramme.map((c) => {
              const slot = ids.indexOf(c.id);
              const active = slot >= 0;
              const full = !active && selected.length >= MAX_SELECTED;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c)}
                  disabled={full}
                  aria-pressed={active}
                  className={`relative bg-white rounded-2xl border p-3 flex flex-col items-center text-center gap-1.5 transition-all ${
                    active ? 'border-[#102a5c] ring-2 ring-[#102a5c]/15' : 'border-slate-100 hover:border-slate-300'
                  } ${full ? 'opacity-40' : ''}`}
                >
                  {active && (
                    <span
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: SLOT_COLORS[slot] }}
                    >
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                  )}
                  <CandidateAvatar c={c} className="w-14 h-14" />
                  <span className="text-sm font-bold text-[#102a5c] leading-tight">{c.fullName}</span>
                  {c.party && <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold leading-tight line-clamp-2">{c.party}</span>}
                  <span className="text-[10px] text-slate-400">{c.measureCount} mesures</span>
                </button>
              );
            })}
            {withoutProgramme.map((c) => (
              <div
                key={c.id}
                className="bg-slate-50 rounded-2xl border border-slate-100 p-3 flex flex-col items-center text-center gap-1.5 opacity-60"
                aria-disabled
              >
                <CandidateAvatar c={c} className="w-14 h-14 grayscale" />
                <span className="text-sm font-bold text-slate-600 leading-tight">{c.fullName}</span>
                <span className="text-[10px] text-slate-500">Programme non disponible</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {base && !showPicker && (
        <div className="flex flex-wrap items-center gap-2">
          {selected.map((c, k) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-1 pr-1 py-1">
              <button
                type="button"
                onClick={() => setSheet({ candidateId: c.id, themeId: null })}
                className="inline-flex items-center gap-1.5"
                aria-label={`Programme de ${c.fullName}`}
              >
                <CandidateAvatar c={c} className="w-7 h-7" />
                <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: SLOT_COLORS[k] }} />
                <span className="text-xs font-bold text-[#102a5c]">{c.fullName}</span>
              </button>
              <button
                type="button"
                onClick={() => remove(c.id)}
                aria-label={`Retirer ${c.fullName}`}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#1a56db] px-2 py-1.5"
          >
            <Pencil className="w-3.5 h-3.5" /> Modifier
          </button>
        </div>
      )}

      {base && comparing && (
        <>
          <section className="flex flex-col gap-2">
            <SectionTitle title="Proximité" subtitle="Ces candidats sont-ils proches ?" />
            <ComparateurProximite
              selected={selected}
              affinities={affQuery.data ?? []}
              themes={base.themes}
              loading={affQuery.isLoading}
              onPickTheme={pickTheme}
            />
          </section>

          <section className="flex flex-col gap-2">
            <SectionTitle title="Vue d'ensemble" subtitle="Répartition des mesures par thème" />
            <ComparateurRepartition selected={selected} themes={base.themes} />
          </section>

          <section ref={faceRef} className="flex flex-col gap-2 scroll-mt-24">
            <SectionTitle title="Le face-à-face" subtitle="Thème par thème, qui vous convainc ?" />
            <ComparateurFaceAFace
              selected={selected}
              themes={base.themes}
              affinities={affQuery.data ?? []}
              syntheses={synQuery.data ?? []}
              focus={focus}
              onOpenSheet={(candidateId, themeId) => setSheet({ candidateId, themeId })}
            />
          </section>
        </>
      )}

      {base && (
        <p className="text-[11px] text-slate-400 leading-snug pb-2">
          {base.attribution}{' '}
          <button type="button" onClick={() => void openLink(DK_LICENCE_URL)} className="underline">Licence CC BY-NC 4.0</button>
        </p>
      )}

      <DkProgrammeSheet
        candidate={sheetCandidate}
        initialThemeId={sheet?.themeId ?? null}
        themes={base?.themes ?? []}
        attribution={base?.attribution ?? ''}
        generatedAt={base?.generatedAt ?? null}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-1">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</div>
      <h3 className="text-base font-bold text-[#102a5c]">{subtitle}</h3>
    </div>
  );
}
