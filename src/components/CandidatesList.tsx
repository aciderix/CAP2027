import { User, Eye, Star, FileText, Scale, Newspaper, ShieldAlert, FileSearch, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

// Interface pour les futurs candidats (Supabase)
export interface Candidate {
  id: string;
  name: string;
  party: string;
  status: string;
  gender: 'M' | 'F';
}

export function CandidatesList() {
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'biographie' | 'programme' | 'historique' | 'actualites'>('biographie');
  const [searchQuery, setSearchQuery] = useState('');
  
  // État vide simulé pour afficher le mode chargement
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Si des données étaient chargées depuis Supabase :
    // data.sort(() => Math.random() - 0.5) // Ordre aléatoire
    // setCandidates(data);
    // setIsLoading(false);
  }, []);

  const filteredCandidates = candidates.filter(candidate => 
    candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    candidate.party.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full animate-in fade-in zoom-in duration-500">
      <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 w-full">
         <h2 className="text-xl font-bold text-[#102a5c] shrink-0">Candidats</h2>
         <div className="relative w-full max-w-[200px] sm:w-64 sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
                type="text"
                className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#102a5c] focus:border-[#102a5c] text-sm transition-all shadow-sm"
                placeholder="Rechercher un candidat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
         </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {filteredCandidates.map((candidate) => (
          <div key={candidate.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center gap-3 transition-all hover:shadow-md hover:-translate-y-1">
            <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 mb-1 relative overflow-hidden bg-slate-50">
                <img 
                  src={candidate.gender === 'F' ? '/card_red.png' : '/card_blue.png'} 
                  alt={candidate.name} 
                  className="w-full h-full object-cover"
                />
            </div>
            
            <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5 max-w-[120px] truncate">{candidate.party}</span>
                <span className="font-bold text-[#102a5c] text-sm sm:text-base leading-tight">{candidate.name}</span>
            </div>

            <Button 
                variant="outline" 
                className="w-full mt-2 h-9 text-xs flex items-center justify-center gap-1.5"
                onClick={() => setSelectedCandidate(candidate)}
            >
               <Eye className="w-3.5 h-3.5" /> Voir
            </Button>
          </div>
        ))}
        
        {/* Placeholder cards to show loading state */}
        {isLoading && [1, 2, 3, 4, 5, 6].map((i) => (
           <div key={`skeleton-${i}`} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center gap-3">
             <div className="w-16 h-16 rounded-full bg-slate-100 animate-pulse mb-1 flex items-center justify-center relative overflow-hidden">
                <User className="text-slate-300 w-8 h-8 relative z-10" />
             </div>
             <div className="flex flex-col items-center w-full gap-1.5">
                 <div className="w-16 h-3 bg-slate-100 animate-pulse rounded-full"></div>
                 <div className="w-24 h-4 bg-slate-200 animate-pulse rounded-full"></div>
             </div>
             <div className="w-full mt-2">
                 <Button onClick={() => setSelectedCandidate({ id: `skeleton-${i}`, name: "Chargement...", party: "...", status: "", gender: i % 2 === 0 ? 'F' : 'M' })} variant="outline" className="w-full h-9 text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                    <Eye className="w-3.5 h-3.5" /> Voir
                 </Button>
             </div>
           </div>
        ))}
      </div>

      <Modal
        isOpen={!!selectedCandidate}
        onClose={() => { setSelectedCandidate(null); setIsFollowing(false); setActiveTab('biographie'); }}
        title=""
      >
        {selectedCandidate && (
          <div className="flex flex-col gap-4 py-2">
             {/* Header Compact */}
             <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-50 flex items-center justify-center shrink-0 relative overflow-hidden shadow-sm">
                      <img 
                        src={selectedCandidate.gender === 'F' ? '/card_red.png' : '/card_blue.png'} 
                        alt={selectedCandidate.name} 
                        className="w-full h-full object-cover"
                      />
                  </div>
                  
                  <div className="flex flex-col">
                     <h3 className="text-lg sm:text-2xl font-bold text-[#102a5c] leading-tight mb-0.5">{selectedCandidate.name}</h3>
                     <span className="text-xs sm:text-sm font-medium text-slate-500 mb-1.5">{selectedCandidate.party}</span>
                     
                     <div className="flex flex-col w-28 sm:w-40 gap-1.5">
                        <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>Parrainages</span>
                          <span>... / 500</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                           {/* Replace w-0 when real data is connected */}
                           <div className="h-full bg-slate-300 w-[15%]" />
                        </div>
                     </div>
                  </div>
                </div>

                <button 
                  onClick={() => setIsFollowing(!isFollowing)}
                  className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 border border-slate-200 bg-white rounded-full shadow-sm text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
                >
                  <Star className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${isFollowing ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                  <span className="hidden min-[380px]:inline">{isFollowing ? 'Suivi' : 'Suivre'}</span>
                </button>
             </div>
             
             {/* Onglets Permanents */}
             <div className="flex flex-col gap-4">
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {[
                    { id: 'biographie', label: 'Bio', smLabel: 'Biographie', icon: User },
                    { id: 'programme', label: 'Prog.', smLabel: 'Programme', icon: FileText },
                    { id: 'historique', label: 'Affaires', smLabel: 'Historique', icon: Scale },
                    { id: 'actualites', label: 'Actus', smLabel: 'Actualités', icon: Newspaper },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-bold transition-all ${
                        activeTab === tab.id 
                          ? 'bg-[#102a5c] text-white shadow-sm' 
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                      }`}
                    >
                      <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="sm:hidden">{tab.label}</span>
                      <span className="hidden sm:block">{tab.smLabel}</span>
                    </button>
                  ))}
                </div>

                {/* Contenu des onglets (Placeholder) */}
                <div className="py-2 space-y-4 animate-in fade-in zoom-in duration-300">
                  {/* Skeleton loaders */}
                  <div className="space-y-3">
                       <div className="w-1/3 h-5 bg-slate-200 rounded animate-pulse"></div>
                       <div className="w-full h-4 bg-slate-100 rounded animate-pulse"></div>
                       <div className="w-full h-4 bg-slate-100 rounded animate-pulse"></div>
                       <div className="w-5/6 h-4 bg-slate-100 rounded animate-pulse"></div>
                       <div className="w-4/5 h-4 bg-slate-100 rounded animate-pulse"></div>
                  </div>
                  <div className="space-y-3 mt-6">
                      <div className="w-1/4 h-5 bg-slate-200 rounded animate-pulse"></div>
                      <div className="flex flex-col sm:flex-row gap-3">
                           <div className="w-full h-24 bg-slate-50 rounded-xl animate-pulse border border-slate-100"></div>
                           <div className="w-full h-24 bg-slate-50 rounded-xl animate-pulse border border-slate-100"></div>
                      </div>
                  </div>
                </div>
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
