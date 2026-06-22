import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Newspaper, Compass, Users, Scale, Bell, BadgeCheck, Star,
} from 'lucide-react';

// First-launch welcome tour. Beyond the intro text, each section slide
// shows a NEUTRAL STATIC mockup of the matching part of the app (no real
// candidate names, just placeholder shapes) so the user gets a visual
// preview without us driving the live navigation. Relaunchable from
// Réglages → Revoir le tutoriel (see App.tsx / SettingsModal).

interface Slide {
  title: string;
  subtitle: string;
  mockup?: React.ReactNode;
}

// ---- Static neutral mockups -------------------------------------------

function Bar({ w = 'w-full', tone = 'bg-slate-200' }: { w?: string; tone?: string }) {
  return <div className={`h-2 rounded-full ${w} ${tone}`} />;
}

function MockFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[280px] max-w-[80vw] rounded-[28px] bg-slate-50 border border-slate-100 shadow-inner p-4 flex flex-col gap-3">
      {children}
    </div>
  );
}

function NewsMockup() {
  return (
    <MockFrame>
      <div className="flex items-center gap-2">
        <Newspaper className="w-4 h-4 text-[#1a56db]" />
        <Bar w="w-20" tone="bg-slate-300" />
      </div>
      {/* orientation chips */}
      <div className="flex gap-1.5">
        {['#e2001a', '#475569', '#3c4ad6', '#cb1f24'].map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-100 px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
            <span className="w-5 h-1.5 rounded-full bg-slate-200" />
          </span>
        ))}
      </div>
      {/* article card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-2 flex gap-2">
        <div className="w-14 h-14 rounded-xl bg-slate-200 shrink-0" />
        <div className="flex-1 flex flex-col gap-1.5 py-1">
          <Bar w="w-12" tone="bg-blue-200" />
          <Bar />
          <Bar w="w-2/3" />
        </div>
      </div>
    </MockFrame>
  );
}

function BoussoleMockup() {
  return (
    <MockFrame>
      <div className="bg-gradient-to-br from-[#102a5c] to-[#1a56db] rounded-2xl p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-white/90" />
          <span className="w-16 h-2 rounded-full bg-white/40" />
        </div>
        <span className="w-3/4 h-2 rounded-full bg-white/25" />
        <div className="flex gap-2 mt-1">
          <span className="flex-1 h-6 rounded-full bg-rose-400/70" />
          <span className="flex-1 h-6 rounded-full bg-white/30" />
          <span className="flex-1 h-6 rounded-full bg-emerald-400/70" />
        </div>
      </div>
      {/* mini ranking */}
      <div className="flex flex-col gap-1.5">
        {['85%', '60%', '35%'].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: w }} />
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

function CandidatesMockup() {
  return (
    <MockFrame>
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-[#1a56db]" />
        <Bar w="w-20" tone="bg-slate-300" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-2 flex flex-col items-center gap-1.5">
            <span className="w-7 h-7 rounded-full bg-slate-200" />
            <span className="w-8 h-1.5 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-100 p-2 flex items-center gap-2">
        <Scale className="w-4 h-4 text-emerald-500" />
        <Bar w="w-2/3" />
      </div>
    </MockFrame>
  );
}

function RecapMockup() {
  const rows = [
    { icon: <Newspaper className="w-4 h-4 text-[#1a56db]" />, label: 'Actualités' },
    { icon: <Compass className="w-4 h-4 text-emerald-600" />, label: 'Boussole' },
    { icon: <Users className="w-4 h-4 text-purple-600" />, label: 'Candidats' },
    { icon: <BadgeCheck className="w-4 h-4 text-indigo-600" />, label: 'Fact-checking' },
    { icon: <Bell className="w-4 h-4 text-amber-500" />, label: 'Notifications' },
  ];
  return (
    <MockFrame>
      {rows.map((r) => (
        <div key={r.label} className="bg-white rounded-xl border border-slate-100 p-2 flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
            {r.icon}
          </span>
          <span className="text-xs font-bold text-[#102a5c]">{r.label}</span>
        </div>
      ))}
    </MockFrame>
  );
}

// ---- Slides -----------------------------------------------------------

const slides: Slide[] = [
  {
    title: 'Bienvenue sur CAP 2027',
    subtitle: 'La boîte à outils civique 100% indépendante pour la présidentielle.',
  },
  {
    title: "L'actualité, tous bords confondus",
    subtitle: 'Un fil agrégé de médias de toutes sensibilités. Filtrez par bord politique et par thème.',
    mockup: <NewsMockup />,
  },
  {
    title: 'Trouvez votre boussole',
    subtitle: 'Positionnez-vous sur les idées, sans voir les noms, et découvrez vos affinités avec les candidats.',
    mockup: <BoussoleMockup />,
  },
  {
    title: 'Candidats & comparateur',
    subtitle: 'Des fiches identiques pour chaque candidat et une comparaison côte à côte, thème par thème.',
    mockup: <CandidatesMockup />,
  },
  {
    title: 'Tout est là, à votre rythme',
    subtitle: 'Notifications que vous maîtrisez, fact-checking, parrainages et rappels civiques. Sans compte, sans pub.',
    mockup: <RecapMockup />,
  },
];

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const slide = slides[currentSlide];

  return (
    <motion.div
      className="fixed inset-0 min-h-[100dvh] bg-white z-[90] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="p-4 sm:p-6 flex justify-end">
        <button
          onClick={onComplete}
          className="text-[#1a56db] font-bold py-2 px-3 sm:px-4 rounded-full hover:bg-blue-50 transition-colors text-[15px] sm:text-base"
        >
          Passer
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 pb-10 sm:pb-16 overflow-y-auto">
         <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center w-full max-w-[400px]"
            >
              <div className="mb-7 sm:mb-9 flex items-center justify-center">
                {slide.mockup ? (
                  slide.mockup
                ) : (
                  <div className="w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] rounded-[32px] sm:rounded-[36px] overflow-hidden shadow-md">
                    <img decoding="async"
                      src="/logo-cap2027.png"
                      alt="CAP 2027"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
              <h1 className="text-[26px] sm:text-[30px] leading-[1.1] font-black text-[#102a5c] mb-4 sm:mb-5 tracking-tight">
                {slide.title}
              </h1>
              <p className="text-[16px] sm:text-[18px] text-[#475569] leading-relaxed font-medium">
                {slide.subtitle}
              </p>
            </motion.div>
         </AnimatePresence>
      </div>

      <div className="p-6 pb-8 sm:pb-10 flex flex-col items-center gap-6 sm:gap-8 bg-white">
        {/* Pagination Dots */}
        <div className="flex gap-2.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              aria-label={`Aller à l'écran ${idx + 1}`}
              onClick={() => setCurrentSlide(idx)}
              className={`h-2 sm:h-2.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-8 bg-[#1a56db]' : 'w-2.5 bg-slate-200'}`}
            />
          ))}
        </div>

        <button
          onClick={nextSlide}
          className="w-full max-w-[400px] inline-flex items-center justify-center gap-2 bg-[#1a56db] text-white font-bold text-[16px] sm:text-[17px] py-4 rounded-[16px] xl:rounded-[20px] hover:bg-[#154bbd] transition-colors active:scale-[0.98] shadow-sm tracking-wide"
        >
          {currentSlide === slides.length - 1 ? (<><Star className="w-4 h-4" /> C'est parti !</>) : 'Suivant'}
        </button>
      </div>
    </motion.div>
  );
}
