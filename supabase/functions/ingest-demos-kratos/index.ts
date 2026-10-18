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
  if (!FILE_RE.test(file)) {
    return Response.json({ error: "missing or invalid ?file=" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch (e) {
    return Response.json({ error: "invalid JSON", detail: String((e as Error)?.message ?? e) }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("dk_import", { p_payload: payload, p_file_name: file });
  if (error) {
    // Export refusé (format, version, compteurs…) : rien n'a été modifié.
    return Response.json({ error: error.message }, { status: 422 });
  }
  return Response.json(data);
});
