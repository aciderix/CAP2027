import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, X, Save, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SubResourceList } from '../components/SubResourceList';

interface Party {
  id: string;
  name: string;
  abbreviation: string | null;
  color: string | null;
  logo_url: string | null;
  order_index: number;
}

async function listParties() {
  const { data, error } = await supabase
    .from('parties')
    .select('id, name, abbreviation, color, logo_url, order_index')
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Party[];
}

export function Parties() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'parties'], queryFn: listParties });
  const [editing, setEditing] = useState<Party | 'new' | null>(null);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('parties').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'parties'] }),
  });

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-ink">Partis</h1>
        <button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-white text-sm font-bold hover:bg-accent">
          <Plus className="w-4 h-4" /> Nouveau parti
        </button>
      </header>

      {list.isLoading && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {(list.data ?? []).map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ backgroundColor: p.color || '#94a3b8' }}>
              {p.logo_url ? (
                <img src={p.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-black text-white">{(p.abbreviation || p.name).slice(0, 3).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-ink truncate">{p.name}</div>
              <div className="text-xs text-slate-500 truncate">
                {p.abbreviation || '—'} · ordre {p.order_index}
              </div>
            </div>
            <button onClick={() => setEditing(p)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button>
            <button
              onClick={() => {
                if (window.confirm(`Supprimer le parti "${p.name}" ? Les alias associés et le lien vers les candidats seront aussi supprimés.`)) {
                  remove.mutate(p.id);
                }
              }}
              className="p-2 rounded-lg hover:bg-rose-50 text-rose-500"
            ><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {list.data?.length === 0 && !list.isLoading && (
          <div className="p-6 text-sm text-center text-slate-500">Aucun parti.</div>
        )}
      </div>

      {editing && (
        <PartyEditor
          party={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'parties'] });
          }}
        />
      )}
    </div>
  );
}

function PartyEditor({ party, onClose, onSaved }: { party: Party | null; onClose: () => void; onSaved: () => void }) {
  const isNew = party === null;
  const [tab, setTab] = useState<'profile' | 'aliases'>('profile');
  const [form, setForm] = useState<Party>(() => party ?? {
    id: '', name: '', abbreviation: '', color: '#475569', logo_url: null, order_index: 100,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(party?.id ?? null);

  const set = <K extends keyof Party>(k: K, v: Party[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onUpload = async (file: File) => {
    setUploading(true); setError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const slug = (form.abbreviation || form.name || 'party').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const path = `parties/${slug}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('media').upload(path, file, {
        cacheControl: '3600', upsert: true, contentType: file.type,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('media').getPublicUrl(path);
      set('logo_url', pub.publicUrl);
    } catch (e: any) {
      setError(e.message ?? 'Upload failed');
    } finally { setUploading(false); }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        abbreviation: form.abbreviation || null,
        color: form.color || null,
        logo_url: form.logo_url || null,
        order_index: form.order_index,
      };
      if (isNew) {
        const { data, error } = await supabase.from('parties').insert(payload).select('id').single();
        if (error) throw error;
        setCreatedId(data.id);
        setForm((f) => ({ ...f, id: data.id }));
      } else {
        const { error } = await supabase.from('parties').update(payload).eq('id', form.id);
        if (error) throw error;
      }
      onSaved();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally { setSaving(false); }
  };

  const partyId = createdId ?? (party?.id ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center" style={{ backgroundColor: form.color || '#94a3b8' }}>
              {form.logo_url ? <img src={form.logo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] font-black text-white">{(form.abbreviation || form.name || '?').slice(0, 3).toUpperCase()}</span>}
            </div>
            <h2 className="font-black text-ink">{isNew ? 'Nouveau parti' : form.name || 'Sans nom'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </header>

        {!isNew && (
          <nav className="px-5 pt-3 flex gap-1 border-b border-slate-100">
            {[
              { k: 'profile', label: 'Profil' },
              { k: 'aliases', label: 'Alias' },
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
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Abréviation</span>
                <input value={form.abbreviation ?? ''} onChange={(e) => set('abbreviation', e.target.value)} className="input" placeholder="LFI, RN, …" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Couleur</span>
                <input type="color" value={form.color ?? '#475569'} onChange={(e) => set('color', e.target.value)} className="input h-10 p-1" />
              </label>
              <div className="flex flex-col gap-1 col-span-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Logo</span>
                <div className="flex items-center gap-3">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="" className="w-12 h-12 rounded-full object-cover bg-slate-100 border border-slate-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200" />
                  )}
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold cursor-pointer hover:bg-slate-200">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Envoi…' : (form.logo_url ? 'Remplacer' : 'Téléverser')}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                  </label>
                  {form.logo_url && (
                    <button type="button" onClick={() => set('logo_url', null)} className="text-xs text-rose-500 hover:underline">Retirer</button>
                  )}
                </div>
              </div>
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

          {!isNew && tab === 'aliases' && partyId && (
            <SubResourceList
              parentId={partyId}
              config={{
                table: 'party_aliases',
                parentKey: 'party_id',
                title: 'Alias du parti',
                emptyText: 'Aucun alias. Ajoutez les variantes utilisées par la presse (ex. "Insoumis", "France insoumise"…) pour que le tagger les détecte.',
                fields: [
                  { kind: 'text', key: 'alias', label: 'Alias', required: true, placeholder: 'France Insoumise, LFI, NUPES…' },
                ],
                labelKey: 'alias',
                orderBy: [{ column: 'alias', ascending: true }],
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
