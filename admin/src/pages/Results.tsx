import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Megaphone, RotateCcw, Trophy, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  is_published: boolean;
  parties?: { name: string; abbreviation: string | null } | null;
}

interface ResultRow {
  round: number;
  candidate_id: string;
  percentage: number;
  votes: number | null;
  is_qualified: boolean;
  is_winner: boolean;
  rank: number | null;
}

interface ResultsConfig {
  round1_published: boolean;
  round2_published: boolean;
}

async function listCandidates(): Promise<Candidate[]> {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, first_name, last_name, photo_url, is_published, parties(name, abbreviation)')
    .order('order_index', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Candidate[]);
}

async function listResults(): Promise<ResultRow[]> {
  const { data, error } = await supabase
    .from('election_results')
    .select('round, candidate_id, percentage, votes, is_qualified, is_winner, rank');
  if (error) throw error;
  return (data ?? []) as ResultRow[];
}

async function readConfig(): Promise<ResultsConfig> {
  const { data, error } = await supabase
    .from('app_config').select('value').eq('key', 'election.results').maybeSingle();
  if (error) throw error;
  return (data?.value ?? { round1_published: false, round2_published: false }) as ResultsConfig;
}

export function Results() {
  const qc = useQueryClient();
  const candidates = useQuery({ queryKey: ['admin', 'candidates_for_results'], queryFn: listCandidates });
  const results = useQuery({ queryKey: ['admin', 'election_results'], queryFn: listResults });
  const config = useQuery({ queryKey: ['admin', 'results_config'], queryFn: readConfig });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'candidates_for_results'] });
    qc.invalidateQueries({ queryKey: ['admin', 'election_results'] });
    qc.invalidateQueries({ queryKey: ['admin', 'results_config'] });
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <header>
        <h1 className="text-2xl font-black text-ink">Résultats du scrutin</h1>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          Saisis les scores officiels une fois publiés par le ministère de l'Intérieur. La
          publication d'un tour&nbsp;: (1) flippe le drapeau côté app, (2) <b>passe automatiquement
          en non-publiés</b> les candidats non qualifiés (1er tour) ou non vainqueurs (2nd tour),
          (3) envoie une notification push à tous les utilisateurs.
        </p>
      </header>

      {(candidates.isLoading || results.isLoading || config.isLoading) && (
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      )}

      {candidates.data && results.data && config.data && (
        <>
          <RoundEditor
            round={1}
            candidates={candidates.data}
            results={results.data.filter((r) => r.round === 1)}
            isPublished={config.data.round1_published}
            onChange={refetchAll}
          />
          <RoundEditor
            round={2}
            candidates={candidates.data}
            results={results.data.filter((r) => r.round === 2)}
            isPublished={config.data.round2_published}
            onChange={refetchAll}
          />
        </>
      )}
    </div>
  );
}

function RoundEditor({
  round, candidates, results, isPublished, onChange,
}: {
  round: 1 | 2;
  candidates: Candidate[];
  results: ResultRow[];
  isPublished: boolean;
  onChange: () => void;
}) {
  const existingMap = useMemo(() => {
    const m = new Map<string, ResultRow>();
    for (const r of results) m.set(r.candidate_id, r);
    return m;
  }, [results]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const saveRow = async (candidate_id: string, patch: Partial<ResultRow>) => {
    setError(null);
    const existing = existingMap.get(candidate_id);
    const merged: ResultRow = {
      round,
      candidate_id,
      percentage: patch.percentage ?? existing?.percentage ?? 0,
      votes: patch.votes ?? existing?.votes ?? null,
      is_qualified: patch.is_qualified ?? existing?.is_qualified ?? false,
      is_winner: patch.is_winner ?? existing?.is_winner ?? false,
      rank: patch.rank ?? existing?.rank ?? null,
    };
    const { error } = await supabase
      .from('election_results')
      .upsert(merged, { onConflict: 'round,candidate_id' });
    if (error) { setError(error.message); return; }
    onChange();
  };

  const deleteRow = async (candidate_id: string) => {
    setError(null);
    const { error } = await supabase
      .from('election_results').delete()
      .eq('round', round).eq('candidate_id', candidate_id);
    if (error) { setError(error.message); return; }
    onChange();
  };

  const publish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('publish_round_results', { p_round: round });
      if (error) throw error;
    },
    onSuccess: () => { onChange(); },
    onError: (e: any) => setError(e.message ?? String(e)),
  });

  const unpublish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('unpublish_round_results', { p_round: round });
      if (error) throw error;
    },
    onSuccess: () => { onChange(); },
    onError: (e: any) => setError(e.message ?? String(e)),
  });

  const handlePublish = () => {
    const eliminatedCount = round === 1
      ? results.filter((r) => !r.is_qualified).length
      : results.filter((r) => !r.is_winner).length;
    const label = round === 1
      ? `Publier les résultats du 1er tour ?\n\n${eliminatedCount} candidat(s) non qualifié(s) passeront automatiquement en "non publié" et disparaîtront de l'app (leurs scores resteront visibles dans la carte Résultats).`
      : `Publier les résultats du 2nd tour ?\n\n${eliminatedCount} candidat(s) non vainqueur(s) passeront automatiquement en "non publié". Une notification "président·e élu·e" sera envoyée à tous.`;
    if (window.confirm(label)) {
      setBusy(true);
      publish.mutate(undefined, { onSettled: () => setBusy(false) });
    }
  };

  const handleUnpublish = () => {
    if (window.confirm(`Annuler la publication du ${round === 1 ? '1er' : '2nd'} tour ?\n\nLe drapeau côté app sera remis à false ET les candidats du tour seront re-publiés. À utiliser uniquement pour annuler une publication faite par erreur.`)) {
      setBusy(true);
      unpublish.mutate(undefined, { onSettled: () => setBusy(false) });
    }
  };

  // Sort: existing rows first (by percentage desc), then candidates without a row
  const sorted = useMemo(() => {
    const withRow = candidates.filter((c) => existingMap.has(c.id));
    const withoutRow = candidates.filter((c) => !existingMap.has(c.id));
    withRow.sort((a, b) => (existingMap.get(b.id)!.percentage) - (existingMap.get(a.id)!.percentage));
    return [...withRow, ...withoutRow];
  }, [candidates, existingMap]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <header className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-ink text-lg">{round === 1 ? '1er tour' : '2nd tour'}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{results.length} candidat(s) avec score saisi</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {isPublished ? 'Publié' : 'En attente'}
          </span>
          {!isPublished ? (
            <button
              onClick={handlePublish}
              disabled={busy || results.length === 0}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-white text-sm font-bold hover:bg-accent disabled:opacity-50"
            >
              <Megaphone className="w-4 h-4" /> Publier les résultats
            </button>
          ) : (
            <button
              onClick={handleUnpublish}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" /> Annuler la publication
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mx-5 mt-3 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2">{error}</div>
      )}

      <div className="divide-y divide-slate-100">
        {sorted.map((c) => (
          <CandidateResultRow
            key={c.id}
            candidate={c}
            existing={existingMap.get(c.id)}
            round={round}
            onSave={(patch) => saveRow(c.id, patch)}
            onDelete={() => deleteRow(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CandidateResultRow({
  candidate, existing, round, onSave, onDelete,
}: {
  candidate: Candidate;
  existing: ResultRow | undefined;
  round: 1 | 2;
  onSave: (patch: Partial<ResultRow>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [percentage, setPercentage] = useState<string>(existing?.percentage?.toString() ?? '');
  const [votes, setVotes] = useState<string>(existing?.votes?.toString() ?? '');
  const [rank, setRank] = useState<string>(existing?.rank?.toString() ?? '');
  const [isQualified, setIsQualified] = useState<boolean>(existing?.is_qualified ?? false);
  const [isWinner, setIsWinner] = useState<boolean>(existing?.is_winner ?? false);
  const [saving, setSaving] = useState(false);

  // Re-sync local state if the underlying row was reloaded.
  useEffect(() => {
    setPercentage(existing?.percentage?.toString() ?? '');
    setVotes(existing?.votes?.toString() ?? '');
    setRank(existing?.rank?.toString() ?? '');
    setIsQualified(existing?.is_qualified ?? false);
    setIsWinner(existing?.is_winner ?? false);
  }, [existing?.percentage, existing?.votes, existing?.rank, existing?.is_qualified, existing?.is_winner]);

  const dirty = useMemo(() => {
    const p = parseFloat(percentage);
    const v = votes === '' ? null : parseInt(votes, 10);
    const rk = rank === '' ? null : parseInt(rank, 10);
    return (existing?.percentage ?? null) !== (Number.isFinite(p) ? p : null)
      || (existing?.votes ?? null) !== v
      || (existing?.rank ?? null) !== rk
      || (existing?.is_qualified ?? false) !== isQualified
      || (existing?.is_winner ?? false) !== isWinner;
  }, [percentage, votes, rank, isQualified, isWinner, existing]);

  const handleSave = async () => {
    const p = parseFloat(percentage);
    if (!Number.isFinite(p) || p < 0 || p > 100) return;
    setSaving(true);
    await onSave({
      percentage: p,
      votes: votes === '' ? null : parseInt(votes, 10),
      rank: rank === '' ? null : parseInt(rank, 10),
      is_qualified: isQualified,
      is_winner: isWinner,
    });
    setSaving(false);
  };

  return (
    <div className="p-3 sm:p-4 flex items-center gap-3 flex-wrap sm:flex-nowrap">
      <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
        {candidate.photo_url ? (
          <img src={candidate.photo_url} alt="" className="w-full h-full object-cover" />
        ) : null}
      </div>
      <div className="flex-1 min-w-[150px]">
        <div className="font-bold text-ink text-sm truncate flex items-center gap-2">
          {candidate.first_name} {candidate.last_name}
          {!candidate.is_published && (
            <span className="text-[9px] uppercase tracking-widest bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">Non publié</span>
          )}
        </div>
        <div className="text-[11px] text-slate-500 truncate">{candidate.parties?.name ?? '—'}</div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1 text-xs">
          <span className="text-slate-500 font-bold">%</span>
          <input
            type="number" step="0.01" min={0} max={100}
            value={percentage} onChange={(e) => setPercentage(e.target.value)}
            className="w-20 input-sm"
            placeholder="0.00"
          />
        </label>
        <label className="flex items-center gap-1 text-xs">
          <span className="text-slate-500 font-bold">voix</span>
          <input
            type="number" min={0}
            value={votes} onChange={(e) => setVotes(e.target.value)}
            className="w-24 input-sm"
            placeholder="—"
          />
        </label>
        <label className="flex items-center gap-1 text-xs">
          <span className="text-slate-500 font-bold">rang</span>
          <input
            type="number" min={1}
            value={rank} onChange={(e) => setRank(e.target.value)}
            className="w-14 input-sm"
            placeholder="—"
          />
        </label>
        {round === 1 ? (
          <label className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 cursor-pointer">
            <input type="checkbox" checked={isQualified} onChange={(e) => setIsQualified(e.target.checked)} />
            <Check className="w-3 h-3" /> Qualifié·e
          </label>
        ) : (
          <label className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 cursor-pointer">
            <input type="checkbox" checked={isWinner} onChange={(e) => setIsWinner(e.target.checked)} />
            <Trophy className="w-3 h-3" /> Vainqueur
          </label>
        )}

        <button
          onClick={handleSave}
          disabled={!dirty || saving || !Number.isFinite(parseFloat(percentage))}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-ink text-white text-xs font-bold hover:bg-accent disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {existing ? 'Maj' : 'Ajouter'}
        </button>
        {existing && (
          <button
            onClick={() => { if (window.confirm(`Supprimer le score de ${candidate.first_name} ${candidate.last_name} pour ce tour ?`)) onDelete(); }}
            className="text-xs text-rose-500 hover:underline font-bold"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}
