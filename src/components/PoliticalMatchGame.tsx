import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimation, PanInfo } from 'motion/react';
import {
  ArrowLeft, ArrowRight, ArrowUp,
  CheckCircle, XCircle, HelpCircle,
  RotateCcw, Trophy, ChevronRight, Share2, Star, Sparkles, Lock,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/Button';
import { shareBoussoleResults, preloadShareImages, preloadCandidatePhotos, getLastShareTimings } from '../lib/share';
import { shouldShowRatePrompt, openRateApp, markRateLater, markRateNever } from '../lib/rateApp';
import { openLink } from '../lib/openLink';
import { STABLE_STALE_MS } from '../lib/queryClient';
import { useAppConfig } from '../lib/appConfig';
import { InfoTip } from './ui/InfoTip';
import { DkCredit } from './comparateurUi';
import {
  DEFAULT_MATCH_PARAMS, coverageByCandidate, isPlayable, nextStatement, scoreCandidates, textHash,
  unlockProgress, type Answer, type CandidateResult, type Coverage, type MatchParams,
} from '../lib/matchScoring';
import {
  MATCH_QUERY_KEY, fetchMatchData, loadSeen, loadStoredAnswers, restoreMatchStateIfMissing,
  saveSeen, saveStoredAnswers, validAnswers, type MatchCandidate, type MatchData, type StoredAnswers,
} from '../lib/matchData';

type Phase = 'tutorial' | 'loading' | 'resume_prompt' | 'game' | 'results' | 'error';
type Statement = MatchData['statements'][number];

const TUTORIAL_DONE_KEY = 'cap2027.matchTutorialDone';

interface Notice {
  /** Affirmations nouvelles (ou reformulées) depuis la dernière partie. */
  newChoices: number;
  /** Candidats devenus jouables depuis la dernière partie. */
  joined: string[];
}

function fallbackPhoto(c: MatchCandidate) {
  return c.gender === 'F' ? '/card_red.png' : '/card_blue.png';
}

// Photo du candidat, avec repli sur la vignette par défaut si elle ne charge
// pas (photos demos-kratos.fr : serveur tiers, parfois limité en débit).
function CandidatePhoto({ c }: { c: MatchCandidate }) {
  return (
    <img
      decoding="async"
      src={c.photoUrl || fallbackPhoto(c)}
      alt=""
      className="w-full h-full object-cover"
      onError={(e) => {
        const img = e.currentTarget;
        if (img.dataset.fallback) return;
        img.dataset.fallback = '1';
        img.src = fallbackPhoto(c);
      }}
    />
  );
}

export function PoliticalMatchGame({ onClose }: { onClose: () => void }) {
  const initialPhase: Phase =
    typeof window !== 'undefined' && localStorage.getItem(TUTORIAL_DONE_KEY) === '1'
      ? 'loading' : 'tutorial';
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MatchData | null>(null);
  const [stored, setStored] = useState<StoredAnswers>(loadStoredAnswers);
  const [current, setCurrent] = useState<Statement | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const queryClient = useQueryClient();
  const appConfig = useAppConfig();

  // Seuils réglables depuis app_config ('match.params') sans nouvelle version.
  const params: MatchParams = useMemo(
    () => ({ ...DEFAULT_MATCH_PARAMS, ...(appConfig.data?.['match.params'] ?? {}) }),
    [appConfig.data],
  );

  // Tout ce qui découle des données et des réponses.
  const view = useMemo(() => {
    if (!data) return null;
    const coverage = coverageByCandidate(data.statements, data.stances);
    const playable = data.candidates.filter((c) => isPlayable(coverage.get(c.id), params));
    const playableIds = new Set(playable.map((c) => c.id));
    const notPlayable = data.candidates
      .filter((c) => !playableIds.has(c.id))
      .map((c) => ({ candidate: c, coverage: coverage.get(c.id) ?? { statements: 0, themes: 0 } }))
      .sort((a, b) => b.coverage.statements - a.coverage.statements);
    // Seules comptent les affirmations sur lesquelles un candidat jouable est positionné.
    const relevant = data.statements.filter((s) =>
      Object.keys(data.stances[s.id] ?? {}).some((cid) => playableIds.has(cid)));
    const answers = validAnswers(stored, relevant);
    const remaining = relevant.filter((s) => !(s.id in answers));
    const results = scoreCandidates(data.statements, data.stances, answers, [...playableIds], params);
    return {
      coverage, playable, playableIds, notPlayable, relevant, answers, remaining, results,
      unlock: unlockProgress(results, params),
    };
  }, [data, stored, params]);

  // Chargement : données partagées avec la carte d'accueil (même queryKey).
  useEffect(() => {
    if (phase !== 'loading') return;
    let cancelled = false;
    (async () => {
      await restoreMatchStateIfMissing();
      let d: MatchData;
      try {
        d = await queryClient.fetchQuery({ queryKey: MATCH_QUERY_KEY, queryFn: fetchMatchData, staleTime: STABLE_STALE_MS });
      } catch (e) {
        if (cancelled) return;
        setError((e as Error)?.message ?? 'Erreur inconnue');
        setPhase('error');
        return;
      }
      if (cancelled) return;
      const st = loadStoredAnswers();
      setStored(st);
      setData(d);
      preloadCandidatePhotos(d.candidates.filter((c) => c.photoIsOurs).map((c) => ({ photo_url: c.photoUrl, gender: c.gender })));
    })();
    return () => { cancelled = true; };
  }, [phase, queryClient]);

  // Une fois les données là : annonce des nouveautés, puis aiguillage.
  useEffect(() => {
    if (phase !== 'loading' || !data || !view) return;
    const seen = loadSeen();
    if (seen && seen.version !== data.version) {
      const before = new Set(seen.playable);
      const joined = view.playable.filter((c) => !before.has(c.id)).map((c) => c.fullName);
      if (view.remaining.length > 0 || joined.length > 0) setNotice({ newChoices: view.remaining.length, joined });
    }
    saveSeen({ version: data.version, playable: view.playable.map((c) => c.id) });

    if (view.relevant.length === 0) {
      setError("Le Match n'est pas encore disponible : aucun candidat n'est assez positionné.");
      setPhase('error');
    } else if (view.remaining.length === 0) {
      setPhase('results');
    } else if (Object.keys(view.answers).length > 0) {
      setPhase('resume_prompt');
    } else {
      startGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, data, view]);

  function pickNext(answers: Record<string, Answer>): Statement | null {
    if (!data || !view) return null;
    const remaining = view.relevant.filter((s) => !(s.id in answers));
    return nextStatement(remaining, data.stances, answers, data.statements, view.playableIds) as Statement | null;
  }

  function startGame() {
    const next = view ? pickNext(view.answers) : null;
    setCurrent(next);
    setPhase(next ? 'game' : 'results');
  }

  function recordAnswer(statementId: string, answer: Answer) {
    if (!view) return;
    const st = view.relevant.find((s) => s.id === statementId);
    if (!st) return;
    const nextStored = { ...stored, [statementId]: { a: answer, h: textHash(st.text) } };
    saveStoredAnswers(nextStored);
    setStored(nextStored);
    const next = pickNext({ ...view.answers, [statementId]: answer });
    if (next) setCurrent(next);
    else setPhase('results');
  }

  function resetAll() {
    saveStoredAnswers({});
    setStored({});
    setNotice(null);
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

  if (phase === 'loading' || !data || !view) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-[#102a5c] animate-spin" />
        <div className="text-sm text-slate-500">Chargement des affirmations...</div>
      </div>
    );
  }

  const totalAnswered = Object.keys(view.answers).length;
  const totalProps = view.relevant.length;

  if (phase === 'resume_prompt') {
    const remaining = view.remaining.length;
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-5">
        <div className="w-16 h-16 rounded-full bg-[#102a5c]/10 flex items-center justify-center">
          {notice ? <Sparkles className="w-8 h-8 text-[#102a5c]" /> : <ChevronRight className="w-8 h-8 text-[#102a5c]" />}
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#102a5c]">
            {notice ? 'Le Match s’enrichit' : 'Reprendre le test ?'}
          </h3>
          {notice && (
            <div className="text-sm text-slate-600 mt-2 max-w-sm flex flex-col gap-1">
              {notice.newChoices > 0 && (
                <p><strong>{notice.newChoices}</strong> nouveau{notice.newChoices > 1 ? 'x' : ''} choix disponible{notice.newChoices > 1 ? 's' : ''}.</p>
              )}
              {notice.joined.length > 0 && (
                <p>{notice.joined.join(', ')} {notice.joined.length > 1 ? 'rejoignent' : 'rejoint'} le Match.</p>
              )}
            </div>
          )}
          <p className="text-sm text-slate-500 mt-2 max-w-sm">
            Vous avez déjà répondu à <strong>{totalAnswered}</strong> affirmation{totalAnswered > 1 ? 's' : ''} sur <strong>{totalProps}</strong>.
            Il vous en reste <strong>{remaining}</strong>.
          </p>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-2 mt-2">
          <Button onClick={startGame} className="w-full bg-[#102a5c] hover:bg-[#153b82] text-white py-3 rounded-xl">
            Continuer ({remaining} restante{remaining > 1 ? 's' : ''})
          </Button>
          <Button onClick={() => setPhase('results')} variant="outline" className="w-full py-3 rounded-xl gap-2">
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
    const byId = new Map(data.candidates.map((c) => [c.id, c]));
    return (
      <Results
        rows={view.results.map((r) => ({ result: r, candidate: byId.get(r.candidateId)!, coverage: view.coverage.get(r.candidateId)! }))}
        notPlayable={view.notPlayable}
        unlock={view.unlock}
        params={params}
        totalAnswered={totalAnswered}
        totalProps={totalProps}
        statementsCount={data.statements.length}
        sourceUrl={data.sourceUrl}
        methodologyUrl={data.methodologyUrl}
        onResume={view.remaining.length > 0 ? startGame : null}
        remainingCount={view.remaining.length}
        onReset={resetAll}
        onClose={onClose}
      />
    );
  }

  // phase === 'game'
  if (!current) {
    setPhase('results');
    return null;
  }
  return (
    <GameCard
      key={current.id}
      proposition={current}
      answeredCount={totalAnswered}
      totalCount={totalProps}
      onAnswer={recordAnswer}
      onJumpToResults={() => setPhase('results')}
      sourceUrl={data.sourceUrl}
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
          Chaque affirmation est soumise à tous les candidats, positionnés d’après leur programme
          (analyse Demos Kratos). Le classement s’affiche dès que chacun a pu être comparé sur
          plusieurs thèmes.
        </p>

        <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
          <p className="text-sm font-semibold text-slate-700 mb-2">Barème :</p>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /> Même avis qu’un candidat</span>
            <span className="font-bold text-emerald-600">+1 pt</span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="flex items-center gap-1.5 text-slate-600">… s’il n’est que « plutôt » de cet avis</span>
            <span className="font-bold text-slate-600">±0,5 pt</span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="flex items-center gap-1.5"><HelpCircle className="w-4 h-4 text-slate-500" /> Sans avis</span>
            <span className="font-bold text-slate-600">non compté</span>
          </div>
          <div className="flex justify-between items-center text-sm py-1">
            <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4 text-rose-500" /> Avis opposé</span>
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
  proposition, answeredCount, totalCount, onAnswer, onJumpToResults, sourceUrl,
}: {
  proposition: Statement;
  answeredCount: number;
  totalCount: number;
  onAnswer: (propId: string, stance: Answer) => void;
  onJumpToResults: () => void;
  sourceUrl: string;
}) {
  const controls = useAnimation();
  const answeredRef = useRef(false);

  const handle = async (stance: Answer) => {
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

  const themeColor = proposition.themeColor || '#94a3b8';
  const progressPct = Math.round((answeredCount / Math.max(1, totalCount)) * 100);

  return (
    <div className="flex flex-col items-center justify-between p-2 sm:p-6 min-h-[480px] relative overflow-hidden">
      {/* Progress */}
      <div className="w-full max-w-[300px] flex flex-col items-center gap-2 mb-4">
        <div className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>{answeredCount} / {totalCount}</span>
          {proposition.themeLabel && (
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }} />
              {proposition.themeLabel}
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

      <div className="mt-3">
        <DkCredit url={sourceUrl} />
      </div>
    </div>
  );
}

// ----------------------- Results ------------------------------

interface ResultRow { result: CandidateResult; candidate: MatchCandidate; coverage: Coverage }

function Results({
  rows, notPlayable, unlock, params, totalAnswered, totalProps, statementsCount,
  sourceUrl, methodologyUrl, onResume, remainingCount, onReset, onClose,
}: {
  rows: ResultRow[];
  notPlayable: { candidate: MatchCandidate; coverage: Coverage }[];
  unlock: { unlocked: boolean; ratio: number };
  params: MatchParams;
  totalAnswered: number;
  totalProps: number;
  statementsCount: number;
  sourceUrl: string;
  methodologyUrl: string;
  onResume: (() => void) | null;
  remainingCount: number;
  onReset: () => void;
  onClose: () => void;
}) {
  // Classement masqué tant que chaque candidat n'a pas été assez comparé —
  // sauf s'il ne reste plus de carte (beaucoup de « sans avis ») : on montre
  // alors ce qu'on a, avec la mention « peu de données ».
  const locked = !unlock.unlocked && onResume !== null;
  const top = rows[0];
  const isComplete = totalAnswered === totalProps;
  const fewData = (r: CandidateResult) => r.compared < params.unlockComparisons;

  return (
    <div className="flex flex-col p-2 sm:p-4 gap-5 animate-in fade-in zoom-in duration-300">
      <div className="text-center">
        <span className="bg-[#102a5c]/10 text-[#102a5c] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
          Classement
        </span>
        <h3 className="text-xl sm:text-2xl font-bold text-[#102a5c] mb-1 inline-flex items-center gap-1.5">
          Vos affinités politiques
          <InfoTip label="Comment le score est-il calculé ?">
            Chaque affirmation est soumise à tous les candidats, positionnés d’après leur
            programme par Demos Kratos. Être du même avis qu’un candidat rapporte un point
            (un demi s’il n’est que « plutôt » de cet avis), un avis opposé en retire un ;
            « sans avis » ne compte pas. Chaque thème pèse de façon équilibrée et le score
            est amorti tant que peu d’affirmations ont été comparées. Seuls les candidats
            positionnés sur au moins {params.minStatements} affirmations et {params.minThemes} thèmes
            sont classés. Calcul propre à CAP 2027, différent de celui de demos-kratos.fr.
          </InfoTip>
        </h3>
        <p className="text-sm text-slate-500">
          {totalAnswered} / {totalProps} affirmations répondues
          {!isComplete && ' (test partiel)'}
        </p>
      </div>

      {locked ? (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center">
            <Lock className="w-5 h-5 text-[#102a5c]" />
          </div>
          <p className="font-bold text-[#102a5c]">Encore quelques cartes pour un résultat équitable</p>
          <p className="text-xs text-slate-500 max-w-xs">
            Le classement s’affiche quand chaque candidat a pu être comparé à vos réponses sur
            au moins {params.unlockComparisons} affirmations et {params.unlockThemes} thèmes.
          </p>
          <div className="w-full max-w-xs h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#102a5c] transition-all" style={{ width: `${Math.round(unlock.ratio * 100)}%` }} />
          </div>
        </div>
      ) : (
        <>
          {top && top.result.compared > 0 && (
            <div className="bg-gradient-to-br from-[#102a5c] to-[#1a56db] rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-80 mb-3">
                <Trophy className="w-4 h-4" /> Votre meilleur match
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 shrink-0 border-2 border-white/30">
                  <CandidatePhoto c={top.candidate} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg leading-tight truncate">{top.candidate.fullName}</div>
                  <div className="text-sm opacity-80 truncate">{top.candidate.party || '—'}</div>
                  <div className="text-[11px] opacity-70 mt-1">
                    {top.result.agree} accords • {top.result.disagree} désaccords • {top.result.compared} comparées
                  </div>
                </div>
                <div className="text-3xl font-black tabular-nums shrink-0">{top.result.pct}%</div>
              </div>
              <ShareInline rows={rows} totalAnswered={totalAnswered} totalProps={totalProps} />
            </div>
          )}

          <div className="flex flex-col gap-2">
            {rows.map(({ result: r, candidate: c, coverage }, i) => {
              const empty = r.compared === 0;
              const positive = r.pct >= 50;
              return (
                <div
                  key={c.id}
                  className={`bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 ${i === 0 ? 'ring-2 ring-[#1a56db]/20' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-slate-400 font-bold w-5 text-center text-sm">{i + 1}</div>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-50 shrink-0">
                      <CandidatePhoto c={c} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-[#102a5c] truncate">{c.fullName}</div>
                        <div className={`text-sm font-bold tabular-nums shrink-0 ${empty ? 'text-slate-400' : positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {empty ? '—' : `${r.pct}%`}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {empty
                          ? 'Pas encore de réponse sur ce candidat'
                          : <>
                              <span className="text-emerald-600 font-semibold">{r.agree}</span> accord{r.agree > 1 ? 's' : ''}
                              {' • '}
                              <span className="text-rose-600 font-semibold">{r.disagree}</span> désaccord{r.disagree > 1 ? 's' : ''}
                              {' • '}
                              <span className="text-slate-500">{r.compared}/{coverage.statements} comparées</span>
                              {fewData(r) && <span className="ml-1 text-amber-600 font-semibold">· peu de données</span>}
                            </>}
                      </div>
                      <DkCredit url={c.dkUrl} label="Son programme sur Demos Kratos" />
                    </div>
                  </div>
                  {!empty && (
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${r.pct}%`, backgroundColor: positive ? '#10b981' : '#ef4444' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {notPlayable.length > 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 p-3 sm:p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            Pas encore assez d’informations pour le Match
          </p>
          <p className="text-[11px] text-slate-500 mb-3 leading-snug">
            Leur programme n’aborde pas encore assez de sujets pour une comparaison équitable
            (au moins {params.minStatements} affirmations et {params.minThemes} thèmes). Ils rejoindront
            le Match dès que ce sera le cas.
          </p>
          <div className="flex flex-col gap-2">
            {notPlayable.map(({ candidate: c, coverage }) => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-50 shrink-0 opacity-70">
                  <CandidatePhoto c={c} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-600 truncate">{c.fullName}</div>
                  <div className="text-[11px] text-slate-400">
                    {coverage.statements} affirmation{coverage.statements > 1 ? 's' : ''} sur {statementsCount}
                    {' • '}{coverage.themes} thème{coverage.themes > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        {onResume && (
          <Button onClick={onResume} className="flex-1 bg-[#102a5c] hover:bg-[#153b82] text-white py-2.5 rounded-xl gap-2">
            <ChevronRight className="w-4 h-4" /> Continuer ({remainingCount} restante{remainingCount > 1 ? 's' : ''})
          </Button>
        )}
        <Button onClick={onReset} variant="outline" className="flex-1 py-2.5 rounded-xl gap-2">
          <RotateCcw className="w-4 h-4" /> Recommencer
        </Button>
        <Button onClick={onClose} variant={onResume ? 'outline' : 'primary'} className={onResume ? 'flex-1 py-2.5 rounded-xl' : 'flex-1 bg-[#102a5c] hover:bg-[#153b82] text-white py-2.5 rounded-xl'}>
          Fermer
        </Button>
      </div>

      <p className="text-[11px] text-slate-400 text-center leading-snug">
        Affirmations et positions des candidats :{' '}
        <button type="button" onClick={() => void openLink(sourceUrl)} className="underline font-semibold text-slate-500">
          propulsé par Demos Kratos
        </button>
        {' · '}
        <button type="button" onClick={() => void openLink(methodologyUrl)} className="underline">
          leur méthode
        </button>
      </p>

      {!locked && top && top.result.compared > 0 && <RatePromptInline />}
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

function toShareScores(rows: ResultRow[], totalProps: number) {
  return rows.map(({ result: r, candidate: c }) => ({
    candidate: {
      // Photo demos-kratos.fr inutilisable dans le canvas (pas de CORS) : vignette par défaut.
      id: c.id, first_name: c.fullName, last_name: '', gender: c.gender, photo_url: c.photoIsOurs ? c.photoUrl : null,
      parties: c.party ? { name: c.party, abbreviation: null, color: null } : null,
    },
    total: r.points, pct: r.pct, agree: r.agree, disagree: r.disagree, neutral: 0,
    answered: r.compared, totalProps,
  }));
}

function ShareInline({
  rows, totalAnswered, totalProps,
}: { rows: ResultRow[]; totalAnswered: number; totalProps: number }) {
  const scores = useMemo(() => toShareScores(rows, totalProps), [rows, totalProps]);
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
