import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimation, PanInfo } from 'motion/react';
import {
  ArrowLeft, ArrowRight, ArrowUp,
  CheckCircle, XCircle, HelpCircle,
  RotateCcw, Trophy, ChevronRight, Share2, Star,
} from 'lucide-react';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';
import { shareBoussoleResults, preloadShareImages, preloadCandidatePhotos, getLastShareTimings } from '../lib/share';
import { shouldShowRatePrompt, openRateApp, markRateLater, markRateNever } from '../lib/rateApp';
import { InfoTip } from './ui/InfoTip';

type Stance = 'pour' | 'contre' | 'neutre';
type Phase = 'tutorial' | 'loading' | 'resume_prompt' | 'game' | 'results' | 'error';

interface ThemeLite {
  slug: string;
  name: string;
  color: string | null;
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

interface Proposition {
  id: string;
  text: string;
  candidate_id: string;
  theme: ThemeLite | null;
}

interface CandidateScore {
  candidate: CandidateLite;
  total: number;          // sum of +1 / 0 / -1
  agree: number;
  disagree: number;
  neutral: number;
  answered: number;       // out of totalProps
  totalProps: number;
}

const TUTORIAL_DONE_KEY = 'cap2027.matchTutorialDone';
const ANSWERS_KEY = 'cap2027.matchAnswers.v2';

function loadAnswers(): Record<string, Stance> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ANSWERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
// Mirror to Capacitor Preferences (native storage) so the answers
// survive a WebView storage wipe, an Android backup/restore, or any
// other event that might empty localStorage. localStorage stays the
// fast read path; Preferences is a write-through backup.
async function mirrorAnswersToPreferences(answers: Record<string, Stance>) {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: ANSWERS_KEY, value: JSON.stringify(answers) });
  } catch {
    // best-effort
  }
}
async function restoreAnswersFromPreferencesIfMissing(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(ANSWERS_KEY)) return;
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: ANSWERS_KEY });
    if (value) localStorage.setItem(ANSWERS_KEY, value);
  } catch {
    // best-effort
  }
}
function saveAnswers(a: Record<string, Stance>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ANSWERS_KEY, JSON.stringify(a));
  void mirrorAnswersToPreferences(a);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PoliticalMatchGame({ onClose }: { onClose: () => void }) {
  const initialPhase: Phase =
    typeof window !== 'undefined' && localStorage.getItem(TUTORIAL_DONE_KEY) === '1'
      ? 'loading' : 'tutorial';
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [error, setError] = useState<string | null>(null);

  const [propositions, setPropositions] = useState<Proposition[]>([]);
  const [candidates, setCandidates] = useState<CandidateLite[]>([]);
  const [answers, setAnswers] = useState<Record<string, Stance>>(loadAnswers);
  const [deck, setDeck] = useState<Proposition[]>([]);   // remaining cards (shuffled)
  const [deckIndex, setDeckIndex] = useState(0);

  // Load propositions + candidates when entering loading phase
  useEffect(() => {
    if (phase !== 'loading') return;
    let cancelled = false;
    (async () => {
      // Restore from native Preferences first if localStorage was
      // cleared (Android backup/restore, manual wipe, etc.).
      await restoreAnswersFromPreferencesIfMissing();
      const [propsRes, candRes] = await Promise.all([
        supabase
          .from('candidate_match_propositions')
          .select('id, text, candidate_id, themes(slug, name, color)')
          .eq('is_active', true),
        supabase
          .from('candidates')
          .select('id, first_name, last_name, gender, photo_url, parties(name, abbreviation, color)')
          .eq('is_published', true),
      ]);
      if (cancelled) return;
      if (propsRes.error || candRes.error) {
        setError(propsRes.error?.message || candRes.error?.message || 'Erreur inconnue');
        setPhase('error');
        return;
      }
      const props: Proposition[] = (propsRes.data ?? []).map((row) => ({
        id: row.id,
        text: row.text,
        candidate_id: row.candidate_id,
        theme: row.themes as unknown as ThemeLite | null,
      }));
      const cands = (candRes.data ?? []) as unknown as CandidateLite[];
      setPropositions(props);
      setCandidates(cands);

      // Warm the CORS image cache early so the share image is
      // ready instantly when the user reaches the Results screen.
      preloadCandidatePhotos(cands);

      const current = loadAnswers();
      setAnswers(current);
      const remaining = props.filter((p) => !(p.id in current));
      const answeredAny = Object.keys(current).length > 0;

      if (props.length === 0) {
        setError('Aucune proposition disponible.');
        setPhase('error');
      } else if (remaining.length === 0) {
        setPhase('results');
      } else if (answeredAny) {
        setDeck(shuffle(remaining));
        setDeckIndex(0);
        setPhase('resume_prompt');
      } else {
        setDeck(shuffle(remaining));
        setDeckIndex(0);
        setPhase('game');
      }
    })();
    return () => { cancelled = true; };
  }, [phase]);

  function recordAnswer(propId: string, stance: Stance) {
    setAnswers((prev) => {
      const next = { ...prev, [propId]: stance };
      saveAnswers(next);
      return next;
    });
    if (deckIndex >= deck.length - 1) {
      setPhase('results');
    } else {
      setDeckIndex((i) => i + 1);
    }
  }

  function resetAll() {
    saveAnswers({});
    setAnswers({});
    setPhase('loading');
  }

  function continueGame() {
    setPhase('game');
  }

  function jumpToResults() {
    setPhase('results');
  }

  const scores: CandidateScore[] = useMemo(() => {
    if (phase !== 'results' && phase !== 'resume_prompt') return [];
    const byCandidate = new Map<string, Proposition[]>();
    for (const p of propositions) {
      if (!byCandidate.has(p.candidate_id)) byCandidate.set(p.candidate_id, []);
      byCandidate.get(p.candidate_id)!.push(p);
    }
    const list: CandidateScore[] = candidates.map((c) => {
      const props = byCandidate.get(c.id) ?? [];
      let total = 0, agree = 0, disagree = 0, neutral = 0, answered = 0;
      for (const p of props) {
        const s = answers[p.id];
        if (!s) continue;
        answered++;
        if (s === 'pour') { total++; agree++; }
        else if (s === 'contre') { total--; disagree++; }
        else { neutral++; }
      }
      return { candidate: c, total, agree, disagree, neutral, answered, totalProps: props.length };
    });
    list.sort((a, b) => b.total - a.total);
    return list;
  }, [phase, candidates, propositions, answers]);

  const totalAnswered = Object.keys(answers).length;
  const totalProps = propositions.length;

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

  if (phase === 'resume_prompt') {
    const remaining = totalProps - totalAnswered;
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-5">
        <div className="w-16 h-16 rounded-full bg-[#102a5c]/10 flex items-center justify-center">
          <ChevronRight className="w-8 h-8 text-[#102a5c]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#102a5c]">Reprendre le test ?</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-sm">
            Vous avez déjà répondu à <strong>{totalAnswered}</strong> proposition{totalAnswered > 1 ? 's' : ''} sur <strong>{totalProps}</strong>.
            Il vous en reste <strong>{remaining}</strong>.
          </p>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-2 mt-2">
          <Button onClick={continueGame} className="w-full bg-[#102a5c] hover:bg-[#153b82] text-white py-3 rounded-xl">
            Continuer ({remaining} restantes)
          </Button>
          <Button onClick={jumpToResults} variant="outline" className="w-full py-3 rounded-xl gap-2">
            <Trophy className="w-4 h-4" /> Voir mes scores actuels
          </Button>
          <button
            onClick={resetAll}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline mt-2"
          >
            Tout recommencer à zéro
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'results') {
    return (
      <Results
        scores={scores}
        totalAnswered={totalAnswered}
        totalProps={totalProps}
        onResume={
          totalAnswered < totalProps
            ? () => {
                const remaining = propositions.filter((p) => !(p.id in answers));
                setDeck(shuffle(remaining));
                setDeckIndex(0);
                setPhase('game');
              }
            : null
        }
        onReset={resetAll}
        onClose={onClose}
      />
    );
  }

  // phase === 'game'
  if (deck.length === 0 || deckIndex >= deck.length) {
    setPhase('results');
    return null;
  }
  const current = deck[deckIndex];
  return (
    <GameCard
      key={current.id}
      proposition={current}
      answeredCount={totalAnswered}
      totalCount={totalProps}
      onAnswer={recordAnswer}
      onJumpToResults={jumpToResults}
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
      title: 'En accord',
      desc: "Glissez vers la GAUCHE pour dire que vous êtes d'accord avec cette idée.",
      img: '/card_red.png',
      icon: <CheckCircle className="w-12 h-12 text-emerald-500 bg-white rounded-full" />,
      arrow: <ArrowLeft className="w-8 h-8 text-emerald-500 animate-pulse" />,
    },
    {
      id: 'tuto_right' as TutoStep, dir: 'right' as const,
      title: 'En désaccord',
      desc: 'Glissez vers la DROITE pour exprimer votre désaccord.',
      img: '/card_blue.png',
      icon: <XCircle className="w-12 h-12 text-rose-500 bg-white rounded-full" />,
      arrow: <ArrowRight className="w-8 h-8 text-rose-500 animate-pulse" />,
    },
    {
      id: 'tuto_up' as TutoStep, dir: 'up' as const,
      title: 'Sans avis',
      desc: "Glissez vers le HAUT si vous n'avez pas d'opinion sur le sujet.",
      img: '/card_red.png',
      icon: <HelpCircle className="w-12 h-12 text-slate-500 bg-white rounded-full" />,
      arrow: <ArrowUp className="w-8 h-8 text-slate-500 animate-pulse" />,
    },
  ];

  const currentTutoIndex = tutorials.findIndex((t) => t.id === step);
  const currentTuto = tutorials[currentTutoIndex];

  const handleDragEnd = async (_e: unknown, info: PanInfo) => {
    const threshold = 80;
    let dir: 'left' | 'right' | 'up' | null = null;
    if (info.offset.y < -threshold && Math.abs(info.offset.x) < threshold) dir = 'up';
    else if (info.offset.x < -threshold) dir = 'left';
    else if (info.offset.x > threshold) dir = 'right';

    if (dir === currentTuto.dir) {
      let x = 0, y = 0;
      if (dir === 'left') x = -500;
      if (dir === 'right') x = 500;
      if (dir === 'up') y = -500;
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
        <p className="text-slate-600 mb-6 max-w-sm">
          Chaque proposition est attribuée à un candidat (que vous ne voyez pas pendant le test).
          Le classement final révèlera vos affinités.
        </p>

        <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
          <p className="text-sm font-semibold text-slate-700 mb-2">Barème :</p>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /> Accord</span>
            <span className="font-bold text-emerald-600">+1 pt</span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="flex items-center gap-1.5"><HelpCircle className="w-4 h-4 text-slate-500" /> Sans avis</span>
            <span className="font-bold text-slate-600">0 pt</span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4 text-rose-500" /> Désaccord</span>
            <span className="font-bold text-rose-600">-1 pt</span>
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
          whileTap={{ scale: 0.95, cursor: 'grabbing' }}
          whileDrag={{ scale: 0.95 }}
          className="w-[220px] sm:w-[240px] aspect-[2.5/3.5] bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border-[4px] border-white z-10 relative overflow-hidden cursor-grab touch-none flex flex-col items-center justify-center"
        >
          <img decoding="async" src={currentTuto.img} alt="Tuto Card" className="absolute inset-0 w-full h-full object-cover z-0" />
          <div className="absolute inset-0 bg-slate-900/20 z-10" />
          <div className="relative z-20 flex flex-col items-center gap-4 text-center p-4">
            {currentTuto.icon}
            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl">
              <p className="font-bold text-slate-800 text-sm">Glissez pour tester</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-8">
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
  proposition, answeredCount, totalCount, onAnswer, onJumpToResults,
}: {
  proposition: Proposition;
  answeredCount: number;
  totalCount: number;
  onAnswer: (propId: string, stance: Stance) => void;
  onJumpToResults: () => void;
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

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    if (answeredRef.current) return;
    const threshold = 80;
    if (info.offset.y < -threshold && Math.abs(info.offset.x) < threshold) handle('neutre');
    else if (info.offset.x < -threshold) handle('pour');
    else if (info.offset.x > threshold) handle('contre');
    else controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
  };

  const themeColor = proposition.theme?.color || '#94a3b8';
  const progressPct = Math.round((answeredCount / Math.max(1, totalCount)) * 100);

  return (
    <div className="flex flex-col items-center justify-between p-2 sm:p-6 min-h-[480px] relative overflow-hidden">
      {/* Progress */}
      <div className="w-full max-w-[300px] flex flex-col items-center gap-2 mb-4">
        <div className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>{answeredCount} / {totalCount}</span>
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
            style={{ width: `${progressPct}%`, backgroundColor: '#102a5c' }}
          />
        </div>
      </div>

      <div className="relative w-full max-w-[300px] h-[320px] flex items-center justify-center">
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
          whileTap={{ scale: 0.97, cursor: 'grabbing' }}
          whileDrag={{ scale: 0.97 }}
          className="w-[260px] sm:w-[280px] aspect-[2.5/3.5] bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border-[4px] border-white z-10 relative overflow-hidden cursor-grab touch-none flex flex-col"
        >
          <div className="h-1.5 w-full" style={{ backgroundColor: themeColor }} />
          <div className="flex-1 flex items-center justify-center p-5 text-center">
            <p className="text-[#102a5c] font-bold text-base sm:text-lg leading-snug">
              {proposition.text}
            </p>
          </div>
          <div className="px-4 pb-4 pt-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Glissez ou tapez pour répondre
          </div>
        </motion.div>
      </div>

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

      {answeredCount > 0 && (
        <button
          onClick={onJumpToResults}
          className="mt-4 text-xs font-semibold text-slate-500 hover:text-slate-700 underline"
        >
          Voir mes scores actuels
        </button>
      )}
    </div>
  );
}

// ----------------------- Results ------------------------------

function Results({
  scores, totalAnswered, totalProps, onResume, onReset, onClose,
}: {
  scores: CandidateScore[];
  totalAnswered: number;
  totalProps: number;
  onResume: (() => void) | null;
  onReset: () => void;
  onClose: () => void;
}) {
  const top = scores[0];
  const isComplete = totalAnswered === totalProps;
  const fullName = (c: CandidateLite) => `${c.first_name} ${c.last_name}`.trim();
  const fallback = (c: CandidateLite) => (c.gender === 'F' ? '/card_red.png' : '/card_blue.png');

  // Determine the highest possible score for bar normalization
  const maxAbs = Math.max(1, ...scores.map((s) => Math.abs(s.total)));

  return (
    <div className="flex flex-col p-2 sm:p-4 gap-5 animate-in fade-in zoom-in duration-300">
      <div className="text-center">
        <span className="bg-[#102a5c]/10 text-[#102a5c] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
          Classement
        </span>
        <h3 className="text-xl sm:text-2xl font-bold text-[#102a5c] mb-1 inline-flex items-center gap-1.5">
          Vos affinités politiques
          <InfoTip label="Comment le score est-il calculé ?">
            Pour chaque proposition, un accord avec la position d’un candidat ajoute
            un point, un désaccord en retire un. « Sans avis » ne compte pas. Le
            classement reflète vos réponses, pas une préférence de l’app.
          </InfoTip>
        </h3>
        <p className="text-sm text-slate-500">
          {totalAnswered} / {totalProps} propositions répondues
          {!isComplete && ' (test partiel)'}
        </p>
      </div>

      {top && top.answered > 0 && (
        <div className="bg-gradient-to-br from-[#102a5c] to-[#1a56db] rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-80 mb-3">
            <Trophy className="w-4 h-4" /> Votre meilleur match
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 shrink-0 border-2 border-white/30">
              <img decoding="async" src={top.candidate.photo_url || fallback(top.candidate)} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-lg leading-tight truncate">{fullName(top.candidate)}</div>
              <div className="text-sm opacity-80 truncate">
                {top.candidate.parties?.name || top.candidate.parties?.abbreviation || '—'}
              </div>
              <div className="text-[11px] opacity-70 mt-1">
                {top.agree} accords • {top.disagree} désaccords • {top.neutral} sans avis
              </div>
            </div>
            <div className="text-3xl font-black tabular-nums shrink-0">
              {top.total > 0 ? '+' : ''}{top.total}
            </div>
          </div>
          <ShareInline scores={scores} totalAnswered={totalAnswered} totalProps={totalProps} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {scores.map((s, i) => {
          const empty = s.answered === 0;
          const sign = s.total > 0 ? '+' : '';
          const widthPct = empty ? 0 : Math.round((Math.abs(s.total) / maxAbs) * 100);
          const positive = s.total >= 0;
          return (
            <div
              key={s.candidate.id}
              className={`bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 ${i === 0 ? 'ring-2 ring-[#1a56db]/20' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="text-slate-400 font-bold w-5 text-center text-sm">{i + 1}</div>
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-50 shrink-0">
                  <img decoding="async" src={s.candidate.photo_url || fallback(s.candidate)} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-[#102a5c] truncate">{fullName(s.candidate)}</div>
                    <div className={`text-sm font-bold tabular-nums shrink-0 ${empty ? 'text-slate-400' : positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {empty ? '—' : `${sign}${s.total}`}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {empty
                      ? 'Pas encore de réponse sur ce candidat'
                      : <>
                          <span className="text-emerald-600 font-semibold">{s.agree}</span> accord{s.agree > 1 ? 's' : ''}
                          {' • '}
                          <span className="text-rose-600 font-semibold">{s.disagree}</span> désaccord{s.disagree > 1 ? 's' : ''}
                          {' • '}
                          <span className="text-slate-500">{s.answered}/{s.totalProps}</span>
                        </>}
                  </div>
                </div>
              </div>

              {!empty && (
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: positive ? '#10b981' : '#ef4444',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        {onResume && (
          <Button onClick={onResume} className="flex-1 bg-[#102a5c] hover:bg-[#153b82] text-white py-2.5 rounded-xl gap-2">
            <ChevronRight className="w-4 h-4" /> Continuer ({totalProps - totalAnswered} restantes)
          </Button>
        )}
        <Button onClick={onReset} variant="outline" className="flex-1 py-2.5 rounded-xl gap-2">
          <RotateCcw className="w-4 h-4" /> Recommencer
        </Button>
        <Button onClick={onClose} variant={onResume ? 'outline' : 'primary'} className={onResume ? 'flex-1 py-2.5 rounded-xl' : 'flex-1 bg-[#102a5c] hover:bg-[#153b82] text-white py-2.5 rounded-xl'}>
          Fermer
        </Button>
      </div>

      {top && top.answered > 0 && <RatePromptInline />}
    </div>
  );
}

// Non-invasive "rate the app" prompt, shown once after a meaningful
// action (finishing/answering the Boussole). Hidden on web, after rating,
// after "Ne plus demander", or within the cooldown after "Plus tard".
function RatePromptInline() {
  const [visible, setVisible] = useState(() => shouldShowRatePrompt());
  if (!visible) return null;

  return (
    <div className="rounded-2xl bg-amber-50/60 border border-amber-100 p-4 flex flex-col gap-3 mt-1 animate-in fade-in duration-300">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-amber-500 shrink-0">
          <Star className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-[#102a5c] text-sm">Vous aimez CAP 2027 ?</p>
          <p className="text-xs text-slate-500 leading-snug mt-0.5">
            Une note sur le Play Store aide d’autres citoyens à découvrir l’app. C’est rapide et ça compte beaucoup.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { void openRateApp(); setVisible(false); }}
          className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 bg-[#1a56db] hover:bg-[#154bbd] text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-colors"
        >
          <Star className="w-4 h-4" /> Noter l'application
        </button>
        <button
          onClick={() => { markRateLater(); setVisible(false); }}
          className="inline-flex items-center justify-center text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-2.5"
        >
          Plus tard
        </button>
        <button
          onClick={() => { markRateNever(); setVisible(false); }}
          className="inline-flex items-center justify-center text-xs font-semibold text-slate-400 hover:text-slate-600 px-3 py-2.5"
        >
          Ne plus demander
        </button>
      </div>
    </div>
  );
}

function ShareInline({
  scores, totalAnswered, totalProps,
}: { scores: CandidateScore[]; totalAnswered: number; totalProps: number }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [timings, setTimings] = useState<{ total: number; image: number; b64: number; write: number; share: number; size: number } | null>(null);

  // Warm the CORS photo cache as soon as Results renders, so by the
  // time the user taps Partager the network round-trip is already done.
  useEffect(() => {
    preloadShareImages(scores);
  }, [scores]);

  const handle = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res = await shareBoussoleResults(scores, totalAnswered, totalProps);
    if (!res.ok) {
      setErr(res.reason ?? 'erreur inconnue');
    }
    setTimings(getLastShareTimings());
    setBusy(false);
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/15 flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 active:bg-slate-200 text-[#102a5c] font-bold text-sm py-2.5 px-4 rounded-xl transition-colors disabled:opacity-60"
      >
        <Share2 className="w-4 h-4" />
        {busy ? 'Génération de l’image…' : 'Partager mes résultats'}
      </button>
      {err && (
        <div className="text-[11px] text-white bg-rose-500/30 border border-rose-100/30 rounded-lg px-2 py-1">
          {err}
        </div>
      )}
      {timings && (
        <div className="text-[10px] text-white/70 tabular-nums leading-tight">
          ⏱ {timings.total}ms — img {timings.image} · b64 {timings.b64} · write {timings.write} · share {timings.share} · {(timings.size / 1024).toFixed(0)}KB
        </div>
      )}
    </div>
  );
}
