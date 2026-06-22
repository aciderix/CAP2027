import { User, Eye, Star, FileText, Scale, Newspaper, Search, ExternalLink, Play, Share2, Check } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';
import type { Tables, Enums } from '../lib/database.types';
import { useFollowedCandidates } from '../lib/follows';
import { openLink } from '../lib/openLink';
import { CandidateParrainagesInline } from './CandidateParrainagesInline';
import { TwitterPostCard } from './TwitterPostCard';
import { STABLE_STALE_MS } from '../lib/queryClient';
import { ShareButton } from './ui/ShareButton';
import { shareCandidate, type ShareOutcome } from '../lib/share';

type CandidateRow = Tables<'candidates'>;
type PartyRow = Tables<'parties'>;
type BioSection = Tables<'candidate_bio_sections'>;
type Affair = Tables<'candidate_affairs'>;

type NewsArticle = {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  published_at: string;
  kind: string;
  source: { name: string; color: string | null; orientation: string } | null;
};

type CandidateWithParty = CandidateRow & { parties: Pick<PartyRow, 'name' | 'abbreviation' | 'color'> | null };

type ProposalWithTheme = {
  id: string;
  title: string;
  content: string | null;
  source_url: string | null;
  order_index: number;
  themes: { id: string; slug: string; name: string; color: string | null } | null;
};

type CandidateDetail = {
  bio: BioSection[];
  proposals: ProposalWithTheme[];
  affairs: Affair[];
  news: NewsArticle[];
};

const AFFAIR_LABELS: Record<Enums<'affair_status'>, string> = {
  mis_en_examen: 'Mis en examen',
  en_cours: 'En cours',
  classee: 'Classée',
  condamnation: 'Condamnation',
  relaxe: 'Relaxe',
};

const AFFAIR_COLORS: Record<Enums<'affair_status'>, string> = {
  mis_en_examen: 'bg-orange-100 text-orange-700',
  en_cours: 'bg-amber-100 text-amber-700',
  classee: 'bg-slate-100 text-slate-600',
  condamnation: 'bg-red-100 text-red-700',
  relaxe: 'bg-emerald-100 text-emerald-700',
};

function fullName(c: CandidateRow) {
  return `${c.first_name} ${c.last_name}`.trim();
}

function fallbackPhoto(c: CandidateRow) {
  return c.gender === 'F' ? '/card_red.png' : '/card_blue.png';
}

/** Lowercase + strip diacritics so "Pecresse" matches "Pécresse". */
function normaliseSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function CandidatesList() {
  const [searchQuery, setSearchQuery] = useState('');

  const location = useLocation();
  const navigate = useNavigate();
  // Slug derived from /explorer/candidats/:slug. When present we open
  // the fiche modal for that candidate. URL → state is one-way; the
  // click handler navigates and the useEffect below picks it up.
  const slugFromUrl = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'explorer' && parts[1] === 'candidats' && parts[2]) {
      return decodeURIComponent(parts[2]);
    }
    return null;
  }, [location.pathname]);

  const [selectedCandidate, setSelectedCandidate] = useState<CandidateWithParty | null>(null);
  const { isFollowed, toggle: toggleFollow } = useFollowedCandidates();
  const isFollowing = selectedCandidate ? isFollowed(selectedCandidate.id) : false;
  const [activeTab, setActiveTab] = useState<'biographie' | 'programme' | 'historique' | 'actualites'>('biographie');

  const candidatesQuery = useQuery({
    queryKey: ['candidatesList'],
    staleTime: STABLE_STALE_MS,
    queryFn: async (): Promise<CandidateWithParty[]> => {
      const { data, error } = await supabase
        .from('candidates')
        .select('*, parties(name, abbreviation, color)')
        .eq('is_published', true)
        .order('order_index');
      if (error) throw error;
      return (data ?? []) as CandidateWithParty[];
    },
  });
  const candidates = candidatesQuery.data ?? [];
  const isLoading = candidatesQuery.isLoading;
  const loadError = candidatesQuery.error?.message ?? null;

  // Per-candidate detail (bio + proposals + affairs + news), cached per id.
  // Bio/proposals/affairs are slow-changing so they live for an hour;
  // we treat news the same since it's already covered by the news_articles
  // freshness elsewhere (5 min default).
  const candidateDetailQuery = useQuery({
    queryKey: ['candidateDetail', selectedCandidate?.id],
    enabled: !!selectedCandidate,
    staleTime: STABLE_STALE_MS,
    queryFn: async (): Promise<CandidateDetail> => {
      const candidateId = selectedCandidate!.id;
      const [bioRes, propRes, affRes, newsRes] = await Promise.all([
        supabase.from('candidate_bio_sections')
          .select('*').eq('candidate_id', candidateId).order('order_index'),
        supabase.from('candidate_proposals')
          .select('id, title, content, source_url, order_index, themes(id, slug, name, color)')
          .eq('candidate_id', candidateId).order('order_index'),
        supabase.from('candidate_affairs')
          .select('*').eq('candidate_id', candidateId).order('order_index'),
        supabase.from('article_candidates')
          .select(`
            article:news_articles(
              id, url, title, summary, image_url, published_at, kind,
              source:news_sources(name, color, orientation)
            )
          `)
          .eq('candidate_id', candidateId)
          .order('article(published_at)', { ascending: false })
          .limit(40),
      ]);
      const news: NewsArticle[] = ((newsRes.data ?? []) as any[])
        .map((r) => r.article)
        .filter((a): a is NewsArticle => !!a)
        .sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at));
      return {
        bio: (bioRes.data ?? []) as BioSection[],
        proposals: (propRes.data ?? []) as unknown as ProposalWithTheme[],
        affairs: (affRes.data ?? []) as Affair[],
        news,
      };
    },
  });

  const detail = candidateDetailQuery.data ?? null;
  const detailLoading = candidateDetailQuery.isLoading && !!selectedCandidate;

  const filteredCandidates = useMemo(() => {
    const q = normaliseSearch(searchQuery);
    if (!q) return candidates;
    return candidates.filter(c => {
      const name = normaliseSearch(fullName(c));
      const party = normaliseSearch(c.parties?.name || c.parties?.abbreviation || '');
      return name.includes(q) || party.includes(q);
    });
  }, [candidates, searchQuery]);

  const proposalsByTheme = useMemo(() => {
    if (!detail) return [];
    const groups = new Map<string, { themeName: string; themeColor: string | null; items: ProposalWithTheme[] }>();
    for (const p of detail.proposals) {
      const key = p.themes?.id ?? 'unknown';
      if (!groups.has(key)) {
        groups.set(key, {
          themeName: p.themes?.name ?? 'Autres',
          themeColor: p.themes?.color ?? null,
          items: [],
        });
      }
      groups.get(key)!.items.push(p);
    }
    return Array.from(groups.values());
  }, [detail]);

  // URL → state. When the path slug changes (deep link, back/forward,
  // closeModal navigate), look up the candidate and open the modal.
  // candidates may not be loaded yet on first render — re-runs once
  // they arrive.
  useEffect(() => {
    if (!slugFromUrl) {
      if (selectedCandidate) setSelectedCandidate(null);
      return;
    }
    if (selectedCandidate?.slug === slugFromUrl) return;
    if (candidates.length === 0) return;
    const found = candidates.find((c) => c.slug === slugFromUrl);
    if (found) setSelectedCandidate(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugFromUrl, candidates]);

  const openCandidate = (c: CandidateWithParty) => {
    setSelectedCandidate(c);
    navigate(`/explorer/candidats/${encodeURIComponent(c.slug)}`);
  };

  const closeModal = () => {
    setSelectedCandidate(null);
    if (slugFromUrl) navigate('/explorer/candidats');
    setActiveTab('biographie');
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full animate-in fade-in zoom-in duration-500">
      <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 w-full">
         <h2 className="text-xl font-bold text-[#102a5c] shrink-0">Candidats</h2>
         <div className="relative w-full max-w-[200px] sm:w-64 sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
                type="text"
                className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#102a5c] focus:border-[#102a5c] text-sm transition-all shadow-sm"
                placeholder="Rechercher un candidat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
         </div>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
          Impossible de charger les candidats : {loadError}
        </div>
      )}

      {!isLoading && !loadError && filteredCandidates.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-100">
          {searchQuery ? 'Aucun candidat ne correspond à votre recherche.' : 'Aucun candidat publié pour le moment.'}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {filteredCandidates.map((candidate) => {
          const partyLabel = candidate.parties?.abbreviation || candidate.parties?.name || '—';
          return (
            <div key={candidate.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center gap-3 transition-all hover:shadow-md hover:-translate-y-1">
              <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 mb-1 relative overflow-hidden bg-slate-50">
                  <img decoding="async"
                    src={candidate.photo_url || fallbackPhoto(candidate)}
                    alt={fullName(candidate)}
                    className="w-full h-full object-cover"
                  />
              </div>

              <div className="flex flex-col items-center">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5 max-w-[120px] truncate">{partyLabel}</span>
                  <span className="font-bold text-[#102a5c] text-sm sm:text-base leading-tight">{fullName(candidate)}</span>
              </div>

              <Button
                  variant="outline"
                  className="w-full mt-2 h-9 text-xs flex items-center justify-center gap-1.5"
                  onClick={() => openCandidate(candidate)}
              >
                 <Eye className="w-3.5 h-3.5" /> Voir
              </Button>
            </div>
          );
        })}

        {isLoading && [1, 2, 3, 4, 5, 6].map((i) => (
           <div key={`skeleton-${i}`} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center gap-3">
             <div className="w-16 h-16 rounded-full bg-slate-100 animate-pulse mb-1 flex items-center justify-center relative overflow-hidden">
                <User className="text-slate-300 w-8 h-8 relative z-10" />
             </div>
             <div className="flex flex-col items-center w-full gap-1.5">
                 <div className="w-16 h-3 bg-slate-100 animate-pulse rounded-full"></div>
                 <div className="w-24 h-4 bg-slate-200 animate-pulse rounded-full"></div>
             </div>
             <div className="w-full mt-2 h-9 bg-slate-100 animate-pulse rounded-xl"></div>
           </div>
        ))}
      </div>

      <Modal isOpen={!!selectedCandidate} onClose={closeModal} title="">
        {selectedCandidate && (
          <div className="flex flex-col gap-4 py-2">
             <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-50 flex items-center justify-center shrink-0 relative overflow-hidden shadow-sm">
                      <img decoding="async"
                        src={selectedCandidate.photo_url || fallbackPhoto(selectedCandidate)}
                        alt={fullName(selectedCandidate)}
                        className="w-full h-full object-cover"
                      />
                  </div>

                  <div className="flex flex-col">
                     <h3 className="text-lg sm:text-2xl font-bold text-[#102a5c] leading-tight mb-0.5">{fullName(selectedCandidate)}</h3>
                     <span className="text-xs sm:text-sm font-medium text-slate-500">{selectedCandidate.parties?.name || '—'}</span>
                     {selectedCandidate.website_url && (() => {
                       const u = selectedCandidate.website_url!;
                       let host: string;
                       try { host = new URL(u).hostname.replace(/^www\./, ''); }
                       catch { host = u; }
                       return (
                         <a
                           href={u}
                           onClick={(e) => { e.preventDefault(); void openLink(u); }}
                           className="text-xs text-[#1a56db] inline-flex items-center gap-1 mt-0.5 hover:underline w-fit"
                         >
                           {host} <ExternalLink className="w-3 h-3" />
                         </a>
                       );
                     })()}

                     <div className="hidden">
                        {/* Legacy parrainages preview removed: now sourced from
                            the parrainages table via CandidateParrainagesInline,
                            which only renders once the Conseil constitutionnel
                            data goes live. */}
                        <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>Parrainages</span>
                          <span />
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-[#1a56db]" />
                        </div>
                     </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <CandidateShareButton
                    name={fullName(selectedCandidate)}
                    slug={selectedCandidate.slug}
                    party={selectedCandidate.parties?.name ?? null}
                  />
                  <button
                    onClick={() => toggleFollow(selectedCandidate.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${
                      isFollowing
                        ? 'bg-amber-50 border border-amber-200 text-amber-700'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFollowing ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                    <span className="hidden min-[380px]:inline">{isFollowing ? 'Suivi' : 'Suivre'}</span>
                  </button>
                </div>
             </div>

             <div className="flex flex-col gap-4">
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {[
                    { id: 'biographie', label: 'Bio', smLabel: 'Biographie', icon: User },
                    { id: 'programme',  label: 'Prog.', smLabel: 'Programme', icon: FileText },
                    { id: 'historique', label: 'Affaires', smLabel: 'Affaires', icon: Scale },
                    { id: 'actualites', label: 'Actus', smLabel: 'Actualités', icon: Newspaper },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-bold transition-all ${
                        activeTab === tab.id
                          ? 'bg-[#102a5c] text-white shadow-sm'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                      }`}
                    >
                      <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="sm:hidden">{tab.label}</span>
                      <span className="hidden sm:block">{tab.smLabel}</span>
                    </button>
                  ))}
                </div>

                <div className="py-2 animate-in fade-in zoom-in duration-300 min-h-[120px]">
                  {detailLoading && <DetailSkeleton />}

                  {!detailLoading && detail && activeTab === 'biographie' && (
                    <div className="space-y-5">
                      {/* Parrainages: only renders once Conseil constitutionnel data is live */}
                      <CandidateParrainagesInline candidateId={selectedCandidate.id} />

                      {detail.bio.length === 0 ? (
                        selectedCandidate.short_bio ? (
                          <p className="text-sm text-slate-600 italic">{selectedCandidate.short_bio}</p>
                        ) : (
                          <EmptyTab message="Biographie en cours de rédaction." />
                        )
                      ) : (
                        <>
                          {selectedCandidate.short_bio && (
                            <p className="text-sm text-slate-600 italic">{selectedCandidate.short_bio}</p>
                          )}
                          {detail.bio.map((s) => (
                            <section key={s.id}>
                              <h4 className="font-bold text-[#102a5c] mb-1.5">{s.title}</h4>
                              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{s.content}</p>
                            </section>
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  {!detailLoading && detail && activeTab === 'programme' && (
                    proposalsByTheme.length === 0 ? (
                      <EmptyTab message="Aucune proposition publiée pour le moment." />
                    ) : (
                      <div className="space-y-5">
                        {proposalsByTheme.map((g, idx) => (
                          <section key={idx}>
                            <h4 className="font-bold text-[#102a5c] mb-2 flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: g.themeColor || '#94a3b8' }}
                              />
                              {g.themeName}
                            </h4>
                            <ul className="space-y-2">
                              {g.items.map((p) => (
                                <li key={p.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                  <div className="font-semibold text-sm text-slate-800">{p.title}</div>
                                  {p.content && <p className="text-sm text-slate-600 mt-1">{p.content}</p>}
                                  {p.source_url && (
                                    <a href={p.source_url}
                                       onClick={(e) => { e.preventDefault(); void openLink(p.source_url!); }}
                                       className="text-xs text-[#1a56db] inline-flex items-center gap-1 mt-1 hover:underline">
                                       Source <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </section>
                        ))}
                      </div>
                    )
                  )}

                  {!detailLoading && detail && activeTab === 'historique' && (
                    detail.affairs.length === 0 ? (
                      <EmptyTab message="Aucune affaire judiciaire recensée." />
                    ) : (
                      <ul className="space-y-3">
                        {detail.affairs.map((a) => (
                          <li key={a.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold text-sm text-slate-800">{a.title}</div>
                              <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${AFFAIR_COLORS[a.status]}`}>
                                {AFFAIR_LABELS[a.status]}
                              </span>
                            </div>
                            {a.date && (
                              <div className="text-xs text-slate-400 mt-0.5">
                                {new Date(a.date).toLocaleDateString('fr-FR')}
                              </div>
                            )}
                            {a.description && <p className="text-sm text-slate-600 mt-1">{a.description}</p>}
                            {a.source_urls.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {a.source_urls.map((u, i) => (
                                  <a key={i} href={u}
                                     onClick={(e) => { e.preventDefault(); void openLink(u); }}
                                     className="text-xs text-[#1a56db] inline-flex items-center gap-1 hover:underline">
                                    Source {i + 1} <ExternalLink className="w-3 h-3" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )
                  )}

                  {!detailLoading && detail && activeTab === 'actualites' && (
                    detail.news.length === 0 ? (
                      <EmptyTab message="Pas encore d'article associé. Le tagueur attribuera des actualités dès qu'il détectera les noms du candidat ou de son parti." />
                    ) : (
                      <div className="space-y-2.5">
                        {detail.news.map((n) => (
                          n.kind === 'twitter_post' ? (
                            <TwitterPostCard
                              key={n.id}
                              title={n.title}
                              summary={n.summary}
                              url={n.url}
                              image_url={n.image_url}
                              published_at={n.published_at}
                              source={n.source}
                              candidateName={fullName(selectedCandidate)}
                            />
                          ) : (
                            <CandidateNewsCard key={n.id} article={n} />
                          )
                        ))}
                      </div>
                    )
                  )}
                </div>
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CandidateShareButton({ name, slug, party }: { name: string; slug: string; party: string | null }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (busy) return;
    setBusy(true);
    const outcome: ShareOutcome = await shareCandidate({ name, slug, party });
    setBusy(false);
    if (outcome === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={busy}
      aria-label="Partager le profil"
      title={copied ? 'Lien copié' : 'Partager le profil'}
      className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-[#1a56db] shadow-sm transition-all disabled:opacity-50"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
    </button>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-3">
      <div className="w-1/3 h-5 bg-slate-200 rounded animate-pulse"></div>
      <div className="w-full h-4 bg-slate-100 rounded animate-pulse"></div>
      <div className="w-full h-4 bg-slate-100 rounded animate-pulse"></div>
      <div className="w-5/6 h-4 bg-slate-100 rounded animate-pulse"></div>
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="text-center text-slate-400 text-sm py-6 px-4 leading-relaxed">{message}</div>
  );
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

function CandidateNewsCard({ article }: { article: NewsArticle }) {
  const isVideo = article.kind === 'youtube_video';
  const isPress = !isVideo;
  return (
    <li>
      <a
        href={article.url}
        onClick={(e) => { e.preventDefault(); void openLink(article.url); }}
        className="feed-card group block bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all overflow-hidden"
      >
        <div className="flex gap-3 p-3">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-slate-100">
            {article.image_url ? (
              <img decoding="async"
                src={article.image_url}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
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
                  className="font-bold uppercase tracking-wider"
                  style={{ color: article.source.color || '#475569' }}
                >
                  {article.source.name}
                </span>
              )}
              <span className="text-slate-300">·</span>
              <span>{relativeTime(article.published_at)}</span>
              <span className="ml-auto flex items-center gap-1">
                {isVideo && (
                  <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                    Vidéo
                  </span>
                )}
                <ShareButton
                  title={article.title}
                  text={`${article.title} — à lire sur CAP 2027`}
                  url={article.url}
                />
                {isPress && (
                  <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-[#1a56db] transition-colors" />
                )}
              </span>
            </div>
            <h4 className="font-bold text-[#102a5c] text-sm leading-snug line-clamp-2 group-hover:text-[#1a56db] transition-colors">
              {article.title}
            </h4>
            {article.summary && (
              <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{article.summary}</p>
            )}
          </div>
        </div>
      </a>
    </li>
  );
}
