import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Save, GripVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * Generic CRUD for "sub" tables — i.e. rows that always belong to a
 * parent (a candidate, a party, a theme). Handles the common case of
 * { id, parent_id, ...payload, order_index? } tables.
 *
 * Field schema is described declaratively so we don't write a
 * one-off form for each table.
 */

export type FieldSpec =
  | { kind: 'text'; key: string; label: string; required?: boolean; placeholder?: string }
  | { kind: 'textarea'; key: string; label: string; required?: boolean; rows?: number; placeholder?: string }
  | { kind: 'number'; key: string; label: string }
  | { kind: 'date'; key: string; label: string }
  | { kind: 'checkbox'; key: string; label: string }
  | { kind: 'select'; key: string; label: string; options: { value: string; label: string }[]; required?: boolean }
  | { kind: 'array-text'; key: string; label: string; placeholder?: string };

export interface SubResourceConfig {
  /** Postgres table name */
  table: string;
  /** FK column pointing at the parent (e.g. "candidate_id") */
  parentKey: string;
  /** Heading shown to the admin */
  title: string;
  /** Field spec for the editor form */
  fields: FieldSpec[];
  /** Column used to render the row label in the list */
  labelKey: string;
  /** Optional: secondary line (e.g. theme name) */
  subLabel?: (row: any) => string | null;
  /** Order direction (default: order_index asc, then created_at) */
  orderBy?: { column: string; ascending: boolean }[];
  /** Optional: extra select fields beyond * (e.g. joined themes) */
  selectExpr?: string;
  /** Optional: custom default value for new rows */
  defaultValues?: Record<string, any>;
  /** Empty state copy */
  emptyText?: string;
}

interface Props {
  parentId: string;
  config: SubResourceConfig;
}

export function SubResourceList({ parentId, config }: Props) {
  const qc = useQueryClient();
  const queryKey = ['admin', 'sub', config.table, parentId];

  const list = useQuery({
    queryKey,
    enabled: !!parentId,
    queryFn: async () => {
      let q = supabase.from(config.table).select(config.selectExpr || '*').eq(config.parentKey, parentId);
      const orderBys = config.orderBy ?? [
        { column: 'order_index', ascending: true },
        { column: 'created_at', ascending: true },
      ];
      for (const ob of orderBys) q = q.order(ob.column, { ascending: ob.ascending });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(config.table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const [editing, setEditing] = useState<any | 'new' | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="font-bold text-ink">{config.title}</h3>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ink text-white text-xs font-bold hover:bg-accent"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </header>

      {list.isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}

      <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-100">
        {(list.data ?? []).length === 0 && !list.isLoading && (
          <div className="p-4 text-xs text-slate-500 text-center">
            {config.emptyText ?? 'Aucune entrée pour l\'instant.'}
          </div>
        )}
        {(list.data ?? []).map((row) => {
          const sub = config.subLabel?.(row);
          return (
            <div key={row.id} className="flex items-start gap-2 p-2.5 group">
              <GripVertical className="w-3 h-3 text-slate-300 mt-1 shrink-0" />
              <button
                type="button"
                onClick={() => setEditing(row)}
                className="flex-1 text-left min-w-0"
              >
                <div className="text-sm text-slate-800 line-clamp-2 font-medium">{row[config.labelKey] || '—'}</div>
                {sub && <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{sub}</div>}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Supprimer cette entrée ?')) remove.mutate(row.id);
                }}
                className="p-1.5 rounded hover:bg-rose-50 text-rose-500 opacity-60 hover:opacity-100"
                aria-label="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {editing && (
        <SubResourceForm
          parentId={parentId}
          config={config}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey });
          }}
        />
      )}
    </div>
  );
}

function SubResourceForm({
  parentId, config, initial, onClose, onSaved,
}: {
  parentId: string;
  config: SubResourceConfig;
  initial: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial;
  const [form, setForm] = useState<Record<string, any>>(() => {
    if (initial) return { ...initial };
    const blank: Record<string, any> = { ...(config.defaultValues ?? {}) };
    for (const f of config.fields) {
      if (f.kind === 'checkbox') blank[f.key] = blank[f.key] ?? false;
      else if (f.kind === 'number') blank[f.key] = blank[f.key] ?? 0;
      else if (f.kind === 'array-text') blank[f.key] = blank[f.key] ?? [];
      else blank[f.key] = blank[f.key] ?? '';
    }
    return blank;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync when initial changes (parent reopens with another row)
  useEffect(() => {
    if (initial) setForm({ ...initial });
  }, [initial?.id]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload: Record<string, any> = { [config.parentKey]: parentId };
      for (const f of config.fields) {
        let v = form[f.key];
        if (f.kind === 'number') v = Number(v) || 0;
        if (f.kind === 'array-text') v = Array.isArray(v) ? v.filter((x: string) => x?.trim()) : [];
        if (f.kind === 'date' && !v) v = null;
        if (f.kind === 'select' && !v) v = null;
        payload[f.key] = v;
      }
      if (isNew) {
        const { error } = await supabase.from(config.table).insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(config.table).update(payload).eq('id', initial.id);
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full max-h-[88vh] overflow-y-auto"
      >
        <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-black text-ink">
            {isNew ? `Nouvelle entrée — ${config.title}` : `Modifier — ${config.title}`}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">
            ×
          </button>
        </header>

        <div className="p-5 grid grid-cols-1 gap-3">
          {config.fields.map((f) => (
            <FieldRender key={f.key} field={f} value={form[f.key]} onChange={(v) => set(f.key, v)} />
          ))}
        </div>

        {error && <div className="mx-5 mb-3 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2">{error}</div>}

        <footer className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
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

function FieldRender({ field, value, onChange }: { field: FieldSpec; value: any; onChange: (v: any) => void }) {
  const lab = (
    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
      {field.label}
      {(field.kind === 'text' || field.kind === 'textarea' || field.kind === 'select') && field.required && (
        <span className="text-rose-500"> *</span>
      )}
    </span>
  );

  switch (field.kind) {
    case 'text':
      return (
        <label className="flex flex-col gap-1">
          {lab}
          <input
            required={field.required} placeholder={field.placeholder}
            value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input"
          />
        </label>
      );
    case 'textarea':
      return (
        <label className="flex flex-col gap-1">
          {lab}
          <textarea
            required={field.required} rows={field.rows ?? 4} placeholder={field.placeholder}
            value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input"
          />
        </label>
      );
    case 'number':
      return (
        <label className="flex flex-col gap-1">
          {lab}
          <input
            type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} className="input"
          />
        </label>
      );
    case 'date':
      return (
        <label className="flex flex-col gap-1">
          {lab}
          <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input" />
        </label>
      );
    case 'checkbox':
      return (
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4" />
          <span className="text-sm font-bold text-slate-700">{field.label}</span>
        </label>
      );
    case 'select':
      return (
        <label className="flex flex-col gap-1">
          {lab}
          <select required={field.required} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input">
            <option value="">— Sélectionner</option>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      );
    case 'array-text': {
      const arr: string[] = Array.isArray(value) ? value : [];
      const replaceAt = (idx: number, v: string) => {
        const next = [...arr]; next[idx] = v; onChange(next);
      };
      return (
        <div className="flex flex-col gap-1">
          {lab}
          <div className="flex flex-col gap-1.5">
            {arr.map((v, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={v} placeholder={field.placeholder}
                  onChange={(e) => replaceAt(idx, e.target.value)}
                  className="input flex-1"
                />
                <button
                  type="button" onClick={() => onChange(arr.filter((_, i) => i !== idx))}
                  className="p-2 rounded hover:bg-rose-50 text-rose-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button" onClick={() => onChange([...arr, ''])}
              className="self-start inline-flex items-center gap-1.5 text-xs text-accent font-bold hover:underline"
            >
              <Plus className="w-3 h-3" /> Ajouter une entrée
            </button>
          </div>
        </div>
      );
    }
  }
}
