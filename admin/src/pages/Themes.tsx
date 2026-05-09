import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, X, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SubResourceList } from '../components/SubResourceList';

interface Theme {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  order_index: number;
}

async function listThemes() {
  const { data, error } = await supabase
    .from('themes')
    .select('id, slug, name, icon, color, order_index')
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Theme[];
}

export function Themes() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'themes'], queryFn: listThemes });
  const [editing, setEditing] = useState<Theme | 'new' | null>(null);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('themes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'themes'] }),
  });

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-ink">Thèmes</h1>
        <button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-white text-sm font-bold hover:bg-accent">
          <Plus className="w-4 h-4" /> Nouveau thème
        </button>
      </header>

      {list.isLoading && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {(list.data ?? []).map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color || '#94a3b8' }} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-ink truncate">{t.name}</div>
              <div className="text-xs text-slate-500 truncate font-mono">/{t.slug} · ordre {t.order_index}</div>
            </div>
            <button onClick={() => setEditing(t)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button>
            <button
              onClick={() => {
                if (window.confirm(`Supprimer le thème "${t.name}" ? Les mots-clés associés seront aussi supprimés.`)) {
                  remove.mutate(t.id);
                }
              }}
              className="p-2 rounded-lg hover:bg-rose-50 text-rose-500"
            ><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {list.data?.length === 0 && !list.isLoading && (
          <div className="p-6 text-sm text-center text-slate-500">Aucun thème.</div>
        )}
      </div>

      {editing && (
        <ThemeEditor
          theme={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'themes'] });
          }}
        />
      )}
    </div>
  );
}

function ThemeEditor({ theme, onClose, onSaved }: { theme: Theme | null; onClose: () => void; onSaved: () => void }) {
  const isNew = theme === null;
  const [tab, setTab] = useState<'profile' | 'keywords'>('profile');
  const [form, setForm] = useState<Theme>(() => theme ?? {
    id: '', slug: '', name: '', icon: null, color: '#94a3b8', order_index: 100,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(theme?.id ?? null);

  const set = <K extends keyof Theme>(k: K, v: Theme[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const slug = form.slug || form.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const payload = {
        slug, name: form.name.trim(), icon: form.icon || null,
        color: form.color || null, order_index: form.order_index,
      };
      if (isNew) {
        const { data, error } = await supabase.from('themes').insert(payload).select('id').single();
        if (error) throw error;
        setCreatedId(data.id);
        setForm((f) => ({ ...f, id: data.id, slug }));
      } else {
        const { error } = await supabase.from('themes').update(payload).eq('id', form.id);
        if (error) throw error;
      }
      onSaved();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally { setSaving(false); }
  };

  const themeId = createdId ?? (theme?.id ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: form.color || '#94a3b8' }} />
            <h2 className="font-black text-ink">{isNew ? 'Nouveau thème' : form.name || 'Sans nom'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </header>

        {!isNew && (
          <nav className="px-5 pt-3 flex gap-1 border-b border-slate-100">
            {[
              { k: 'profile', label: 'Profil' },
              { k: 'keywords', label: 'Mots-clés' },
            ].map((t) => (
              <button
                key={t.k} onClick={() => setTab(t.k as any)}
                className={`px-3 py-2 text-sm font-bold rounded-t-lg ${tab === t.k ? 'bg-slate-100 text-ink' : 'text-slate-500 hover:text-ink'}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}

        <div className="p-5">
          {(isNew || tab === 'profile') && (
            <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Nom *</span>
                <input required value={form.name} onChange={(e) => set('name', e.target.value)} className="input" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Slug</span>
                <input value={form.slug} onChange={(e) => set('slug', e.target.value)} className="input font-mono" placeholder="auto" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Icône (Lucide)</span>
                <input value={form.icon ?? ''} onChange={(e) => set('icon', e.target.value)} className="input" placeholder="Heart, Globe, Coins…" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Couleur</span>
                <input type="color" value={form.color ?? '#94a3b8'} onChange={(e) => set('color', e.target.value)} className="input h-10 p-1" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Ordre</span>
                <input type="number" value={form.order_index} onChange={(e) => set('order_index', Number(e.target.value))} className="input" />
              </label>

              {error && <div className="col-span-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2">{error}</div>}

              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200">Annuler</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-white font-bold text-sm hover:bg-accent disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isNew ? 'Créer' : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}

          {!isNew && tab === 'keywords' && themeId && (
            <SubResourceList
              parentId={themeId}
              config={{
                table: 'theme_keywords',
                parentKey: 'theme_id',
                title: 'Mots-clés',
                emptyText: 'Aucun mot-clé. Ajoutez ceux qui font matcher les articles à ce thème (ex. "écologie", "transition", "climat").',
                fields: [
                  { kind: 'text', key: 'keyword', label: 'Mot-clé', required: true, placeholder: 'écologie, climat…' },
                ],
                labelKey: 'keyword',
                orderBy: [{ column: 'keyword', ascending: true }],
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
