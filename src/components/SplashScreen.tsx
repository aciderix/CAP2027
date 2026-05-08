import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

export function SplashScreen() {
  return (
    <motion.div 
      className="fixed inset-0 min-h-[100dvh] bg-white z-[100] flex flex-col items-center justify-between py-12 px-6"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
        <div className="flex-1 flex flex-col items-center justify-center -mt-10 max-w-[400px] w-full">
           <img src="/logo1.png" alt="CAP 2027" className="w-[85%] sm:w-[340px] mb-6 object-contain" />
           <h2 className="text-[#102a5c] text-[18px] sm:text-[22px] font-bold tracking-tight text-center">Votre boîte à outils civique</h2>
           
           <div className="mt-16 sm:mt-20">
              <Loader2 className="w-10 h-10 text-[#3b82f6] animate-spin opacity-80" strokeWidth={2.5} />
           </div>
        </div>

        <div className="text-center w-full">
            <p className="text-[#102a5c] font-bold text-[15px] mb-1">Application indépendante</p>
            <p className="text-slate-400 text-[14px]">Aucune donnée collectée</p>
        </div>
    </motion.div>
  );
}
