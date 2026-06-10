import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAppConfig, type ElectionRound } from '../lib/appConfig';

function diffDays(targetMs: number, nowMs: number) {
  return Math.ceil((targetMs - nowMs) / 86_400_000);
}

function diffMonths(targetMs: number, nowMs: number) {
  // Calendar-month delta, more meaningful than dividing by 30 d.
  const target = new Date(targetMs);
  const now = new Date(nowMs);
  let m =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  if (target.getDate() < now.getDate()) m -= 1;
  return Math.max(0, m);
}

function formatHMS(remainingMs: number) {
  const h = Math.max(0, Math.floor(remainingMs / 3_600_000));
  const m = Math.max(0, Math.floor((remainingMs % 3_600_000) / 60_000));
  const s = Math.max(0, Math.floor((remainingMs % 60_000) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function CountdownBanner() {
  const [now, setNow] = useState(Date.now());
  const { data: cfg } = useAppConfig();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Election-day reminders are now scheduled server-side via pg_cron
  // jobs that fire exact-time POSTs to the dispatch-election-reminders
  // edge function (see migration 20260514_election_reminders_scheduler).
  // No local LocalNotifications scheduling here anymore — the FCM
  // path is more reliable for users who don't reopen the app daily.

  const text = computeBannerText(now, cfg?.['election.round1'], cfg?.['election.round2']);

  return (
    <div
      className="bg-[#102a5c] text-white flex items-center justify-center gap-1.5 sm:gap-2 pt-1 pb-1.5 px-3 sm:pt-1.5 sm:pb-2 sm:px-4 rounded-br-2xl shadow-sm text-[10px] sm:text-xs font-medium w-max opacity-95 transition-opacity hover:opacity-100"
      aria-live="polite"
    >
      <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white/80 shrink-0" />
      <span className="tracking-wide tracking-[0.01em]">{text}</span>
    </div>
  );
}

// Estimation utilisée tant que la date n'est pas saisie officiellement.
// Premier tour de la présidentielle française : traditionnellement
// l'avant-dernier dimanche d'avril. 2027 → 11 avril. Bureaux 8 h Paris
// soit 06:00 UTC en avril (CEST = UTC+2).
const ESTIMATED_R1_MS = Date.UTC(2027, 3, 11, 6, 0, 0);
const ESTIMATED_R2_MS = Date.UTC(2027, 3, 25, 6, 0, 0);

function approxOffset(targetMs: number, nowMs: number): string {
  // "~X mois", "~X semaines", "~X jours". Bascule à 30 j / 7 j.
  const dayMs = 86_400_000;
  const days = Math.max(0, Math.ceil((targetMs - nowMs) / dayMs));
  if (days >= 30) {
    const months = diffMonths(targetMs, nowMs);
    return `~${months} mois`;
  }
  if (days >= 7) return `~${Math.round(days / 7)} semaines`;
  return `~${days} j`;
}

function computeBannerText(
  nowMs: number,
  r1?: ElectionRound,
  r2?: ElectionRound,
): string {
  // Cas où rien (ou seulement r2) n'est saisi : on bascule sur une
  // estimation traditionnelle d'avril 2027 pour avoir un compte à
  // rebours utile dès la sortie de l'app.
  const r1Start = r1 ? new Date(r1.scheduled_at).getTime() : ESTIMATED_R1_MS;
  const r1End   = r1 ? new Date(r1.results_at).getTime()   : Number.POSITIVE_INFINITY;
  const r2Start = r2 ? new Date(r2.scheduled_at).getTime() : ESTIMATED_R2_MS;
  const r2End   = r2 ? new Date(r2.results_at).getTime()   : Number.POSITIVE_INFINITY;

  const r1Official = r1?.is_official === true;
  const r2Official = r2?.is_official === true;

  if (nowMs < r1Start) {
    if (r1Official) return `J-${diffDays(r1Start, nowMs)} avant le 1er tour`;
    return `${approxOffset(r1Start, nowMs)} avant le 1er tour (date estimée)`;
  }
  if (nowMs < r1End) {
    return `${formatHMS(r1End - nowMs)} avant les résultats du 1er tour`;
  }
  if (nowMs < r2Start) {
    if (r2Official) return `J-${diffDays(r2Start, nowMs)} avant le 2nd tour`;
    return `${approxOffset(r2Start, nowMs)} avant le 2nd tour (date estimée)`;
  }
  if (nowMs < r2End) {
    return `${formatHMS(r2End - nowMs)} avant les résultats finaux`;
  }
  return 'Élection terminée';
}
