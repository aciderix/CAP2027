import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ConfigRow { key: string; value: any; }

async function readAll(): Promise<Record<string, any>> {
  const { data, error } = await supabase.from('app_config').select('key, value');
  if (error) throw error;
  const out: Record<string, any> = {};
  for (const r of (data ?? []) as ConfigRow[]) out[r.key] = r.value;
  return out;
}

export function AppConfig() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'config'], queryFn: readAll });
  const cfg = q.data;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-black text-ink">Config app</h1>
        <p className="text-sm text-slate-500 mt-1">
          Dates de scrutin et flux parrainages. Les valeurs sont mises en cache localement
          dans l'app mobile pour fonctionner hors-ligne.
        </p>
      </header>

      {q.isLoading && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}

      {cfg && (
        <>
          <RoundCard
            title="1er tour"
            keyName="election.round1"
            value={cfg['election.round1']}
            onSaved={() => qc.invalidateQueries({ queryKey: ['admin', 'config'] })}
          />
          <RoundCard
            title="2nd tour"
            keyName="election.round2"
            value={cfg['election.round2']}
            onSaved={() => qc.invalidateQueries({ queryKey: ['admin', 'config'] })}
          />
          <ParrainagesCard
            value={cfg['parrainages.source']}
            onSaved={() => qc.invalidateQueries({ queryKey: ['admin', 'config'] })}
          />
        </>
      )}
    </div>
  );
}

function RoundCard({
  title, keyName, value, onSaved,
}: {
  title: string;
  keyName: string;
  value: { scheduled_at: string; results_at: string; is_official: boolean; label: string } | undefined;
  onSaved: () => void;
}) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [resultsAt, setResultsAt] = useState('');
  const [isOfficial, setIsOfficial] = useState(false);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    setScheduledAt(localFromIso(value.scheduled_at));
    setResultsAt(localFromIso(value.results_at));
    setIsOfficial(value.is_official);
    setLabel(value.label);
  }, [value?.scheduled_at, value?.results_at, value?.is_official, value?.label]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload = {
        scheduled_at: new Date(scheduledAt).toISOString(),
        results_at: new Date(resultsAt).toISOString(),
        is_official: isOfficial,
        label: label || (isOfficial ? 'Officiel' : 'Estimé'),
      };
      const { error } = await supabase.from('app_config')
        .upsert({ key: keyName, value: payload }, { onConflict: 'key' });
      if (error) throw error;
      onSaved();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="font-bold text-ink">{title}</h3>
        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${isOfficial ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {isOfficial ? 'Officiel' : 'Estimé'}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Ouverture des bureaux</span>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Heure des résultats</span>
          <input type="datetime-local" value={resultsAt} onChange={(e) => setResultsAt(e.target.value)} className="input" />
        </label>
        <label className="flex flex-col gap-1 col-span-2">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Libellé</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" placeholder="Estimé" />
        </label>
        <label className="inline-flex items-center gap-2 col-span-2">
          <input type="checkbox" checked={isOfficial} onChange={(e) => setIsOfficial(e.target.checked)} />
          <span className="text-sm font-bold text-slate-700">Date officielle (déclenche les rappels J-1, J-day, résultats)</span>
        </label>
      </div>

      {error && <div className="text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2">{error}</div>}

      <button
        onClick={save}
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-ink text-white font-bold text-sm hover:bg-accent disabled:opacity-50 self-start"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
      </button>
    </div>
  );
}

function ParrainagesCard({
  value, onSaved,
}: {
  value: { url: string; is_available: boolean; note?: string } | undefined;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    setUrl(value.url);
    setIsAvailable(value.is_available);
    setNote(value.note ?? '');
  }, [value?.url, value?.is_available, value?.note]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload = { url, is_available: isAvailable, note: note || null };
      const { error } = await supabase.from('app_config')
        .upsert({ key: 'parrainages.source', value: payload }, { onConflict: 'key' });
      if (error) throw error;
      onSaved();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally { setSaving(false); }
  };

  const triggerFetch = async () => {
    try {
      const r = await fetch(
        `${(import.meta.env.VITE_SUPABASE_URL ?? 'https://oyvqvfawcxlnvpgloicx.supabase.co')}/functions/v1/fetch-parrainages`,
        { method: 'POST' },
      );
      const j = await r.json();
      alert(JSON.stringify(j, null, 2));
    } catch (e: any) {
      alert(`Échec : ${e.message ?? e}`);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="font-bold text-ink">Flux parrainages (Conseil constitutionnel)</h3>
        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {isAvailable ? 'Live' : 'En attente'}
        </span>
      </header>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">URL JSON</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} className="input font-mono text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Note (affichée si flux indisponible)</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="input" />
      </label>
      <label className="inline-flex items-center gap-2">
        <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
        <span className="text-sm font-bold text-slate-700">Flux disponible (le widget se remplit côté app)</span>
      </label>

      {error && <div className="text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          onClick={save} disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-ink text-white font-bold text-sm hover:bg-accent disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
        </button>
        <button
          onClick={triggerFetch}
          className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200"
        >
          Forcer un fetch maintenant
        </button>
      </div>
    </div>
  );
}

function localFromIso(iso: string): string {
  // Convert to local-time string suitable for <input type="datetime-local">
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
