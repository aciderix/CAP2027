// Card variant for X (Twitter) posts ingested via nitter.net. Renders
// the full post text inline so the user can read without opening an
// external page; the URL is rewritten to x.com via lib/twitter.ts.

import { Repeat2, ExternalLink } from 'lucide-react';
import { parseXPost, rewriteNitterUrl, rewriteNitterImage } from '../lib/twitter';
import { openLink } from '../lib/openLink';
import { ShareButton } from './ui/ShareButton';

interface SourceLite {
  name: string;
  color?: string | null;
}

interface TwitterPostCardProps {
  title: string;
  summary: string | null;
  url: string;
  image_url: string | null;
  published_at: string;
  source: SourceLite | null;
  candidateName?: string | null;
}

// L'ingestion donne ce score au candidat propriétaire de la source (son
// compte X) ; les autres candidats rattachés sont seulement cités (alias).
const OWNER_SCORE = 100;

/** Auteur d'un post X : le candidat propriétaire du compte, s'il est visible,
 *  et non un candidat simplement cité. Sinon null (le nom de la source s'affiche). */
export function postAuthor(
  links: { score?: number | null; candidate: { first_name: string; last_name: string } | null }[] | null | undefined,
): string | null {
  const owner = (links ?? []).find((l) => l.candidate && (l.score ?? 0) >= OWNER_SCORE)?.candidate;
  return owner ? `${owner.first_name} ${owner.last_name}`.trim() : null;
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function TwitterPostCard({
  title, summary, url, image_url, published_at, source, candidateName,
}: TwitterPostCardProps) {
  const { body, retweetedBy } = parseXPost(title, summary);
  const targetUrl = rewriteNitterUrl(url);
  const image = rewriteNitterImage(image_url);
  const displayName = candidateName || source?.name || 'X';

  return (
    <article className="feed-card bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all overflow-hidden">
      <div className="p-3 sm:p-4 flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shrink-0">
              X
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#102a5c] truncate leading-tight">
                {displayName}
              </div>
              <div className="text-[11px] text-slate-500">{relativeTime(published_at)}</div>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-0.5">
            <ShareButton
              title={`${displayName} sur X`}
              text={`${body ? body.slice(0, 180) : `Publication de ${displayName}`} — via CAP 2027`}
              url={targetUrl}
            />
            <a
              href={targetUrl}
              onClick={(e) => { e.preventDefault(); void openLink(targetUrl); }}
              className="text-[11px] font-bold text-[#1a56db] hover:underline inline-flex items-center gap-1"
              title="Ouvrir sur x.com"
            >
              Voir sur X <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Retweet attribution */}
        {retweetedBy && (
          <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Repeat2 className="w-3.5 h-3.5" /> Retweet de @{retweetedBy}
          </div>
        )}

        {/* Body */}
        {body && (
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
            {body}
          </p>
        )}

        {/* Image */}
        {image && (
          <a href={targetUrl} onClick={(e) => { e.preventDefault(); void openLink(targetUrl); }} className="block mt-1 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
            <img
              decoding="async"
              loading="lazy"
              src={image}
              alt=""
              className="w-full h-auto max-h-[400px] object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </a>
        )}
      </div>
    </article>
  );
}
