import { useEffect, useMemo, useState } from 'react';
import { Heart, X, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { PoliticalMatchGame } from './PoliticalMatchGame';
import { supabase } from '../lib/supabase';
import { STABLE_STALE_MS } from '../lib/queryClient';

const ANSWERS_KEY = 'cap2027.matchAnswers.v2';

// Lightweight version of the Comparateur query — same queryKey so both
// hooks share the cache entry. The badge only needs the proposition
// ids to cross-reference with the localStorage answers map.
type PropRow = { id: string };

function readAnsweredIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(ANSWERS_KEY) ?? '{}') as Record<string, unknown>;
    return new Set(Object.keys(raw));
  } catch {
    return new Set();
  }
}

export function PoliticalMatchCard() {
  const [isOpen, setIsOpen] = useState(false);

  // The MoreMenu's "Mes résultats de Boussole" entry navigates here and
  // then asks us to open the modal via this event.
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('cap2027:open-boussole', open);
    return () => window.removeEventListener('cap2027:open-boussole', open);
  }, []);

  // Active match proposition ids. Shared cache with the Comparateur
  // (same queryKey) so opening either screen warms the badge instantly.
  // Invalidated by the admin counter sync + the foreground
  // 'match_proposition_change' push, so a new proposition added in
  // the admin console is reflected here without waiting for staleTime.
  const propsQuery = useQuery({
    queryKey: ['matchPropositions'],
    staleTime: STABLE_STALE_MS,
    queryFn: async (): Promise<PropRow[]> => {
      const { data, error } = await supabase
        .from('candidate_match_propositions')
        .select('id, text, candidate_id, theme_id, order_index')
        .eq('is_active', true)
        .order('order_index');
      if (error) throw error;
      return (data ?? []) as PropRow[];
    },
  });

  // Re-read answers whenever the modal closes (the game saves on each
  // swipe) or fresh propositions arrive. Filter the stored ids by the
  // currently-active proposition set so retired propositions don't
  // inflate the answered count.
  const { remaining, total } = useMemo(() => {
    const props = propsQuery.data ?? [];
    if (props.length === 0) return { remaining: 0, total: 0 };
    const answered = readAnsweredIds();
    let count = 0;
    for (const p of props) if (answered.has(p.id)) count++;
    return { remaining: props.length - count, total: props.length };
  }, [propsQuery.data, isOpen]);

  const showBadge = total > 0 && remaining > 0;

  return (
    <>
      <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-4 sm:p-6 sm:px-8 flex flex-row items-center justify-between gap-4 sm:gap-8 relative overflow-hidden">
        {showBadge && (
          <span
            className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] sm:text-[11px] font-bold border border-amber-200 shadow-sm"
            title={`${remaining} proposition${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`}
          >
            <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.5} />
            {remaining} à compléter
          </span>
        )}
        {/* Left Content */}
        <div className="flex-1 max-w-[280px] sm:max-w-md relative z-10 w-full text-left">
          <h2 className="text-[18px] sm:text-[28px] font-bold text-[#102a5c] mb-1.5 sm:mb-2 whitespace-nowrap">
            Match politique
          </h2>
          <p className="text-slate-600 mb-3 sm:mb-5 text-[12px] sm:text-[15px] leading-[1.4] sm:leading-relaxed">
            Répondez à des propositions anonymes et découvrez avec quels candidats vous êtes le plus compatible.
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
        onClose={() => setIsOpen(false)}
        title=""
      >
        <PoliticalMatchGame onClose={() => setIsOpen(false)} />
      </Modal>
    </>
  );
}
