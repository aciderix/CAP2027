import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Filter, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';

type CandidateRow = Tables<'candidates'>;
type PartyLite = Pick<Tables<'parties'>, 'name' | 'abbreviation' | 'color'>;
type ProgramRow = Tables<'candidate_programs'>;
type ThemeLite = Pick<Tables<'themes'>, 'id' | 'slug' | 'name' | 'color' | 'order_index'>;

type ProgramSection = {
  id: string;
  intro: string | null;
  content: string;
  order_index: number;
  theme: ThemeLite;
};

interface Props {
  candidateId: string;
  onBack: () => void;
}

function fullName(c: CandidateRow) {
  return `${c.first_name} ${c.last_name}`.trim();
}

function fallbackPhoto(c: CandidateRow) {
  return c.gender === 'F' ? '/card_red.png' : '/card_blue.png';
}

function anchorFor(themeSlug: string) {
  return `theme-${themeSlug}`;
}

export function ProgrammeDetail({ candidateId, onBack }: Props) {
  const [candidate, setCandidate] = useState<(CandidateRow & { parties: PartyLite | null }) | null>(null);
  const [sections, setSections] = useState<ProgramSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeThemeSlug, setActiveThemeSlug] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActiveThemeSlug(null);
    setFilterMode(false);

    (async () => {
      const [candRes, progRes] = await Promise.all([
        supabase
          .from('candidates')
          .select('*, parties(name, abbreviation, color)')
          .eq('id', candidateId)
          .single(),
        supabase
          .from('candidate_programs')
          .select('id, intro, content, order_index, themes(id, slug, name, color, order_index)')
          .eq('candidate_id', candidateId)
          .order('order_index'),
      ]);

      if (cancelled) return;
      if (candRes.error) {
        setError(candRes.error.message);
        setLoading(false);
        return;
      }

      const rawSections = (progRes.data ?? []) as unknown as Array<
        Pick<ProgramRow, 'id' | 'intro' | 'content' | 'order_index'> & { themes: ThemeLite | null }
      >;
      const safeSections: ProgramSection[] = rawSections
        .filter((s): s is typeof s & { themes: ThemeLite } => s.themes !== null)
        .map((s) => ({
          id: s.id,
          intro: s.intro,
          content: s.content,
          order_index: s.order_index,
          theme: s.themes,
        }))
        .sort((a, b) => a.theme.order_index - b.theme.order_index);

      setCandidate(candRes.data as CandidateRow & { parties: PartyLite | null });
      setSections(safeSections);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [candidateId]);

  const visibleSections = useMemo(() => {
    if (filterMode && activeThemeSlug) {
      return sections.filter((s) => s.theme.slug === activeThemeSlug);
    }
    return sections;
  }, [sections, filterMode, activeThemeSlug]);

  function scrollToTheme(slug: string) {
    setActiveThemeSlug(slug);
    if (filterMode) return;
    const el = document.getElementById(anchorFor(slug));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full animate-in fade-in duration-300">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[#1a56db] font-medium hover:underline w-fit px-2"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Retour aux programmes
      </button>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
          Impossible de charger ce programme : {error}
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl p-6 border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 animate-pulse" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="w-1/2 h-5 bg-slate-200 animate-pulse rounded-full" />
              <div className="w-1/3 h-3 bg-slate-100 animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      )}

      {!loading && candidate && (
        <>
          {/* Header */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-slate-50 shrink-0">
              <img decoding="async"
                src={candidate.photo_url || fallbackPhoto(candidate)}
                alt={fullName(candidate)}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Programme de
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-[#102a5c] leading-tight">
                {fullName(candidate)}
              </h2>
              {candidate.parties?.name && (
                <div className="text-sm text-slate-500 mt-0.5">{candidate.parties.name}</div>
              )}
            </div>
          </div>

          {sections.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-100">
              Le programme de ce candidat n'est pas encore publié.
            </div>
          ) : (
            <>
              {/* Theme chips (sticky-ish, scroll target / filter mode) */}
              <div className="sticky top-2 z-10 bg-slate-50/90 backdrop-blur-sm -mx-1 px-1 py-1 rounded-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  {sections.map((s) => {
                    const isActive = activeThemeSlug === s.theme.slug;
                    return (
                      <button
                        key={s.id}
                        onClick={() => scrollToTheme(s.theme.slug)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
                          isActive
                            ? 'bg-[#102a5c] text-white border-[#102a5c] shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: s.theme.color || '#94a3b8' }}
                        />
                        {s.theme.name}
                      </button>
                    );
                  })}

                  {activeThemeSlug && (
                    <button
                      onClick={() => setFilterMode((m) => !m)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
                        filterMode
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {filterMode ? (
                        <>
                          <X className="w-3.5 h-3.5" />
                          Tous les thèmes
                        </>
                      ) : (
                        <>
                          <Filter className="w-3.5 h-3.5" />
                          Filtrer ce thème
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Sommaire (visible only when not filtered) */}
              {!filterMode && sections.length > 1 && (
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Sommaire
                  </div>
                  <ol className="space-y-1.5">
                    {sections.map((s, i) => (
                      <li key={s.id}>
                        <button
                          onClick={() => scrollToTheme(s.theme.slug)}
                          className="text-left text-sm text-slate-700 hover:text-[#1a56db] hover:underline w-full"
                        >
                          <span className="text-slate-400 font-mono mr-2">
                            {String(i + 1).padStart(2, '0')}.
                          </span>
                          {s.theme.name}
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Sections */}
              <div className="flex flex-col gap-4">
                {visibleSections.map((s) => (
                  <section
                    key={s.id}
                    id={anchorFor(s.theme.slug)}
                    className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 scroll-mt-24"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: s.theme.color || '#94a3b8' }}
                      />
                      <h3 className="text-lg sm:text-xl font-bold text-[#102a5c]">
                        {s.theme.name}
                      </h3>
                    </div>
                    {s.intro && (
                      <p className="text-sm text-slate-600 italic mb-4">{s.intro}</p>
                    )}
                    <div className="prose-program">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {s.content}
                      </ReactMarkdown>
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
