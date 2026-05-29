import { Home, Compass, Rss, Newspaper, MoreHorizontal } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  return (
    <>
      {/* Spacer to prevent content from hiding behind the fixed bottom nav on mobile */}
      <div className="h-[calc(80px+env(safe-area-inset-bottom))] md:hidden" aria-hidden="true"></div>
      
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 md:hidden shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)] pb-safe">
        <div className="flex justify-between items-center h-[64px] px-1">
          {/* Accueil */}
          <button 
            onClick={() => setActiveTab('accueil')}
            className={`flex flex-col items-center justify-center w-[20%] h-full gap-1 transition-colors ${activeTab === 'accueil' ? 'text-[#102a5c]' : 'text-slate-500 hover:text-[#102a5c]'}`}
          >
            <Home className="w-6 h-6" strokeWidth={activeTab === 'accueil' ? 2 : 1.5} />
            <span className={`text-[10px] ${activeTab === 'accueil' ? 'font-semibold' : 'font-medium'}`}>Accueil</span>
          </button>
  
          {/* Explorer */}
          <button 
            onClick={() => setActiveTab('explorer')}
            className={`flex flex-col items-center justify-center w-[20%] h-full gap-1 transition-colors ${activeTab === 'explorer' ? 'text-[#102a5c]' : 'text-slate-500 hover:text-[#102a5c]'}`}
          >
            <Compass className="w-6 h-6" strokeWidth={activeTab === 'explorer' ? 2 : 1.5} />
            <span className={`text-[10px] ${activeTab === 'explorer' ? 'font-semibold' : 'font-medium'}`}>Explorer</span>
          </button>
  
          {/* Mon fil (Center Floating CTA) */}
          <button 
            onClick={() => setActiveTab('fil')}
            className="group relative flex flex-col justify-end items-center w-[20%] h-full outline-none"
          >
            <div className="absolute -top-5 w-[56px] h-[56px] flex items-center justify-center z-10">
              
              {/* Animated Border Arcs (Left Blue, Right Red) */}
              <motion.svg 
                width="72" height="72" viewBox="0 0 72 72"
                className="absolute z-0 pointer-events-none"
                initial={false}
                animate={activeTab === 'fil' ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
              >
                {/* Left Blue Arc */}
                <circle 
                  cx="36" cy="36" r="33" 
                  fill="none" 
                  stroke="#102a5c" 
                  strokeWidth="4" 
                  strokeLinecap="round" 
                  pathLength="100" 
                  strokeDasharray="32 68" 
                  strokeDashoffset="66" 
                />
                {/* Right Red Arc */}
                <circle 
                  cx="36" cy="36" r="33" 
                  fill="none" 
                  stroke="#e11d48" 
                  strokeWidth="4" 
                  strokeLinecap="round" 
                  pathLength="100" 
                  strokeDasharray="32 68" 
                  strokeDashoffset="16" 
                />
              </motion.svg>

              {/* Main Circle */}
              <div 
                className={`relative z-10 w-full h-full rounded-full flex items-center justify-center transition-colors duration-300 shadow-[0_0_0_4px_white,0_4px_10px_rgba(0,0,0,0.08)] overflow-hidden ${
                  activeTab === 'fil' 
                    ? 'bg-white text-[#102a5c]' 
                    : 'bg-[#102a5c] text-white group-hover:bg-[#153b82]'
                }`}
              >
                <Rss className="w-6 h-6 ml-0.5 mb-0.5" strokeWidth={activeTab === 'fil' ? 2.5 : 2} />
              </div>

            </div>
            <span className={`text-[10px] mb-1.5 transition-colors ${activeTab === 'fil' ? 'font-semibold text-[#102a5c]' : 'font-medium text-slate-500 group-hover:text-[#102a5c]'}`}>Mon fil</span>
          </button>
  
          {/* Actualités */}
          <button 
            onClick={() => setActiveTab('actualites')}
            className={`flex flex-col items-center justify-center w-[20%] h-full gap-1 transition-colors ${activeTab === 'actualites' ? 'text-[#102a5c]' : 'text-slate-500 hover:text-[#102a5c]'}`}
          >
            <Newspaper className="w-6 h-6" strokeWidth={activeTab === 'actualites' ? 2 : 1.5} />
            <span className={`text-[10px] ${activeTab === 'actualites' ? 'font-semibold' : 'font-medium'}`}>Actualités</span>
          </button>
  
          {/* Plus */}
          <button 
            onClick={() => setActiveTab('plus')}
            className={`flex flex-col items-center justify-center w-[20%] h-full gap-1 transition-colors ${activeTab === 'plus' ? 'text-[#102a5c]' : 'text-slate-500 hover:text-[#102a5c]'}`}
          >
            <MoreHorizontal className="w-6 h-6" strokeWidth={activeTab === 'plus' ? 2 : 1.5} />
            <span className={`text-[10px] ${activeTab === 'plus' ? 'font-semibold' : 'font-medium'}`}>Plus</span>
          </button>
        </div>
      </nav>
    </>
  );
}
