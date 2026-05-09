import { Settings, Home, Compass, Rss, Newspaper } from 'lucide-react';
import { CountdownBanner } from './CountdownBanner';
import { useState } from 'react';
import { SettingsModal } from './SettingsModal';
import { NotificationsBell } from './NotificationsBell';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Header({ activeTab, setActiveTab }: HeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 md:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left side: Logo & Slogan */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="flex items-center justify-center h-10 sm:h-11 w-auto">
              <img decoding="async" 
                src="/logo1.png" 
                alt="CAP 2027" 
                className="h-full w-auto object-contain"
                onError={(e) => {
                  // Hide broken image icon if logo1.png is missing
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                  }
                }}
              />
              {/* Fallback Text Logo */}
              <div className="text-xl font-black italic tracking-tighter flex-col leading-[0.9]" style={{ display: 'none' }}>
                <span className="text-[#102a5c]">CAP</span>
                <div className="flex items-center gap-1">
                  <div className="flex gap-[2px] h-3">
                    <div className="w-1.5 h-full bg-[#102a5c] -skew-x-12"></div>
                    <div className="w-1.5 h-full bg-white border border-gray-200 -skew-x-12"></div>
                    <div className="w-1.5 h-full bg-[#e11d48] -skew-x-12"></div>
                  </div>
                  <span className="text-[#e11d48]">2027</span>
                </div>
              </div>
            </div>
            
            {/* Vertical Divider */}
            <div className="h-8 sm:h-10 w-[1px] bg-slate-300"></div>
            
            {/* Slogan */}
            <div className="flex flex-col text-[10px] sm:text-[12px] font-medium text-[#102a5c] italic leading-[1.1] tracking-tight">
              <span>S'informer.</span>
              <span>Comparer.</span>
              <span>Choisir.</span>
            </div>
          </div>

          {/* Center: Desktop Nav */}
          <nav className="hidden md:flex items-center justify-center gap-5 lg:gap-8 flex-1 px-4">
            <button 
              onClick={() => setActiveTab('accueil')}
              className={`flex items-center gap-2 font-medium text-sm xl:text-base transition-colors ${activeTab === 'accueil' ? 'text-[#102a5c] font-bold' : 'text-slate-500 hover:text-[#102a5c]'}`}
            >
              <Home className="w-[18px] h-[18px] xl:w-5 xl:h-5" strokeWidth={activeTab === 'accueil' ? 2.5 : 1.5}/> Accueil
            </button>
            <button 
              onClick={() => setActiveTab('explorer')}
              className={`flex items-center gap-2 font-medium text-sm xl:text-base transition-colors ${activeTab === 'explorer' ? 'text-[#102a5c] font-bold' : 'text-slate-500 hover:text-[#102a5c]'}`}
            >
              <Compass className="w-[18px] h-[18px] xl:w-5 xl:h-5" strokeWidth={activeTab === 'explorer' ? 2.5 : 1.5}/> Explorer
            </button>
            <button 
              onClick={() => setActiveTab('fil')}
              className={`flex items-center gap-2 font-medium text-sm xl:text-base transition-colors ${activeTab === 'fil' ? 'text-[#102a5c] font-bold' : 'text-slate-500 hover:text-[#102a5c]'}`}
            >
              <Rss className="w-[18px] h-[18px] xl:w-5 xl:h-5" strokeWidth={activeTab === 'fil' ? 2.5 : 1.5}/> Mon fil
            </button>
            <button 
              onClick={() => setActiveTab('actualites')}
              className={`flex items-center gap-2 font-medium text-sm xl:text-base transition-colors ${activeTab === 'actualites' ? 'text-[#102a5c] font-bold' : 'text-slate-500 hover:text-[#102a5c]'}`}
            >
              <Newspaper className="w-[18px] h-[18px] xl:w-5 xl:h-5" strokeWidth={activeTab === 'actualites' ? 2.5 : 1.5}/> Actualités
            </button>
          </nav>

          {/* Right side: Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationsBell />
            <button
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Réglages"
              className="p-2 text-[#102a5c] hover:bg-slate-100 rounded-full transition-colors flex items-center justify-center cursor-pointer"
            >
              <Settings strokeWidth={2.5} className="w-[20px] h-[20px]" />
            </button>
          </div>
        </div>
      </header>
      <div className="fixed top-[64px] md:top-[74px] left-0 w-full flex items-start z-40 pointer-events-none">
        <div className="pointer-events-auto scale-90 sm:scale-100 origin-top-left">
          <CountdownBanner />
        </div>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
