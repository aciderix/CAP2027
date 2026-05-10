import { User, BookOpen, Scale, BadgeCheck } from 'lucide-react';

interface ExplorerItemProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  onClick: () => void;
  iconClass?: string;
  bgClass?: string;
  borderClass?: string;
}

function ExplorerItem({ icon, title, onClick, iconClass = "text-[#1a56db]", bgClass = "bg-[#eff4ff]", borderClass = "border-[#dbeafe]" }: ExplorerItemProps) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden flex flex-col items-center justify-center ${bgClass} border ${borderClass} rounded-[14px] xl:rounded-[18px] p-1 w-full aspect-[5/4] sm:aspect-[4/3] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}
    >
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center drop-shadow-sm">
        <span className="font-bold text-[#102a5c] text-[10px] min-[375px]:text-[11px] sm:text-[14px] md:text-[15px] tracking-tight leading-[1.15] text-center break-normal hyphens-none px-1">
          {title}
        </span>
      </div>
      <div className={`absolute -bottom-2 -right-2 sm:-bottom-3 sm:-right-3 ${iconClass} opacity-[0.12] shrink-0 pointer-events-none`}>
        <div className="scale-[2.5] sm:scale-[3] origin-bottom-right">
          {icon}
        </div>
      </div>
    </button>
  );
}

export function ExplorerSection({ onNavigate }: { onNavigate: (view: string) => void }) {
  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 py-4 sm:py-6 md:py-8 px-4 sm:px-6 md:px-8 w-full">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-[18px] sm:text-[28px] font-bold text-[#102a5c]">
          Explorer
        </h2>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-4 md:gap-5">
        <ExplorerItem
          icon={<User className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" strokeWidth={2.5} />}
          title="Candidats"
          onClick={() => onNavigate('candidats')}
          iconClass="text-blue-600"
          bgClass="bg-blue-50"
          borderClass="border-blue-100"
        />
        <ExplorerItem
          icon={<BookOpen className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" strokeWidth={2.5} />}
          title="Programmes"
          onClick={() => onNavigate('programmes')}
          iconClass="text-purple-600"
          bgClass="bg-purple-50"
          borderClass="border-purple-100"
        />
        <ExplorerItem
          icon={<Scale className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" strokeWidth={2.5} />}
          title={<>Comparateur<br/>thématique</>}
          onClick={() => onNavigate('comparateur')}
          iconClass="text-emerald-600"
          bgClass="bg-emerald-50"
          borderClass="border-emerald-100"
        />
        <ExplorerItem
          icon={<BadgeCheck className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" strokeWidth={2.5} />}
          title={<>Fact-<br className="sm:hidden" />checking</>}
          onClick={() => onNavigate('factchecking')}
          iconClass="text-indigo-600"
          bgClass="bg-indigo-50"
          borderClass="border-indigo-100"
        />
      </div>
    </div>
  );
}
