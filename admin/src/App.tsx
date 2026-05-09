import { useState } from 'react';
import { useAuth } from './lib/auth';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Candidates } from './pages/Candidates';
import { Parties } from './pages/Parties';
import { Themes } from './pages/Themes';
import { Sources } from './pages/Sources';
import { AppConfig } from './pages/AppConfig';
import { Sidebar, type Page } from './components/Sidebar';
import { Loader2 } from 'lucide-react';

export default function App() {
  const auth = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

  if (auth.loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-ink" />
      </div>
    );
  }

  if (!auth.session) {
    return <Login />;
  }

  if (!auth.isAdmin) {
    return (
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
    );
  }

  return (
    <div className="h-full grid grid-cols-[240px_1fr]">
      <Sidebar page={page} onPageChange={setPage} email={auth.user?.email ?? ''} onSignOut={auth.signOut} />
      <main className="overflow-y-auto p-6 lg:p-8 bg-slate-50">
        {page === 'dashboard' && <Dashboard />}
        {page === 'candidates' && <Candidates />}
        {page === 'parties' && <Parties />}
        {page === 'themes' && <Themes />}
        {page === 'sources' && <Sources />}
        {page === 'config' && <AppConfig />}
      </main>
    </div>
  );
}
