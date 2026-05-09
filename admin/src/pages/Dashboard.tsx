import { useQuery } from '@tanstack/react-query';
import { Users, Newspaper, Rss, BadgeCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState } from 'react';

interface Stats {
  candidates: number;
  parties: number;
  sources: number;
  sourcesError: number;
  articles: number;
  factchecks: number;
  articlesLast24h: number;
}

async function fetchStats(): Promise<Stats> {
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [c, p, s, sErr, a, f, last] = await Promise.all([
    supabase.from('candidates').select('id', { count: 'exact', head: true }),
    supabase.from('parties').select('id', { count: 'exact', head: true }),
    supabase.from('news_sources').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('news_sources').select('id', { count: 'exact', head: true }).eq('is_active', true).not('last_fetch_error', 'is', null),
    supabase.from('news_articles').select('id', { count: 'exact', head: true }).eq('is_factcheck', false),
    supabase.from('news_articles').select('id', { count: 'exact', head: true }).eq('is_factcheck', true),
    supabase.from('news_articles').select('id', { count: 'exact', head: true }).gt('published_at', since24h),
  ]);
  return {
    candidates: c.count ?? 0,
    parties: p.count ?? 0,
    sources: s.count ?? 0,
    sourcesError: sErr.count ?? 0,
    articles: a.count ?? 0,
    factchecks: f.count ?? 0,
    articlesLast24h: last.count ?? 0,
  };
}

export function Dashboard() {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admin', 'stats'], queryFn: fetchStats });
  const stats = q.data;

  const triggerIngest = async () => {
    setBusy(true); setOut(null);
    try {
      const res = await fetch(
        `${(import.meta.env.VITE_SUPABASE_URL ?? 'https://oyvqvfawcxlnvpgloicx.supabase.co')}/functions/v1/ingest-rss`,
        { method: 'GET' },
      );
      const j = await res.json().catch(() => null);
      setOut(j ? JSON.stringify(j.totalInserted ?? j, null, 0).slice(0, 300) : `HTTP ${res.status}`);
      await q.refetch();
    } catch (e: any) {
      setOut(String(e?.message ?? e));
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-ink">Vue d'ensemble</h1>
        <button
          onClick={triggerIngest}
          disabled={busy}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink text-white text-sm font-bold hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          Forcer un ingest RSS
        </button>
      </header>

      {out && (
        <div className="text-xs bg-slate-50 border border-slate-200 rounded p-2 font-mono">{out}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<Users />} label="Candidats" value={stats?.candidates} />
        <Stat icon={<Newspaper />} label="Articles" value={stats?.articles} hint={stats ? `+${stats.articlesLast24h} en 24 h` : undefined} />
        <Stat icon={<BadgeCheck />} label="Fact-checks" value={stats?.factchecks} />
        <Stat
          icon={<Rss />}
          label="Sources actives"
          value={stats?.sources}
          hint={stats?.sourcesError ? `${stats.sourcesError} en erreur` : '—'}
          alert={!!stats?.sourcesError}
        />
      </div>
    </div>
  );
}

function Stat({
  icon, label, value, hint, alert,
}: {
  icon: React.ReactNode; label: string; value?: number; hint?: string; alert?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-1 ${alert ? 'border-amber-300' : ''}`}>
      <div className="flex items-center gap-2 text-slate-500">
        <span className="text-slate-400">{icon}</span>
        <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
      </div>
      <div className="text-3xl font-black text-ink tabular-nums">
        {value === undefined ? '—' : value}
      </div>
      {hint && (
        <div className={`text-xs font-semibold inline-flex items-center gap-1 ${alert ? 'text-amber-600' : 'text-slate-400'}`}>
          {alert && <AlertTriangle className="w-3 h-3" />}
          {hint}
        </div>
      )}
    </div>
  );
}
