// Contextual help bubble. A small "?" button that toggles a short
// explanation popover, designed to stay readable on small screens:
//   - bubble width is capped and clamped to the viewport
//   - alignment (left/right) avoids horizontal overflow near edges
//   - tap outside / Escape / scroll closes it
//
// Usage:
//   <InfoTip label="À quoi sert ce filtre ?">
//     Choisissez les bords politiques dont vous voulez voir les articles.
//   </InfoTip>

import { useEffect, useId, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface InfoTipProps {
  children: React.ReactNode;
  /** Accessible label / tooltip title for the trigger button. */
  label?: string;
  /** Horizontal anchor of the bubble relative to the button. */
  align?: 'left' | 'right';
  /** Extra classes on the wrapper (e.g. to nudge spacing). */
  className?: string;
}

export function InfoTip({ children, label = 'Plus d’infos', align = 'right', className = '' }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const bubbleId = useId();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={bubbleId}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-slate-400 hover:text-[#1a56db] hover:bg-blue-50 transition-colors shrink-0"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {open && (
        <span
          id={bubbleId}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-7 z-[60] w-64 max-w-[calc(100vw-2rem)] rounded-xl bg-[#102a5c] text-white text-xs leading-relaxed font-medium p-3 shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
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
        </span>
      )}
    </span>
  );
}
