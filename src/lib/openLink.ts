// Single entry point for "open this URL" interactions in the app.
//
//   - YouTube / Vimeo / direct .mp4 → resolved to a videoId/payload and
//     dispatched as a 'cap2027:open-video' window event. The
//     <VideoModal /> mounted at the App root listens for it and opens
//     a fullscreen in-app player.
//   - Anything else → Capacitor Browser (Chrome Custom Tabs on Android,
//     SFSafariViewController on iOS) so the user stays "in" the app
//     and can return with one tap. On web we fall back to window.open.
//
// Replaces all <a href={url} target="_blank"> patterns: every clickable
// link in the news / programmes / candidates UI now goes through here.

import { Capacitor } from '@capacitor/core';

export type VideoSource =
  | { kind: 'youtube'; id: string; url: string }
  | { kind: 'vimeo';   id: string; url: string }
  | { kind: 'direct';  url: string };

export const OPEN_VIDEO_EVENT = 'cap2027:open-video';

function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return id || null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      // /watch?v=ID
      const v = u.searchParams.get('v');
      if (v) return v;
      // /live/ID, /shorts/ID, /embed/ID
      const m = u.pathname.match(/^\/(?:live|shorts|embed)\/([A-Za-z0-9_-]+)/);
      if (m) return m[1];
    }
    if (host === 'nitter.net' || host === 'xcancel.com') {
      // Some Nitter instances inline video links pointing back to YouTube
      const wrapped = u.searchParams.get('url');
      if (wrapped) return parseYouTubeId(wrapped);
    }
  } catch {
    return null;
  }
  return null;
}

function parseVimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('vimeo.com')) return null;
    const m = u.pathname.match(/^\/(\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function detectVideo(url: string): VideoSource | null {
  const yt = parseYouTubeId(url);
  if (yt) return { kind: 'youtube', id: yt, url };
  const vi = parseVimeoId(url);
  if (vi) return { kind: 'vimeo', id: vi, url };
  if (/\.(mp4|webm|m3u8)(\?|$)/i.test(url)) return { kind: 'direct', url };
  return null;
}

/** Open a URL keeping the user inside CAP 2027.
 *
 *  YouTube / Vimeo / direct video → in-app modal.
 *  Anything else → Chrome Custom Tabs (or system browser fallback).
 */
export async function openLink(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const video = detectVideo(url);
  if (video) {
    window.dispatchEvent(new CustomEvent<VideoSource>(OPEN_VIDEO_EVENT, { detail: video }));
    return;
  }
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url, presentationStyle: 'fullscreen' });
      return;
    } catch {
      // best-effort; fall through to window.open
    }
  }
  try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* noop */ }
}
