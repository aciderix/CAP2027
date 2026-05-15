import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Newspaper, BadgeCheck, Search, X, ExternalLink,
  SlidersHorizontal, Sparkles,
} from 'lucide-react';
import Fuse from 'fuse.js';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { ARTICLE_STALE_MS, STABLE_STALE_MS } from '../lib/queryClient';
import { TwitterPostCard } from './TwitterPostCard';
import { useFollowedOrientations } from '../lib/orientationFollows';
import { openLink } from '../lib/openLink';

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

const ORIENTATION_META: Record<string, { label: string; short: string; dot: string }> = {
  'gauche':       { label: 'Gauche',       short: 'Gauche',  dot: '#e2001a' },
  'centre':       { label: 'Centre',       short: 'Centre',  dot: '#475569' },
  'centre-droit': { label: 'Centre-droit', short: 'C.-droit',dot: '#3c4ad6' },
  'droite':       { label: 'Droite',       short: 'Droite',  dot: '#cb1f24' },
  'transverse':   { label: 'Transverse',   short: 'Transv.', dot: '#7c3aed' },
  'factcheck':    { label: 'Fact-check',   short: 'Fact',    dot: '#005baa' },
};

const VERDICT_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  vrai:     { label: 'Vrai',     bg: 'bg-emerald-100', text: 'text-emerald-700' },
  faux:     { label: 'Faux',     bg: 'bg-rose-100',    text: 'text-rose-700' },
  trompeur: { label: 'Trompeur', bg: 'bg-amber-100',   text: 'text-amber-800' },
  partiel:  { label: 'Partiel',  bg: 'bg-orange-100',  text: 'text-orange-700' },
};

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function fullName(c: CandidateLite) {
  return `${c.first_name} ${c.last_name}`;
}

export function NewsFeed({ mode }: { mode: Mode }) {
  const [search, setSearch] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  // Persistent multi-select: drives both the in-app feed filter and
  // the push-broadcast filter for press notifs. Empty set = "no
  // filter, receive everything" (opt-in restrictif with lenient
  // default). See lib/orientationFollows.ts.
  const { followed: followedOrientations, toggle: toggleOrientation, clear: clearOrientations } =
    useFollowedOrientations();
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [selectedParty, setSelectedParty] = useState<string | null>(null);

  const isFactcheck = mode === 'factcheck';

  // Reset transient filters on mode switch. Orientation set is
  // persistent across mode switches (it's a saved user preference).
  useEffect(() => {
    setSelectedTheme(null);
    setSelectedCandidate(null);
    setSelectedParty(null);
    setSearch('');
    setAdvancedOpen(false);
  }, [mode]);

  // Articles: 30 min stale (server cron runs hourly), focus refetch.
  const articlesQuery = useQuery({
    queryKey: ['articles', mode],
    staleTime: ARTICLE_STALE_MS,
    queryFn: async (): Promise<ArticleRow[]> => {
      const { data, error } = await supabase
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
      if (error) throw error;
      return (data ?? []) as unknown as ArticleRow[];
    },
  });

  // Filter options: reference data, very stable.
  const filtersQuery = useQuery({
    queryKey: ['newsFeedFilters'],
    staleTime: STABLE_STALE_MS,
    queryFn: async (): Promise<FilterOption> => {
      const [tRes, cRes, pRes, sRes] = await Promise.all([
        supabase.from('themes').select('id, slug, name, color').order('order_index'),
        supabase.from('candidates').select('id, slug, first_name, last_name').eq('is_published', true),
        supabase.from('parties').select('id, name, abbreviation, color').order('order_index'),
        supabase.from('news_sources').select('orientation').eq('is_active', true),
      ]);
      const orientationSet = new Set<string>((sRes.data ?? []).map((r: any) => r.orientation));
      const order = ['gauche','centre','centre-droit','droite','transverse','factcheck'];
      const orientations = [...orientationSet].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      return {
        themes: (tRes.data ?? []) as ThemeLite[],
        candidates: (cRes.data ?? []) as CandidateLite[],
        parties: (pRes.data ?? []) as PartyLite[],
        orientations,
      };
    },
  });

  const articles = articlesQuery.data ?? [];
  const filters = filtersQuery.data ?? null;
  const loading = articlesQuery.isLoading;
  const error = articlesQuery.error?.message ?? null;

  // Filter by chips first (cheap), then run fuzzy search on the result.
  const chipFiltered = useMemo(() => {
    return articles.filter((a) => {
      if (selectedTheme && !a.article_themes.some((x) => x.theme?.id === selectedTheme)) return false;
      // Orientation filter: empty set = no filter, non-empty = must
      // be one of the followed orientations (only applied in news
      // mode — factcheck has its own dedicated tab).
      if (!isFactcheck && followedOrientations.size > 0) {
        const o = a.source?.orientation;
        if (!o || !followedOrientations.has(o)) return false;
      }
      if (selectedCandidate && !a.article_candidates.some((x) => x.candidate?.id === selectedCandidate)) return false;
      if (selectedParty && !a.article_parties.some((x) => x.party?.id === selectedParty)) return false;
      return true;
    });
  }, [articles, selectedTheme, followedOrientations, selectedCandidate, selectedParty, isFactcheck]);

  // Fuzzy search: tolerates typos and missing accents (e.g. "melanchon" → Mélenchon).
  const fuse = useMemo(() => new Fuse(chipFiltered, {
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'summary', weight: 0.3 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 3,
    ignoreDiacritics: true,
  }), [chipFiltered]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (q.length < 2) return chipFiltered;
    return fuse.search(q).map((r) => r.item);
  }, [chipFiltered, fuse, search]);

  const advancedFilterCount = (selectedCandidate ? 1 : 0) + (selectedParty ? 1 : 0);

  const headerCount = filtered.length;
  const totalCount = articles.length;

  const featured = filtered[0];
  const rest = filtered.slice(1);

  const clearAll = () => {
    setSelectedTheme(null);
    clearOrientations();
    setSelectedCandidate(null);
    setSelectedParty(null);
    setSearch('');
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full animate-in fade-in duration-300">
      {/* Hero */}
      <div className={`rounded-[24px] p-5 sm:p-6 text-white relative overflow-hidden ${
        isFactcheck
          ? 'bg-gradient-to-br from-indigo-700 to-violet-600'
          : 'bg-gradient-to-br from-[#102a5c] to-[#1a56db]'
      }`}>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
            {isFactcheck ? <BadgeCheck className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isFactcheck ? 'Vérifications' : 'Fil d\'actualité'}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold leading-tight">
            {isFactcheck ? 'Le vrai du faux de la campagne' : 'Toute l\'actualité présidentielle'}
          </h2>
          <p className="text-sm opacity-80 mt-1.5">
            {isFactcheck
              ? `${totalCount} vérifications agrégées depuis les rédactions de fact-checking françaises.`
              : `${totalCount} articles agrégés des principaux titres de la presse française.`}
          </p>
        </div>
        {isFactcheck
          ? <BadgeCheck className="absolute -right-6 -bottom-6 w-40 h-40 opacity-10" strokeWidth={1.5} />
          : <Newspaper className="absolute -right-6 -bottom-6 w-40 h-40 opacity-10" strokeWidth={1.5} />}
      </div>

      {/* Search + advanced */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white rounded-full border border-slate-100 shadow-sm px-3 py-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isFactcheck ? 'Rechercher une vérification…' : 'Rechercher dans le fil…'}
            className="flex-1 bg-transparent outline-none text-sm py-0.5 min-w-0"
          />
          {search && (
            <button onClick={() => setSearch('')} className="p-1 rounded-full hover:bg-slate-100 shrink-0">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border transition-all ${
            advancedFilterCount > 0 || advancedOpen
              ? 'bg-[#102a5c] text-white border-[#102a5c]'
              : 'bg-white text-slate-700 border-slate-100 hover:border-slate-300'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filtres</span>
          {advancedFilterCount > 0 && (
            <span className="text-[10px] px-1 rounded-full bg-white/20">{advancedFilterCount}</span>
          )}
        </button>
      </div>

      {/* Filter ribbons */}
      {filters && (
        <div className="flex flex-col gap-2">
          {/* Orientations (news only). Multi-select, persisted locally
              and mirrored to push_token_orientations so the server can
              filter press notifs the same way. */}
          {!isFactcheck && filters.orientations.length > 0 && (
            <ScrollRow label="Orientations suivies">
              <Chip
                active={followedOrientations.size === 0}
                onClick={() => clearOrientations()}
                label="Toutes"
              />
              {filters.orientations.map((o) => {
                const meta = ORIENTATION_META[o];
                return (
                  <Chip
                    key={o}
                    active={followedOrientations.has(o)}
                    onClick={() => toggleOrientation(o)}
                    label={meta?.short ?? o}
                    dotColor={meta?.dot}
                  />
                );
              })}
            </ScrollRow>
          )}

          {/* Themes */}
          {filters.themes.length > 0 && (
            <ScrollRow label="Thèmes">
              <Chip
                active={selectedTheme === null}
                onClick={() => setSelectedTheme(null)}
                label="Tous"
              />
              {filters.themes.map((t) => (
                <Chip
                  key={t.id}
                  active={selectedTheme === t.id}
                  onClick={() => setSelectedTheme(selectedTheme === t.id ? null : t.id)}
                  label={t.name}
                  dotColor={t.color || '#94a3b8'}
                />
              ))}
            </ScrollRow>
          )}
        </div>
      )}

      {/* Advanced drawer */}
      {advancedOpen && filters && (
        <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-4 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
          <DrawerRow label="Candidat">
            <Chip
              active={selectedCandidate === null}
              onClick={() => setSelectedCandidate(null)}
              label="Tous"
            />
            {filters.candidates.map((c) => (
              <Chip
                key={c.id}
                active={selectedCandidate === c.id}
                onClick={() => setSelectedCandidate(selectedCandidate === c.id ? null : c.id)}
                label={fullName(c)}
              />
            ))}
          </DrawerRow>
          <DrawerRow label="Parti">
            <Chip
              active={selectedParty === null}
              onClick={() => setSelectedParty(null)}
              label="Tous"
            />
            {filters.parties.map((p) => (
              <Chip
                key={p.id}
                active={selectedParty === p.id}
                onClick={() => setSelectedParty(selectedParty === p.id ? null : p.id)}
                label={p.abbreviation || p.name}
                dotColor={p.color || '#94a3b8'}
              />
            ))}
          </DrawerRow>
          {(selectedTheme || followedOrientations.size > 0 || selectedCandidate || selectedParty || search) && (
            <button
              onClick={clearAll}
              className="self-start inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700"
            >
              <X className="w-3 h-3" /> Effacer tous les filtres
            </button>
          )}
        </div>
      )}

      {/* Result counter */}
      <div className="text-[11px] text-slate-500 px-1">
        {loading ? 'Chargement…' : `${headerCount} ${isFactcheck ? 'vérification' : 'article'}${headerCount > 1 ? 's' : ''}${headerCount !== totalCount ? ` sur ${totalCount}` : ''}`}
      </div>

      {/* Errors */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl p-3 text-sm">
          Erreur de chargement : {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col gap-3">
          <SkeletonCard featured />
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <div className="font-bold text-[#102a5c]">Aucun résultat</div>
            <div className="text-sm text-slate-500 mt-1">Essayez d'élargir les filtres ou la recherche.</div>
          </div>
          <button
            onClick={clearAll}
            className="mt-2 text-xs font-bold text-[#1a56db] hover:underline"
          >
            Réinitialiser
          </button>
        </div>
      )}

      {/* Featured + list */}
      {!loading && featured && (
        <div className="flex flex-col gap-3 pb-4">
          {featured.kind === 'twitter_post' ? (
            <TwitterPostCard
              title={featured.title}
              summary={featured.summary}
              url={featured.url}
              image_url={featured.image_url}
              published_at={featured.published_at}
              source={featured.source}
              candidateName={
                featured.article_candidates
                  .map((x) => x.candidate)
                  .filter((c): c is CandidateLite => !!c)
                  .map((c) => fullName(c))[0] ?? null
              }
            />
          ) : (
            <FeaturedCard article={featured} />
          )}
          {rest.map((a) => {
            if (a.kind === 'twitter_post') {
              const candidate = a.article_candidates
                .map((x) => x.candidate)
                .filter((c): c is CandidateLite => !!c)[0] ?? null;
              return (
                <TwitterPostCard
                  key={a.id}
                  title={a.title}
                  summary={a.summary}
                  url={a.url}
                  image_url={a.image_url}
                  published_at={a.published_at}
                  source={a.source}
                  candidateName={candidate ? fullName(candidate) : null}
                />
              );
            }
            return <CompactCard key={a.id} article={a} />;
          })}
        </div>
      )}
    </div>
  );
}

// ----------- Sub-components -----------

function ScrollRow({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <div>
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div
        ref={ref}
        className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {children}
      </div>
    </div>
  );
}

function DrawerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active, onClick, label, dotColor,
}: { active: boolean; onClick: () => void; label: string; dotColor?: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all whitespace-nowrap ${
        active
          ? 'bg-[#102a5c] text-white border-[#102a5c] shadow-sm'
          : 'bg-white text-slate-700 border-slate-100 hover:border-slate-300'
      }`}
    >
      {dotColor && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />}
      {label}
    </button>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const v = VERDICT_STYLES[verdict];
  if (!v) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${v.bg} ${v.text}`}>
      {v.label}
    </span>
  );
}

function SourceLine({ source, time }: { source: SourceLite | null; time: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
      {source && (
        <>
          <span
            className="font-bold uppercase tracking-wider"
            style={{ color: source.color || '#475569' }}
          >
            {source.name}
          </span>
          <span className="text-slate-300">·</span>
        </>
      )}
      <span>{time}</span>
    </div>
  );
}

function TagChips({
  themes, candidates, parties, max = 3,
}: { themes: ThemeLite[]; candidates: CandidateLite[]; parties: PartyLite[]; max?: number }) {
  const items: React.ReactNode[] = [];
  for (const c of candidates) {
    items.push(
      <span key={`c-${c.id}`} className="inline-flex items-center text-[10px] font-bold bg-blue-50 text-[#1a56db] px-1.5 py-0.5 rounded-full">
        {fullName(c)}
      </span>
    );
  }
  for (const p of parties) {
    items.push(
      <span key={`p-${p.id}`} className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full">
        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: p.color || '#94a3b8' }} />
        {p.abbreviation || p.name}
      </span>
    );
  }
  for (const t of themes) {
    items.push(
      <span key={`t-${t.id}`} className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">
        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: t.color || '#10b981' }} />
        {t.name}
      </span>
    );
  }
  if (items.length === 0) return null;
  const visible = items.slice(0, max);
  const overflow = items.length - max;
  return (
    <div className="flex flex-wrap gap-1">
      {visible}
      {overflow > 0 && (
        <span className="inline-flex items-center text-[10px] font-bold text-slate-400 px-1.5 py-0.5">
          +{overflow}
        </span>
      )}
    </div>
  );
}

function FallbackThumb({ source }: { source: SourceLite | null }) {
  const initial = (source?.name ?? '?').replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 2).toUpperCase() || '?';
  return (
    <div
      className="w-full h-full flex items-center justify-center text-white font-black text-2xl"
      style={{ backgroundColor: source?.color || '#94a3b8' }}
    >
      {initial}
    </div>
  );
}

function FeaturedCard({ article }: { article: ArticleRow }) {
  const themes = article.article_themes.map((x) => x.theme).filter((t): t is ThemeLite => !!t);
  const candidates = article.article_candidates.map((x) => x.candidate).filter((c): c is CandidateLite => !!c);
  const parties = article.article_parties.map((x) => x.party).filter((p): p is PartyLite => !!p);
  const time = relativeTime(article.published_at);

  return (
    <a
      href={article.url}
      onClick={(e) => { e.preventDefault(); void openLink(article.url); }}
      className="group block bg-white rounded-[24px] border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all overflow-hidden"
    >
      <div className="relative w-full aspect-[16/9] bg-slate-100 overflow-hidden">
        {article.image_url ? (
          <img decoding="async"
            src={article.image_url}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget.parentElement as HTMLElement).classList.add('!bg-slate-200');
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <FallbackThumb source={article.source} />
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="bg-white/95 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full" style={{ color: article.source?.color || '#102a5c' }}>
            {article.source?.name ?? '—'}
          </span>
          {article.verdict && <VerdictBadge verdict={article.verdict} />}
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-bold text-white text-base sm:text-lg leading-tight drop-shadow-sm line-clamp-3">
            {article.title}
          </h3>
        </div>
      </div>
      <div className="p-3 sm:p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>{time}</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#1a56db] transition-colors" />
        </div>
        {article.summary && (
          <p className="text-sm text-slate-600 leading-snug line-clamp-2">{article.summary}</p>
        )}
        <TagChips themes={themes} candidates={candidates} parties={parties} max={4} />
      </div>
    </a>
  );
}

function CompactCard({ article }: { article: ArticleRow }) {
  const themes = article.article_themes.map((x) => x.theme).filter((t): t is ThemeLite => !!t);
  const candidates = article.article_candidates.map((x) => x.candidate).filter((c): c is CandidateLite => !!c);
  const parties = article.article_parties.map((x) => x.party).filter((p): p is PartyLite => !!p);
  const time = relativeTime(article.published_at);

  return (
    <a
      href={article.url}
      onClick={(e) => { e.preventDefault(); void openLink(article.url); }}
      className="group block bg-white rounded-[20px] border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all overflow-hidden"
    >
      <div className="flex gap-3 p-3 sm:p-4">
        <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl overflow-hidden bg-slate-100">
          {article.image_url ? (
            <img decoding="async"
              src={article.image_url}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) parent.innerHTML = '';
                (parent as HTMLElement).style.backgroundColor = article.source?.color || '#94a3b8';
              }}
            />
          ) : (
            <FallbackThumb source={article.source} />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <SourceLine source={article.source} time={time} />
            {article.verdict && <VerdictBadge verdict={article.verdict} />}
          </div>
          <h3 className="font-bold text-[#102a5c] leading-snug text-sm sm:text-[15px] line-clamp-2 group-hover:text-[#1a56db] transition-colors">
            {article.title}
          </h3>
          <TagChips themes={themes} candidates={candidates} parties={parties} max={2} />
        </div>
      </div>
    </a>
  );
}

function SkeletonCard({ featured = false }: { featured?: boolean }) {
  if (featured) {
    return (
      <div className="bg-white rounded-[24px] border border-slate-100 overflow-hidden animate-pulse">
        <div className="w-full aspect-[16/9] bg-slate-100" />
        <div className="p-4 space-y-2">
          <div className="h-3 w-1/4 bg-slate-100 rounded-full" />
          <div className="h-3 w-3/4 bg-slate-200 rounded-full" />
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-[20px] border border-slate-100 p-4 flex gap-3 animate-pulse">
      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-100 rounded-2xl shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-2.5 w-1/3 bg-slate-100 rounded-full" />
        <div className="h-3.5 w-full bg-slate-200 rounded-full" />
        <div className="h-3.5 w-2/3 bg-slate-200 rounded-full" />
      </div>
    </div>
  );
}
