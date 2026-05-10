import { LayoutDashboard, Users, Flag, Layers, Rss, Cog, LogOut, X } from 'lucide-react';

export type Page = 'dashboard' | 'candidates' | 'parties' | 'themes' | 'sources' | 'config';

const ITEMS: { key: Page; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { key: 'candidates', label: 'Candidats', icon: Users },
  { key: 'parties', label: 'Partis', icon: Flag },
  { key: 'themes', label: 'Thèmes', icon: Layers },
  { key: 'sources', label: 'Sources RSS', icon: Rss },
  { key: 'config', label: 'Config app', icon: Cog },
];

export function Sidebar({
  page, onPageChange, email, onSignOut, isOpen, onClose,
}: {
  page: Page;
  onPageChange: (p: Page) => void;
  email: string;
  onSignOut: () => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop on mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[260px] bg-ink text-white flex flex-col
          transition-transform duration-200 ease-out
          md:relative md:translate-x-0 md:w-auto md:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-black tracking-tight text-lg leading-none">CAP 2027</div>
            <div className="text-[10px] uppercase tracking-widest text-white/60 mt-1">Admin console</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="md:hidden p-1.5 rounded hover:bg-white/10 text-white/70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {ITEMS.map((it) => {
            const Icon = it.icon;
            const active = page === it.key;
            return (
              <button
                key={it.key}
                onClick={() => {
                  onPageChange(it.key);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-bold transition-colors ${
                  active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {it.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10 text-xs">
          <div className="text-white/60 truncate mb-2 px-1.5" title={email}>
            {email}
          </div>
          <button
            onClick={onSignOut}
            className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/15 text-white/90 font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" /> Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}
