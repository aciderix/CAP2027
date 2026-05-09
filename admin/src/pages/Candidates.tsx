import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, Upload, X, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SubResourceList, type FieldSpec } from '../components/SubResourceList';

interface Party { id: string; name: string; abbreviation: string | null; }
interface Theme { id: string; name: string; slug: string; }
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
    .from('parties').select('id, name, abbreviation').order('name');
  if (error) throw error;
  return (data ?? []) as Party[];
}
async function listThemes() {
  const { data, error } = await supabase
    .from('themes').select('id, name, slug').order('order_index');
  if (error) throw error;
  return (data ?? []) as Theme[];
}

export function Candidates() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'candidates'], queryFn: listCandidates });
  const parties = useQuery({ queryKey: ['admin', 'parties'], queryFn: listParties });
  const themes = useQuery({ queryKey: ['admin', 'themes'], queryFn: listThemes });
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
        <button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-white text-sm font-bold hover:bg-accent">
          <Plus className="w-4 h-4" /> Nouveau candidat
        </button>
      </header>

      {list.isLoading && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
      {list.error && <div className="text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2">{(list.error as Error).message}</div>}

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
                  <span className="ml-2 text-[9px] uppercase tracking-widest bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">Brouillon</span>
                )}
              </div>
              <div className="text-xs text-slate-500 truncate">{c.parties?.name ?? '—'} · /{c.slug}</div>
            </div>
            <button onClick={() => setEditing(c)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button>
            <button
              onClick={() => {
                if (window.confirm(`Supprimer définitivement ${c.first_name} ${c.last_name} ? Tous les bios, programmes, alias, propositions seront aussi supprimés.`)) {
                  remove.mutate(c.id);
                }
              }}
              className="p-2 rounded-lg hover:bg-rose-50 text-rose-500"
            ><Trash2 className="w-4 h-4" /></button>
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
          themes={themes.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin', 'candidates'] })}
        />
      )}
    </div>
  );
}

type Tab = 'profile' | 'aliases' | 'bio' | 'programs' | 'proposals' | 'affairs' | 'boussole';
const TABS: { k: Tab; label: string }[] = [
  { k: 'profile', label: 'Profil' },
  { k: 'aliases', label: 'Alias' },
  { k: 'bio', label: 'Biographie' },
  { k: 'programs', label: 'Programme (long)' },
  { k: 'proposals', label: 'Propositions' },
  { k: 'affairs', label: 'Affaires' },
  { k: 'boussole', label: 'Boussole' },
];

function CandidateEditor({
  candidate, parties, themes, onClose, onSaved,
}: {
  candidate: Candidate | null;
  parties: Party[];
  themes: Theme[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = candidate === null;
  const [tab, setTab] = useState<Tab>('profile');
  const [form, setForm] = useState<Candidate>(() => candidate ?? {
    id: '', slug: '', first_name: '', last_name: '', party_id: null,
    photo_url: null, short_bio: '', is_published: false, order_index: 100, gender: null,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(candidate?.id ?? null);

  const set = <K extends keyof Candidate>(k: K, v: Candidate[K]) => setForm((f) => ({ ...f, [k]: v }));

  const computedSlug = useMemo(() => {
    if (form.slug) return form.slug;
    return `${form.first_name}-${form.last_name}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }, [form.slug, form.first_name, form.last_name]);

  const onUpload = async (file: File) => {
    setUploading(true); setError(null);
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
    } finally { setUploading(false); }
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
        const { data, error } = await supabase.from('candidates').insert(payload).select('id').single();
        if (error) throw error;
        setCreatedId(data.id);
        setForm((f) => ({ ...f, id: data.id, slug: computedSlug }));
      } else {
        const { error } = await supabase.from('candidates').update(payload).eq('id', form.id);
        if (error) throw error;
      }
      onSaved();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally { setSaving(false); }
  };

  const cid = createdId ?? (candidate?.id ?? null);
  const themeOpts = themes.map((t) => ({ value: t.id, label: t.name }));

  // Field configs for sub-resources
  const aliasesFields: FieldSpec[] = [
    { kind: 'text', key: 'alias', label: 'Alias', required: true, placeholder: 'Mélenchon, JLM, …' },
  ];
  const bioFields: FieldSpec[] = [
    { kind: 'text', key: 'title', label: 'Titre de la section', required: true, placeholder: 'Jeunesse et formation' },
    { kind: 'textarea', key: 'content', label: 'Contenu', required: true, rows: 6 },
    { kind: 'number', key: 'order_index', label: 'Ordre' },
  ];
  const programsFields: FieldSpec[] = [
    { kind: 'select', key: 'theme_id', label: 'Thème', required: true, options: themeOpts },
    { kind: 'textarea', key: 'intro', label: 'Intro (optionnel)', rows: 2 },
    { kind: 'textarea', key: 'content', label: 'Contenu détaillé', required: true, rows: 8 },
    { kind: 'number', key: 'order_index', label: 'Ordre' },
  ];
  const proposalsFields: FieldSpec[] = [
    { kind: 'select', key: 'theme_id', label: 'Thème', required: true, options: themeOpts },
    { kind: 'text', key: 'title', label: 'Titre', required: true },
    { kind: 'textarea', key: 'content', label: 'Détail (optionnel)', rows: 3 },
    { kind: 'text', key: 'source_url', label: 'URL source (optionnel)', placeholder: 'https://…' },
    { kind: 'number', key: 'order_index', label: 'Ordre' },
  ];
  const affairsFields: FieldSpec[] = [
    { kind: 'text', key: 'title', label: 'Titre', required: true },
    { kind: 'textarea', key: 'description', label: 'Description', rows: 4 },
    {
      kind: 'select', key: 'status', label: 'Statut', required: true,
      options: [
        { value: 'mis_en_examen', label: 'Mis en examen' },
        { value: 'en_cours', label: 'En cours' },
        { value: 'classee', label: 'Classée' },
        { value: 'condamnation', label: 'Condamnation' },
        { value: 'relaxe', label: 'Relaxe' },
      ],
    },
    { kind: 'date', key: 'date', label: 'Date' },
    { kind: 'array-text', key: 'source_urls', label: 'URLs sources', placeholder: 'https://…' },
    { kind: 'number', key: 'order_index', label: 'Ordre' },
  ];
  const boussoleFields: FieldSpec[] = [
    { kind: 'select', key: 'theme_id', label: 'Thème', required: true, options: themeOpts },
    { kind: 'textarea', key: 'text', label: 'Proposition (1-2 phrases)', required: true, rows: 3 },
    { kind: 'checkbox', key: 'is_active', label: 'Active dans le test' },
    { kind: 'number', key: 'order_index', label: 'Ordre' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[92vh] overflow-y-auto">
        <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100">
              {form.photo_url && <img src={form.photo_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <h2 className="font-black text-ink">{isNew ? 'Nouveau candidat' : `${form.first_name} ${form.last_name}`}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </header>

        {!isNew && (
          <nav className="px-3 sm:px-5 pt-3 flex gap-1 border-b border-slate-100 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`shrink-0 px-3 py-2 text-sm font-bold rounded-t-lg whitespace-nowrap ${tab === t.k ? 'bg-slate-100 text-ink' : 'text-slate-500 hover:text-ink'}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}

        <div className="p-5">
          {(isNew || tab === 'profile') && (
            <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Prénom *</span>
                <input required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} className="input" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Nom *</span>
                <input required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} className="input" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Slug</span>
                <input value={form.slug || computedSlug} onChange={(e) => set('slug', e.target.value)} className="input font-mono text-sm" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Genre</span>
                <select value={form.gender ?? ''} onChange={(e) => set('gender', (e.target.value || null) as 'M' | 'F' | null)} className="input">
                  <option value="">—</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Parti</span>
                <select value={form.party_id ?? ''} onChange={(e) => set('party_id', e.target.value || null)} className="input">
                  <option value="">— Aucun</option>
                  {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <div className="flex flex-col gap-1 col-span-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Photo</span>
                <div className="flex items-center gap-3">
                  {form.photo_url ? (
                    <img src={form.photo_url} alt="" className="w-16 h-16 rounded-full object-cover bg-slate-100 border border-slate-200" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200" />
                  )}
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold cursor-pointer hover:bg-slate-200">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Envoi…' : (form.photo_url ? 'Remplacer' : 'Téléverser')}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                  </label>
                  {form.photo_url && (
                    <button type="button" onClick={() => set('photo_url', null)} className="text-xs text-rose-500 hover:underline">Retirer</button>
                  )}
                </div>
              </div>
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Bio courte (1-2 phrases)</span>
                <textarea rows={2} value={form.short_bio ?? ''} onChange={(e) => set('short_bio', e.target.value)} className="input" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Ordre</span>
                <input type="number" value={form.order_index} onChange={(e) => set('order_index', Number(e.target.value))} className="input" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Publié</span>
                <label className="inline-flex items-center gap-2 mt-2">
                  <input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm">Visible dans l'app mobile</span>
                </label>
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

          {!isNew && cid && (
            <>
              {tab === 'aliases' && (
                <SubResourceList
                  parentId={cid}
                  config={{
                    table: 'candidate_aliases',
                    parentKey: 'candidate_id',
                    title: 'Alias du candidat',
                    emptyText: 'Aucun alias. Ajoutez surnoms, abréviations et formes utilisées par la presse pour matcher les articles.',
                    fields: aliasesFields,
                    labelKey: 'alias',
                    orderBy: [{ column: 'alias', ascending: true }],
                  }}
                />
              )}
              {tab === 'bio' && (
                <SubResourceList
                  parentId={cid}
                  config={{
                    table: 'candidate_bio_sections',
                    parentKey: 'candidate_id',
                    title: 'Sections biographiques',
                    fields: bioFields,
                    labelKey: 'title',
                    subLabel: (r) => r.content?.slice(0, 80) ?? null,
                  }}
                />
              )}
              {tab === 'programs' && (
                <SubResourceList
                  parentId={cid}
                  config={{
                    table: 'candidate_programs',
                    parentKey: 'candidate_id',
                    title: 'Programme détaillé (par thème)',
                    fields: programsFields,
                    labelKey: 'intro',
                    selectExpr: '*, themes(id, name, color)',
                    subLabel: (r) => r.themes?.name ?? null,
                    emptyText: 'Aucun chapitre de programme. Ajoutez-en un par thème pour la fiche détaillée.',
                  }}
                />
              )}
              {tab === 'proposals' && (
                <SubResourceList
                  parentId={cid}
                  config={{
                    table: 'candidate_proposals',
                    parentKey: 'candidate_id',
                    title: 'Propositions (courtes)',
                    fields: proposalsFields,
                    labelKey: 'title',
                    selectExpr: '*, themes(id, name, color)',
                    subLabel: (r) => r.themes?.name ?? null,
                  }}
                />
              )}
              {tab === 'affairs' && (
                <SubResourceList
                  parentId={cid}
                  config={{
                    table: 'candidate_affairs',
                    parentKey: 'candidate_id',
                    title: 'Affaires judiciaires',
                    fields: affairsFields,
                    labelKey: 'title',
                    subLabel: (r) => r.status ?? null,
                    defaultValues: { status: 'en_cours', source_urls: [] },
                  }}
                />
              )}
              {tab === 'boussole' && (
                <SubResourceList
                  parentId={cid}
                  config={{
                    table: 'candidate_match_propositions',
                    parentKey: 'candidate_id',
                    title: 'Propositions Boussole',
                    fields: boussoleFields,
                    labelKey: 'text',
                    selectExpr: '*, themes(id, name, color)',
                    subLabel: (r) => r.themes?.name ?? null,
                    defaultValues: { is_active: true },
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
