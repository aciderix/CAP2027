import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, ChevronRight, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';
import { COMPARATEUR_QUERY_KEY, fetchComparateurBase, type CompCandidate } from '../lib/comparateurData';
import { STABLE_STALE_MS } from '../lib/queryClient';
import { ProgrammeDetail } from './ProgrammeDetail';
import { DkProgrammeView } from './DkProgrammeSheet';
import { CandidateAvatar, DkCredit } from './comparateurUi';
import { Button } from './ui/Button';

type CandidateRow = Tables<'candidates'>;
type PartyLite = Pick<Tables<'parties'>, 'name' | 'abbreviation' | 'color'>;
type CandidateWithParty = CandidateRow & { parties: PartyLite | null };

type OurCandidate = CandidateWithParty & { themeCount: number };

/** Une ligne de la liste : programme analysé par Demos Kratos, et/ou notre
 *  livret (candidate_programs, saisi dans l'admin) pour un candidat publié. */
interface Entry {
  key: string;
  name: string;
  party: string | null;
  photo: { photoUrl: string | null; gender: string | null };
  dk: CompCandidate | null;
  ours: OurCandidate | null;
}

type Selection = { kind: 'dk'; id: string } | { kind: 'ours'; id: string };

function fullName(c: CandidateRow) {
  return `${c.first_name} ${c.last_name}`.trim();
}

/** Lowercase + strip diacritics so "Pecresse" matches "Pécresse". */
function normaliseSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

async function fetchOurProgrammes(): Promise<OurCandidate[]> {
  const [candRes, progRes] = await Promise.all([
    supabase
      .from('candidates')
      .select('*, parties(name, abbreviation, color)')
      .eq('is_published', true),
    supabase.from('candidate_programs').select('candidate_id'),
  ]);
  if (candRes.error) throw candRes.error;
  const counts = new Map<string, number>();
  for (const row of progRes.data ?? []) {
    counts.set(row.candidate_id, (counts.get(row.candidate_id) ?? 0) + 1);
  }
  return ((candRes.data ?? []) as CandidateWithParty[])
    .map((c) => ({ ...c, themeCount: counts.get(c.id) ?? 0 }));
}

export function ProgrammesList() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Selection | null>(null);

  const baseQuery = useQuery({
    queryKey: COMPARATEUR_QUERY_KEY,
    queryFn: fetchComparateurBase,
    staleTime: STABLE_STALE_MS,
  });
  const oursQuery = useQuery({
    queryKey: ['ourProgrammes'],
    queryFn: fetchOurProgrammes,
    staleTime: STABLE_STALE_MS,
  });
  const base = baseQuery.data;
  const loading = baseQuery.isLoading || oursQuery.isLoading;
  const error = baseQuery.error || oursQuery.error;

  useEffect(() => {
    if (selected) window.scrollTo({ top: 0 });
  }, [selected]);

  const entries = useMemo(() => {
    const ours = oursQuery.data ?? [];
    const oursBySlug = new Map(ours.map((c) => [c.slug, c]));
    const linked = new Set<string>();
    const list: Entry[] = (base?.candidates ?? []).map((dk) => {
      const o = dk.ourSlug ? oursBySlug.get(dk.ourSlug) ?? null : null;
      if (o) linked.add(o.id);
      return { key: `dk:${dk.id}`, name: dk.fullName, party: dk.party, photo: dk, dk, ours: o };
    });
    for (const o of ours) {
      if (linked.has(o.id)) continue;
      list.push({
        key: `ours:${o.id}`,
        name: fullName(o),
        party: o.parties?.name || o.parties?.abbreviation || null,
        photo: { photoUrl: o.photo_url, gender: o.gender },
        dk: null,
        ours: o,
      });
    }
    // Programmes disponibles d'abord, puis par nom.
    const available = (e: Entry) => (e.dk?.measureCount ?? 0) > 0 || (e.ours?.themeCount ?? 0) > 0;
    return list.sort((a, b) => Number(available(b)) - Number(available(a))
      || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  }, [base, oursQuery.data]);

  const filtered = useMemo(() => {
    const q = normaliseSearch(search);
    if (!q) return entries;
    return entries.filter((e) => normaliseSearch(e.name).includes(q) || normaliseSearch(e.party ?? '').includes(q));
  }, [entries, search]);

  if (selected?.kind === 'ours') {
    return <ProgrammeDetail candidateId={selected.id} onBack={() => setSelected(null)} />;
  }

  const dkSelected = selected?.kind === 'dk' ? entries.find((e) => e.dk?.id === selected.id) : undefined;
  if (dkSelected?.dk && base) {
    const o = dkSelected.ours;
    return (
      <div className="flex flex-col gap-4 w-full animate-in fade-in duration-300">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-[#1a56db] font-medium hover:underline w-fit px-2"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Retour aux programmes
        </button>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6">
          <DkProgrammeView
            candidate={dkSelected.dk}
            initialThemeId={null}
            themes={base.themes}
            attribution={base.attribution}
            generatedAt={base.generatedAt}
            withName
          >
            {o && o.themeCount > 0 && (
              <button
                type="button"
                onClick={() => setSelected({ kind: 'ours', id: o.id })}
                className="self-start inline-flex items-center gap-1.5 text-xs font-bold text-[#1a56db] hover:underline"
              >
                <BookOpen className="w-3.5 h-3.5" /> Synthèse CAP 2027 ({o.themeCount} thème{o.themeCount > 1 ? 's' : ''})
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </DkProgrammeView>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full animate-in fade-in duration-300">
      <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 w-full">
        <h2 className="text-xl font-bold text-[#102a5c] shrink-0">Programmes</h2>
        <div className="relative w-full max-w-[200px] sm:w-64 sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#102a5c] focus:border-[#102a5c] text-sm transition-all shadow-sm"
            placeholder="Rechercher un candidat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
          Impossible de charger les programmes : {(error as Error).message}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-100">
          {search ? 'Aucun candidat ne correspond à votre recherche.' : 'Aucun programme publié pour le moment.'}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {loading && [1, 2, 3].map((i) => (
          <div key={`sk-${i}`} className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 animate-pulse" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="w-1/3 h-4 bg-slate-100 animate-pulse rounded-full" />
              <div className="w-1/2 h-3 bg-slate-100 animate-pulse rounded-full" />
            </div>
          </div>
        ))}

        {filtered.map((e) => {
          const measures = e.dk?.measureCount ?? 0;
          const dkThemes = e.dk ? Object.values(e.dk.themeCounts).filter((n) => n > 0).length : 0;
          const ourThemes = e.ours?.themeCount ?? 0;
          const empty = measures === 0 && ourThemes === 0;
          const open = () => {
            if (measures > 0) setSelected({ kind: 'dk', id: e.dk!.id });
            else if (ourThemes > 0) setSelected({ kind: 'ours', id: e.ours!.id });
          };
          return (
            <button
              key={e.key}
              onClick={open}
              disabled={empty}
              className={`bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-4 text-left transition-all w-full ${
                empty ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md hover:border-slate-200 cursor-pointer'
              }`}
            >
              <CandidateAvatar c={e.photo} className="w-12 h-12" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[#102a5c] truncate">{e.name}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 min-w-0">
                  {e.party && (
                    <>
                      <span className="font-semibold uppercase tracking-wider truncate">{e.party}</span>
                      <span className="text-slate-300">•</span>
                    </>
                  )}
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <BookOpen className="w-3 h-3" />
                    {measures > 0
                      ? `${measures} mesures · ${dkThemes} thèmes`
                      : ourThemes > 0
                        ? `${ourThemes} thème${ourThemes > 1 ? 's' : ''}`
                        : 'Programme à venir'}
                  </span>
                </div>
              </div>
              {!empty && <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />}
            </button>
          );
        })}
      </div>

      {base && !loading && (
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-[11px] text-slate-400 leading-snug">{base.attribution}</p>
          <DkCredit url={base.sourceUrl} />
        </div>
      )}

      {!loading && !error && filtered.length > 0 && search && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setSearch('')}>
            Effacer la recherche
          </Button>
        </div>
      )}
    </div>
  );
}
