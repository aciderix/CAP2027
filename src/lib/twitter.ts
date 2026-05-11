// Helpers for displaying X (Twitter) content fetched via nitter.net.
//
// The ingestion stores nitter URLs (because the RSS feed itself lives
// there). At render time we rewrite to x.com so taps land on the
// actual platform, and we rewrite nitter image URLs to pbs.twimg.com
// so they survive the eventual demise of any nitter instance.

const NITTER_HOST_RE = /^https?:\/\/(?:[\w-]+\.)?nitter\.[\w.-]+\//i;

/** Strips the trailing "#m" anchor nitter adds to every status URL. */
function stripNitterAnchor(url: string): string {
  return url.replace(/#m$/, '');
}

/**
 * Returns the canonical x.com URL for a nitter status link, or the
 * input unchanged if it doesn't look like a nitter URL.
 *
 *   https://nitter.net/InsoumisJeunes/status/2053452197308887098#m
 *     → https://x.com/InsoumisJeunes/status/2053452197308887098
 */
export function rewriteNitterUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (!NITTER_HOST_RE.test(url)) return url;
  // Picture / media URLs
  if (url.includes('/pic/')) {
    try {
      const path = url.split('/pic/')[1] ?? '';
      const decoded = decodeURIComponent(path);
      return `https://pbs.twimg.com/${decoded}`;
    } catch {
      // best-effort: fall through to host swap
    }
  }
  return stripNitterAnchor(url.replace(NITTER_HOST_RE, 'https://x.com/'));
}

/** Same idea for image URLs explicitly. */
export function rewriteNitterImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!NITTER_HOST_RE.test(url)) return url;
  return rewriteNitterUrl(url);
}

const RT_PREFIX_RE = /^RT by @([\w-]+):\s*/;

export interface ParsedXPost {
  /** Text of the post, with the "RT by @x: " prefix stripped. */
  body: string;
  /** If the post is a retweet, the handle that retweeted (without @). */
  retweetedBy: string | null;
}

/**
 * Decodes the nitter-flavoured RSS title/summary into a clean post
 * body + retweet attribution.
 */
export function parseXPost(rawTitle: string, rawSummary: string | null): ParsedXPost {
  // The nitter RSS title is the closest thing to the original tweet
  // text. The summary sometimes trails with "Video" when the post is
  // a video — strip it.
  const source = (rawSummary || rawTitle || '').trim();
  const rtMatch = source.match(RT_PREFIX_RE);
  const body = (rtMatch ? source.slice(rtMatch[0].length) : source)
    // Drop the literal trailing "Video" / "Image" word nitter appends
    .replace(/\s*\b(?:Video|Image)\s*$/i, '')
    .trim();
  return {
    body,
    retweetedBy: rtMatch ? rtMatch[1] : null,
  };
}
