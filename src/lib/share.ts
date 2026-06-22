// Generate a 1080x1350 PNG of the user's top 3 Boussole results and
// open the native share sheet (Android Share / iOS Activity / web
// navigator.share) so they can post it to social media.
//
// The URL embedded in the share text is currently a flat cap2027.fr —
// we'll iterate towards a /boussole route + per-user encoded results
// once the web landing is in place.

import { Capacitor } from '@capacitor/core';

// ---------------------------------------------------------------------------
// Lightweight link sharing (articles, candidate profiles).
//
// Unlike the Boussole image share below, this just shares a title + URL:
//   - native  → @capacitor/share (Android share sheet)
//   - web     → navigator.share when available (mobile browsers, recent
//               desktops), otherwise copy the link to the clipboard.
// The app is also built as the cap2027.fr website; on web we degrade to
// clipboard copy so there's always a usable action.
// ---------------------------------------------------------------------------

const WEB_BASE = 'https://cap2027.fr';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'error';

export interface ShareLinkInput {
  title: string;
  /** Optional longer text; falls back to title. Keep the tone neutral. */
  text?: string;
  url: string;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function shareLink({ title, text, url }: ShareLinkInput): Promise<ShareOutcome> {
  const body = text?.trim() || title;

  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text: body, url, dialogTitle: 'Partager' });
      return 'shared';
    } catch (e: any) {
      // User cancelling the sheet rejects on some Android versions.
      if (/cancel/i.test(String(e?.message ?? e))) return 'cancelled';
      return 'error';
    }
  }

  // Web: native share sheet if the browser supports it…
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, text: body, url });
      return 'shared';
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return 'cancelled';
    // fall through to clipboard
  }

  // …otherwise copy the link.
  const ok = await copyToClipboard(`${body}\n${url}`);
  return ok ? 'copied' : 'error';
}

/** Share a news article (press article, tweet, video). Shares the source URL. */
export function shareArticle(opts: { title: string; url: string; sourceName?: string | null }): Promise<ShareOutcome> {
  const via = opts.sourceName ? ` (${opts.sourceName})` : '';
  return shareLink({
    title: opts.title,
    text: `${opts.title}${via} — à lire sur CAP 2027`,
    url: opts.url,
  });
}

/** Share a candidate profile. Links to the cap2027.fr web fiche. */
export function shareCandidate(opts: { name: string; slug: string; party?: string | null }): Promise<ShareOutcome> {
  const party = opts.party ? ` (${opts.party})` : '';
  return shareLink({
    title: `${opts.name} — CAP 2027`,
    text: `Découvrez le profil de ${opts.name}${party} sur CAP 2027, l’app neutre de la présidentielle 2027.`,
    url: `${WEB_BASE}/explorer/candidats/${encodeURIComponent(opts.slug)}`,
  });
}

interface ScoreLike {
  candidate: {
    id: string;
    first_name: string;
    last_name: string;
    gender: string | null;
    photo_url: string | null;
    parties: { name: string | null; abbreviation: string | null; color: string | null } | null;
  };
  total: number;
  agree: number;
  disagree: number;
  neutral: number;
  answered: number;
  totalProps: number;
}

const SHARE_URL = 'https://cap2027.fr';

// Debug: last share's per-phase timings, exposed so the in-app UI can
// surface them without needing chrome://inspect.
export interface ShareTimings {
  total: number;
  image: number;
  b64: number;
  write: number;
  share: number;
  size: number;
}
let lastTimings: ShareTimings | null = null;
export function getLastShareTimings(): ShareTimings | null {
  return lastTimings;
}

function fullName(c: ScoreLike['candidate']) {
  return `${c.first_name} ${c.last_name}`.trim();
}

function fallbackPhoto(gender: string | null) {
  return gender === 'F' ? '/card_red.png' : '/card_blue.png';
}

function partyLabel(p: ScoreLike['candidate']['parties']): string {
  return p?.name || p?.abbreviation || '';
}

// Module-level cache of CORS-loaded images so we don't refetch
// between preload (on Results mount) and the actual share click,
// and across repeated shares within the same session.
const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      imageCache.delete(src); // don't cache failures
      reject(new Error('image load failed: ' + src));
    };
    img.src = src;
  });
  imageCache.set(src, p);
  return p;
}

// Fire-and-forget warm-up. Called from the Results screen as soon as
// it renders so that by the time the user taps "Partager", the
// candidate photos are already decoded and ready to draw.
export function preloadShareImages(scores: ScoreLike[]) {
  const top3 = scores.slice(0, 3);
  for (const s of top3) {
    const primary = s.candidate.photo_url || fallbackPhoto(s.candidate.gender);
    loadImage(primary).catch(() => {
      const fb = fallbackPhoto(s.candidate.gender);
      if (fb !== primary) loadImage(fb).catch(() => {});
    });
  }
}

// Aggressively warm the cache from raw candidate data — called when
// candidates first load at game start, ~30s+ before Results renders.
// Every candidate is preloaded so any top-3 permutation is hot.
export function preloadCandidatePhotos(
  candidates: Array<{ photo_url: string | null; gender: string | null }>,
) {
  for (const c of candidates) {
    const url = c.photo_url || fallbackPhoto(c.gender);
    loadImage(url).catch(() => {});
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function generateImage(scores: ScoreLike[], totalAnswered: number, totalProps: number): Promise<Blob> {
  // 4:5 portrait. Bitmap is 900x1125 (down from 1080x1350) — cuts JPEG
  // encoding time roughly in half on mid-range Android with no visible
  // quality drop at share-card viewing distances. We still draw in the
  // original 1080x1350 coordinate space via ctx.scale() so all the
  // layout math below stays unchanged.
  const W = 1080;
  const H = 1350;
  const SCALE = 0.834; // 900 / 1080
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * SCALE);
  canvas.height = Math.round(H * SCALE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unsupported');
  ctx.scale(SCALE, SCALE);

  // Background gradient — same blue family as the in-app hero card
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#102a5c');
  grad.addColorStop(1, '#1a56db');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 32px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CAP 2027', W / 2, 90);

  ctx.fillStyle = 'white';
  ctx.font = 'bold 62px Inter, system-ui, sans-serif';
  ctx.fillText('Mes affinités politiques', W / 2, 170);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '28px Inter, system-ui, sans-serif';
  const subtitle = totalAnswered === totalProps
    ? `Test complet — ${totalProps} propositions`
    : `${totalAnswered} / ${totalProps} propositions répondues`;
  ctx.fillText(subtitle, W / 2, 215);

  // Top 3 candidate cards
  const top3 = scores.slice(0, 3);
  const cardX = 80;
  const cardW = W - 2 * cardX;
  const cardH = 240;
  const cardGap = 30;
  const cardY0 = 300;

  // Parallel-fetch all candidate photos before drawing. Single
  // Promise.all turns 3 sequential round-trips into one — biggest
  // perf win in this whole function.
  const photos: (HTMLImageElement | null)[] = await Promise.all(
    top3.map(async (s) => {
      const primary = s.candidate.photo_url || fallbackPhoto(s.candidate.gender);
      try {
        return await loadImage(primary);
      } catch {
        try {
          return await loadImage(fallbackPhoto(s.candidate.gender));
        } catch {
          return null;
        }
      }
    }),
  );

  for (let i = 0; i < top3.length; i++) {
    const s = top3[i];
    const y = cardY0 + i * (cardH + cardGap);

    // Card background
    roundRect(ctx, cardX, y, cardW, cardH, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();

    // Rank badge
    ctx.fillStyle = i === 0 ? '#fbbf24' : '#94a3b8';
    ctx.font = 'bold 36px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`#${i + 1}`, cardX + 40, y + 60);

    // Photo
    const photoR = 70;
    const photoX = cardX + 150 + photoR;
    const photoY = y + cardH / 2;
    const img = photos[i];
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(photoX, photoY, photoR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, photoX - photoR, photoY - photoR, photoR * 2, photoR * 2);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(photoX, photoY, photoR, 0, Math.PI * 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
    }

    // Name
    ctx.fillStyle = '#102a5c';
    ctx.font = 'bold 42px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    const name = fullName(s.candidate);
    const truncated = name.length > 24 ? name.slice(0, 22) + '…' : name;
    ctx.fillText(truncated, photoX + photoR + 30, y + 100);

    // Party
    ctx.fillStyle = '#64748b';
    ctx.font = '28px Inter, system-ui, sans-serif';
    const party = partyLabel(s.candidate.parties);
    if (party) {
      const partyTrunc = party.length > 28 ? party.slice(0, 26) + '…' : party;
      ctx.fillText(partyTrunc, photoX + photoR + 30, y + 140);
    }

    // Breakdown line (accords • désaccords • sans avis)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px Inter, system-ui, sans-serif';
    const breakdown = `${s.agree} accord${s.agree > 1 ? 's' : ''} • ${s.disagree} désaccord${s.disagree > 1 ? 's' : ''} • ${s.neutral} sans avis`;
    ctx.fillText(breakdown, photoX + photoR + 30, y + 180);

    // Score
    const empty = s.answered === 0;
    if (!empty) {
      const positive = s.total >= 0;
      ctx.fillStyle = positive ? '#059669' : '#dc2626';
      ctx.font = 'bold 80px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      const sign = s.total > 0 ? '+' : '';
      ctx.fillText(`${sign}${s.total}`, cardX + cardW - 50, y + 120);
    } else {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 56px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('—', cardX + cardW - 50, y + 110);
    }
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 36px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("Faites le test sur cap2027.fr", W / 2, H - 90);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '24px Inter, system-ui, sans-serif';
  ctx.fillText("S'informer. Comparer. Choisir.", W / 2, H - 50);

  // JPEG is ~3-4x faster to encode than PNG in Android WebView and
  // gives a 60% smaller file. Quality 0.9 is visually indistinguishable
  // for photos + flat color UI text.
  return new Promise<Blob>((resolve, reject) => {
    const t = performance.now();
    canvas.toBlob(
      (blob) => {
        console.log(`[share] toBlob in ${(performance.now() - t).toFixed(0)}ms`);
        if (blob) resolve(blob);
        else reject(new Error('toBlob failed'));
      },
      'image/jpeg',
      0.9,
    );
  });
}

// Fast base64 encoder: chunked btoa on the raw bytes. For sub-MB
// blobs this is consistently faster than FileReader.readAsDataURL
// in Android WebView because it skips data-URL string assembly and
// the prefix split.
async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000; // 32 KB chunks to stay under fromCharCode arg limit
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunk, bytes.length)) as unknown as number[],
    );
  }
  return btoa(binary);
}

function buildShareText(scores: ScoreLike[]): string {
  const top = scores[0];
  if (!top || top.answered === 0) {
    return `J'ai découvert mes affinités politiques pour la présidentielle 2027 sur CAP 2027. À ton tour !\n\n${SHARE_URL}`;
  }
  const sign = top.total > 0 ? '+' : '';
  return `Mon top match pour la présidentielle 2027 selon CAP 2027 : ${fullName(top.candidate)} (${sign}${top.total}).\n\nFais le test : ${SHARE_URL}`;
}

export async function shareBoussoleResults(
  scores: ScoreLike[],
  totalAnswered: number,
  totalProps: number,
): Promise<{ ok: boolean; reason?: string }> {
  const t0 = performance.now();
  let blob: Blob;
  try {
    blob = await generateImage(scores, totalAnswered, totalProps);
  } catch (e: any) {
    return { ok: false, reason: 'image: ' + (e?.message ?? e) };
  }
  const tImg = performance.now();
  console.log(`[share] image generated in ${(tImg - t0).toFixed(0)}ms (${blob.size} bytes, ${blob.type})`);

  const text = buildShareText(scores);

  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64 = await blobToBase64(blob);
      const tB64 = performance.now();
      console.log(`[share] base64 in ${(tB64 - tImg).toFixed(0)}ms`);
      const filename = `cap2027-boussole-${Date.now()}.jpg`;
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      const tFs = performance.now();
      console.log(`[share] fs write in ${(tFs - tB64).toFixed(0)}ms → ${saved.uri}`);
      const { Share } = await import('@capacitor/share');
      const tShareStart = performance.now();
      await Share.share({
        title: 'Mes affinités CAP 2027',
        text,
        url: saved.uri,
        dialogTitle: 'Partager mes résultats',
      });
      const tShareEnd = performance.now();
      console.log(`[share] share intent ${(tShareEnd - tShareStart).toFixed(0)}ms`);
      const total = tShareEnd - t0;
      console.log(`[share] total ${total.toFixed(0)}ms`);
      lastTimings = {
        total: Math.round(total),
        image: Math.round(tImg - t0),
        b64: Math.round(tB64 - tImg),
        write: Math.round(tFs - tB64),
        share: Math.round(tShareEnd - tShareStart),
        size: blob.size,
      };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: 'native: ' + (e?.message ?? e) };
    }
  }

  // Web: try navigator.share with the file, then fallback to download.
  try {
    const file = new File([blob], 'cap2027-boussole.jpg', { type: 'image/jpeg' });
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'Mes affinités CAP 2027',
        text,
        files: [file],
      });
      return { ok: true };
    }
  } catch {
    // fall through to download
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cap2027-boussole.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { ok: true, reason: 'downloaded' };
  } catch (e: any) {
    return { ok: false, reason: 'download: ' + (e?.message ?? e) };
  }
}
