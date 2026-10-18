import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Heart, X, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { PoliticalMatchGame } from './PoliticalMatchGame';
import { STABLE_STALE_MS } from '../lib/queryClient';
import { useAppConfig } from '../lib/appConfig';
import { DEFAULT_MATCH_PARAMS, coverageByCandidate, isPlayable } from '../lib/matchScoring';
import { MATCH_QUERY_KEY, fetchMatchData, loadSeen, loadStoredAnswers, validAnswers } from '../lib/matchData';

export function PoliticalMatchCard() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const appConfig = useAppConfig();

  // The MoreMenu's "Mes résultats de Boussole" entry navigates here and
  // then asks us to open the modal via this event. App.tsx fires the
  // same event when /boussole is hit as a deep link.
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('cap2027:open-boussole', open);
    return () => window.removeEventListener('cap2027:open-boussole', open);
  }, []);

  // When the user closes the modal AND we arrived via /boussole, bring
  // the URL back to / so refresh doesn't re-open it.
  const closeModal = () => {
    setIsOpen(false);
    if (location.pathname === '/boussole') navigate('/');
  };

  // Affirmations et positions Demos Kratos, même cache que le jeu.
  const matchQuery = useQuery({
    queryKey: MATCH_QUERY_KEY,
    staleTime: STABLE_STALE_MS,
    queryFn: fetchMatchData,
  });

  // Recalculé à la fermeture du jeu (qui enregistre à chaque carte) ou à
  // l'arrivée de nouvelles données. « Nouveaux choix » quand un export
  // Demos Kratos plus récent que la dernière partie apporte des cartes.
  const { remaining, total, isNew } = useMemo(() => {
    const d = matchQuery.data;
    if (!d) return { remaining: 0, total: 0, isNew: false };
    const params = { ...DEFAULT_MATCH_PARAMS, ...(appConfig.data?.['match.params'] ?? {}) };
    const coverage = coverageByCandidate(d.statements, d.stances);
    const playable = new Set(d.candidates.filter((c) => isPlayable(coverage.get(c.id), params)).map((c) => c.id));
    const relevant = d.statements.filter((s) => Object.keys(d.stances[s.id] ?? {}).some((cid) => playable.has(cid)));
    const answered = validAnswers(loadStoredAnswers(), relevant);
    const count = relevant.filter((s) => !(s.id in answered)).length;
    const seen = loadSeen();
    return { remaining: count, total: relevant.length, isNew: !!seen && seen.version !== d.version };
  }, [matchQuery.data, appConfig.data, isOpen]);

  const showBadge = total > 0 && remaining > 0;

  return (
    <>
      <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-4 sm:p-6 sm:px-8 flex flex-row items-center justify-between gap-4 sm:gap-8 relative overflow-hidden">
        {showBadge && (
          <span
            className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] sm:text-[11px] font-bold border border-amber-200 shadow-sm"
            title={`${remaining} affirmation${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`}
          >
            <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.5} />
            {isNew ? `${remaining} nouveau${remaining > 1 ? 'x' : ''} choix` : `${remaining} à compléter`}
          </span>
        )}
        {/* Left Content */}
        <div className="flex-1 max-w-[280px] sm:max-w-md relative z-10 w-full text-left">
          <h2 className="text-[18px] sm:text-[28px] font-bold text-[#102a5c] mb-1.5 sm:mb-2 whitespace-nowrap">
            Match politique
          </h2>
          <p className="text-slate-600 mb-3 sm:mb-5 text-[12px] sm:text-[15px] leading-[1.4] sm:leading-relaxed">
            Réagissez à des affirmations et découvrez de quels candidats vous êtes le plus proche, d’après leur programme.
          </p>
          <Button
            onClick={() => setIsOpen(true)}
            className="bg-[#0a1b3f] hover:bg-[#153b82] text-white px-5 sm:px-6 py-2 sm:py-2.5 rounded-[10px] sm:rounded-xl font-medium w-auto text-[13px] sm:text-[14px]"
          >
            Lancer le test
          </Button>
        </div>

        {/* Right Illustration */}
        <div className="relative w-[160px] sm:w-[260px] h-[110px] sm:h-[180px] shrink-0 pointer-events-none mt-0">
          {/* Blue Card */}
          <div className="absolute left-0 sm:left-[10%] top-1/2 -translate-y-1/2 w-[80px] sm:w-[130px] aspect-[2.5/3.5] rounded-lg sm:rounded-xl rotate-[-12deg] shadow-lg border-[3px] sm:border-[5px] border-white overflow-hidden bg-white flex items-center justify-center">
            <img decoding="async" 
              src="/card_blue.png" 
              alt="Profil Bleu" 
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 bg-white rounded-full p-1 sm:p-2 shadow-sm">
              <X className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" strokeWidth={3}/>
            </div>
          </div>

          {/* Red Card */}
          <div className="absolute right-0 sm:right-[10%] top-1/2 -translate-y-1/2 w-[80px] sm:w-[130px] aspect-[2.5/3.5] rounded-lg sm:rounded-xl rotate-[8deg] shadow-lg border-[3px] sm:border-[5px] border-white overflow-hidden bg-white z-10 flex items-center justify-center">
            <img decoding="async" 
              src="/card_red.png" 
              alt="Profil Rouge" 
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="absolute bottom-1 sm:bottom-2 right-1 sm:right-2 bg-white rounded-full p-1 sm:p-2 shadow-sm flex items-center justify-center">
              <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-[#10b981] fill-[#10b981]" />
            </div>
          </div>

          {/* Center Match Badge */}
          <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 bg-white rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] z-20 flex flex-col items-center justify-center w-[64px] sm:w-[100px] h-[64px] sm:h-[100px] border border-slate-50">
            <span className="text-[18px] sm:text-[28px] font-black text-[#102a5c] leading-none mb-0 sm:mb-1">78%</span>
            <span className="text-[7px] sm:text-[10px] font-medium text-slate-800 lowercase tracking-wide">compatibilité</span>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title=""
      >
        <PoliticalMatchGame onClose={closeModal} />
      </Modal>
    </>
  );
}
