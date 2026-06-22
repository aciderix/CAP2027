// Small icon button for sharing a link (article / candidate profile).
// Safe to nest inside an <a> card: it stops propagation and prevents the
// parent link from firing. Shows a transient "Lien copié" state when the
// web fallback copies to the clipboard.

import { useRef, useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { shareLink, type ShareLinkInput } from '../../lib/share';

interface ShareButtonProps extends ShareLinkInput {
  /** Visual size of the button. */
  size?: 'sm' | 'md';
  /** Extra classes (color, spacing). */
  className?: string;
  label?: string;
}

export function ShareButton({ title, text, url, size = 'sm', className = '', label = 'Partager' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dim = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  const icon = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]';

  const handle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const outcome = await shareLink({ title, text, url });
    setBusy(false);
    if (outcome === 'copied') {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      aria-label={label}
      title={copied ? 'Lien copié' : label}
      className={`inline-flex items-center justify-center ${dim} rounded-full text-slate-400 hover:text-[#1a56db] hover:bg-blue-50 transition-colors disabled:opacity-50 ${className}`}
      disabled={busy}
    >
      {copied ? <Check className={`${icon} text-emerald-600`} /> : <Share2 className={icon} />}
    </button>
  );
}
