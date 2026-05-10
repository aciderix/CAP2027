// Floating diagnostic panel — captures console output + fetch calls so
// they can be copied to the clipboard. Mostly useful on mobile where
// browser DevTools are unavailable.
//
// Hooks:
//   - Replaces console.{log,info,warn,error} with wrappers that
//     mirror entries into local state.
//   - Wraps window.fetch to log method/URL/status/duration.
//   - Listens to window 'error' and 'unhandledrejection' so uncaught
//     exceptions surface here too.
//
// All hooks are installed once at mount. Originals are restored on
// unmount (only useful in dev with HMR).

import { useEffect, useState } from 'react';
import { Bug, Copy, Trash2, X } from 'lucide-react';

type EntryKind = 'log' | 'info' | 'warn' | 'error' | 'fetch';
type FilterMode = 'all' | 'console' | 'network' | 'error';

interface LogEntry {
  ts: number;
  kind: EntryKind;
  text: string;
}

const MAX_ENTRIES = 200;

function partsToText(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) {
        return a.message + (a.stack ? '\n' + a.stack : '');
      }
      if (typeof a === 'object' && a !== null) {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');
}

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');

  useEffect(() => {
    const push = (kind: EntryKind, args: unknown[]) => {
      setEntries((prev) => {
        const next = prev.concat({ ts: Date.now(), kind, text: partsToText(args) });
        return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
      });
    };

    const origLog = console.log;
    const origInfo = console.info;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...a: unknown[]) => { origLog.apply(console, a); push('log', a); };
    console.info = (...a: unknown[]) => { origInfo.apply(console, a); push('info', a); };
    console.warn = (...a: unknown[]) => { origWarn.apply(console, a); push('warn', a); };
    console.error = (...a: unknown[]) => { origError.apply(console, a); push('error', a); };

    const origFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' || input instanceof URL
        ? String(input)
        : input.url;
      const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
      const startedAt = Date.now();
      try {
        const res = await origFetch(input, init);
        const dur = Date.now() - startedAt;
        push('fetch', [`${method} ${res.status} ${url} (${dur} ms)`]);
        return res;
      } catch (err: unknown) {
        const dur = Date.now() - startedAt;
        const msg = err instanceof Error ? err.message : String(err);
        push('fetch', [`${method} ERR ${url} (${dur} ms): ${msg}`]);
        throw err;
      }
    };

    const onErr = (e: ErrorEvent) => {
      const stack = e.error instanceof Error && e.error.stack ? '\n' + e.error.stack : '';
      push('error', [`window.onerror: ${e.message}${stack}`]);
    };
    const onRej = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const msg = r instanceof Error ? `${r.message}${r.stack ? '\n' + r.stack : ''}` : String(r);
      push('error', [`unhandledrejection: ${msg}`]);
    };
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);

    return () => {
      console.log = origLog;
      console.info = origInfo;
      console.warn = origWarn;
      console.error = origError;
      window.fetch = origFetch;
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, []);

  const filtered = entries.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'console') return e.kind !== 'fetch';
    if (filter === 'network') return e.kind === 'fetch';
    if (filter === 'error') return e.kind === 'error';
    return true;
  });

  const errorCount = entries.reduce((n, e) => (e.kind === 'error' ? n + 1 : n), 0);

  const copyAll = async () => {
    const text = filtered
      .map((e) => {
        const time = new Date(e.ts).toISOString().slice(11, 23);
        return `[${time}] [${e.kind}] ${e.text}`;
      })
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: select-all in a textarea (rare browsers without clipboard API)
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  };

  const kindClass = (k: EntryKind) => {
    if (k === 'error') return 'bg-rose-700 text-white';
    if (k === 'warn') return 'bg-amber-600 text-white';
    if (k === 'fetch') return 'bg-blue-700 text-white';
    if (k === 'info') return 'bg-emerald-700 text-white';
    return 'bg-slate-600 text-white';
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Diagnostic"
        className="fixed bottom-3 right-3 z-[200] bg-slate-900 text-white rounded-full w-11 h-11 shadow-lg flex items-center justify-center hover:bg-slate-700 transition-colors"
      >
        <Bug className="w-4 h-4" />
        {errorCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 rounded-full border-2 border-white text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {errorCount > 99 ? '99+' : errorCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-x-2 bottom-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[480px] z-[200] bg-slate-900 text-white rounded-2xl shadow-xl flex flex-col max-h-[70vh]">
      <header className="px-3 py-2 flex items-center gap-2 border-b border-slate-700">
        <Bug className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="font-bold text-sm">Diagnostic</span>
        <span className="text-xs text-slate-400 tabular-nums">{filtered.length}/{entries.length}</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterMode)}
          className="ml-auto bg-slate-800 text-xs rounded px-1.5 py-1 border border-slate-700"
          aria-label="Filtre"
        >
          <option value="all">tout</option>
          <option value="console">console</option>
          <option value="network">network</option>
          <option value="error">erreurs</option>
        </select>
        <button onClick={copyAll} title="Copier" className="p-1.5 hover:bg-slate-700 rounded">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setEntries([])} title="Effacer" className="p-1.5 hover:bg-slate-700 rounded">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setOpen(false)} title="Fermer" className="p-1.5 hover:bg-slate-700 rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto font-mono text-[11px] p-2 space-y-1 leading-snug">
        {filtered.length === 0 && (
          <div className="text-slate-500 text-center py-6">Aucun message</div>
        )}
        {filtered.map((e, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-slate-500 shrink-0 tabular-nums">
              {new Date(e.ts).toISOString().slice(11, 19)}
            </span>
            <span className={`shrink-0 px-1 rounded text-[9px] uppercase font-bold tracking-wider ${kindClass(e.kind)}`}>
              {e.kind}
            </span>
            <span className="break-all whitespace-pre-wrap text-slate-100">{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
