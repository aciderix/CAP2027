// "Noter l'application" — opens the Google Play listing so the user can
// leave a review. Web-only builds (cap2027.fr) have no relevant store
// target, so the entry points are hidden there (see canRateApp()).
//
// A lightweight, NON-INVASIVE prompt can also be surfaced after a
// significant action (e.g. finishing the Boussole test). The user can
// dismiss it once ("Plus tard") or for good ("Ne plus demander"); both
// choices are persisted in localStorage and honoured by shouldShowRatePrompt().

import { Capacitor } from '@capacitor/core';
import { openLink } from './openLink';

const PACKAGE_ID = 'fr.cap2027.app';
const PLAY_URL = `https://play.google.com/store/apps/details?id=${PACKAGE_ID}`;
// market:// opens the Play app directly on Android; we still pass the
// https URL to openLink which falls back gracefully via Chrome Custom Tabs.
const MARKET_URL = `market://details?id=${PACKAGE_ID}`;

const NEVER_KEY = 'cap2027.rate.never';
const RATED_KEY = 'cap2027.rate.done';
const LATER_KEY = 'cap2027.rate.laterAt';

// Re-surface the soft prompt at most once every 7 days after a "Plus tard".
const LATER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Rating only makes sense in the native (Play Store) build. */
export function canRateApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Open the Play Store listing on the reviews/details page. */
export async function openRateApp(): Promise<void> {
  markRated();
  // Prefer the market:// deep link on native; openLink handles the
  // https fallback for everything else.
  await openLink(Capacitor.isNativePlatform() ? MARKET_URL : PLAY_URL);
}

export function markRated() {
  try { localStorage.setItem(RATED_KEY, 'true'); } catch { /* noop */ }
}

export function markRateNever() {
  try { localStorage.setItem(NEVER_KEY, 'true'); } catch { /* noop */ }
}

export function markRateLater() {
  try { localStorage.setItem(LATER_KEY, String(Date.now())); } catch { /* noop */ }
}

/**
 * Whether the soft "rate the app" prompt should be shown right now.
 * False on web, after rating, after "ne plus demander", or within the
 * cooldown window following a "Plus tard".
 */
export function shouldShowRatePrompt(): boolean {
  if (!canRateApp()) return false;
  try {
    if (localStorage.getItem(NEVER_KEY) === 'true') return false;
    if (localStorage.getItem(RATED_KEY) === 'true') return false;
    const laterAt = Number(localStorage.getItem(LATER_KEY) || '0');
    if (laterAt && Date.now() - laterAt < LATER_COOLDOWN_MS) return false;
  } catch {
    return false;
  }
  return true;
}
