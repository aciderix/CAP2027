import { Bell, ExternalLink, Check, BadgeCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useUnseenArticles, markAllSeen, type UnseenArticle } from '../lib/notifications';

function relativeTime(iso: string) {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  return days < 2 ? 'hier' : `il y a ${days} j`;
}

export function NotificationsBell() {
  const { count, articles } = useUnseenArticles();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const display = Math.min(count, 99);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative p-2 text-[#102a5c] hover:bg-slate-100 rounded-full transition-colors"
      >
        <Bell strokeWidth={2.5} className="w-[22px] h-[22px]" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#e11d48] rounded-full border-2 border-white text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {display}
            {count > 99 ? '+' : ''}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[88vw] max-w-[360px] bg-white rounded-2xl shadow-xl border border-slate-100 z-[60] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-[#102a5c] text-sm">
              Notifications
              {count > 0 && (
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-full">
                  {count} nouvelles
                </span>
              )}
            </h3>
            {count > 0 && (
              <button
                onClick={() => { markAllSeen(); setOpen(false); }}
                className="text-[11px] font-bold text-[#1a56db] hover:underline inline-flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {articles.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Vous êtes à jour. <br />
                <span className="text-xs text-slate-400">On vous notifie dès qu'un article tombe.</span>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {articles.map((a) => <NotifRow key={a.id} article={a} />)}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifRow({ article }: { article: UnseenArticle }) {
  return (
    <li>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
          {article.is_factcheck && <BadgeCheck className="w-3 h-3 text-indigo-500" />}
          {article.source_name && (
            <span className="font-bold uppercase tracking-wider truncate" style={{ color: article.source_color || '#475569' }}>
              {article.source_name}
            </span>
          )}
          <span className="text-slate-300">·</span>
          <span>{relativeTime(article.published_at)}</span>
          <ExternalLink className="w-2.5 h-2.5 text-slate-400 ml-auto" />
        </div>
        <h4 className="font-semibold text-[#102a5c] text-sm leading-snug line-clamp-3">
          {article.title}
        </h4>
      </a>
    </li>
  );
}
