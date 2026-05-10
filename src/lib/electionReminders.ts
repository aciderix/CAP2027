// Schedules local OS reminders for election day. We use stable
// notification IDs so this can be called every render without
// stacking duplicates (Capacitor's `schedule` upserts by id).
//
// Three families of reminders:
//   1. Election day milestones — eve at 18 h, J-day at 8 h,
//      results at the configured `results_at` timestamp.
//   2. Civic reminders — inscription électorale deadline (J-6 sem
//      before R1), procuration reminders (J-3 sem and J-1 sem
//      before each round).
//   3. Boussole — single reminder J-30 before R1 nudging the user
//      to take the Match test.
//
// Legal note on French silence électoral (art. L49 du code électoral):
// la loi interdit la diffusion de tout message ayant le caractère de
// PROPAGANDE électorale à partir de la veille du scrutin à zéro heure.
// Tous les rappels que nous envoyons sont strictement civiques et
// neutres ("Demain, élection présidentielle, bureaux ouverts de 8 h
// à 20 h"), sans citer de candidat ni d'opinion. Pour les rappels
// d'inscription / procuration, ils sont équivalents aux SMS envoyés
// par certaines mairies. Le rappel Boussole évite le J-1 / J-day
// pour ne pas interférer avec la période de silence (J-30, donc
// largement avant).
//
// Toute mention de candidat, d'orientation ou d'incitation au vote
// pour un camp est interdite ici.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  getNotificationsEnabled,
} from './notifications';
import type { ElectionRound } from './appConfig';

const SMALL_ICON = 'ic_stat_cap2027';
const LARGE_ICON = 'ic_notif_cap2027';
const ICON_COLOR = '#102a5c';

interface RoundReminders {
  round1?: ElectionRound;
  round2?: ElectionRound;
}

// All civic / election notifs target French presidential election times,
// which always reference Europe/Paris regardless of where the user is.
// (A French expat voting at the embassy in Tokyo doesn't want to be
// woken at 8 h Tokyo for a French scrutin.) We compute the absolute UTC
// instant that corresponds to a given wall-clock hour in Paris on a
// given calendar date.
const PARIS_TZ = 'Europe/Paris';

function parisOffsetMs(forUtc: number): number {
  // Use Intl.DateTimeFormat to read the Paris-local hour for `forUtc`,
  // then derive the offset (handles CET/CEST transitions automatically).
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: PARIS_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(forUtc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  // "Wall clock" in Paris reinterpreted as if it were UTC.
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asIfUtc - forUtc;
}

/**
 * Returns a Date for a wall-clock instant (year, month, day, hour) in
 * Europe/Paris. Always correct under DST.
 */
function parisDate(year: number, month: number, day: number, hour: number, minute = 0): Date {
  // First guess: treat as if Paris were UTC, compute offset, correct.
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = parisOffsetMs(guess);
  // Second pass for DST edge cases.
  const off2 = parisOffsetMs(guess - off1);
  return new Date(guess - off2);
}

function dateInParis(absMs: number): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: PARIS_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date(absMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day') };
}

function addDaysParis(absMs: number, days: number): { year: number; month: number; day: number } {
  // Calendar arithmetic in Paris timezone — just shift by N days from
  // the Paris-local date of `absMs`.
  const { year, month, day } = dateInParis(absMs);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * Stable IDs per round/event so re-scheduling never duplicates notifs.
 * Range chosen well above NotificationsBell's incrementing ID counter.
 *
 *   1_000_xxx — election day milestones (R1 + R2)
 *   1_100_xxx — civic reminders (inscription + procuration)
 *   1_200_xxx — Boussole nudge (one-shot J-30)
 *   1_300_xxx — recurring weekly nudges (campaign period: 2027 onwards)
 */
const IDS = {
  // 1. Election day
  r1Eve: 1_000_001,
  r1Day: 1_000_002,
  r1Res: 1_000_003,
  r2Eve: 1_000_004,
  r2Day: 1_000_005,
  r2Res: 1_000_006,
  // 2. Civic
  inscription: 1_100_001,        // J-6 sem before R1, applies to both rounds
  procurationR1Eve3w: 1_100_002, // J-3 sem before R1
  procurationR1Eve1w: 1_100_003, // J-1 sem before R1
  procurationR2Eve3w: 1_100_004, // J-3 sem before R2
  procurationR2Eve1w: 1_100_005, // J-1 sem before R2
  // 3. Boussole (one-shot)
  boussoleR1J30: 1_200_001,      // J-30 before R1
  // 4. Weekly nudges — pre-scheduled to start in early 2027 and repeat
  //    weekly through the election. OS picks them up via AlarmManager
  //    even with the app killed.
  weeklyVoterToolkit: 1_300_001, // Mondays 10 h Paris
  weeklyBoussole:     1_300_002, // Wednesdays 11 h Paris
  weeklyProgrammes:   1_300_003, // Fridays 10 h Paris
};

const WEEKLY_START_YEAR = 2027;
const WEEKLY_START_MONTH = 1; // January
const WEEKLY_START_DAY = 1;   // first occurrence onwards from Jan 1

/** Returns the next Paris-local instance of a given weekday (1=Mon … 7=Sun)
 *  at the given hour, starting from the configured WEEKLY_START date. */
function firstWeeklyOccurrence(targetIsoWeekday: number, hour: number): Date {
  const startTime = parisDate(WEEKLY_START_YEAR, WEEKLY_START_MONTH, WEEKLY_START_DAY, hour).getTime();
  // Find the first matching weekday on or after the start date.
  let cursor = startTime;
  for (let i = 0; i < 7; i++) {
    const d = new Date(cursor);
    // Date.getUTCDay returns 0=Sun..6=Sat; convert to ISO 1=Mon..7=Sun.
    const isoWeekday = ((d.getUTCDay() + 6) % 7) + 1;
    if (isoWeekday === targetIsoWeekday) {
      // Re-anchor to the right wall-clock hour for that Paris day.
      const { year, month, day } = dateInParis(cursor);
      return parisDate(year, month, day, hour);
    }
    cursor += DAY_MS;
  }
  return new Date(startTime);
}

const ALL_IDS = Object.values(IDS);

const DAY_MS = 86_400_000;

/** A given hour (Paris wall-clock) on the Paris-calendar day of `base`. */
function atParisHour(base: Date, hour: number): Date {
  const { year, month, day } = dateInParis(base.getTime());
  return parisDate(year, month, day, hour);
}

/** A given hour (Paris wall-clock) N days offset from `base` (Paris calendar). */
function atParisHourOffset(base: Date, days: number, hour: number): Date {
  const { year, month, day } = addDaysParis(base.getTime(), days);
  return parisDate(year, month, day, hour);
}

export async function scheduleElectionReminders(rounds: RoundReminders) {
  if (!Capacitor.isNativePlatform()) return;
  if (!getNotificationsEnabled()) return;

  // Only schedule if the system permission is granted; we don't
  // re-prompt here (Settings is responsible for that).
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;
  } catch {
    return;
  }

  // Always start by clearing our previous reminders so that a date
  // change in the DB cleanly replaces old ones.
  try {
    await LocalNotifications.cancel({ notifications: ALL_IDS.map((id) => ({ id })) });
  } catch {
    // ignore — first scheduling
  }

  const now = Date.now();
  const toSchedule: any[] = [];

  // ---------- 1. Election day milestones (per round) ----------

  const buildRoundMilestones = (
    round: ElectionRound | undefined,
    label: '1er' | '2nd',
    ids: { eve: number; day: number; res: number },
  ) => {
    if (!round || !round.is_official) return;

    const start = new Date(round.scheduled_at).getTime();
    const results = new Date(round.results_at).getTime();
    if (Number.isNaN(start) || Number.isNaN(results)) return;

    // Eve at 18 h Paris of the day before the election.
    const eveAt = atParisHourOffset(new Date(start), -1, 18).getTime();

    // J-day at 8 h Paris (poll opening).
    const dayAt = atParisHour(new Date(start), 8).getTime();

    if (eveAt > now) {
      toSchedule.push({
        id: ids.eve,
        title: `Présidentielle 2027 — ${label} tour demain`,
        body: 'Demain, jour du scrutin. Bureaux de vote ouverts de 8 h à 20 h (22 h dans certaines communes). Pensez à votre pièce d\'identité.',
        smallIcon: SMALL_ICON,
        largeIcon: LARGE_ICON,
        iconColor: ICON_COLOR,
        schedule: { at: new Date(eveAt) },
      });
    }
    if (dayAt > now) {
      toSchedule.push({
        id: ids.day,
        title: `C'est aujourd'hui — ${label} tour de la présidentielle`,
        body: 'Les bureaux de vote sont ouverts. Munissez-vous d\'une pièce d\'identité.',
        smallIcon: SMALL_ICON,
        largeIcon: LARGE_ICON,
        iconColor: ICON_COLOR,
        schedule: { at: new Date(dayAt) },
      });
    }
    if (results > now) {
      toSchedule.push({
        id: ids.res,
        title: `Résultats du ${label} tour disponibles`,
        body: 'Les premières estimations sont publiées. Ouvrez CAP 2027 pour les consulter.',
        smallIcon: SMALL_ICON,
        largeIcon: LARGE_ICON,
        iconColor: ICON_COLOR,
        schedule: { at: new Date(results) },
      });
    }
  };

  buildRoundMilestones(rounds.round1, '1er', { eve: IDS.r1Eve, day: IDS.r1Day, res: IDS.r1Res });
  buildRoundMilestones(rounds.round2, '2nd', { eve: IDS.r2Eve, day: IDS.r2Day, res: IDS.r2Res });

  // ---------- 2. Civic reminders (R1 only for inscription, both for procuration) ----------

  const r1 = rounds.round1;
  if (r1 && r1.is_official) {
    const r1Start = new Date(r1.scheduled_at).getTime();
    if (!Number.isNaN(r1Start)) {
      // Inscription: 6 weeks before R1, fires at 10 h Paris.
      // The legal deadline applies to both rounds (one inscription
      // covers everything), so a single reminder is enough.
      const inscriptionAt = atParisHourOffset(new Date(r1Start), -42, 10).getTime();
      if (inscriptionAt > now) {
        toSchedule.push({
          id: IDS.inscription,
          title: 'Listes électorales : 6 semaines pour vous inscrire',
          body: "Vous avez déménagé, ou vous votez pour la première fois ? Vérifiez votre situation et inscrivez-vous sur service-public.fr avant la fermeture des listes.",
          smallIcon: SMALL_ICON,
          largeIcon: LARGE_ICON,
          iconColor: ICON_COLOR,
          schedule: { at: new Date(inscriptionAt) },
        });
      }

      // Procuration R1 — 3 sem et 1 sem avant, à 10 h Paris.
      const procR1_3w = atParisHourOffset(new Date(r1Start), -21, 10).getTime();
      const procR1_1w = atParisHourOffset(new Date(r1Start), -7, 10).getTime();
      if (procR1_3w > now) {
        toSchedule.push({
          id: IDS.procurationR1Eve3w,
          title: 'Procuration — plus que 3 semaines avant le 1er tour',
          body: "Pas disponible le jour du vote ? Faites votre procuration en ligne sur maprocuration.gouv.fr (validation en commissariat ou via France Identité).",
          smallIcon: SMALL_ICON,
          largeIcon: LARGE_ICON,
          iconColor: ICON_COLOR,
          schedule: { at: new Date(procR1_3w) },
        });
      }
      if (procR1_1w > now) {
        toSchedule.push({
          id: IDS.procurationR1Eve1w,
          title: 'Procuration — dernière ligne droite avant le 1er tour',
          body: "Si vous serez absent dimanche, donnez procuration à un autre électeur sur maprocuration.gouv.fr. Compter quelques jours d'instruction.",
          smallIcon: SMALL_ICON,
          largeIcon: LARGE_ICON,
          iconColor: ICON_COLOR,
          schedule: { at: new Date(procR1_1w) },
        });
      }
    }
  }

  const r2 = rounds.round2;
  if (r2 && r2.is_official) {
    const r2Start = new Date(r2.scheduled_at).getTime();
    if (!Number.isNaN(r2Start)) {
      const procR2_3w = atParisHourOffset(new Date(r2Start), -21, 10).getTime();
      const procR2_1w = atParisHourOffset(new Date(r2Start), -7, 10).getTime();
      if (procR2_3w > now) {
        toSchedule.push({
          id: IDS.procurationR2Eve3w,
          title: 'Procuration — plus que 3 semaines avant le 2nd tour',
          body: "Pas disponible le jour du vote ? Faites votre procuration en ligne sur maprocuration.gouv.fr (validation en commissariat ou via France Identité).",
          smallIcon: SMALL_ICON,
          largeIcon: LARGE_ICON,
          iconColor: ICON_COLOR,
          schedule: { at: new Date(procR2_3w) },
        });
      }
      if (procR2_1w > now) {
        toSchedule.push({
          id: IDS.procurationR2Eve1w,
          title: 'Procuration — dernière ligne droite avant le 2nd tour',
          body: "Si vous serez absent dimanche, donnez procuration à un autre électeur sur maprocuration.gouv.fr. Compter quelques jours d'instruction.",
          smallIcon: SMALL_ICON,
          largeIcon: LARGE_ICON,
          iconColor: ICON_COLOR,
          schedule: { at: new Date(procR2_1w) },
        });
      }
    }
  }

  // ---------- 3. Boussole — J-30 before R1 ----------

  if (r1 && r1.is_official) {
    const r1Start = new Date(r1.scheduled_at).getTime();
    if (!Number.isNaN(r1Start)) {
      // 11 h Paris — outside work peak, before lunch.
      const boussoleAt = atParisHourOffset(new Date(r1Start), -30, 11).getTime();
      if (boussoleAt > now) {
        toSchedule.push({
          id: IDS.boussoleR1J30,
          title: 'Plus que 30 jours avant le 1er tour',
          body: "Avez-vous fait le test de la Boussole ? Quelques minutes pour découvrir avec quels candidats vous êtes le plus en accord, sans citer aucun nom pendant les questions.",
          smallIcon: SMALL_ICON,
          largeIcon: LARGE_ICON,
          iconColor: ICON_COLOR,
          schedule: { at: new Date(boussoleAt) },
        });
      }
    }
  }

  // ---------- 4. Weekly recurring civic nudges (campaign period) ----------
  //
  // Three soft reminders rotate across the week, scheduled with the
  // OS plugin's `repeats: true / every: 'week'` so AlarmManager keeps
  // firing them without us re-scheduling. We anchor the first
  // occurrence to the first matching weekday on or after Jan 1, 2027
  // — earlier than that and they'd start firing right away in dev.

  const weeklyMonday = firstWeeklyOccurrence(1, 10).getTime();
  const weeklyWednesday = firstWeeklyOccurrence(3, 11).getTime();
  const weeklyFriday = firstWeeklyOccurrence(5, 10).getTime();

  if (weeklyMonday > now) {
    toSchedule.push({
      id: IDS.weeklyVoterToolkit,
      title: 'Préparez votre vote',
      body: "Inscription sur les listes, procuration, comment voter — tout pour passer du fauteuil au bureau de vote en quelques minutes.",
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
      iconColor: ICON_COLOR,
      schedule: { at: new Date(weeklyMonday), repeats: true, every: 'week' },
    });
  }
  if (weeklyWednesday > now) {
    toSchedule.push({
      id: IDS.weeklyBoussole,
      title: 'Faites le test de la Boussole',
      body: "Quelques minutes pour découvrir avec quels candidats vous êtes le plus en accord, sans citer aucun nom pendant les questions.",
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
      iconColor: ICON_COLOR,
      schedule: { at: new Date(weeklyWednesday), repeats: true, every: 'week' },
    });
  }
  if (weeklyFriday > now) {
    toSchedule.push({
      id: IDS.weeklyProgrammes,
      title: 'Comparez les programmes',
      body: "Économie, écologie, sécurité, social… Lisez et opposez les propositions des candidats sur les thématiques qui vous concernent.",
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
      iconColor: ICON_COLOR,
      schedule: { at: new Date(weeklyFriday), repeats: true, every: 'week' },
    });
  }

  if (toSchedule.length === 0) return;

  try {
    await LocalNotifications.schedule({ notifications: toSchedule as any });
  } catch {
    // best-effort
  }
}

/** Used by the settings panel toggle: when notifs are disabled, also
 *  clean the election reminders so we don't leave them queued. */
export async function cancelElectionReminders() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: ALL_IDS.map((id) => ({ id })) });
  } catch {
    // ignore
  }
}
