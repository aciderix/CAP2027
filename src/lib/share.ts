// Generate a 1080x1350 PNG of the user's top 3 Boussole results and
// open the native share sheet (Android Share / iOS Activity / web
// navigator.share) so they can post it to social media.
//
// The URL embedded in the share text is currently a flat cap2027.fr —
// we'll iterate towards a /boussole route + per-user encoded results
// once the web landing is in place.

import { Capacitor } from '@capacitor/core';

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

function fullName(c: ScoreLike['candidate']) {
  return `${c.first_name} ${c.last_name}`.trim();
}

function fallbackPhoto(gender: string | null) {
  return gender === 'F' ? '/card_red.png' : '/card_blue.png';
}

function partyLabel(p: ScoreLike['candidate']['parties']): string {
  return p?.name || p?.abbreviation || '';
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed: ' + src));
    img.src = src;
  });
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
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unsupported');

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
    let img: HTMLImageElement | null = null;
    try {
      img = await loadImage(s.candidate.photo_url || fallbackPhoto(s.candidate.gender));
    } catch {
      try {
        img = await loadImage(fallbackPhoto(s.candidate.gender));
      } catch {
        img = null;
      }
    }
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

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
      0.95,
    );
  });
}

function buildShareText(scores: ScoreLike[]): string {
  const top = scores[0];
  if (!top || top.answered === 0) {
    return `J'ai découvert mes affinités politiques pour la présidentielle 2027 sur CAP 2027. À ton tour !\n\n${SHARE_URL}`;
  }
  const sign = top.total > 0 ? '+' : '';
  return `Mon top match pour la présidentielle 2027 selon CAP 2027 : ${fullName(top.candidate)} (${sign}${top.total}).\n\nFais le test : ${SHARE_URL}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // result is "data:image/png;base64,XXX"; strip the prefix
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function shareBoussoleResults(
  scores: ScoreLike[],
  totalAnswered: number,
  totalProps: number,
): Promise<{ ok: boolean; reason?: string }> {
  let blob: Blob;
  try {
    blob = await generateImage(scores, totalAnswered, totalProps);
  } catch (e: any) {
    return { ok: false, reason: 'image: ' + (e?.message ?? e) };
  }

  const text = buildShareText(scores);

  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64 = await blobToBase64(blob);
      const filename = `cap2027-boussole-${Date.now()}.png`;
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: 'Mes affinités CAP 2027',
        text,
        url: saved.uri,
        dialogTitle: 'Partager mes résultats',
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: 'native: ' + (e?.message ?? e) };
    }
  }

  // Web: try navigator.share with the file, then fallback to download.
  try {
    const file = new File([blob], 'cap2027-boussole.png', { type: 'image/png' });
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
    a.download = 'cap2027-boussole.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { ok: true, reason: 'downloaded' };
  } catch (e: any) {
    return { ok: false, reason: 'download: ' + (e?.message ?? e) };
  }
}
