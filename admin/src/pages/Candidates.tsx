import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, Upload, X, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Party { id: string; name: string; abbreviation: string | null; }
interface Candidate {
  id: string;
  slug: string;
  first_name: string;
  last_name: string;
  party_id: string | null;
  photo_url: string | null;
  short_bio: string | null;
  is_published: boolean;
  order_index: number;
  gender: 'M' | 'F' | null;
  parties?: { name: string } | null;
}

async function listCandidates() {
  const { data, error } = await supabase
    .from('candidates')
    .select('*, parties(name)')
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Candidate[];
}

async function listParties() {
  const { data, error } = await supabase
    .from('parties')
    .select('id, name, abbreviation')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Party[];
}

export function Candidates() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'candidates'], queryFn: listCandidates });
  const parties = useQuery({ queryKey: ['admin', 'parties'], queryFn: listParties });
  const [editing, setEditing] = useState<Candidate | 'new' | null>(null);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('candidates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'candidates'] }),
  });

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-ink">Candidats</h1>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-white text-sm font-bold hover:bg-accent"
        >
          <Plus className="w-4 h-4" /> Nouveau candidat
        </button>
      </header>

      {list.isLoading && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
      {list.error && <ErrorBox message={(list.error as Error).message} />}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {(list.data ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 shrink-0">
              {c.photo_url ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" /> : null}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-ink truncate">
                {c.first_name} {c.last_name}
                {!c.is_published && (
                  <span className="ml-2 text-[9px] uppercase tracking-widest bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                    Brouillon
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {c.parties?.name ?? '—'} · /{c.slug}
              </div>
            </div>
            <button
              onClick={() => setEditing(c)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              aria-label="Modifier"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Supprimer définitivement ${c.first_name} ${c.last_name} ?`)) {
                  remove.mutate(c.id);
                }
              }}
              className="p-2 rounded-lg hover:bg-rose-50 text-rose-500"
              aria-label="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {list.data?.length === 0 && (
          <div className="p-6 text-sm text-center text-slate-500">Aucun candidat.</div>
        )}
      </div>

      {editing && (
        <CandidateEditor
          candidate={editing === 'new' ? null : editing}
          parties={parties.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['admin', 'candidates'] });
          }}
        />
      )}
    </div>
  );
}

function CandidateEditor({
  candidate, parties, onClose, onSaved,
}: {
  candidate: Candidate | null;
  parties: Party[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = candidate === null;
  const [form, setForm] = useState<Candidate>(() => candidate ?? {
    id: '',
    slug: '',
    first_name: '',
    last_name: '',
    party_id: null,
    photo_url: null,
    short_bio: '',
    is_published: false,
    order_index: 100,
    gender: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof Candidate>(k: K, v: Candidate[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const computedSlug = useMemo(() => {
    if (form.slug) return form.slug;
    return `${form.first_name}-${form.last_name}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }, [form.slug, form.first_name, form.last_name]);

  const onUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `candidates/${computedSlug || crypto.randomUUID()}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('media').upload(path, file, {
        cacheControl: '3600', upsert: true, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('media').getPublicUrl(path);
      set('photo_url', pub.publicUrl);
    } catch (e: any) {
      setError(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        slug: computedSlug,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        party_id: form.party_id || null,
        photo_url: form.photo_url || null,
        short_bio: form.short_bio || null,
        is_published: form.is_published,
        order_index: form.order_index,
        gender: form.gender,
      };
      if (isNew) {
        const { error } = await supabase.from('candidates').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('candidates').update(payload).eq('id', form.id);
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
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full max-h-[92vh] overflow-y-auto"
      >
        <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-black text-ink">{isNew ? 'Nouveau candidat' : 'Modifier'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 grid grid-cols-2 gap-3">
          <Field label="Prénom" required>
            <input
              required value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)}
              className="input" />
          </Field>
          <Field label="Nom" required>
            <input
              required value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
              className="input" />
          </Field>

          <Field label="Slug (URL)" hint="Calculé automatiquement">
            <input
              value={form.slug || computedSlug}
              onChange={(e) => set('slug', e.target.value)}
              className="input font-mono text-sm" />
          </Field>
          <Field label="Genre">
            <select
              value={form.gender ?? ''}
              onChange={(e) => set('gender', (e.target.value || null) as 'M' | 'F' | null)}
              className="input"
            >
              <option value="">—</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </Field>

          <Field label="Parti" wide>
            <select
              value={form.party_id ?? ''}
              onChange={(e) => set('party_id', e.target.value || null)}
              className="input"
            >
              <option value="">— Aucun</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Photo" wide>
            <div className="flex items-center gap-3">
              {form.photo_url ? (
                <img src={form.photo_url} alt="" className="w-16 h-16 rounded-full object-cover bg-slate-100 border border-slate-200" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200" />
              )}
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold cursor-pointer hover:bg-slate-200">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Envoi…' : (form.photo_url ? 'Remplacer' : 'Téléverser')}
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                />
              </label>
              {form.photo_url && (
                <button
                  type="button"
                  onClick={() => set('photo_url', null)}
                  className="text-xs text-rose-500 hover:underline"
                >
                  Retirer
                </button>
              )}
            </div>
          </Field>

          <Field label="Bio courte (1-2 phrases)" wide>
            <textarea
              rows={2}
              value={form.short_bio ?? ''}
              onChange={(e) => set('short_bio', e.target.value)}
              className="input" />
          </Field>

          <Field label="Ordre">
            <input
              type="number" value={form.order_index}
              onChange={(e) => set('order_index', Number(e.target.value))}
              className="input" />
          </Field>
          <Field label="Publié">
            <label className="inline-flex items-center gap-2 mt-2">
              <input
                type="checkbox" checked={form.is_published}
                onChange={(e) => set('is_published', e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Visible dans l'app mobile</span>
            </label>
          </Field>
        </div>

        {error && (
          <div className="mx-5 mb-3 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2">{error}</div>
        )}

        <footer className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-white font-bold text-sm hover:bg-accent disabled:opacity-50"
          >
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

function ErrorBox({ message }: { message: string }) {
  return <div className="text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2">{message}</div>;
}
