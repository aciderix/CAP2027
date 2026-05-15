// Fullscreen in-app video player. Listens for the
// 'cap2027:open-video' window event dispatched by lib/openLink.ts and
// renders an <iframe> embed (YouTube/Vimeo) or a <video> element
// (direct mp4/webm/m3u8). Closes on tap outside, on the X button, or
// on hardware back (Android).
//
// Embed via youtube-nocookie.com to avoid Google ads/cookie consent
// from disrupting the in-app experience when possible.

import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { OPEN_VIDEO_EVENT, type VideoSource } from '../lib/openLink';
import { Capacitor } from '@capacitor/core';

export function VideoModal() {
  const [video, setVideo] = useState<VideoSource | null>(null);

  const close = useCallback(() => setVideo(null), []);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<VideoSource>;
      if (custom.detail) setVideo(custom.detail);
    };
    window.addEventListener(OPEN_VIDEO_EVENT, handler);
    return () => window.removeEventListener(OPEN_VIDEO_EVENT, handler);
  }, []);

  // Hardware back button on Android closes the modal instead of
  // backgrounding the app. Only when the modal is visible.
  useEffect(() => {
    if (!video) return;
    if (!Capacitor.isNativePlatform()) {
      // Browser ESC fallback
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    let removeListener: (() => void) | null = null;
    void import('@capacitor/app').then(async ({ App }) => {
      const handle = await App.addListener('backButton', () => { close(); });
      removeListener = () => { void handle.remove(); };
    });
    return () => { removeListener?.(); };
  }, [video, close]);

  if (!video) return null;

  let inner: React.ReactNode = null;
  if (video.kind === 'youtube') {
    const src = `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`;
    inner = (
      <iframe
        src={src}
        title="Vidéo YouTube"
        allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="w-full h-full border-0"
      />
    );
  } else if (video.kind === 'vimeo') {
    const src = `https://player.vimeo.com/video/${video.id}?autoplay=1`;
    inner = (
      <iframe
        src={src}
        title="Vidéo Vimeo"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="w-full h-full border-0"
      />
    );
  } else {
    inner = (
      <video
        src={video.url}
        controls
        autoPlay
        playsInline
        className="w-full h-full bg-black"
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-black flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-end p-3 bg-black/90 text-white shrink-0">
        <button
          onClick={close}
          aria-label="Fermer la vidéo"
          className="p-2 rounded-full hover:bg-white/10"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="w-full max-w-5xl aspect-video">{inner}</div>
      </div>
    </div>
  );
}
