import { Star, Target, Info, Search, FileText, ChevronRight } from 'lucide-react';

export function MoreMenu() {
  const items = [
    {
      id: 'subscriptions',
      icon: <Star className="w-5 h-5 text-amber-500" />,
      title: "Gérer mes abonnements",
      desc: "Personnalisez votre fil d'actualités",
    },
    {
      id: 'compass',
      icon: <Target className="w-5 h-5 text-emerald-500" />,
      title: "Mes résultats de Boussole",
      desc: "Continuez à swiper pour affiner vos affinités",
    },
    {
      id: 'about',
      icon: <Info className="w-5 h-5 text-blue-500" />,
      title: "À propos",
      desc: "Découvrez notre mission et nos valeurs",
    },
    {
      id: 'methodology',
      icon: <Search className="w-5 h-5 text-purple-500" />,
      title: "Méthodologie et sources",
      desc: "Transparence et validation des données",
    },
    {
      id: 'legal',
      icon: <FileText className="w-5 h-5 text-slate-500" />,
      title: "Mentions légales",
      desc: "Données, confidentialité et CGU",
    }
  ];

  return (
    <div className="flex flex-col gap-3 pb-20 animate-in fade-in zoom-in duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {items.map((item, index) => (
          <button
            key={item.id}
            className={`w-full flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50 transition-colors text-left ${index !== items.length - 1 ? 'border-b border-slate-100' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[#102a5c] text-[15px] sm:text-base">{item.title}</span>
                <span className="text-xs sm:text-sm text-slate-500 font-medium">{item.desc}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        ))}
      </div>

      <div className="text-center mt-6">
         <p className="text-xs text-slate-400 font-medium tracking-wide">CAP 2027 • App indépendante</p>
         <p className="text-[10px] text-slate-300 mt-1">Version 1.0.0 (build 42)</p>
      </div>
    </div>
  );
}
