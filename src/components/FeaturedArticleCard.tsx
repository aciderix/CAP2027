import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, Sparkles, Play } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { ARTICLE_STALE_MS } from '../lib/queryClient';
import { useFollowedCandidates } from '../lib/follows';

interface Source {
  name: string;
  color: string | null;
  orientation: string;
}

interface ArticleHero {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  published_at: string;
  is_factcheck: boolean;
  verdict: string | null;
  kind: string;
  source: Source | null;
  candidate_ids: string[];
}

interface FeaturedArticleCardProps {
  onNavigate?: () => void;
  onNavigateFactcheck?: () => void;
}

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
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function FeaturedArticleCard({ onNavigate, onNavigateFactcheck }: FeaturedArticleCardProps) {
  const { followed } = useFollowedCandidates();
  const followedIds = useMemo(() => [...followed].sort(), [followed]);
  const followedKey = followedIds.join(',');

  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const heroQuery = useQuery({
    queryKey: ['featuredHero', followedKey],
    staleTime: ARTICLE_STALE_MS,
    queryFn: async (): Promise<{ news: ArticleHero[]; factchecks: ArticleHero[] }> => {
      const baseSelect = `
        id, url, title, summary, image_url, published_at, is_factcheck, verdict, kind,
        source:news_sources(name, color, orientation),
        article_candidates(candidate_id)
      `;
      const [newsRes, factRes] = await Promise.all([
        supabase.from('news_articles').select(baseSelect)
          .eq('is_factcheck', false)
          .order('published_at', { ascending: false })
          .limit(15) as any,
        supabase.from('news_articles').select(baseSelect)
          .eq('is_factcheck', true)
          .order('published_at', { ascending: false })
          .limit(6) as any,
      ]);

      const flatten = (rows: any[] | null): ArticleHero[] =>
        (rows ?? []).map((r) => ({
          id: r.id, url: r.url, title: r.title, summary: r.summary,
          image_url: r.image_url, published_at: r.published_at,
          is_factcheck: r.is_factcheck, verdict: r.verdict, kind: r.kind,
          source: r.source as Source | null,
          candidate_ids: (r.article_candidates ?? []).map((ac: any) => ac.candidate_id),
        }));

      const newsItems = flatten(newsRes.data);
      const followedSet = new Set(followedIds);
      const followedItems = newsItems.filter((a) => a.candidate_ids.some((id) => followedSet.has(id)));
      const otherItems = newsItems.filter((a) => !a.candidate_ids.some((id) => followedSet.has(id)));
      const ordered = [...followedItems, ...otherItems].slice(0, 8);

      return { news: ordered, factchecks: flatten(factRes.data).slice(0, 3) };
    },
  });

  const news = heroQuery.data?.news ?? [];
  const factchecks = heroQuery.data?.factchecks ?? [];
  const loading = heroQuery.isLoading;

  // Programmatic scrolls fire onScroll too. We ignore those for a short
  // window after we trigger them so the auto-advance isn't fought by
  // handleScroll snapping back to the nearest slide mid-animation.
  const programmaticScrollUntil = useRef(0);
  // When the user touches/swipes the carousel, pause auto-rotate for 12 s.
  const userInteractionUntil = useRef(0);

  useEffect(() => { setActiveIndex(0); }, [heroQuery.dataUpdatedAt]);

  // Auto-rotate every 6 s, but skip a tick if the user just interacted.
  useEffect(() => {
    if (news.length < 2) return;
    const id = setInterval(() => {
      if (Date.now() < userInteractionUntil.current) return;
      setActiveIndex((i) => (i + 1) % news.length);
    }, 6000);
    return () => clearInterval(id);
  }, [news.length]);

  // Drive scroll from the active index. Width is the container width,
  // since each slide is full-width — no need to read offsetLeft.
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const target = activeIndex * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) < 4) return;
    programmaticScrollUntil.current = Date.now() + 700;
    el.scrollTo({ left: target, behavior: 'smooth' });
  }, [activeIndex]);

  function handleScroll() {
    const el = carouselRef.current;
    if (!el) return;
    if (Date.now() < programmaticScrollUntil.current) return;
    userInteractionUntil.current = Date.now() + 12_000;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeIndex && idx >= 0 && idx < news.length) {
      setActiveIndex(idx);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Carrousel actu */}
      <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-[#102a5c] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1a56db]" />
            À la une
            {followedIds.length > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                Personnalisé
              </span>
            )}
          </h2>
          <button
            onClick={onNavigate}
            className="text-sm font-semibold text-[#1a56db] hover:underline whitespace-nowrap inline-flex items-center gap-1"
          >
            Voir tout <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading && <CarouselSkeleton />}

        {!loading && news.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500">
            Aucun article disponible pour l'instant.
          </div>
        )}

        {!loading && news.length > 0 && (
          <>
            <div
              ref={carouselRef}
              onScroll={handleScroll}
              className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth"
              style={{ scrollbarWidth: 'none' }}
            >
              {news.map((a) => (
                <HeroSlide key={a.id} article={a} followedIds={followedIds} />
              ))}
            </div>
            {news.length > 1 && (
              <div className="px-5 py-3 flex items-center justify-center gap-1.5">
                {news.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    aria-label={`Aller au slide ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === activeIndex
                        ? 'w-6 bg-[#102a5c]'
                        : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Mini section fact-check */}
      <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-[#102a5c] flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-indigo-600" />
            Fact-checking
          </h2>
          <button
            onClick={onNavigateFactcheck}
            className="text-sm font-semibold text-[#1a56db] hover:underline whitespace-nowrap inline-flex items-center gap-1"
          >
            Voir tout <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {loading ? (
          <div className="px-5 py-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-16 h-16 bg-slate-100 rounded-lg animate-pulse shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-2.5 w-1/3 bg-slate-100 rounded-full animate-pulse" />
                  <div className="h-3 w-full bg-slate-200 rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : factchecks.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Pas de vérification récente.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {factchecks.map((a) => <FactcheckRow key={a.id} article={a} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function HeroSlide({ article, followedIds }: { article: ArticleHero; followedIds: string[] }) {
  const isVideo = article.kind === 'youtube_video';
  const matchesFollowed = article.candidate_ids.some((id) => followedIds.includes(id));
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block w-full shrink-0 snap-start"
    >
      <div className="relative w-full aspect-[16/10] sm:aspect-[2/1] bg-slate-100 overflow-hidden">
        {article.image_url ? (
          <img decoding="async"
            src={article.image_url}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white font-black text-3xl"
            style={{ backgroundColor: article.source?.color || '#94a3b8' }}
          >
            {(article.source?.name ?? '?').replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 2).toUpperCase() || '?'}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        <div className="absolute top-3 left-3 right-3 flex items-center gap-2 flex-wrap">
          <span
            className="bg-white/95 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
            style={{ color: article.source?.color || '#102a5c' }}
          >
            {article.source?.name ?? '—'}
          </span>
          {isVideo && (
            <span className="bg-rose-500/95 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">
              Vidéo
            </span>
          )}
          {matchesFollowed && (
            <span className="bg-amber-400/95 text-amber-900 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">
              Suivi
            </span>
          )}
        </div>

        {isVideo && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-7 h-7 text-white drop-shadow-lg fill-white" />
            </span>
          </span>
        )}

        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-bold text-white text-base sm:text-lg leading-tight drop-shadow-sm line-clamp-3">
            {article.title}
          </h3>
          <div className="text-[11px] text-white/80 mt-1">{relativeTime(article.published_at)}</div>
        </div>
      </div>
    </a>
  );
}

function FactcheckRow({ article }: { article: ArticleHero }) {
  const v = article.verdict ? VERDICT_STYLES[article.verdict] : null;
  return (
    <li>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-slate-100">
          {article.image_url ? (
            <img decoding="async" src={article.image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-white font-black"
              style={{ backgroundColor: article.source?.color || '#94a3b8' }}
            >
              {(article.source?.name ?? '?').replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 2).toUpperCase() || '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            {article.source && (
              <span className="font-bold uppercase tracking-wider truncate" style={{ color: article.source.color || '#475569' }}>
                {article.source.name}
              </span>
            )}
            <span className="text-slate-300">·</span>
            <span>{relativeTime(article.published_at)}</span>
            {v && (
              <span className={`ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${v.bg} ${v.text}`}>
                {v.label}
              </span>
            )}
          </div>
          <h4 className="font-bold text-[#102a5c] text-sm leading-snug line-clamp-2">
            {article.title}
          </h4>
        </div>
      </a>
    </li>
  );
}

function CarouselSkeleton() {
  return (
    <div className="w-full aspect-[16/10] sm:aspect-[2/1] bg-slate-100 animate-pulse" />
  );
}
