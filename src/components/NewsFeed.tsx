import { useEffect, useMemo, useState } from 'react';
import { Newspaper, BadgeCheck, Search, X, ExternalLink, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Mode = 'news' | 'factcheck';

interface SourceLite {
  slug: string;
  name: string;
  orientation: string;
  color: string | null;
  homepage_url: string | null;
}
interface ThemeLite { id: string; slug: string; name: string; color: string | null }
interface CandidateLite { id: string; slug: string; first_name: string; last_name: string }
interface PartyLite { id: string; name: string; abbreviation: string | null; color: string | null }

interface ArticleRow {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  published_at: string;
  is_factcheck: boolean;
  verdict: string | null;
  source: SourceLite | null;
  article_themes: { theme: ThemeLite | null }[];
  article_candidates: { candidate: CandidateLite | null }[];
  article_parties: { party: PartyLite | null }[];
}

interface FilterOption {
  themes: ThemeLite[];
  candidates: CandidateLite[];
  parties: PartyLite[];
  orientations: string[];
}

const ORIENTATION_LABELS: Record<string, string> = {
  'gauche': 'Gauche',
  'centre': 'Centre',
  'centre-droit': 'Centre-droit',
  'droite': 'Droite',
  'transverse': 'Transverse',
  'factcheck': 'Fact-check',
};

const ORIENTATION_DOTS: Record<string, string> = {
  'gauche': '#e2001a',
  'centre': '#1a1a1a',
  'centre-droit': '#3c4ad6',
  'droite': '#cb1f24',
  'transverse': '#d63333',
  'factcheck': '#005baa',
};

const VERDICT_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  vrai: { label: 'Vrai', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  faux: { label: 'Faux', bg: 'bg-rose-100', text: 'text-rose-700' },
  trompeur: { label: 'Trompeur', bg: 'bg-amber-100', text: 'text-amber-700' },
  partiel: { label: 'Partiel', bg: 'bg-orange-100', text: 'text-orange-700' },
};

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function NewsFeed({ mode }: { mode: Mode }) {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterOption | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [selectedOrientations, setSelectedOrientations] = useState<Set<string>>(new Set());

  // Reset filters when switching mode
  useEffect(() => {
    setSelectedTheme(null);
    setSelectedCandidate(null);
    setSelectedParty(null);
    setSelectedOrientations(new Set());
    setSearch('');
  }, [mode]);

  // Fetch articles + filter options in parallel
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const articlesQuery = supabase
        .from('news_articles')
        .select(`
          id, url, title, summary, image_url, published_at, is_factcheck, verdict,
          source:news_sources(slug, name, orientation, color, homepage_url),
          article_themes(theme:themes(id, slug, name, color)),
          article_candidates(candidate:candidates(id, slug, first_name, last_name)),
          article_parties(party:parties(id, name, abbreviation, color))
        `)
        .eq('is_factcheck', mode === 'factcheck')
        .order('published_at', { ascending: false })
        .limit(200);

      const filtersPromise = filters
        ? Promise.resolve(null)
        : Promise.all([
            supabase.from('themes').select('id, slug, name, color').order('order_index'),
            supabase.from('candidates').select('id, slug, first_name, last_name').eq('is_published', true),
            supabase.from('parties').select('id, name, abbreviation, color').order('order_index'),
            supabase.from('news_sources').select('orientation').eq('is_active', true),
          ]);

      const [{ data: arts, error: aErr }, fdata] = await Promise.all([articlesQuery, filtersPromise]);
      if (cancelled) return;

      if (aErr) {
        setError(aErr.message);
        setLoading(false);
        return;
      }
      setArticles((arts ?? []) as unknown as ArticleRow[]);
      setLoading(false);

      if (fdata) {
        const [tRes, cRes, pRes, sRes] = fdata;
        const orientationSet = new Set<string>((sRes.data ?? []).map((r: any) => r.orientation));
        setFilters({
          themes: (tRes.data ?? []) as ThemeLite[],
          candidates: (cRes.data ?? []) as CandidateLite[],
          parties: (pRes.data ?? []) as PartyLite[],
          orientations: [...orientationSet].sort(),
        });
      }
    })();
    return () => { cancelled = true; };
  }, [mode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a) => {
      if (selectedTheme && !a.article_themes.some((x) => x.theme?.id === selectedTheme)) return false;
      if (selectedCandidate && !a.article_candidates.some((x) => x.candidate?.id === selectedCandidate)) return false;
      if (selectedParty && !a.article_parties.some((x) => x.party?.id === selectedParty)) return false;
      if (selectedOrientations.size > 0 && !(a.source && selectedOrientations.has(a.source.orientation))) return false;
      if (q) {
        const hay = `${a.title} ${a.summary ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [articles, search, selectedTheme, selectedCandidate, selectedParty, selectedOrientations]);

  const activeFilterCount =
    (selectedTheme ? 1 : 0) +
    (selectedCandidate ? 1 : 0) +
    (selectedParty ? 1 : 0) +
    selectedOrientations.size;

  const clearAll = () => {
    setSelectedTheme(null);
    setSelectedCandidate(null);
    setSelectedParty(null);
    setSelectedOrientations(new Set());
    setSearch('');
  };

  const isFactcheck = mode === 'factcheck';

  return (
    <div className="flex flex-col gap-4 w-full animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#102a5c] flex items-center gap-2">
          {isFactcheck ? <BadgeCheck className="w-5 h-5 text-indigo-600" /> : <Newspaper className="w-5 h-5 text-[#1a56db]" />}
          {isFactcheck ? 'Fact-checking' : 'Actualités'}
        </h2>
        <div className="text-xs text-slate-500">{filtered.length} / {articles.length}</div>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-2xl border border-slate-100 px-3 py-2 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isFactcheck ? 'Rechercher une vérification…' : 'Rechercher un article…'}
          className="flex-1 bg-transparent outline-none text-sm py-1"
        />
        {search && (
          <button onClick={() => setSearch('')} className="p-1 rounded hover:bg-slate-100">
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
            activeFilterCount > 0 || showFilters
              ? 'bg-[#102a5c] text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Filter className="w-3 h-3" />
          Filtres
          {activeFilterCount > 0 && <span className="text-[10px] opacity-80">({activeFilterCount})</span>}
        </button>
      </div>

      {/* Filter pane */}
      {showFilters && filters && (
        <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-4 flex flex-col gap-3">
          {/* Orientations */}
          {!isFactcheck && (
            <FilterRow label="Orientation">
              {filters.orientations.map((o) => {
                const active = selectedOrientations.has(o);
                return (
                  <Pill
                    key={o}
                    active={active}
                    onClick={() => {
                      const next = new Set(selectedOrientations);
                      if (active) next.delete(o); else next.add(o);
                      setSelectedOrientations(next);
                    }}
                    color={ORIENTATION_DOTS[o]}
                    label={ORIENTATION_LABELS[o] ?? o}
                  />
                );
              })}
            </FilterRow>
          )}

          {/* Themes */}
          <FilterRow label="Thème">
            {filters.themes.map((t) => (
              <Pill
                key={t.id}
                active={selectedTheme === t.id}
                onClick={() => setSelectedTheme(selectedTheme === t.id ? null : t.id)}
                color={t.color || '#94a3b8'}
                label={t.name}
              />
            ))}
          </FilterRow>

          {/* Candidates */}
          <FilterRow label="Candidat">
            {filters.candidates.map((c) => (
              <Pill
                key={c.id}
                active={selectedCandidate === c.id}
                onClick={() => setSelectedCandidate(selectedCandidate === c.id ? null : c.id)}
                label={`${c.first_name} ${c.last_name}`}
              />
            ))}
          </FilterRow>

          {/* Parties */}
          <FilterRow label="Parti">
            {filters.parties.map((p) => (
              <Pill
                key={p.id}
                active={selectedParty === p.id}
                onClick={() => setSelectedParty(selectedParty === p.id ? null : p.id)}
                color={p.color || '#94a3b8'}
                label={p.abbreviation || p.name}
              />
            ))}
          </FilterRow>

          {(activeFilterCount > 0 || search) && (
            <button
              onClick={clearAll}
              className="self-start text-xs font-semibold text-slate-500 hover:text-slate-700 underline"
            >
              Effacer tous les filtres
            </button>
          )}
        </div>
      )}

      {/* List */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100">
              <div className="w-1/3 h-3 bg-slate-100 animate-pulse rounded-full mb-3" />
              <div className="w-full h-4 bg-slate-200 animate-pulse rounded-full mb-2" />
              <div className="w-2/3 h-4 bg-slate-200 animate-pulse rounded-full mb-3" />
              <div className="w-full h-3 bg-slate-100 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-100">
          Aucun article ne correspond aux critères.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3 pb-4">
          {filtered.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pill({
  active, onClick, color, label,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border transition-all ${
        active
          ? 'bg-[#102a5c] text-white border-[#102a5c]'
          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
      }`}
    >
      {color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

function ArticleCard({ article }: { article: ArticleRow }) {
  const themes = article.article_themes.map((x) => x.theme).filter((t): t is ThemeLite => t !== null);
  const candidates = article.article_candidates.map((x) => x.candidate).filter((c): c is CandidateLite => c !== null);
  const parties = article.article_parties.map((x) => x.party).filter((p): p is PartyLite => p !== null);
  const verdict = article.verdict;
  const verdictStyle = verdict ? VERDICT_STYLES[verdict] : null;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all overflow-hidden"
    >
      <div className="flex gap-3 p-3 sm:p-4">
        {/* Image */}
        {article.image_url && (
          <div className="hidden sm:block w-28 h-28 shrink-0 rounded-xl overflow-hidden bg-slate-100">
            <img src={article.image_url} alt="" className="w-full h-full object-cover" loading="lazy"
                 onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Source line */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
            {article.source && (
              <span
                className="inline-flex items-center gap-1 font-bold uppercase tracking-wider"
                style={{ color: article.source.color || '#475569' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: article.source.color || '#475569' }}
                />
                {article.source.name}
              </span>
            )}
            <span>·</span>
            <span>{relativeTime(article.published_at)}</span>
            {verdictStyle && (
              <span className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${verdictStyle.bg} ${verdictStyle.text}`}>
                {verdictStyle.label}
              </span>
            )}
            <ExternalLink className="w-3 h-3 text-slate-300 ml-auto sm:hidden" />
          </div>

          {/* Title */}
          <h3 className="font-bold text-[#102a5c] leading-snug text-sm sm:text-base">
            {article.title}
          </h3>

          {/* Summary */}
          {article.summary && (
            <p className="text-xs sm:text-sm text-slate-600 leading-snug line-clamp-2">
              {article.summary}
            </p>
          )}

          {/* Tags */}
          {(themes.length || candidates.length || parties.length) > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {candidates.map((c) => (
                <span key={`c-${c.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-[#1a56db] px-1.5 py-0.5 rounded-full">
                  {c.first_name} {c.last_name}
                </span>
              ))}
              {parties.map((p) => (
                <span key={`p-${p.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full">
                  <span className="w-1 h-1 rounded-full" style={{ backgroundColor: p.color || '#94a3b8' }} />
                  {p.abbreviation || p.name}
                </span>
              ))}
              {themes.map((t) => (
                <span key={`t-${t.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">
                  <span className="w-1 h-1 rounded-full" style={{ backgroundColor: t.color || '#10b981' }} />
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
