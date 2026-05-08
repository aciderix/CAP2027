import { Button } from './ui/Button';

interface FeaturedArticleCardProps {
  onNavigate?: () => void;
}

export function FeaturedArticleCard({ onNavigate }: FeaturedArticleCardProps) {
  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-4">
        <h2 className="text-lg sm:text-lg font-bold text-[#102a5c]">À la une – Fact-checking</h2>
        <button 
          onClick={onNavigate}
          className="text-[14px] sm:text-[15px] font-medium text-[#1a56db] hover:underline whitespace-nowrap"
        >
          Voir tout
        </button>
      </div>
      
      <div className="p-4 sm:p-5 flex flex-col">
        {/* Skeleton layout representing loading state / placeholder */}
        <div className="flex items-center gap-3 sm:gap-4">
           {/* Placeholder image */}
           <div className="w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] bg-slate-100 rounded-lg sm:rounded-xl animate-pulse shrink-0" />
           
           {/* Placeholder content */}
           <div className="flex flex-col gap-2 flex-1 w-full justify-center">
             <div className="flex items-center gap-2">
               <div className="w-16 h-5 bg-[#102a5c] rounded-full animate-pulse opacity-20" />
               <div className="w-full max-w-[200px] h-3 bg-slate-200 rounded animate-pulse" />
             </div>
             <div className="space-y-1.5 mt-1">
               <div className="w-full max-w-[280px] h-4 sm:h-5 bg-slate-200 rounded animate-pulse" />
               <div className="w-4/5 max-w-[220px] h-4 sm:h-5 bg-slate-200 rounded animate-pulse" />
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
