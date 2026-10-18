// Import d'un export Demos Kratos (fichier programmes ou match) dans les
// tables dk_*, via la RPC dk_import : vérification du format, puis
// remplacement complet en une transaction si le contentHash a changé.
// Appelée par le workflow quotidien du dépôt public aciderix/cap2027-privacy
// (demos-kratos-check.yml), qui récupère l'export en FTPS.
//
// POST /functions/v1/ingest-demos-kratos?file=<nom du fichier>
// Headers:  X-Ingest-Token: <INGEST_FROM_XML_TOKEN>  (même jeton que ingest-from-xml)
// Body:     le JSON de l'export, tel quel (~5 Mo pour le fichier programmes)
//
// La fonction n'expose que dk_import : le workflow n'a pas besoin de la clé
// service role, qui n'a pas sa place dans les secrets d'un dépôt public.
//
// Après l'import d'un fichier match qui ajoute des affirmations ou des
// candidats, envoie la notification « Le Match s'enrichit » (canal « Mises à
// jour candidats »), si app_config['match.notify'].enabled est vrai.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INGEST_TOKEN = Deno.env.get("INGEST_FROM_XML_TOKEN");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Noms déposés par Demos Kratos : horodatage UTC, deux-points remplacés par
// des tirets (README de l'export).
const FILE_RE = /^demos-kratos-(programmes|match)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.json$/;

interface MatchSnapshot { statements: Set<string>; candidates: Set<string> }

async function matchSnapshot(): Promise<MatchSnapshot> {
  const [st, ca] = await Promise.all([
    supabase.from("dk_match_statements").select("id"),
    supabase.from("dk_match_candidates").select("id"),
  ]);
  return {
    statements: new Set((st.data ?? []).map((r) => r.id as string)),
    candidates: new Set((ca.data ?? []).map((r) => r.id as string)),
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Annonce les nouveautés du Match ; renvoie ce qui a été envoyé (ou pourquoi rien). */
async function notifyMatchUpdate(before: MatchSnapshot): Promise<Record<string, unknown>> {
  const { data: cfg } = await supabase.from("app_config").select("value").eq("key", "match.notify").maybeSingle();
  // Interrupteur dans l'admin (Config app) : à activer une fois publiée la
  // version de l'app qui affiche le Match Demos Kratos.
  if (!(cfg?.value as { enabled?: boolean } | null)?.enabled) return { notified: false, reason: "disabled" };
  // Premier import : rien de « nouveau » à annoncer.
  if (before.statements.size === 0) return { notified: false, reason: "first_import" };

  const after = await matchSnapshot();
  const newStatements = [...after.statements].filter((id) => !before.statements.has(id)).length;
  const newCandidates = [...after.candidates].filter((id) => !before.candidates.has(id)).length;
  if (newStatements === 0 && newCandidates === 0) return { notified: false, reason: "nothing_new" };

  const parts: string[] = [];
  if (newStatements > 0) parts.push(plural(newStatements, "nouvelle affirmation", "nouvelles affirmations"));
  if (newCandidates > 0) parts.push(plural(newCandidates, "nouveau candidat", "nouveaux candidats"));
  const r = await fetch(`${SUPABASE_URL}/functions/v1/push-broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({
      title: "Le Match s'enrichit",
      body: `${parts.join(" et ")} à découvrir dans CAP 2027.`,
      // Type existant : canal « Mises à jour candidats », et l'app recharge le Match.
      type: "match_proposition_change",
    }),
  });
  return { notified: r.ok, newStatements, newCandidates, status: r.status };
}

Deno.serve(async (req) => {
  if (!INGEST_TOKEN) {
    return Response.json({ error: "INGEST_FROM_XML_TOKEN secret not set" }, { status: 503 });
  }
  if (req.headers.get("x-ingest-token") !== INGEST_TOKEN) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  const file = new URL(req.url).searchParams.get("file") ?? "";
  const kind = FILE_RE.exec(file)?.[1];
  if (!kind) {
    return Response.json({ error: "missing or invalid ?file=" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch (e) {
    return Response.json({ error: "invalid JSON", detail: String((e as Error)?.message ?? e) }, { status: 400 });
  }

  const before = kind === "match" ? await matchSnapshot() : null;
  const { data, error } = await supabase.rpc("dk_import", { p_payload: payload, p_file_name: file });
  if (error) {
    // Export refusé (format, version, compteurs…) : rien n'a été modifié.
    return Response.json({ error: error.message }, { status: 422 });
  }
  if (before && !(data as { skipped?: boolean } | null)?.skipped) {
    // Une notification ratée ne doit pas faire échouer un import réussi.
    const notification = await notifyMatchUpdate(before).catch((e) => ({ notified: false, error: String(e) }));
    return Response.json({ ...(data as Record<string, unknown>), notification });
  }
  return Response.json(data);
});
