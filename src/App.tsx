/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User, BookOpen, Scale, BadgeCheck, ArrowLeft, Stamp, BarChart3 } from 'lucide-react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { VoterToolkit } from './components/VoterToolkit';
import { PoliticalMatchCard } from './components/PoliticalMatchCard';
import { ExplorerSection } from './components/ExplorerSection';
import { FeaturedArticleCard } from './components/FeaturedArticleCard';
import { CandidatesList } from './components/CandidatesList';
import { ProgrammesList } from './components/ProgrammesList';
import { Comparateur } from './components/Comparateur';
import { NewsFeed } from './components/NewsFeed';
import { MyFeed } from './components/MyFeed';
import { MoreMenu } from './components/MoreMenu';
import { ParrainagesCard } from './components/ParrainagesCard';
import { ParrainagesList } from './components/ParrainagesList';
import { ResultsCard } from './components/ResultsCard';
import { ResultsList } from './components/ResultsList';
import { SplashScreen } from './components/SplashScreen';
import { Onboarding } from './components/Onboarding';
import { ChannelSelection } from './components/ChannelSelection';
import { VideoModal } from './components/VideoModal';
import { useAppConfig } from './lib/appConfig';
import { useAdminChangeSync } from './lib/adminChangeSync';
import {
  useResumeNotificationsHook,
  maybeAskFirstLaunchPermission,
  notificationPermissionGranted,
} from './lib/notifications';
import { registerPushNotifications } from './lib/push';
import { registerPushWeb } from './lib/pushWeb';

// Wrapper that mounts its children once and only flips visibility via
// CSS afterwards. Used for the heavy tabs (Actualités, Mon fil,
// Candidats, Fact-checking) so switching back is instant — no
// re-fetch, no Fuse rebuild, no image re-decode.
function KeepMounted({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: visible ? 'block' : 'none' }} aria-hidden={!visible}>
      {children}
    </div>
  );
}

// URL ↔ tab state sync. Children keep calling setActiveTab/setExplorerView
// as before — these two helpers translate one direction at a time and the
// two effects below avoid an infinite loop by guarding on equality.
function pathFromState(activeTab: string, explorerView: string): string {
  if (activeTab === 'explorer') {
    return explorerView === 'main' ? '/explorer' : `/explorer/${explorerView}`;
  }
  if (activeTab === 'accueil') return '/';
  return '/' + activeTab;
}

function stateFromPath(pathname: string): { activeTab: string; explorerView: string } {
  const parts = pathname.split('/').filter(Boolean);
  const first = parts[0] ?? '';
  if (!first) return { activeTab: 'accueil', explorerView: 'main' };
  if (first === 'explorer') {
    const sub = parts[1] ?? 'main';
    return { activeTab: 'explorer', explorerView: sub };
  }
  if (['candidats', 'fil', 'actualites', 'plus'].includes(first)) {
    return { activeTab: first, explorerView: 'main' };
  }
  return { activeTab: 'accueil', explorerView: 'main' };
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const initial = stateFromPath(location.pathname);
  const [activeTab, setActiveTab] = useState(initial.activeTab);
  const [explorerView, setExplorerView] = useState(initial.explorerView);
  const { data: appCfg } = useAppConfig();
  const round1Published = appCfg?.['election.results']?.round1_published === true;

  // URL → state. Fires on back/forward, direct link or programmatic
  // navigate. Guarded against feedback loops by the equality check.
  useEffect(() => {
    const s = stateFromPath(location.pathname);
    if (s.activeTab !== activeTab) setActiveTab(s.activeTab);
    if (s.explorerView !== explorerView) setExplorerView(s.explorerView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // state → URL. Fires when any child calls setActiveTab/setExplorerView.
  // Replace=false so the browser back button retraces the user's nav.
  // Exception : /boussole is a deep-link to the match modal that's
  // hosted on accueil — we don't want the state→URL effect to rewrite
  // the URL to /, the user-facing path stays /boussole until the modal
  // is dismissed (where the modal's onClose handler navigates back).
  useEffect(() => {
    if (location.pathname === '/boussole') return;
    const target = pathFromState(activeTab, explorerView);
    if (location.pathname !== target) navigate(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, explorerView]);

  // /boussole deep link → switch to accueil + open the match modal.
  // PoliticalMatchCard listens to this event and opens the modal.
  useEffect(() => {
    if (location.pathname !== '/boussole') return;
    setActiveTab('accueil');
    setExplorerView('main');
    const t = setTimeout(() => {
      try { window.dispatchEvent(new Event('cap2027:open-boussole')); }
      catch { /* noop */ }
    }, 60);
    return () => clearTimeout(t);
  }, [location.pathname]);

  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showChannelSelection, setShowChannelSelection] = useState(false);

  // Local OS notif when the app comes back to foreground.
  useResumeNotificationsHook();

  // Detect server-side admin changes on cold launch / resume and
  // invalidate admin-driven caches when the counter has bumped. Picks
  // up the case "notif arrived while the app was closed, user opened
  // it via launcher without tapping the notif".
  useAdminChangeSync();

  // Splash + onboarding routing.
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
      } else {
        // Returning user: ask for notif permission on first launch
        // post-onboarding, then register the FCM token. Both calls
        // are idempotent and silent on web / when already granted.
        void maybeAskFirstLaunchPermission().then(() => Promise.all([
          registerPushNotifications(),
          registerPushWeb(),
        ]));
      }
    }, 2500);
    return () => clearTimeout(splashTimer);
  }, []);

  // The MoreMenu can fire a synthetic event to land the user on home tab
  // (used by the "Mes résultats de Boussole" entry, which then asks the
  // PoliticalMatchCard on home to open its own modal).
  useEffect(() => {
    const goHome = () => setActiveTab('accueil');
    window.addEventListener('cap2027:goto-home', goHome);
    return () => window.removeEventListener('cap2027:goto-home', goHome);
  }, []);

  // Replay the welcome tutorial on demand (Réglages → Revoir le tutoriel).
  useEffect(() => {
    const replay = () => setShowOnboarding(true);
    window.addEventListener('cap2027:replay-onboarding', replay);
    return () => window.removeEventListener('cap2027:replay-onboarding', replay);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
    // Right after the user closes onboarding, ask for the OS notif
    // permission once, then register with FCM (silent if denied). If the
    // permission ends up granted and the user hasn't seen it yet, surface
    // the channel-selection screen so they can tune what they receive.
    void maybeAskFirstLaunchPermission()
      .then(() => Promise.all([
        registerPushNotifications(),
        registerPushWeb(),
      ]))
      .then(() => notificationPermissionGranted())
      .then((granted) => {
        if (granted && localStorage.getItem('hasSeenChannelSelection') !== 'true') {
          setShowChannelSelection(true);
        }
      });
  };

  const handleChannelSelectionComplete = () => {
    localStorage.setItem('hasSeenChannelSelection', 'true');
    setShowChannelSelection(false);
  };

  // Tapping a bottom-nav / header tab always returns to that tab's
  // root view. Without this, tapping Explorer while already on
  // explorer/candidats would do nothing — the user expected a
  // "back to Explorer main" behaviour, matching iOS / Android tab
  // bar convention.
  const handleTabChange = (tab: string) => {
    if (tab === 'explorer') setExplorerView('main');
    setActiveTab(tab);
  };


  const getTabContent = () => {
    switch(activeTab) {
      case 'accueil':
        return {
          title: "Bienvenue sur CAP 2027",
          desc: "S'informer, comparer et choisir pour les élections présidentielles de 2027."
        };
      case 'explorer':
        return {
          title: "Explorer les programmes",
          desc: "Découvrez les différentes propositions et comparez-les facilement."
        };
      case 'candidats':
        return {
          title: "Les Candidats",
          desc: "Découvrez les candidats déclarés et pressentis pour 2027."
        };
      case 'fil':
        return {
          title: "Mon fil personnalisé",
          desc: "Retrouvez ici les mises à jour sur vos thèmes et candidats favoris."
        };
      case 'actualites':
        return {
          title: "Dernières Actualités",
          desc: "Les informations récentes sur la campagne électorale de 2027."
        };
      case 'plus':
        return {
          title: "Plus d'options",
          desc: "Paramètres, profil et informations supplémentaires."
        };
      default:
        return { title: "CAP 2027", desc: "En cours de construction." };
    }
  };

  const content = getTabContent();

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen key="splash" />}
        {showOnboarding && <Onboarding key="onboarding" onComplete={handleOnboardingComplete} />}
        {showChannelSelection && (
          <ChannelSelection key="channel-selection" onComplete={handleChannelSelectionComplete} />
        )}
      </AnimatePresence>
      <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
        <Header activeTab={activeTab} setActiveTab={handleTabChange} />

      


      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:px-6 overflow-hidden">
        {/* Heavy views are always mounted — switching tabs only flips
            CSS visibility, so no re-fetch / no image re-decode / no
            Fuse index rebuild. Background invalidations from push
            notifs still re-fetch in place; when the user returns to
            the tab, content is already up to date. */}
        <KeepMounted visible={activeTab === 'actualites'}>
          <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
            <NewsFeed mode="news" />
          </div>
        </KeepMounted>
        <KeepMounted visible={activeTab === 'fil'}>
          <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
            <MyFeed onGoToCandidates={() => { setActiveTab('explorer'); setExplorerView('candidats'); }} />
          </div>
        </KeepMounted>
        <KeepMounted visible={activeTab === 'candidats' || (activeTab === 'explorer' && explorerView === 'candidats')}>
          <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
            <button onClick={() => { setActiveTab('explorer'); setExplorerView('main'); }} className="flex items-center gap-2 text-[#1a56db] font-medium hover:underline w-fit px-2">
              <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Retour à l'exploration
            </button>
            <CandidatesList />
          </div>
        </KeepMounted>
        <KeepMounted visible={activeTab === 'explorer' && explorerView === 'factchecking'}>
          <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
            <button onClick={() => setExplorerView('main')} className="flex items-center gap-2 text-[#1a56db] font-medium hover:underline w-fit px-2">
              <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Retour à l'exploration
            </button>
            <NewsFeed mode="factcheck" />
          </div>
        </KeepMounted>

        <motion.div
          key={activeTab + ':' + explorerView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-4 sm:gap-6 mb-8"
        >
          {/* Main Welcome/Title Card */}
          {activeTab !== 'accueil' && activeTab !== 'explorer' && activeTab !== 'actualites' && activeTab !== 'fil' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-10">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#102a5c]">
                {content.title}
              </h1>
              <p className="mt-4 text-slate-500 max-w-2xl text-lg">
                {content.desc}
              </p>
            </div>
          )}

          {activeTab === 'explorer' && explorerView === 'main' && (
            <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20 pt-2 lg:pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full">
                 {round1Published && (
                   <div onClick={() => setExplorerView('results')} className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col justify-center min-h-[120px] hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group">
                      <div className="relative z-10 pr-6 sm:pr-10">
                        <h3 className="text-[18px] sm:text-xl font-bold text-[#102a5c] mb-1 sm:mb-2 group-hover:text-[#1a56db] transition-colors">Résultats</h3>
                        <p className="text-[13px] sm:text-[14px] text-slate-600 leading-relaxed max-w-[90%] sm:max-w-none">Scores officiels du scrutin, qualifiés du 1er tour et président·e élu·e à l'issue du 2nd tour.</p>
                      </div>
                      <BarChart3 className="absolute right-[-10px] sm:right-2 top-1/2 -translate-y-1/2 w-[100px] h-[100px] sm:w-[130px] sm:h-[130px] text-blue-50 pointer-events-none transition-transform group-hover:scale-105" strokeWidth={2.5} />
                   </div>
                 )}

                 <div onClick={() => setExplorerView('candidats')} className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col justify-center min-h-[120px] hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group">
                    <div className="relative z-10 pr-6 sm:pr-10">
                      <h3 className="text-[18px] sm:text-xl font-bold text-[#102a5c] mb-1 sm:mb-2 group-hover:text-[#1a56db] transition-colors">Candidats</h3>
                      <p className="text-[13px] sm:text-[14px] text-slate-600 leading-relaxed max-w-[90%] sm:max-w-none">Découvrez le profil, le parcours et l'entourage détaillé de chaque candidat certifié à l'élection présidentielle.</p>
                    </div>
                    <User className="absolute right-[-10px] sm:right-2 top-1/2 -translate-y-1/2 w-[100px] h-[100px] sm:w-[130px] sm:h-[130px] text-blue-50 pointer-events-none transition-transform group-hover:scale-105" strokeWidth={2.5} />
                 </div>

                 <div onClick={() => setExplorerView('programmes')} className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col justify-center min-h-[120px] hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group">
                    <div className="relative z-10 pr-6 sm:pr-10">
                      <h3 className="text-[18px] sm:text-xl font-bold text-[#102a5c] mb-1 sm:mb-2 group-hover:text-[#1a56db] transition-colors">Programmes</h3>
                      <p className="text-[13px] sm:text-[14px] text-slate-600 leading-relaxed max-w-[90%] sm:max-w-none">Consultez les livrets programmatiques complets, téléchargez les synthèses et explorez leur vision détaillée.</p>
                    </div>
                    <BookOpen className="absolute right-[-10px] sm:right-2 top-1/2 -translate-y-1/2 w-[100px] h-[100px] sm:w-[130px] sm:h-[130px] text-purple-50 pointer-events-none transition-transform group-hover:scale-105" strokeWidth={2.5} />
                 </div>

                 <div onClick={() => setExplorerView('comparateur')} className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col justify-center min-h-[120px] hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group">
                    <div className="relative z-10 pr-6 sm:pr-10">
                      <h3 className="text-[18px] sm:text-xl font-bold text-[#102a5c] mb-1 sm:mb-2 group-hover:text-[#1a56db] transition-colors">Comparateur thématique</h3>
                      <p className="text-[13px] sm:text-[14px] text-slate-600 leading-relaxed max-w-[90%] sm:max-w-none">Choisissez 2 ou 3 candidats : proximité de leurs programmes, thèmes privilégiés et face-à-face thème par thème.</p>
                    </div>
                    <Scale className="absolute right-[-10px] sm:right-2 top-1/2 -translate-y-1/2 w-[100px] h-[100px] sm:w-[130px] sm:h-[130px] text-emerald-50 pointer-events-none transition-transform group-hover:scale-105" strokeWidth={2.5} />
                 </div>

                 <div onClick={() => setExplorerView('factchecking')} className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col justify-center min-h-[120px] hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group">
                    <div className="relative z-10 pr-6 sm:pr-10">
                      <h3 className="text-[18px] sm:text-xl font-bold text-[#102a5c] mb-1 sm:mb-2 group-hover:text-[#1a56db] transition-colors">Fact-checking</h3>
                      <p className="text-[13px] sm:text-[14px] text-slate-600 leading-relaxed max-w-[90%] sm:max-w-none">Suivez les vérifications en direct, identifiez les fausses informations et retrouvez les sources vérifiées des déclarations.</p>
                    </div>
                    <BadgeCheck className="absolute right-[-10px] sm:right-2 top-1/2 -translate-y-1/2 w-[100px] h-[100px] sm:w-[130px] sm:h-[130px] text-indigo-50 pointer-events-none transition-transform group-hover:scale-105" strokeWidth={2.5} />
                 </div>

                 <div onClick={() => setExplorerView('parrainages')} className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col justify-center min-h-[120px] hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group">
                    <div className="relative z-10 pr-6 sm:pr-10">
                      <h3 className="text-[18px] sm:text-xl font-bold text-[#102a5c] mb-1 sm:mb-2 group-hover:text-[#1a56db] transition-colors">Parrainages</h3>
                      <p className="text-[13px] sm:text-[14px] text-slate-600 leading-relaxed max-w-[90%] sm:max-w-none">Consultez le décompte officiel des 500 signatures d'élus collectées par chaque candidat, mis à jour quotidiennement.</p>
                    </div>
                    <Stamp className="absolute right-[-10px] sm:right-2 top-1/2 -translate-y-1/2 w-[100px] h-[100px] sm:w-[130px] sm:h-[130px] text-amber-50 pointer-events-none transition-transform group-hover:scale-105" strokeWidth={2.5} />
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'explorer' && explorerView === 'programmes' && (
            <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
               <button onClick={() => setExplorerView('main')} className="flex items-center gap-2 text-[#1a56db] font-medium hover:underline w-fit px-2">
                 <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Retour à l'exploration
               </button>
               <ProgrammesList />
            </div>
          )}

          {activeTab === 'explorer' && explorerView === 'comparateur' && (
            <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
               <button onClick={() => setExplorerView('main')} className="flex items-center gap-2 text-[#1a56db] font-medium hover:underline w-fit px-2">
                 <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Retour à l'exploration
               </button>
               <Comparateur />
            </div>
          )}

          {activeTab === 'explorer' && explorerView === 'factchecking' && (
            <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
               <button onClick={() => setExplorerView('main')} className="flex items-center gap-2 text-[#1a56db] font-medium hover:underline w-fit px-2">
                 <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Retour à l'exploration
               </button>
               <NewsFeed mode="factcheck" />
            </div>
          )}

          {activeTab === 'explorer' && explorerView === 'parrainages' && (
            <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
               <button onClick={() => setExplorerView('main')} className="flex items-center gap-2 text-[#1a56db] font-medium hover:underline w-fit px-2">
                 <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Retour à l'exploration
               </button>
               <ParrainagesList />
            </div>
          )}

          {activeTab === 'explorer' && explorerView === 'results' && (
            <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
               <button onClick={() => setExplorerView('main')} className="flex items-center gap-2 text-[#1a56db] font-medium hover:underline w-fit px-2">
                 <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Retour à l'exploration
               </button>
               <ResultsList />
            </div>
          )}

          {activeTab === 'explorer' && explorerView !== 'main' && explorerView !== 'candidats' && explorerView !== 'programmes' && explorerView !== 'comparateur' && explorerView !== 'factchecking' && explorerView !== 'parrainages' && explorerView !== 'results' && (
            <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
               <button onClick={() => setExplorerView('main')} className="flex items-center gap-2 text-[#1a56db] font-medium hover:underline w-fit px-2">
                 <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Retour à l'exploration
               </button>
               <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-10 flex flex-col items-center justify-center text-center">
                  <h2 className="text-xl font-bold text-[#102a5c] mb-2 cursor-default">Bientôt disponible !</h2>
                  <p className="text-slate-500 cursor-default">Cette page de la plateforme est en cours de développement.</p>
               </div>
            </div>
          )}

          {/* Conditional Blocks based on tab */}
          {activeTab === 'accueil' && (
            <div className="flex flex-col gap-4 sm:gap-6 w-full">
              <VoterToolkit />
              {round1Published && (
                <ResultsCard
                  onSeeAll={() => { setActiveTab('explorer'); setExplorerView('results'); }}
                />
              )}
              <ExplorerSection onNavigate={(view) => { setActiveTab('explorer'); setExplorerView(view); }} />
              <PoliticalMatchCard />
              <FeaturedArticleCard
                onNavigate={() => setActiveTab('actualites')}
                onNavigateFactcheck={() => { setActiveTab('explorer'); setExplorerView('factchecking'); }}
              />
              <ParrainagesCard
                onSeeAll={() => { setActiveTab('explorer'); setExplorerView('parrainages'); }}
              />
            </div>
          )}

          {activeTab === 'plus' && (
            <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
               <MoreMenu
                 onGoToCandidates={() => { setActiveTab('explorer'); setExplorerView('candidats'); }}
               />
            </div>
          )}

        </motion.div>
      </main>
      <BottomNav activeTab={activeTab} setActiveTab={handleTabChange} />
      <VideoModal />
    </div>
    </>
  );
}
