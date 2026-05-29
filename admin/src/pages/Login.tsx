import { useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <div className="h-full flex items-center justify-center p-6 bg-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-200 p-7 flex flex-col gap-4"
      >
        <div className="text-center">
          <div className="font-black text-2xl text-ink">CAP 2027</div>
          <div className="text-xs uppercase tracking-widest text-slate-500 mt-0.5">Admin console</div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Mot de passe</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </label>

        {error && <div className="text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="bg-ink text-white font-bold py-2.5 rounded-lg hover:bg-accent transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          Se connecter
        </button>
      </form>
    </div>
  );
}
