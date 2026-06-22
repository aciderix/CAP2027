// Contextual help bubble. A small "?" button that toggles a short
// explanation popover.
//
// On small screens a bubble anchored to the button can overflow the
// viewport (and trigger horizontal scroll). To avoid that, the bubble is
// rendered in a portal on <body> with FIXED positioning, measured from
// the trigger's bounding box and CLAMPED inside the viewport so it can
// never spill off-screen. It closes on outside tap, Escape, scroll or
// resize.
//
// Usage:
//   <InfoTip label="À quoi sert ce filtre ?">
//     Choisissez les bords politiques dont vous voulez voir les articles.
//   </InfoTip>

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';

interface InfoTipProps {
  children: React.ReactNode;
  /** Accessible label / tooltip title for the trigger button. */
  label?: string;
  /** Extra classes on the trigger button (e.g. to nudge spacing). */
  className?: string;
}

interface Pos { top: number; left: number; width: number }

export function InfoTip({ children, label = 'Plus d’infos', className = '' }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const bubbleId = useId();

  const compute = () => {
    const btn = btnRef.current;
    if (typeof window === 'undefined' || !btn) return;
    const r = btn.getBoundingClientRect();
    const margin = 12;
    const vw = window.innerWidth;
    const width = Math.min(280, vw - margin * 2);
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, vw - width - margin));
    setPos({ top: r.bottom + 8, left, width });
  };

  useLayoutEffect(() => {
    if (open) compute();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onPointer = (e: PointerEvent) => {
      if (btnRef.current && btnRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    // capture scroll on any ancestor (e.g. modal body) to dismiss.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={bubbleId}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-slate-400 hover:text-[#1a56db] hover:bg-blue-50 transition-colors shrink-0 ${className}`}
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {open && pos && createPortal(
        <div
          id={bubbleId}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          className="z-[300] rounded-xl bg-[#102a5c] text-white text-xs leading-relaxed font-medium p-3 shadow-xl"
        >
          <button
            type="button"
            aria-label="Fermer"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="absolute top-1.5 right-1.5 p-0.5 rounded-full text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <span className="block pr-4">{children}</span>
        </div>,
        document.body,
      )}
    </>
  );
}
