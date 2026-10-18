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
          <QuietHoursCard
            value={cfg['push.quiet_hours']}
            onSaved={() => qc.invalidateQueries({ queryKey: ['admin', 'config'] })}
          />
          <MatchNotifyCard
            value={cfg['match.notify']}
            onSaved={() => qc.invalidateQueries({ queryKey: ['admin', 'config'] })}
          />
        </>
      )}
    </div>
  );
}

// Notification « Le Match s'enrichit », envoyée par ingest-demos-kratos quand
// l'import quotidien ajoute des affirmations ou des candidats au Match.
function MatchNotifyCard({
  value, onSaved,
}: {
  value: { enabled?: boolean } | undefined;
  onSaved: () => void;
}) {
  const enabled = !!value?.enabled;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setSaving(true); setError(null);
    try {
      const { error } = await supabase.from('app_config')
        .upsert({ key: 'match.notify', value: { enabled: !enabled } }, { onConflict: 'key' });
      if (error) throw error;
      onSaved();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="font-bold text-ink">Notification « Le Match s'enrichit »</h3>
        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {enabled ? 'Activée' : 'Désactivée'}
        </span>
      </header>
      <p className="text-xs text-slate-500 leading-relaxed">
        Quand l'import quotidien Demos Kratos ajoute des affirmations ou des candidats au Match,
        une notification part sur le canal « Mises à jour candidats » (désactivable par chaque
        utilisateur). <b>À activer seulement une fois publiée la version de l'app qui affiche le
        Match Demos Kratos</b> : l'ancienne version ne montrerait pas ces nouveautés.
      </p>
      {error && <div className="text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2">{error}</div>}
      <div className="flex justify-end">
        <button
          onClick={toggle}
          disabled={saving}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-white font-bold text-sm hover:bg-accent disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {enabled ? 'Désactiver' : 'Activer'}
        </button>
      </div>
    </div>
  );
}

function QuietHoursCard({
  value, onSaved,
}: {
  value: { enabled: boolean; start_paris: number; end_paris: number } | undefined;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(true);
  const [startHour, setStartHour] = useState(22);
  const [endHour, setEndHour] = useState(7);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    setEnabled(value.enabled);
    setStartHour(value.start_paris);
    setEndHour(value.end_paris);
  }, [value?.enabled, value?.start_paris, value?.end_paris]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload = {
        enabled,
        start_paris: Math.max(0, Math.min(23, startHour)),
        end_paris: Math.max(0, Math.min(23, endHour)),
      };
      const { error } = await supabase.from('app_config')
        .upsert({ key: 'push.quiet_hours', value: payload }, { onConflict: 'key' });
      if (error) throw error;
      onSaved();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="font-bold text-ink">Pause notifications nocturnes</h3>
        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {enabled ? 'Activée' : 'Désactivée'}
        </span>
      </header>

      <p className="text-xs text-slate-500 leading-relaxed">
        Bloque les notifs push entre <b>{String(startHour).padStart(2, '0')}h</b> et <b>{String(endHour).padStart(2, '0')}h</b> (heure de Paris). Les rappels électoraux
        (jour J, résultats, J-1, procuration, inscription) et la confirmation des
        dates officielles passent quand même. Les autres notifs sont silencées —
        le contenu reste en base, l'app le récupère à la prochaine ouverture.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Début (heure Paris)</span>
          <input
            type="number" min={0} max={23}
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Fin (heure Paris)</span>
          <input
            type="number" min={0} max={23}
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="input"
          />
        </label>
      </div>

      <label className="inline-flex items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span className="text-sm font-bold text-slate-700">Activer la pause nocturne</span>
      </label>

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
    setScheduledAt(parisInputFromIso(value.scheduled_at));
    setResultsAt(parisInputFromIso(value.results_at));
    setIsOfficial(value.is_official);
    setLabel(value.label);
  }, [value?.scheduled_at, value?.results_at, value?.is_official, value?.label]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload = {
        scheduled_at: parisIsoFromInput(scheduledAt),
        results_at: parisIsoFromInput(resultsAt),
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
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Ouverture des bureaux <span className="text-slate-400 normal-case tracking-normal font-medium">— heure de Paris</span></span>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Heure des résultats <span className="text-slate-400 normal-case tracking-normal font-medium">— heure de Paris</span></span>
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
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(
        `${(import.meta.env.VITE_SUPABASE_URL ?? 'https://oyvqvfawcxlnvpgloicx.supabase.co')}/functions/v1/fetch-parrainages`,
        {
          method: 'POST',
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        },
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

// ---- Paris-locked datetime-local conversions --------------------------
//
// `<input type="datetime-local">` is timezone-naive: when its value is
// fed to `new Date(...)`, the browser interprets it in its OWN local
// timezone. For an admin in Paris that's fine, but anyone editing dates
// from another city would silently shift the whole election clock by N
// hours. We force the input/output to Paris wall-clock so the field
// always means what its label says.

function parisOffsetMs(utcMs: number): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asIfUtc - utcMs;
}

function parisInputFromIso(iso: string): string {
  // UTC ISO → "YYYY-MM-DDTHH:MM" rendered as Paris wall clock.
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function parisIsoFromInput(input: string): string {
  // "YYYY-MM-DDTHH:MM" interpreted as Paris wall clock → UTC ISO.
  // Two-pass offset to handle the DST transition correctly when the
  // typed instant is right around the spring-forward / fall-back hour.
  if (!input) return '';
  const [date, time] = input.split('T');
  if (!date || !time) return '';
  const [y, m, d] = date.split('-').map(Number);
  const [h, mn] = time.split(':').map(Number);
  if ([y, m, d, h, mn].some((n) => Number.isNaN(n))) return '';
  const guess = Date.UTC(y, m - 1, d, h, mn);
  const off1 = parisOffsetMs(guess);
  const off2 = parisOffsetMs(guess - off1);
  return new Date(guess - off2).toISOString();
}
