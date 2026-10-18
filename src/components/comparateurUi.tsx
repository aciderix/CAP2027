// Briques d'affichage partagées par le comparateur (sections et fiche programme).

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { openLink } from '../lib/openLink';
import type { Affinity, Verdict } from '../lib/comparateurData';

// Couleur d'identité d'un candidat = sa position dans la sélection (jamais son
// rang). Trois premières teintes de la palette catégorielle de référence,
// validées deux à deux (daltonismes compris) sur fond blanc. L'aqua est sous
// 3:1 de contraste : les valeurs sont donc toujours aussi écrites en texte.
export const SLOT_COLORS = ['#2a78d6', '#eb6834', '#1baf7a'] as const;

// Proximité entre deux programmes : divergent bleu ↔ rouge, gris neutre au milieu.
export const PROXIMITY = {
  convergent: { color: '#2a78d6', label: 'convergentes' },
  different: { color: '#c3c2b7', label: 'différentes' },
  opposed: { color: '#e34948', label: 'opposées' },
} as const;

type ProximityKey = keyof typeof PROXIMITY;
const PROXIMITY_KEYS: ProximityKey[] = ['convergent', 'different', 'opposed'];

export const pct = (x: number) => Math.round(x * 100);

/** Centre un onglet dans sa rangée défilante, sans faire défiler la page. */
export function centerInRow(el: HTMLElement | null) {
  const row = el?.parentElement;
  if (!el || !row) return;
  const offset = el.getBoundingClientRect().left - row.getBoundingClientRect().left;
  row.scrollTo({ left: row.scrollLeft + offset - (row.clientWidth - el.clientWidth) / 2, behavior: 'smooth' });
}

export function fallbackPhoto(c: { gender: string | null }) {
  return c.gender === 'F' ? '/card_red.png' : '/card_blue.png';
}

/** Photo du candidat, repli sur la vignette par défaut si elle ne charge pas
 *  (photos demos-kratos.fr : serveur tiers, parfois limité en débit). */
export function CandidateAvatar({
  c, className = 'w-10 h-10',
}: {
  c: { photoUrl: string | null; gender: string | null };
  className?: string;
}) {
  return (
    <span className={`${className} rounded-full overflow-hidden bg-slate-100 shrink-0 inline-block`}>
      <img
        loading="lazy"
        decoding="async"
        src={c.photoUrl || fallbackPhoto(c)}
        alt=""
        className="w-full h-full object-cover"
        onError={(e) => {
          const img = e.currentTarget;
          if (img.dataset.fallback) return;
          img.dataset.fallback = '1';
          img.src = fallbackPhoto(c);
        }}
      />
    </span>
  );
}

/** Mention de la source, qui ouvre la page correspondante sur demos-kratos.fr. */
export function DkCredit({ url, label = 'Propulsé par Demos Kratos' }: { url: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => void openLink(url)}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-[#1a56db] transition-colors"
    >
      {label} <ExternalLink className="w-3 h-3" />
    </button>
  );
}

/** Barre convergentes / différentes / opposées, segments séparés par 2 px de fond. */
export function ProximityBar({
  d, className = 'h-3',
}: {
  d: NonNullable<Affinity['distribution']>;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-[2px] w-full rounded-[4px] overflow-hidden bg-white ${className}`}
      role="img"
      aria-label={PROXIMITY_KEYS.map((k) => `${pct(d[k])} % ${PROXIMITY[k].label}`).join(', ')}
    >
      {PROXIMITY_KEYS.filter((k) => d[k] > 0).map((k) => (
        <div key={k} style={{ width: `${d[k] * 100}%`, backgroundColor: PROXIMITY[k].color }} />
      ))}
    </div>
  );
}

/** Légende chiffrée de la barre : l'identité ne repose jamais sur la couleur seule. */
export function ProximityLegend({ d }: { d: NonNullable<Affinity['distribution']> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
      {PROXIMITY_KEYS.map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: PROXIMITY[k].color }} />
          <span className="font-bold text-slate-800">{pct(d[k])} %</span> {PROXIMITY[k].label}
        </span>
      ))}
    </div>
  );
}

// Verdict par sujet : pictogramme + libellé (forme distincte pour chacun).
export const VERDICTS: Record<Verdict, { symbol: string; label: string; className: string }> = {
  convergents: { symbol: '✓', label: 'convergents', className: 'bg-blue-50 text-blue-700' },
  plutot_convergents: { symbol: '≈', label: 'plutôt convergents', className: 'bg-sky-50 text-sky-700' },
  divergents: { symbol: '≠', label: 'divergents', className: 'bg-slate-100 text-slate-600' },
  opposes: { symbol: '✗', label: 'opposés', className: 'bg-red-50 text-red-700' },
};

export function VerdictBadge({ v }: { v: Verdict }) {
  const meta = VERDICTS[v] ?? VERDICTS.divergents;
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[12px] font-bold shrink-0 ${meta.className}`} title={meta.label} aria-label={meta.label}>
      {meta.symbol}
    </span>
  );
}

/** Texte long replié à quelques lignes, dépliable. */
export function Expandable({
  text, lines = 4, className = '',
}: {
  text: string;
  lines?: 3 | 4 | 5 | 6;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const clamp = { 3: 'line-clamp-3', 4: 'line-clamp-4', 5: 'line-clamp-5', 6: 'line-clamp-6' }[lines];
  // ~60 caractères par ligne sur mobile : en dessous, pas de bouton.
  const long = text.length > lines * 60;
  return (
    <div className={className}>
      <p className={`text-sm text-slate-700 leading-relaxed whitespace-pre-line ${open || !long ? '' : clamp}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-bold text-[#1a56db] mt-1">
          {open ? 'Réduire' : 'Lire la suite'}
        </button>
      )}
    </div>
  );
}
