/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, BookOpen, Scale, BadgeCheck, ArrowLeft } from 'lucide-react';
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
import { SplashScreen } from './components/SplashScreen';
import { Onboarding } from './components/Onboarding';
import {
  useResumeNotificationsHook,
  maybeAskFirstLaunchPermission,
} from './lib/notifications';

export default function App() {
  const [activeTab, setActiveTab] = useState('accueil');
  const [explorerView, setExplorerView] = useState('main');

  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Local OS notif when the app comes back to foreground.
  useResumeNotificationsHook();

  // Splash + onboarding routing.
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
      } else {
        // Returning user: ask for notif permission on first launch
        // post-onboarding (idempotent, silent on web / when already granted).
        void maybeAskFirstLaunchPermission();
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

  const handleOnboardingComplete = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
    // Right after the user closes onboarding, ask for the OS notif
    // permission once. The background runner + foreground hook will
    // pick it up automatically.
    void maybeAskFirstLaunchPermission();
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
      </AnimatePresence>
      <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      


      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:px-6 overflow-hidden">
        <motion.div 
          key={activeTab}
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
                      <p className="text-[13px] sm:text-[14px] text-slate-600 leading-relaxed max-w-[90%] sm:max-w-none">Sélectionnez une thématique (écologie, économie...) et opposez directement les propositions des candidats majeurs.</p>
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

          {activeTab === 'actualites' && (
            <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
              <NewsFeed mode="news" />
            </div>
          )}

          {activeTab === 'fil' && (
            <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
              <MyFeed onGoToCandidates={() => { setActiveTab('explorer'); setExplorerView('candidats'); }} />
            </div>
          )}

          {activeTab === 'explorer' && explorerView !== 'main' && explorerView !== 'candidats' && explorerView !== 'programmes' && explorerView !== 'comparateur' && explorerView !== 'factchecking' && explorerView !== 'parrainages' && (
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

          {(activeTab === 'candidats' || (activeTab === 'explorer' && explorerView === 'candidats')) && (
            <div className="flex flex-col gap-4 sm:gap-6 w-full pb-20">
               <button onClick={() => { setActiveTab('explorer'); setExplorerView('main'); }} className="flex items-center gap-2 text-[#1a56db] font-medium hover:underline w-fit px-2">
                 <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Retour à l'exploration
               </button>
               <CandidatesList />
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
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
    </>
  );
}
