// Daily fetch of the parrainages collected at the Conseil constitutionnel.
// The endpoint (configurable via app_config['parrainages.source']) returns
// one row per mayor signature with a `Candidat` field of the form
// "NOM Prénom". We aggregate by Candidat to get the per-candidate
// signature count, then upsert today's snapshot.
//
// Match candidates by full normalised "last_name first_name" or by
// last_name alone, with a fallback through public.candidate_aliases.
// Unmatched rows are still stored (candidate_id null) so the admin
// can see the raw distribution.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function norm(s: string): string {
  return stripAccents(String(s ?? "").toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();
}

interface Aggregate {
  source_name: string;
  total: number;
}

function parsePayload(payload: any): Aggregate[] {
  let items: any[] = [];
  if (Array.isArray(payload)) items = payload;
  else if (Array.isArray(payload?.parrainages)) items = payload.parrainages;
  else if (Array.isArray(payload?.data)) items = payload.data;

  // The 2022 file is one row per signing mayor; we count by `Candidat`
  // ("NOM Prénom"). Be permissive on field name in case the 2027
  // schema evolves.
  const totals = new Map<string, number>();
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const raw = String(
      it.Candidat ?? it.candidat ?? it.beneficiaire ?? "",
    ).trim();
    if (!raw) continue;
    // Sometimes the source already provides a numeric NombreParrainages
    // (per-candidate aggregate file). Honour it if present, otherwise
    // we're counting one signature per row.
    const incr = Number(
      it.NombreParrainages ?? it.nombreParrainages ?? it.total ?? it.count ?? 1,
    );
    if (Number.isNaN(incr) || incr < 0) continue;
    totals.set(raw, (totals.get(raw) ?? 0) + incr);
  }
  return [...totals.entries()].map(([source_name, total]) => ({ source_name, total }));
}

interface CandidateRow {
  id: string;
  first_name: string;
  last_name: string;
  candidate_aliases?: { alias: string }[];
}

function matchCandidate(rawName: string, candidates: CandidateRow[]): string | null {
  // Format from source is "NOM Prénom" (uppercase last name first).
  // Build several lookup keys on the candidate side and try in order.
  const fullKey = norm(rawName);
  if (!fullKey) return null;
  const tokens = fullKey.split(" ").filter(Boolean);
  const firstToken = tokens[0];

  for (const c of candidates) {
    const candidateFull = norm(`${c.last_name} ${c.first_name}`);
    const candidateRev = norm(`${c.first_name} ${c.last_name}`);
    if (candidateFull === fullKey || candidateRev === fullKey) return c.id;
  }
  for (const c of candidates) {
    if (norm(c.last_name) === firstToken) return c.id;
  }
  for (const c of candidates) {
    for (const a of (c.candidate_aliases ?? [])) {
      const ak = norm(a.alias);
      if (ak && (ak === fullKey || ak === firstToken)) return c.id;
    }
  }
  return null;
}

Deno.serve(async (_req) => {
  const { data: cfg } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "parrainages.source")
    .maybeSingle();
  const source = (cfg?.value as any) ?? null;

  if (!source?.url) {
    return Response.json({ error: "no parrainages.source configured" }, { status: 400 });
  }
  if (source.is_available !== true) {
    return Response.json({ skipped: true, note: "parrainages.source.is_available=false" });
  }

  let payload: any;
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": "CAP2027/1.0 (civic-tech aggregator; +https://cap2027.app)",
        "Accept": "application/json",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    payload = await res.json();
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }

  const aggregates = parsePayload(payload);
  if (aggregates.length === 0) {
    return Response.json({ inserted: 0, note: "parser found no rows in payload" });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Wipe today's snapshot first so a previous broken run (one row per
  // mayor with total=1) doesn't leak into the corrected aggregates.
  await supabase.from("parrainages").delete().eq("snapshot_date", today);

  const { data: cands } = await supabase
    .from("candidates")
    .select("id, first_name, last_name, candidate_aliases:candidate_aliases(alias)");
  const candidates = (cands ?? []) as CandidateRow[];

  let inserted = 0, matched = 0;
  for (const entry of aggregates) {
    const candidateId = matchCandidate(entry.source_name, candidates);
    if (candidateId) matched++;
    const { error } = await supabase
      .from("parrainages")
      .upsert(
        {
          source_name: entry.source_name,
          total: entry.total,
          snapshot_date: today,
          candidate_id: candidateId,
        },
        { onConflict: "source_name,snapshot_date" },
      );
    if (!error) inserted++;
  }

  return Response.json({
    inserted,
    matched,
    total_aggregated_rows: aggregates.length,
    snapshot_date: today,
  });
});
