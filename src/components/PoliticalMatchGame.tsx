import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimation, PanInfo } from 'motion/react';
import {
  ArrowLeft, ArrowRight, ArrowUp,
  CheckCircle, XCircle, HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';
import type { Tables, Enums } from '../lib/database.types';

type Stance = Enums<'match_stance'>;
type Phase = 'tutorial' | 'loading' | 'game' | 'results' | 'error';

interface ThemeLite {
  slug: string;
  name: string;
  color: string | null;
}

interface Proposition {
  id: string;
  text: string;
  theme: ThemeLite | null;
}

interface PartyLite {
  name: string | null;
  abbreviation: string | null;
  color: string | null;
}

interface CandidateLite {
  id: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  photo_url: string | null;
  parties: PartyLite | null;
}

interface CandidateScore {
  candidate: CandidateLite;
  pct: number;
  weightUsed: number;
  weightMatched: number;
}

const TUTORIAL_DONE_KEY = 'cap2027.matchTutorialDone';

export function PoliticalMatchGame({ onClose }: { onClose: () => void }) {
  const initialPhase: Phase = typeof window !== 'undefined' && localStorage.getItem(TUTORIAL_DONE_KEY) === '1'
    ? 'loading'
    : 'tutorial';
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [error, setError] = useState<string | null>(null);

  const [propositions, setPropositions] = useState<Proposition[]>([]);
  const [positions, setPositions] = useState<Tables<'candidate_positions'>[]>([]);
  const [candidates, setCandidates] = useState<CandidateLite[]>([]);
  const [answers, setAnswers] = useState<Record<string, Stance>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  // Load data when entering loading phase
  useEffect(() => {
    if (phase !== 'loading') return;
    let cancelled = false;
    (async () => {
      const [propsRes, posRes, candRes] = await Promise.all([
        supabase
          .from('match_propositions')
          .select('id, text, themes(slug, name, color)')
          .eq('is_active', true)
          .order('order_index'),
        supabase
          .from('candidate_positions')
          .select('*'),
        supabase
          .from('candidates')
          .select('id, first_name, last_name, gender, photo_url, parties(name, abbreviation, color)')
          .eq('is_published', true),
      ]);
      if (cancelled) return;
      if (propsRes.error || posRes.error || candRes.error) {
        setError(propsRes.error?.message || posRes.error?.message || candRes.error?.message || 'Erreur inconnue');
        setPhase('error');
        return;
      }
      const props = (propsRes.data ?? []).map((row) => {
        const themes = row.themes as unknown as ThemeLite | null;
        return { id: row.id, text: row.text, theme: themes };
      });
      // Shuffle to add variety per session
      for (let i = props.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [props[i], props[j]] = [props[j], props[i]];
      }
      setPropositions(props);
      setPositions((posRes.data ?? []) as Tables<'candidate_positions'>[]);
      setCandidates((candRes.data ?? []) as unknown as CandidateLite[]);
      setAnswers({});
      setCurrentIndex(0);
      setPhase(props.length === 0 ? 'error' : 'game');
      if (props.length === 0) setError('Aucune proposition disponible.');
    })();
    return () => { cancelled = true; };
  }, [phase]);

  function recordAnswer(propId: string, stance: Stance) {
    setAnswers((prev) => ({ ...prev, [propId]: stance }));
    if (currentIndex >= propositions.length - 1) {
      setPhase('results');
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  const scores: CandidateScore[] = useMemo(() => {
    if (phase !== 'results') return [];
    // Group positions by candidate for fast lookup
    const byCandidate = new Map<string, Map<string, Tables<'candidate_positions'>>>();
    for (const p of positions) {
      if (!byCandidate.has(p.candidate_id)) byCandidate.set(p.candidate_id, new Map());
      byCandidate.get(p.candidate_id)!.set(p.proposition_id, p);
    }
    const results: CandidateScore[] = candidates.map((c) => {
      let weightMatched = 0;
      let weightUsed = 0;
      const cPositions = byCandidate.get(c.id);
      if (cPositions) {
        for (const [propId, userStance] of Object.entries(answers)) {
          if (userStance === 'neutre') continue;
          const pos = cPositions.get(propId);
          if (!pos) continue;
          if (pos.stance === 'neutre') {
            weightUsed += pos.weight;
            continue;
          }
          weightUsed += pos.weight;
          if (pos.stance === userStance) {
            weightMatched += pos.weight;
          } else {
            weightMatched -= pos.weight;
          }
        }
      }
      const pct = weightUsed === 0 ? 50 : Math.round(((weightMatched / weightUsed) + 1) / 2 * 100);
      return { candidate: c, pct, weightUsed, weightMatched };
    });
    results.sort((a, b) => b.pct - a.pct);
    return results;
  }, [phase, candidates, positions, answers]);

  function restart() {
    setAnswers({});
    setCurrentIndex(0);
    setPhase('loading');
  }

  if (phase === 'tutorial') {
    return (
      <Tutorial
        onDone={() => {
          if (typeof window !== 'undefined') localStorage.setItem(TUTORIAL_DONE_KEY, '1');
          setPhase('loading');
        }}
        onSkip={() => {
          if (typeof window !== 'undefined') localStorage.setItem(TUTORIAL_DONE_KEY, '1');
          setPhase('loading');
        }}
      />
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-[#102a5c] animate-spin" />
        <div className="text-sm text-slate-500">Chargement des propositions...</div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
        <XCircle className="w-12 h-12 text-rose-500" />
        <div className="text-slate-700 font-semibold">Impossible de lancer le test</div>
        <div className="text-sm text-slate-500">{error}</div>
        <Button onClick={onClose} variant="outline">Fermer</Button>
      </div>
    );
  }

  if (phase === 'results') {
    return <Results scores={scores} answeredCount={Object.keys(answers).length} totalCount={propositions.length} onRestart={restart} onClose={onClose} />;
  }

  // phase === 'game'
  const current = propositions[currentIndex];
  return (
    <GameCard
      key={current.id}
      proposition={current}
      index={currentIndex}
      total={propositions.length}
      onAnswer={recordAnswer}
    />
  );
}

// ----------------------- Tutorial ----------------------------

type TutoStep = 'tuto_left' | 'tuto_right' | 'tuto_up' | 'recap';

function Tutorial({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [step, setStep] = useState<TutoStep>('tuto_left');
  const controls = useAnimation();

  const tutorials = [
    {
      id: 'tuto_left' as TutoStep, dir: 'left' as const,
      title: "En accord",
      desc: "Glissez vers la GAUCHE pour dire que vous êtes d'accord avec cette idée.",
      img: '/card_red.png',
      icon: <CheckCircle className="w-12 h-12 text-emerald-500 bg-white rounded-full" />,
      arrow: <ArrowLeft className="w-8 h-8 text-emerald-500 animate-pulse" />,
    },
    {
      id: 'tuto_right' as TutoStep, dir: 'right' as const,
      title: "En désaccord",
      desc: "Glissez vers la DROITE pour exprimer votre désaccord.",
      img: '/card_blue.png',
      icon: <XCircle className="w-12 h-12 text-rose-500 bg-white rounded-full" />,
      arrow: <ArrowRight className="w-8 h-8 text-rose-500 animate-pulse" />,
    },
    {
      id: 'tuto_up' as TutoStep, dir: 'up' as const,
      title: "Sans avis",
      desc: "Glissez vers le HAUT si vous n'avez pas d'opinion sur le sujet.",
      img: '/card_red.png',
      icon: <HelpCircle className="w-12 h-12 text-slate-500 bg-white rounded-full" />,
      arrow: <ArrowUp className="w-8 h-8 text-slate-500 animate-pulse" />,
    },
  ];

  const currentTutoIndex = tutorials.findIndex((t) => t.id === step);
  const currentTuto = tutorials[currentTutoIndex];

  const handleDragEnd = async (_event: unknown, info: PanInfo) => {
    const threshold = 80;
    let swipedDirection: 'left' | 'right' | 'up' | null = null;
    if (info.offset.y < -threshold && Math.abs(info.offset.x) < threshold) swipedDirection = 'up';
    else if (info.offset.x < -threshold) swipedDirection = 'left';
    else if (info.offset.x > threshold) swipedDirection = 'right';

    if (swipedDirection === currentTuto.dir) {
      let x = 0, y = 0;
      if (swipedDirection === 'left') x = -500;
      if (swipedDirection === 'right') x = 500;
      if (swipedDirection === 'up') y = -500;
      await controls.start({ x, y, opacity: 0, transition: { duration: 0.3 } });
      if (currentTutoIndex < tutorials.length - 1) {
        setStep(tutorials[currentTutoIndex + 1].id);
        controls.start({ x: 0, y: 0, opacity: 1, transition: { duration: 0 } });
      } else {
        setStep('recap');
      }
    } else {
      controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  if (step === 'recap') {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500 relative min-h-[400px]">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-600" />
        </div>
        <h3 className="text-2xl font-bold text-[#102a5c] mb-2">Tutoriel terminé !</h3>
        <p className="text-slate-600 mb-8 max-w-sm">
          Vous êtes prêt. Vous allez maintenant voir des propositions anonymes et découvrir avec quels candidats vous êtes le plus compatible.
        </p>

        <div className="w-full flex justify-center mt-auto">
          <div className="flex flex-col gap-3 w-full bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
            <p className="text-sm font-semibold text-slate-700">Rappel des gestes :</p>
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /> Gauche = Accord</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4 text-rose-500" /> Droite = Désaccord</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-1.5"><HelpCircle className="w-4 h-4 text-slate-500" /> Haut = Sans avis</span>
            </div>
          </div>
        </div>

        <Button onClick={onDone} className="w-full bg-[#102a5c] hover:bg-[#153b82] text-white py-3 rounded-xl">
          Démarrer le test
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between p-2 sm:p-6 min-h-[450px] relative overflow-hidden">
      <div className="text-center mb-8 w-full">
        <span className="bg-[#102a5c]/10 text-[#102a5c] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
          Tutoriel {currentTutoIndex + 1}/3
        </span>
        <h3 className="text-xl sm:text-2xl font-bold text-[#102a5c] mb-2">{currentTuto.title}</h3>
        <p className="text-sm text-slate-500 max-w-[260px] mx-auto">{currentTuto.desc}</p>
      </div>

      <div className="relative w-full max-w-[280px] h-[320px] flex items-center justify-center">
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 z-0">
          {currentTuto.dir === 'left' && <div className="absolute left-[-20px] top-1/2 -translate-y-1/2">{currentTuto.arrow}</div>}
          {currentTuto.dir === 'right' && <div className="absolute right-[-20px] top-1/2 -translate-y-1/2">{currentTuto.arrow}</div>}
          {currentTuto.dir === 'up' && <div className="absolute top-[-20px] left-1/2 -translate-x-1/2">{currentTuto.arrow}</div>}
        </div>

        <motion.div
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.8}
          onDragEnd={handleDragEnd}
          animate={controls}
          whileTap={{ scale: 0.95, cursor: "grabbing" }}
          whileDrag={{ scale: 0.95 }}
          className="w-[220px] sm:w-[240px] aspect-[2.5/3.5] bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border-[4px] border-white z-10 relative overflow-hidden cursor-grab touch-none flex flex-col items-center justify-center"
        >
          <img src={currentTuto.img} alt="Tuto Card" className="absolute inset-0 w-full h-full object-cover z-0" />
          <div className="absolute inset-0 bg-slate-900/20 z-10" />
          <div className="relative z-20 flex flex-col items-center gap-4 text-center p-4">
            {currentTuto.icon}
            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl">
              <p className="font-bold text-slate-800 text-sm">Glissez pour tester</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-2">
        <button
          onClick={onSkip}
          className="text-xs font-semibold text-slate-500 underline hover:text-slate-700"
        >
          Passer le tutoriel
        </button>
      </div>
    </div>
  );
}

// ----------------------- Game card ----------------------------

function GameCard({
  proposition, index, total, onAnswer,
}: {
  proposition: Proposition;
  index: number;
  total: number;
  onAnswer: (propId: string, stance: Stance) => void;
}) {
  const controls = useAnimation();
  const answeredRef = useRef(false);

  const handle = async (stance: Stance) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    let x = 0, y = 0;
    if (stance === 'pour') x = -500;
    if (stance === 'contre') x = 500;
    if (stance === 'neutre') y = -500;
    await controls.start({ x, y, opacity: 0, transition: { duration: 0.3 } });
    onAnswer(proposition.id, stance);
  };

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (answeredRef.current) return;
    const threshold = 80;
    if (info.offset.y < -threshold && Math.abs(info.offset.x) < threshold) {
      handle('neutre');
    } else if (info.offset.x < -threshold) {
      handle('pour');
    } else if (info.offset.x > threshold) {
      handle('contre');
    } else {
      controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  const themeColor = proposition.theme?.color || '#94a3b8';

  return (
    <div className="flex flex-col items-center justify-between p-2 sm:p-6 min-h-[480px] relative overflow-hidden">
      {/* Progress */}
      <div className="w-full max-w-[300px] flex flex-col items-center gap-2 mb-4">
        <div className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>Question {index + 1} / {total}</span>
          {proposition.theme && (
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }} />
              {proposition.theme.name}
            </span>
          )}
        </div>
        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${Math.round(((index) / total) * 100)}%`, backgroundColor: '#102a5c' }}
          />
        </div>
      </div>

      {/* Swipe area */}
      <div className="relative w-full max-w-[300px] h-[320px] flex items-center justify-center">
        {/* Hint arrows */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 flex items-center gap-1 text-emerald-500/60">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase">Pour</span>
          </div>
          <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 flex items-center gap-1 text-rose-500/60">
            <span className="text-[10px] font-bold uppercase">Contre</span>
            <ArrowRight className="w-5 h-5" />
          </div>
          <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 text-slate-500/60">
            <ArrowUp className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase">Sans avis</span>
          </div>
        </div>

        <motion.div
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.8}
          onDragEnd={handleDragEnd}
          animate={controls}
          whileTap={{ scale: 0.97, cursor: "grabbing" }}
          whileDrag={{ scale: 0.97 }}
          className="w-[260px] sm:w-[280px] aspect-[2.5/3.5] bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border-[4px] border-white z-10 relative overflow-hidden cursor-grab touch-none flex flex-col"
        >
          <div
            className="h-1.5 w-full"
            style={{ backgroundColor: themeColor }}
          />
          <div className="flex-1 flex items-center justify-center p-5 text-center">
            <p className="text-[#102a5c] font-bold text-base sm:text-lg leading-snug">
              {proposition.text}
            </p>
          </div>
          <div className="px-4 pb-4 pt-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Glissez pour répondre
          </div>
        </motion.div>
      </div>

      {/* Tap fallback */}
      <div className="mt-6 flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => handle('pour')}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors"
        >
          <CheckCircle className="w-4 h-4" /> Pour
        </button>
        <button
          onClick={() => handle('neutre')}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
        >
          <HelpCircle className="w-4 h-4" /> Sans avis
        </button>
        <button
          onClick={() => handle('contre')}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors"
        >
          <XCircle className="w-4 h-4" /> Contre
        </button>
      </div>
    </div>
  );
}

// ----------------------- Results ------------------------------

function Results({
  scores, answeredCount, totalCount, onRestart, onClose,
}: {
  scores: CandidateScore[];
  answeredCount: number;
  totalCount: number;
  onRestart: () => void;
  onClose: () => void;
}) {
  const top = scores[0];
  const fullName = (c: CandidateLite) => `${c.first_name} ${c.last_name}`.trim();
  const fallback = (c: CandidateLite) => (c.gender === 'F' ? '/card_red.png' : '/card_blue.png');

  return (
    <div className="flex flex-col p-2 sm:p-4 gap-5 animate-in fade-in zoom-in duration-300">
      <div className="text-center">
        <span className="bg-[#102a5c]/10 text-[#102a5c] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
          Résultats
        </span>
        <h3 className="text-xl sm:text-2xl font-bold text-[#102a5c] mb-1">Vos affinités politiques</h3>
        <p className="text-sm text-slate-500">
          Calculées sur {answeredCount} réponse{answeredCount > 1 ? 's' : ''}
          {totalCount !== answeredCount ? ` / ${totalCount}` : ''}
        </p>
      </div>

      {top && top.weightUsed > 0 && (
        <div className="bg-gradient-to-br from-[#102a5c] to-[#1a56db] rounded-2xl p-5 text-white shadow-lg">
          <div className="text-xs font-bold uppercase tracking-wider opacity-80 mb-3">Votre meilleur match</div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 shrink-0 border-2 border-white/30">
              <img src={top.candidate.photo_url || fallback(top.candidate)} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-lg leading-tight truncate">{fullName(top.candidate)}</div>
              <div className="text-sm opacity-80 truncate">
                {top.candidate.parties?.name || top.candidate.parties?.abbreviation || '—'}
              </div>
            </div>
            <div className="text-3xl font-black tabular-nums shrink-0">{top.pct}%</div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {scores.map((s, i) => {
          const insufficient = s.weightUsed === 0;
          return (
            <div
              key={s.candidate.id}
              className={`bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 flex items-center gap-3 ${i === 0 ? 'ring-2 ring-[#1a56db]/20' : ''}`}
            >
              <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-50 shrink-0">
                <img src={s.candidate.photo_url || fallback(s.candidate)} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-[#102a5c] truncate">{fullName(s.candidate)}</div>
                  <div className={`text-sm font-bold tabular-nums shrink-0 ${insufficient ? 'text-slate-400' : 'text-[#102a5c]'}`}>
                    {insufficient ? '—' : `${s.pct}%`}
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${insufficient ? 0 : s.pct}%`,
                      backgroundColor: s.pct >= 60 ? '#10b981' : s.pct >= 40 ? '#1a56db' : '#f59e0b',
                    }}
                  />
                </div>
                {insufficient && (
                  <div className="text-[10px] text-slate-400 mt-1">Pas assez de positions enregistrées pour ce candidat.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        <Button onClick={onRestart} variant="outline" className="flex-1 py-2.5 rounded-xl gap-2">
          <RotateCcw className="w-4 h-4" /> Recommencer
        </Button>
        <Button onClick={onClose} className="flex-1 bg-[#102a5c] hover:bg-[#153b82] text-white py-2.5 rounded-xl">
          Fermer
        </Button>
      </div>
    </div>
  );
}
