// Schedules local OS reminders for election day. We use stable
// notification IDs so this can be called every render without
// stacking duplicates (Capacitor's `schedule` upserts by id).
//
// Legal note on French silence électoral (art. L49 du code électoral):
// la loi interdit la diffusion de tout message ayant le caractère de
// PROPAGANDE électorale à partir de la veille du scrutin à zéro heure.
// Les rappels que nous envoyons sont strictement civiques et neutres
// ("Demain, élection présidentielle, bureaux ouverts de 8 h à 20 h"),
// sans citer de candidat ni d'opinion — équivalents aux SMS de rappel
// envoyés par certaines mairies. Ils ne constituent pas de la
// propagande au sens de la loi. Toute mention de candidat, d'orientation
// ou d'incitation au vote pour un camp est interdite ici.

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

/**
 * Stable IDs per round/event so re-scheduling never duplicates notifs.
 * Range chosen well above NotificationsBell's incrementing ID counter.
 */
const IDS = {
  r1Eve: 1_000_001,
  r1Day: 1_000_002,
  r1Res: 1_000_003,
  r2Eve: 1_000_004,
  r2Day: 1_000_005,
  r2Res: 1_000_006,
};

const ALL_IDS = Object.values(IDS);

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
  const toSchedule = [];

  const buildRoundNotifs = (
    round: ElectionRound | undefined,
    label: '1er' | '2nd',
    ids: { eve: number; day: number; res: number },
  ) => {
    if (!round || !round.is_official) return;

    const start = new Date(round.scheduled_at).getTime();
    const results = new Date(round.results_at).getTime();
    if (Number.isNaN(start) || Number.isNaN(results)) return;

    // Eve at 18 h local of the day before the election.
    const eveDate = new Date(start);
    eveDate.setDate(eveDate.getDate() - 1);
    eveDate.setHours(18, 0, 0, 0);
    const eveAt = eveDate.getTime();

    // J-day at 8 h local (poll opening).
    const dayDate = new Date(start);
    dayDate.setHours(8, 0, 0, 0);
    const dayAt = dayDate.getTime();

    if (eveAt > now) {
      toSchedule.push({
        id: ids.eve,
        title: `Présidentielle 2027 — ${label} tour demain`,
        body: 'Demain, jour du scrutin. Bureaux de vote ouverts de 8 h à 20 h (22 h dans certaines communes). Pense à ta pièce d\'identité.',
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
        body: 'Les bureaux de vote sont ouverts. Munis-toi d\'une pièce d\'identité.',
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
        body: 'Les premières estimations sont publiées. Ouvre CAP 2027 pour les voir.',
        smallIcon: SMALL_ICON,
        largeIcon: LARGE_ICON,
        iconColor: ICON_COLOR,
        schedule: { at: new Date(results) },
      });
    }
  };

  buildRoundNotifs(rounds.round1, '1er', { eve: IDS.r1Eve, day: IDS.r1Day, res: IDS.r1Res });
  buildRoundNotifs(rounds.round2, '2nd', { eve: IDS.r2Eve, day: IDS.r2Day, res: IDS.r2Res });

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
