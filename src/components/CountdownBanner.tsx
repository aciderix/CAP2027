import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAppConfig, type ElectionRound } from '../lib/appConfig';
import { scheduleElectionReminders } from '../lib/electionReminders';

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

  // Schedule J-1, J-day and result-time local notifications. Idempotent:
  // stable IDs, so re-scheduling on every render does NOT spam the user.
  const r1Sched = cfg?.['election.round1']?.scheduled_at;
  const r2Sched = cfg?.['election.round2']?.scheduled_at;
  const r1Off = cfg?.['election.round1']?.is_official;
  const r2Off = cfg?.['election.round2']?.is_official;
  useEffect(() => {
    if (!cfg) return;
    const round1 = cfg['election.round1'];
    const round2 = cfg['election.round2'];
    if (round1 || round2) {
      void scheduleElectionReminders({ round1, round2 });
    }
  }, [cfg, r1Sched, r2Sched, r1Off, r2Off]);

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

function computeBannerText(
  nowMs: number,
  r1?: ElectionRound,
  r2?: ElectionRound,
): string {
  if (!r1 && !r2) return 'Présidentielle 2027';

  const r1Start = r1 ? new Date(r1.scheduled_at).getTime() : Infinity;
  const r1End   = r1 ? new Date(r1.results_at).getTime()   : Infinity;
  const r2Start = r2 ? new Date(r2.scheduled_at).getTime() : Infinity;
  const r2End   = r2 ? new Date(r2.results_at).getTime()   : Infinity;

  const r1Official = r1?.is_official === true;
  const r2Official = r2?.is_official === true;

  if (nowMs < r1Start) {
    if (r1Official) return `J-${diffDays(r1Start, nowMs)} avant le 1er tour`;
    const months = diffMonths(r1Start, nowMs);
    if (months <= 0) return 'Présidentielle 2027 — date à confirmer';
    return `~${months} mois avant le 1er tour (estimé)`;
  }
  if (nowMs < r1End) {
    return `${formatHMS(r1End - nowMs)} avant les résultats du 1er tour`;
  }
  if (nowMs < r2Start) {
    if (r2Official) return `J-${diffDays(r2Start, nowMs)} avant le 2nd tour`;
    const days = diffDays(r2Start, nowMs);
    return `~${days} j avant le 2nd tour (estimé)`;
  }
  if (nowMs < r2End) {
    return `${formatHMS(r2End - nowMs)} avant les résultats finaux`;
  }
  return 'Élection terminée';
}
