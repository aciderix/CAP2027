import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const slides = [
  {
    title: "Bienvenue sur CAP 2027",
    subtitle: "La boîte à outils civique 100% indépendante pour la présidentielle."
  },
  {
    title: "Sans compte, sans publicité",
    subtitle: "Pas d'inscription, pas de tracking publicitaire. Vos choix restent sur votre téléphone."
  },
  {
    title: "Neutre et factuel",
    subtitle: "Tous les candidats sont présentés de manière égale. Sources vérifiables."
  },
  {
    title: "Prêt à explorer ?",
    subtitle: "Découvrez les candidats, comparez les programmes, trouvez votre boussole."
  }
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

      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 pb-16 sm:pb-24">
         <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center w-full max-w-[400px]"
            >
              <div className="w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] rounded-[32px] sm:rounded-[36px] overflow-hidden mb-8 sm:mb-12 shadow-md">
                <img decoding="async"
                  src="/logo-cap2027.png"
                  alt="CAP 2027"
                  className="w-full h-full object-cover"
                />
              </div>
              <h1 className="text-[28px] sm:text-[32px] leading-[1.1] font-black text-[#102a5c] mb-5 sm:mb-6 tracking-tight">
                {slides[currentSlide].title}
              </h1>
              <p className="text-[17px] sm:text-[19px] text-[#475569] leading-relaxed font-medium">
                {slides[currentSlide].subtitle}
              </p>
            </motion.div>
         </AnimatePresence>
      </div>

      <div className="p-6 pb-8 sm:pb-10 flex flex-col items-center gap-8 sm:gap-10 bg-white">
        {/* Pagination Dots */}
        <div className="flex gap-2.5">
          {slides.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-2 sm:h-2.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-8 bg-[#1a56db]' : 'w-2.5 bg-slate-200'}`}
            />
          ))}
        </div>

        <button 
          onClick={nextSlide}
          className="w-full max-w-[400px] bg-[#1a56db] text-white font-bold text-[16px] sm:text-[17px] py-4 rounded-[16px] xl:rounded-[20px] hover:bg-[#154bbd] transition-colors active:scale-[0.98] shadow-sm tracking-wide"
        >
          {currentSlide === slides.length - 1 ? "C'est parti !" : "Suivant"}
        </button>
      </div>
    </motion.div>
  );
}
