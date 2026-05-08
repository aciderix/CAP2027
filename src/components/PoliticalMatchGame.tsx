import { useState } from 'react';
import { motion, useAnimation, PanInfo } from 'motion/react';
import { ArrowLeft, ArrowRight, ArrowUp, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { Button } from './ui/Button';

type MatchStep = 'tuto_left' | 'tuto_right' | 'tuto_up' | 'recap';

export function PoliticalMatchGame({ onComplete, onClose }: { onComplete: () => void, onClose: () => void }) {
  const [step, setStep] = useState<MatchStep>('tuto_left');
  const controls = useAnimation();

  const tutorials = [
    { 
      id: 'tuto_left', 
      dir: 'left', 
      title: "En accord", 
      desc: "Glissez vers la GAUCHE pour dire que vous êtes d'accord avec cette idée.", 
      img: '/card_red.png',
      icon: <CheckCircle className="w-12 h-12 text-emerald-500 bg-white rounded-full" />,
      arrow: <ArrowLeft className="w-8 h-8 text-emerald-500 animate-pulse" />
    },
    { 
      id: 'tuto_right', 
      dir: 'right', 
      title: "En désaccord", 
      desc: "Glissez vers la DROITE pour exprimer votre désaccord.", 
      img: '/card_blue.png',
      icon: <XCircle className="w-12 h-12 text-rose-500 bg-white rounded-full" />,
      arrow: <ArrowRight className="w-8 h-8 text-rose-500 animate-pulse" />
    },
    { 
      id: 'tuto_up', 
      dir: 'up', 
      title: "Sans avis", 
      desc: "Glissez vers le HAUT si vous n'avez pas d'opinion sur le sujet.", 
      img: '/card_red.png',
      icon: <HelpCircle className="w-12 h-12 text-slate-500 bg-white rounded-full" />,
      arrow: <ArrowUp className="w-8 h-8 text-slate-500 animate-pulse" />
    },
  ];

  const currentTutoIndex = tutorials.findIndex(t => t.id === step);
  const currentTuto = tutorials[currentTutoIndex];

  const handleDragEnd = async (event: any, info: PanInfo) => {
    const threshold = 80;
    let swipedDirection = null;
    
    if (info.offset.y < -threshold && Math.abs(info.offset.x) < threshold) {
      swipedDirection = 'up';
    } else if (info.offset.x < -threshold) {
      swipedDirection = 'left';
    } else if (info.offset.x > threshold) {
      swipedDirection = 'right';
    }

    if (swipedDirection === currentTuto.dir) {
      // Success
      let x = 0;
      let y = 0;
      if (swipedDirection === 'left') x = -500;
      if (swipedDirection === 'right') x = 500;
      if (swipedDirection === 'up') y = -500;
      
      await controls.start({ x, y, opacity: 0, transition: { duration: 0.3 } });
      
      // Move to next step
      if (currentTutoIndex < tutorials.length - 1) {
        setStep(tutorials[currentTutoIndex + 1].id as MatchStep);
        controls.start({ x: 0, y: 0, opacity: 1, transition: { duration: 0 } });
      } else {
        setStep('recap');
      }
    } else {
      // Revert if wrong direction or not enough swipe
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
           Vous êtes maintenant prêt. Le test vous proposera des dizaines de propositions anonymes. Découvrez qui se cache derrière vos convictions !
         </p>
         
         <div className="w-full flex justify-center mt-auto">
             <div className="flex flex-col gap-3 w-full bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                 <p className="text-sm font-semibold text-slate-700">Rappel du barème :</p>
                 <div className="flex justify-between items-center text-sm">
                     <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /> Accord</span>
                     <span className="font-bold text-emerald-600">+1 pt</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                     <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4 text-rose-500" /> Désaccord</span>
                     <span className="font-bold text-rose-600">-1 pt</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                     <span className="flex items-center gap-1.5"><HelpCircle className="w-4 h-4 text-slate-500" /> Sans avis</span>
                     <span className="font-bold text-slate-600">0 pt</span>
                 </div>
             </div>
         </div>

         <div className="flex flex-col sm:flex-row w-full gap-3">
             <Button onClick={onComplete} className="flex-1 bg-[#102a5c] hover:bg-[#153b82] text-white py-3 rounded-xl">
                 Afficher les propositions
             </Button>
             <Button variant="outline" onClick={onComplete} className="flex-1 py-3 rounded-xl border-slate-200">
                 Mes scores d'affinité
             </Button>
         </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between p-2 sm:p-6 min-h-[450px] relative overflow-hidden">
        {/* Header Tuto */}
        <div className="text-center mb-8">
            <span className="bg-[#102a5c]/10 text-[#102a5c] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
                Tutoriel {currentTutoIndex + 1}/3
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-[#102a5c] mb-2">{currentTuto.title}</h3>
            <p className="text-sm text-slate-500 max-w-[260px] mx-auto">{currentTuto.desc}</p>
        </div>

        {/* Swipe Area */}
        <div className="relative w-full max-w-[280px] h-[320px] flex items-center justify-center">
            {/* Guide arrows depending on direction */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 z-0">
               {currentTuto.dir === 'left' && <div className="absolute left-[-20px] top-1/2 -translate-y-1/2">{currentTuto.arrow}</div>}
               {currentTuto.dir === 'right' && <div className="absolute right-[-20px] top-1/2 -translate-y-1/2">{currentTuto.arrow}</div>}
               {currentTuto.dir === 'up' && <div className="absolute top-[-20px] left-1/2 -translate-x-1/2">{currentTuto.arrow}</div>}
            </div>

            {/* Draggable Card */}
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
                <div className="absolute inset-0 bg-slate-900/20 z-10"></div>
                
                <div className="relative z-20 flex flex-col items-center gap-4 text-center p-4">
                    {currentTuto.icon}
                    <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl">
                        <p className="font-bold text-slate-800 text-sm">Glissez pour tester</p>
                    </div>
                </div>
            </motion.div>
        </div>

        {/* Fallback buttons in case they don't want to drag */}
        <div className="mt-8 flex gap-4 opacity-50 hover:opacity-100 transition-opacity">
            <button 
                onClick={() => handleDragEnd(null, { offset: { x: currentTuto.dir === 'left' ? -100 : currentTuto.dir === 'right' ? 100 : 0, y: currentTuto.dir === 'up' ? -100 : 0 } } as any)}
                className="text-xs font-semibold text-slate-500 underline"
            >
                Simuler le geste
            </button>
        </div>
    </div>
  );
}
