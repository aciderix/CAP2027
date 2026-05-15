// Server-side election-day reminder dispatcher. Invoked by pg_cron at
// the exact UTC instant computed from app_config.election.round{1,2}
// in Europe/Paris (see migration 20260514_election_reminders_scheduler).
//
// URL params:
//   ?milestone=eve|day|results|inscription|proc_3w|proc_1w|boussole_30
//   &round=1|2
//
// Idempotent: each milestone is recorded in election_reminders_sent so
// a cron retry within the same window won't double-fire.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Milestone =
  | "eve" | "day" | "results"
  | "inscription"
  | "proc_3w" | "proc_1w"
  | "boussole_30";

interface Notif { title: string; body: string }

// Pure civic / neutral wording — see lib/electionReminders.ts for the
// legal rationale (art. L49 du code électoral).
function buildNotif(milestone: Milestone, round: 1 | 2): Notif | null {
  const tour = round === 1 ? "1er" : "2nd";
  switch (milestone) {
    case "eve":
      return {
        title: `Présidentielle 2027 — ${tour} tour demain`,
        body: "Demain, jour du scrutin. Bureaux de vote ouverts de 8 h à 20 h (22 h dans certaines communes). Pensez à votre pièce d'identité.",
      };
    case "day":
      return {
        title: `C'est aujourd'hui — ${tour} tour de la présidentielle`,
        body: "Les bureaux de vote sont ouverts. Munissez-vous d'une pièce d'identité.",
      };
    case "results":
      return {
        title: `Résultats du ${tour} tour disponibles`,
        body: "Les premières estimations sont publiées. Ouvrez CAP 2027 pour les consulter.",
      };
    case "inscription":
      // Only sent for round 1 — one inscription covers both rounds.
      if (round !== 1) return null;
      return {
        title: "Listes électorales : 6 semaines pour vous inscrire",
        body: "Vous avez déménagé, ou vous votez pour la première fois ? Vérifiez votre situation et inscrivez-vous sur service-public.fr avant la fermeture des listes.",
      };
    case "proc_3w":
      return {
        title: `Procuration — plus que 3 semaines avant le ${tour} tour`,
        body: "Pas disponible le jour du vote ? Faites votre procuration en ligne sur maprocuration.gouv.fr (validation en commissariat ou via France Identité).",
      };
    case "proc_1w":
      return {
        title: `Procuration — dernière ligne droite avant le ${tour} tour`,
        body: "Si vous serez absent dimanche, donnez procuration à un autre électeur sur maprocuration.gouv.fr. Compter quelques jours d'instruction.",
      };
    case "boussole_30":
      if (round !== 1) return null;
      return {
        title: "Plus que 30 jours avant le 1er tour",
        body: "Avez-vous fait le test de la Boussole ? Quelques minutes pour découvrir avec quels candidats vous êtes le plus en accord, sans citer aucun nom pendant les questions.",
      };
  }
}

const MILESTONES: ReadonlySet<Milestone> = new Set([
  "eve", "day", "results", "inscription", "proc_3w", "proc_1w", "boussole_30",
]);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const milestone = url.searchParams.get("milestone") as Milestone | null;
  const roundRaw = url.searchParams.get("round");
  const round = roundRaw === "1" ? 1 : roundRaw === "2" ? 2 : null;
  const dryRun = url.searchParams.get("dry") === "1";

  if (!milestone || !MILESTONES.has(milestone) || !round) {
    return Response.json({ error: "missing or invalid ?milestone= and/or ?round=" }, { status: 400 });
  }

  const notif = buildNotif(milestone, round as 1 | 2);
  if (!notif) {
    return Response.json({ skipped: true, reason: "milestone not applicable to this round", milestone, round });
  }

  const milestoneKey = `r${round}_${milestone}`;

  // Idempotency: if already fired, skip.
  const { data: existing } = await supabase
    .from("election_reminders_sent")
    .select("milestone_key")
    .eq("milestone_key", milestoneKey)
    .maybeSingle();
  if (existing) {
    return Response.json({ skipped: true, reason: "already sent", milestoneKey });
  }

  if (dryRun) {
    return Response.json({ would_send: notif, milestoneKey });
  }

  // Mark sent BEFORE calling push-broadcast so a slow/failed broadcast
  // doesn't lead to duplicate notifs on cron retry. We accept the
  // (rare) risk of a missed notif if push-broadcast crashes.
  const { error: insErr } = await supabase
    .from("election_reminders_sent")
    .insert({ milestone_key: milestoneKey });
  if (insErr && !String(insErr.message).includes("duplicate")) {
    return Response.json({ error: "sent-log insert: " + insErr.message }, { status: 500 });
  }

  const r = await fetch(`${SUPABASE_URL}/functions/v1/push-broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ ...notif, type: "election_milestone" }),
  });

  let broadcastResult: any = null;
  try { broadcastResult = await r.json(); } catch { /* ignore */ }

  return Response.json({
    milestoneKey,
    title: notif.title,
    sent: broadcastResult?.sent ?? null,
    failed: broadcastResult?.failed ?? null,
    broadcast_status: r.status,
  });
});
