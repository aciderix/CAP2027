import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, X, Save, AlertTriangle, ExternalLink, Power } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Source {
  id: string;
  slug: string;
  name: string;
  homepage_url: string | null;
  rss_url: string;
  orientation: string;
  color: string | null;
  is_factcheck: boolean;
  is_active: boolean;
  kind: string;
  candidate_id: string | null;
  fetch_via_github: boolean;
  last_fetched_at: string | null;
  last_fetch_error: string | null;
}

const ORIENTATIONS = [
  'extreme-gauche', 'gauche', 'centre-gauche', 'centre', 'centre-droit', 'droite', 'extreme-droite',
  'transverse', 'factcheck',
];
const KINDS = ['press', 'youtube', 'twitch', 'mastodon', 'bluesky', 'twitter'];

export function Sources() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['admin', 'sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_sources')
        .select('*')
        .order('orientation')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Source[];
    },
  });

  // Candidate list — needed by the editor to attach a source to a
  // candidate. The notify-after-ingest function uses that link to send
  // "Nouveau post de X" to followers when a new social-media item lands.
  const candidates = useQuery({
    queryKey: ['admin', 'candidates-min'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, slug')
        .order('last_name');
      if (error) throw error;
      return (data ?? []) as { id: string; first_name: string; last_name: string; slug: string }[];
    },
  });

  const [editing, setEditing] = useState<Source | 'new' | null>(null);

  const toggle = useMutation({
    mutationFn: async (s: Source) => {
      const { error } = await supabase.from('news_sources')
        .update({ is_active: !s.is_active }).eq('id', s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sources'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('news_sources').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sources'] }),
  });

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-ink">Sources RSS</h1>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-white text-sm font-bold hover:bg-accent"
        >
          <Plus className="w-4 h-4" /> Nouvelle source
        </button>
      </header>

      {list.isLoading && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {(list.data ?? []).map((s) => (
          <div key={s.id} className="flex items-start gap-3 p-3">
            <span
              className="mt-2 w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: s.color || '#94a3b8' }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-ink">{s.name}</span>
                <span className="text-[9px] uppercase tracking-widest font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {s.orientation}
                </span>
                {s.is_factcheck && (
                  <span className="text-[9px] uppercase tracking-widest font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                    Fact-check
                  </span>
                )}
                {!s.is_active && (
                  <span className="text-[9px] uppercase tracking-widest font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    Désactivée
                  </span>
                )}
                {s.fetch_via_github && (
                  <span className="text-[9px] uppercase tracking-widest font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    Via GitHub
                  </span>
                )}
              </div>
              <a
                href={s.rss_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-slate-500 truncate inline-flex items-center gap-1 hover:underline"
              >
                {s.rss_url} <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
              {s.last_fetch_error && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-1.5 mt-1 inline-flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {s.last_fetch_error}
                </div>
              )}
            </div>
            <button
              onClick={() => toggle.mutate(s)}
              className={`p-2 rounded-lg ${s.is_active ? 'hover:bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-400'}`}
              title={s.is_active ? 'Désactiver' : 'Activer'}
            >
              <Power className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditing(s)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Supprimer la source ${s.name} ? Les articles déjà ingérés sont conservés.`)) {
                  remove.mutate(s.id);
                }
              }}
              className="p-2 rounded-lg hover:bg-rose-50 text-rose-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <SourceEditor
          source={editing === 'new' ? null : editing}
          candidates={candidates.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['admin', 'sources'] });
          }}
        />
      )}
    </div>
  );
}

function SourceEditor({
  source, candidates, onClose, onSaved,
}: {
  source: Source | null;
  candidates: { id: string; first_name: string; last_name: string; slug: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = source === null;
  const [form, setForm] = useState<Source>(() => source ?? {
    id: '',
    slug: '',
    name: '',
    homepage_url: '',
    rss_url: '',
    orientation: 'centre',
    color: '#475569',
    is_factcheck: false,
    is_active: true,
    kind: 'press',
    candidate_id: null,
    fetch_via_github: false,
    last_fetched_at: null,
    last_fetch_error: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Source>(k: K, v: Source[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        homepage_url: form.homepage_url || null,
        rss_url: form.rss_url.trim(),
        orientation: form.orientation,
        color: form.color || null,
        is_factcheck: form.is_factcheck,
        is_active: form.is_active,
        kind: form.kind,
        candidate_id: form.candidate_id || null,
        fetch_via_github: form.fetch_via_github,
      };
      if (isNew) {
        const { error } = await supabase.from('news_sources').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('news_sources').update(payload).eq('id', form.id);
        if (error) throw error;
      }
      onSaved();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full max-h-[92vh] overflow-y-auto">
        <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-black text-ink">{isNew ? 'Nouvelle source' : 'Modifier la source'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 grid grid-cols-2 gap-3">
          <Field label="Nom" required wide>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)} className="input" />
          </Field>
          <Field label="Slug" required hint="ex. le-monde">
            <input required value={form.slug} onChange={(e) => set('slug', e.target.value)} className="input font-mono" />
          </Field>
          <Field label="Type">
            <select value={form.kind} onChange={(e) => set('kind', e.target.value)} className="input">
              {KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="Orientation">
            <select value={form.orientation} onChange={(e) => set('orientation', e.target.value)} className="input">
              {ORIENTATIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Couleur (hex)">
            <input type="color" value={form.color ?? '#475569'} onChange={(e) => set('color', e.target.value)} className="input h-10 p-1" />
          </Field>
          <Field label="URL RSS" required wide>
            <input required value={form.rss_url} onChange={(e) => set('rss_url', e.target.value)} className="input font-mono text-sm" />
          </Field>
          <Field label="Site (homepage)" wide>
            <input value={form.homepage_url ?? ''} onChange={(e) => set('homepage_url', e.target.value)} className="input font-mono text-sm" />
          </Field>
          <Field label="Fact-check ?">
            <label className="inline-flex items-center gap-2 mt-2">
              <input type="checkbox" checked={form.is_factcheck} onChange={(e) => set('is_factcheck', e.target.checked)} />
              <span className="text-sm">Détection de verdict</span>
            </label>
          </Field>
          <Field label="Active ?">
            <label className="inline-flex items-center gap-2 mt-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              <span className="text-sm">Ingérée par le cron</span>
            </label>
          </Field>
          <Field label="Fetch via GitHub Actions ?" wide hint="active si l'URL bloque l'IP Supabase (Le Figaro, X via nitter, etc.)">
            <label className="inline-flex items-center gap-2 mt-2">
              <input type="checkbox" checked={form.fetch_via_github} onChange={(e) => set('fetch_via_github', e.target.checked)} />
              <span className="text-sm">Fetch côté GitHub puis POST à <code className="text-[10px]">ingest-from-xml</code></span>
            </label>
          </Field>
          <Field
            label="Candidat lié"
            wide
            hint="Optionnel. Pour une source X / YouTube d'un candidat, lie-la ici — la notif deviendra « Nouveau post de … » / « Nouvelle vidéo de … » et ne sera envoyée qu'aux utilisateurs qui suivent ce candidat."
          >
            <select
              value={form.candidate_id ?? ''}
              onChange={(e) => set('candidate_id', e.target.value || null)}
              className="input"
            >
              <option value="">— Aucun (source non rattachée) —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && <div className="mx-5 mb-3 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2">{error}</div>}

        <footer className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-white font-bold text-sm hover:bg-accent disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'Créer' : 'Enregistrer'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({
  label, required, hint, wide, children,
}: { label: string; required?: boolean; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'col-span-2' : ''}`}>
      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
        {hint && <span className="ml-1 text-slate-400 normal-case tracking-normal font-medium">— {hint}</span>}
      </span>
      {children}
    </label>
  );
}
