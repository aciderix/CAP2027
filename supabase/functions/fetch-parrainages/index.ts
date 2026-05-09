// Daily fetch of the "parrainages" (signatures) collected for each
// candidate at the Conseil constitutionnel. The 2022 endpoint shape was:
//   https://presidentielle2022.conseil-constitutionnel.fr/telechargement/parrainagestotal.json
// The 2027 endpoint may follow the same convention; the URL is read
// from app_config so it can be updated when the official URL goes live.
//
// On invocation we:
//   1. read app_config['parrainages.source'] to know if active + URL
//   2. fetch the JSON
//   3. normalise (the 2022 file used { parrainages: [{ Civilite, Nom,
//      Prenom, NombreParrainages }] })
//   4. upsert today's snapshot into public.parrainages
//   5. attempt to attach to candidates by name match (case + accent
//      insensitive); leave candidate_id null if no match.

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
  return stripAccents(String(s ?? "").toLowerCase()).replace(/[^a-z]+/g, " ").trim();
}

interface ParrainagesEntry {
  source_name: string;
  total: number;
}

function parsePayload(payload: any): ParrainagesEntry[] {
  // 2022 shape: { parrainages: [{ Civilite, Nom, Prenom, NombreParrainages }] }
  // Be permissive: accept any array of objects with parsable fields.
  let items: any[] = [];
  if (Array.isArray(payload)) items = payload;
  else if (Array.isArray(payload?.parrainages)) items = payload.parrainages;
  else if (Array.isArray(payload?.data)) items = payload.data;

  // Aggregate by candidate name in case the source lists individual
  // parrains rather than totals.
  const totals = new Map<string, number>();
  for (const it of items) {
    const first = it.Prenom ?? it.prenom ?? it.first_name ?? "";
    const last = it.Nom ?? it.nom ?? it.last_name ?? "";
    const name = `${first} ${last}`.trim();
    if (!name) continue;
    const total = Number(
      it.NombreParrainages ?? it.nombreParrainages ?? it.total ?? it.count ?? 1,
    );
    if (Number.isNaN(total)) continue;
    totals.set(name, (totals.get(name) ?? 0) + total);
  }
  return [...totals.entries()].map(([source_name, total]) => ({ source_name, total }));
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

  const entries = parsePayload(payload);
  if (entries.length === 0) {
    return Response.json({ inserted: 0, note: "parser found no rows in payload" });
  }

  // Pre-load candidates for name matching.
  const { data: cands } = await supabase
    .from("candidates")
    .select("id, first_name, last_name, candidate_aliases:candidate_aliases(alias)");
  const candByKey = new Map<string, string>();
  for (const c of (cands ?? []) as any[]) {
    const fullKey = norm(`${c.first_name} ${c.last_name}`);
    if (fullKey) candByKey.set(fullKey, c.id);
    const lastKey = norm(c.last_name);
    if (lastKey && !candByKey.has(lastKey)) candByKey.set(lastKey, c.id);
    for (const a of (c.candidate_aliases ?? []) as any[]) {
      const k = norm(a.alias);
      if (k && !candByKey.has(k)) candByKey.set(k, c.id);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0, matched = 0;
  for (const entry of entries) {
    const candidateId =
      candByKey.get(norm(entry.source_name)) ??
      candByKey.get(norm(entry.source_name.split(" ").slice(-1).join(" "))) ??
      null;
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

  return Response.json({ inserted, matched, total_rows: entries.length, snapshot_date: today });
});
