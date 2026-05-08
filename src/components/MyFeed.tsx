import { useEffect, useMemo, useState } from 'react';
import { Heart, Star, ChevronRight, Play, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useFollowedCandidates } from '../lib/follows';

type Mode = 'mine';

interface CandidateLite {
  id: string;
  slug: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  gender: string | null;
}

interface SourceLite {
  name: string;
  orientation: string;
  color: string | null;
}

interface ArticleRow {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  published_at: string;
  kind: string;
  is_factcheck: boolean;
  source: SourceLite | null;
  article_candidates: { candidate: CandidateLite | null }[];
}

function fullName(c: CandidateLite) {
  return `${c.first_name} ${c.last_name}`.trim();
}

function fallbackPhoto(c: CandidateLite) {
  return c.gender === 'F' ? '/card_red.png' : '/card_blue.png';
}

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

export function MyFeed({ onGoToCandidates }: { onGoToCandidates: () => void }) {
  const { followed, toggle } = useFollowedCandidates();
  const followedIds = useMemo(() => [...followed], [followed]);

  const [followedCandidates, setFollowedCandidates] = useState<CandidateLite[]>([]);
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null); // candidate id or null
  const [kindFilter, setKindFilter] = useState<'all' | 'press' | 'video'>('all');

  // Fetch data when followed list changes
  useEffect(() => {
    if (followedIds.length === 0) {
      setFollowedCandidates([]);
      setArticles([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [candRes, artRes] = await Promise.all([
        supabase
          .from('candidates')
          .select('id, slug, first_name, last_name, photo_url, gender')
          .in('id', followedIds),
        supabase
          .from('article_candidates')
          .select(`
            article:news_articles(
              id, url, title, summary, image_url, published_at, kind, is_factcheck,
              source:news_sources(name, orientation, color),
              article_candidates(candidate:candidates(id, slug, first_name, last_name, photo_url, gender))
            )
          `)
          .in('candidate_id', followedIds)
          .order('article(published_at)', { ascending: false })
          .limit(120),
      ]);
      if (cancelled) return;
      setFollowedCandidates((candRes.data ?? []) as CandidateLite[]);
      const dedup = new Map<string, ArticleRow>();
      for (const r of (artRes.data ?? []) as any[]) {
        const a = r.article;
        if (a && !dedup.has(a.id)) dedup.set(a.id, a);
      }
      const sorted = [...dedup.values()].sort(
        (a, b) => +new Date(b.published_at) - +new Date(a.published_at)
      );
      setArticles(sorted);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [followedIds.join(',')]);

  // Filtered list
  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (activeFilter && !a.article_candidates.some((x) => x.candidate?.id === activeFilter)) return false;
      if (kindFilter === 'press' && a.kind !== 'article') return false;
      if (kindFilter === 'video' && a.kind !== 'youtube_video') return false;
      return true;
    });
  }, [articles, activeFilter, kindFilter]);

  // Empty state
  if (followedIds.length === 0) {
    return (
      <div className="flex flex-col gap-4 sm:gap-5 w-full">
        <div className="bg-gradient-to-br from-amber-500 to-rose-500 rounded-[24px] p-5 sm:p-6 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-90 mb-1.5">
              <Heart className="w-3.5 h-3.5" />
              Mon fil
            </div>
            <h2 className="text-xl sm:text-2xl font-bold leading-tight">
              Personnalisez votre fil d'actualité
            </h2>
            <p className="text-sm opacity-90 mt-1.5">
              Suivez vos candidats favoris pour ne plus rater leurs déclarations, leurs vidéos et tout ce que la presse écrit sur eux.
            </p>
          </div>
          <Heart className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" strokeWidth={1.5} />
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
            <Star className="w-7 h-7 text-amber-400" strokeWidth={2} />
          </div>
          <div>
            <h3 className="font-bold text-[#102a5c] mb-1">Aucun candidat suivi</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Ouvrez la fiche d'un candidat et appuyez sur le bouton « Suivre » pour le voir apparaître ici.
            </p>
          </div>
          <button
            onClick={onGoToCandidates}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#102a5c] text-white text-sm font-bold rounded-full hover:bg-[#153b82] transition-colors"
          >
            Voir les candidats <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full animate-in fade-in duration-300">
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-500 to-rose-500 rounded-[24px] p-5 sm:p-6 text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-90 mb-1.5">
            <Heart className="w-3.5 h-3.5" />
            Mon fil
          </div>
          <h2 className="text-xl sm:text-2xl font-bold leading-tight">
            {followedIds.length} candidat{followedIds.length > 1 ? 's' : ''} suivi{followedIds.length > 1 ? 's' : ''}
          </h2>
          <p className="text-sm opacity-90 mt-1.5">
            {articles.length} contenu{articles.length > 1 ? 's' : ''} pour vous • presse, vidéos et fact-checks.
          </p>
        </div>
        <Heart className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" strokeWidth={1.5} />
      </div>

      {/* Followed candidate avatars */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        <FilterCandidatePill
          active={activeFilter === null}
          onClick={() => setActiveFilter(null)}
          label={`Tous (${followedIds.length})`}
        />
        {followedCandidates.map((c) => (
          <FilterAvatarPill
            key={c.id}
            candidate={c}
            active={activeFilter === c.id}
            onClick={() => setActiveFilter(activeFilter === c.id ? null : c.id)}
            onUnfollow={() => toggle(c.id)}
          />
        ))}
      </div>

      {/* Content kind toggle */}
      <div className="flex gap-1.5">
        {([
          { id: 'all', label: 'Tout' },
          { id: 'press', label: 'Articles' },
          { id: 'video', label: 'Vidéos' },
        ] as const).map((opt) => (
          <button
            key={opt.id}
            onClick={() => setKindFilter(opt.id)}
            className={`flex-1 px-3 py-2 rounded-full text-xs font-bold transition-all ${
              kindFilter === opt.id
                ? 'bg-[#102a5c] text-white'
                : 'bg-white text-slate-700 border border-slate-100 hover:border-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-3 animate-pulse">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-100 rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-2.5 w-1/3 bg-slate-100 rounded-full" />
                <div className="h-3.5 w-full bg-slate-200 rounded-full" />
                <div className="h-3.5 w-2/3 bg-slate-200 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <p className="text-sm text-slate-500">
            {kindFilter !== 'all'
              ? "Aucun contenu de ce type pour les candidats suivis."
              : "Aucun contenu pour l'instant. Le pipeline d'actualités tournera dans l'heure."}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-2.5 pb-4">
          {filtered.map((a) => <FeedCard key={a.id} article={a} />)}
        </div>
      )}
    </div>
  );
}

function FilterCandidatePill({
  active, onClick, label,
}: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold border transition-all whitespace-nowrap ${
        active
          ? 'bg-[#102a5c] text-white border-[#102a5c]'
          : 'bg-white text-slate-700 border-slate-100 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );
}

function FilterAvatarPill({
  candidate, active, onClick, onUnfollow,
}: {
  candidate: CandidateLite;
  active: boolean;
  onClick: () => void;
  onUnfollow: () => void;
}) {
  return (
    <div className="shrink-0 relative">
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-xs font-bold border transition-all whitespace-nowrap ${
          active
            ? 'bg-[#102a5c] text-white border-[#102a5c]'
            : 'bg-white text-slate-700 border-slate-100 hover:border-slate-300'
        }`}
      >
        <span className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 shrink-0">
          <img src={candidate.photo_url || fallbackPhoto(candidate)} alt="" className="w-full h-full object-cover" />
        </span>
        {candidate.last_name}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onUnfollow(); }}
        title="Retirer du suivi"
        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-500 flex items-center justify-center text-[9px] font-bold leading-none shadow-sm"
      >
        ×
      </button>
    </div>
  );
}

function FeedCard({ article }: { article: ArticleRow }) {
  const isVideo = article.kind === 'youtube_video';
  const candidates = article.article_candidates
    .map((x) => x.candidate)
    .filter((c): c is CandidateLite => !!c);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all overflow-hidden"
    >
      <div className="flex gap-3 p-3">
        <div className="relative w-24 h-24 shrink-0 rounded-2xl overflow-hidden bg-slate-100">
          {article.image_url ? (
            <img src={article.image_url} alt="" loading="lazy"
                 className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-black text-2xl"
                 style={{ backgroundColor: article.source?.color || '#94a3b8' }}>
              {(article.source?.name ?? '?').replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 2).toUpperCase() || '?'}
            </div>
          )}
          {isVideo && (
            <span className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <Play className="w-7 h-7 text-white drop-shadow-lg fill-white" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            {article.source && (
              <span
                className="font-bold uppercase tracking-wider truncate"
                style={{ color: article.source.color || '#475569' }}
              >
                {article.source.name}
              </span>
            )}
            <span className="text-slate-300">·</span>
            <span>{relativeTime(article.published_at)}</span>
            {isVideo && (
              <span className="ml-auto inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                Vidéo
              </span>
            )}
            {!isVideo && (
              <ExternalLink className="w-3 h-3 text-slate-300 ml-auto group-hover:text-[#1a56db] transition-colors" />
            )}
          </div>
          <h3 className="font-bold text-[#102a5c] text-sm leading-snug line-clamp-2 group-hover:text-[#1a56db] transition-colors">
            {article.title}
          </h3>
          {candidates.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {candidates.slice(0, 3).map((c) => (
                <span key={c.id} className="inline-flex items-center text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">
                  {fullName(c)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
