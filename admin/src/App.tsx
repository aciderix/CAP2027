import { useState } from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from './lib/auth';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Candidates } from './pages/Candidates';
import { Parties } from './pages/Parties';
import { Themes } from './pages/Themes';
import { Sources } from './pages/Sources';
import { AppConfig } from './pages/AppConfig';
import { Sidebar, type Page } from './components/Sidebar';
import { DebugPanel } from './components/DebugPanel';
import { Loader2 } from 'lucide-react';

const DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

const PAGE_LABELS: Record<Page, string> = {
  dashboard: "Vue d'ensemble",
  candidates: 'Candidats',
  parties: 'Partis',
  themes: 'Thèmes',
  sources: 'Sources RSS',
  config: 'Config app',
};

export default function App() {
  const auth = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (auth.loading) {
    return (
      <>
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-ink" />
        </div>
        {DEBUG && <DebugPanel />}
      </>
    );
  }

  if (!auth.session) {
    return (
      <>
        <Login />
        {DEBUG && <DebugPanel />}
      </>
    );
  }

  if (!auth.isAdmin) {
    return (
      <>
        <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-2xl font-bold text-ink">Accès refusé</div>
          <p className="text-slate-500 max-w-md">
            Le compte <code>{auth.user?.email}</code> est connecté mais n'est pas dans la table{' '}
            <code>public.admins</code>. Demande à un admin existant d'ajouter ton{' '}
            <code>user_id</code>, ou exécute&nbsp;:
          </p>
          <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto max-w-full">
{`insert into public.admins (user_id, email)
values ('${auth.user?.id}', '${auth.user?.email}');`}
          </pre>
          <button
            onClick={auth.signOut}
            className="mt-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
          >
            Se déconnecter
          </button>
        </div>
        {DEBUG && <DebugPanel />}
      </>
    );
  }

  return (
    <div className="h-full md:grid md:grid-cols-[240px_1fr]">
      <Sidebar
        page={page}
        onPageChange={setPage}
        email={auth.user?.email ?? ''}
        onSignOut={auth.signOut}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col min-w-0 h-full">
        {/* Mobile top bar with hamburger */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-3 py-2.5 flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
            className="p-2 rounded-lg hover:bg-slate-100 text-ink"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-black text-ink text-sm leading-tight">CAP 2027</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 truncate">
              {PAGE_LABELS[page]}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50">
          {page === 'dashboard' && <Dashboard />}
          {page === 'candidates' && <Candidates />}
          {page === 'parties' && <Parties />}
          {page === 'themes' && <Themes />}
          {page === 'sources' && <Sources />}
          {page === 'config' && <AppConfig />}
        </main>
      </div>

      {DEBUG && <DebugPanel />}
    </div>
  );
}
