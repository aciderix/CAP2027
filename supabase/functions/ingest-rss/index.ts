// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  textNodeName: "#text",
});

const VERDICT_RULES: Array<[RegExp, string]> = [
  [/\b(faux|c'est faux|fake|infox|intox)\b/i, "faux"],
  [/\btrompeur|trompeuse\b/i, "trompeur"],
  [/\b(c'est vrai|exact|véridique|confirmé)\b/i, "vrai"],
  [/\bpartiellement|en partie\b/i, "partiel"],
];

interface NormalizedItem {
  guid: string;
  url: string;
  title: string;
  summary: string;
  image_url: string | null;
  author: string | null;
  published_at: string;
}

function ensureArray<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

function pickText(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    if ("#text" in v) return String((v as any)["#text"] ?? "");
    if ("@_href" in v) return String((v as any)["@_href"] ?? "");
  }
  return "";
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pickLink(item: any): string {
  if (typeof item.link === "string") return item.link;
  if (Array.isArray(item.link)) {
    const alt = item.link.find((l: any) => l && l["@_rel"] !== "self" && l["@_href"]);
    if (alt) return String(alt["@_href"]);
    const first = item.link.find((l: any) => l && l["@_href"]);
    if (first) return String(first["@_href"]);
    return String(item.link[0] ?? "");
  }
  if (item.link && typeof item.link === "object") {
    if (item.link["@_href"]) return String(item.link["@_href"]);
    if (item.link["#text"]) return String(item.link["#text"]);
  }
  return "";
}

function pickImage(item: any): string | null {
  const enclosure = item.enclosure;
  if (enclosure) {
    const arr = ensureArray(enclosure);
    for (const e of arr) {
      const t = e?.["@_type"] ?? "";
      const u = e?.["@_url"] ?? "";
      if (u && (t.startsWith?.("image") || /\.(jpe?g|png|webp|gif)/i.test(u))) return String(u);
    }
  }
  // YouTube Atom feed nests media stuff under <media:group>
  const mediaGroup = item["media:group"];
  if (mediaGroup) {
    const thumb = mediaGroup["media:thumbnail"];
    if (thumb) {
      const arr = ensureArray(thumb);
      for (const m of arr) {
        const u = m?.["@_url"];
        if (u) return String(u);
      }
    }
  }
  const mediaContent = item["media:content"] ?? item.content;
  if (mediaContent) {
    const arr = ensureArray(mediaContent);
    for (const m of arr) {
      const u = m?.["@_url"];
      if (u) return String(u);
    }
  }
  const mediaThumb = item["media:thumbnail"];
  if (mediaThumb) {
    const arr = ensureArray(mediaThumb);
    for (const m of arr) {
      const u = m?.["@_url"];
      if (u) return String(u);
    }
  }
  const html = pickText(item.description ?? item.summary ?? item.content ?? item["content:encoded"]);
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function parseDate(item: any): string {
  const raw =
    pickText(item.pubDate) ||
    pickText(item.published) ||
    pickText(item.updated) ||
    pickText(item["dc:date"]);
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function detectVerdict(title: string, summary: string): string | null {
  const txt = `${title} ${summary}`;
  for (const [re, verdict] of VERDICT_RULES) {
    if (re.test(txt)) return verdict;
  }
  return null;
}

function normalize(item: any): NormalizedItem | null {
  const title = stripHtml(pickText(item.title));
  if (!title) return null;
  const url = stripHtml(pickLink(item));
  if (!url) return null;
  const guidRaw = pickText(item.guid) || pickText(item.id) || url;
  const guid = String(guidRaw).slice(0, 500);
  // YouTube nests description under media:group
  const mediaGroup = item["media:group"] ?? null;
  const summary = stripHtml(
    pickText(item.description) ||
      pickText(item.summary) ||
      pickText(item["content:encoded"]) ||
      pickText(item.content) ||
      (mediaGroup ? pickText(mediaGroup["media:description"]) : ""),
  ).slice(0, 2000);
  return {
    guid,
    url,
    title: title.slice(0, 500),
    summary,
    image_url: pickImage(item),
    author: stripHtml(pickText(item.author) || pickText(item["dc:creator"])).slice(0, 200) || null,
    published_at: parseDate(item),
  };
}

async function fetchSourceItems(rssUrl: string): Promise<NormalizedItem[]> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20_000);
  // Some hosts (e.g. xcancel) only respond to RSS-reader UAs; press hosts
  // tend to prefer browser-looking UAs. Try the more permissive one first,
  // fall back to the second on any non-2xx.
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'FreshRSS/1.20.0 (Linux; https://freshrss.org)',
  ];
  let lastErr: Error | null = null;
  let xml = '';
  try {
    for (let i = 0; i < userAgents.length; i++) {
      try {
        const res = await fetch(rssUrl, {
          headers: {
            'User-Agent': userAgents[i],
            'Accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          },
          signal: ctrl.signal,
          redirect: 'follow',
        });
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status}`);
          continue;
        }
        xml = await res.text();
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e as Error;
      }
    }
    if (lastErr || !xml) throw lastErr ?? new Error('no body');
    const parsed = xmlParser.parse(xml);
    let items: any[] = [];
    if (parsed?.rss?.channel) items = ensureArray(parsed.rss.channel.item);
    else if (parsed?.feed) items = ensureArray(parsed.feed.entry);
    else if (parsed?.['rdf:RDF']) items = ensureArray(parsed['rdf:RDF'].item);
    return items.map(normalize).filter((x): x is NormalizedItem => x !== null);
  } finally {
    clearTimeout(timeout);
  }
}

// Word-boundary regex that respects Unicode letter/digit, so "EPR" won't
// match inside "reproché" and "ISF" won't match inside "satisfaisant".
// Strip diacritics so "Mélenchon" matches against "melenchon" written
// without the accent (still strict otherwise — typos do not match).
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Word-boundary regex respecting Unicode letter/digit, so "EPR" won't
// match inside "reproché" and "ISF" won't match inside "satisfaisant".
function makePattern(keyword: string): RegExp {
  const ascii = stripAccents(keyword);
  const escaped = ascii.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
}

interface CandidateAlias { candidate_id: string; alias: string; regex: RegExp }
interface PartyAlias    { party_id: string;    alias: string; regex: RegExp }
interface ThemeKeyword  { theme_id: string;    keyword: string; regex: RegExp }

interface Refs {
  candidateAliases: CandidateAlias[];
  partyAliases: PartyAlias[];
  themeKeywords: ThemeKeyword[];
}

function tagArticle(title: string, summary: string, refs: Refs) {
  // Both the haystack and the keyword regexes are accent-stripped, so
  // "Melenchon" in an article still matches the alias "Mélenchon".
  const titleAscii = stripAccents(title);
  const summaryAscii = stripAccents(summary);

  const candidateScores = new Map<string, number>();
  for (const a of refs.candidateAliases) {
    let score = 0;
    if (a.regex.test(titleAscii)) score += 2;
    if (a.regex.test(summaryAscii)) score += 1;
    if (score > 0) candidateScores.set(a.candidate_id, (candidateScores.get(a.candidate_id) ?? 0) + score);
  }
  const partyScores = new Map<string, number>();
  for (const a of refs.partyAliases) {
    let score = 0;
    if (a.regex.test(titleAscii)) score += 2;
    if (a.regex.test(summaryAscii)) score += 1;
    if (score > 0) partyScores.set(a.party_id, (partyScores.get(a.party_id) ?? 0) + score);
  }
  const themeScores = new Map<string, number>();
  for (const k of refs.themeKeywords) {
    let score = 0;
    if (k.regex.test(titleAscii)) score += 2;
    if (k.regex.test(summaryAscii)) score += 1;
    if (score > 0) themeScores.set(k.theme_id, (themeScores.get(k.theme_id) ?? 0) + score);
  }
  return {
    candidates: [...candidateScores.entries()].map(([id, s]) => ({ id, score: s })),
    parties:    [...partyScores.entries()].map(([id, s])    => ({ id, score: s })),
    themes:     [...themeScores.entries()].map(([id, s])    => ({ id, score: s })),
  };
}

async function loadRefs(): Promise<Refs> {
  const [c, p, t] = await Promise.all([
    supabase.from("candidate_aliases").select("candidate_id, alias"),
    supabase.from("party_aliases").select("party_id, alias"),
    supabase.from("theme_keywords").select("theme_id, keyword"),
  ]);
  if (c.error) throw c.error;
  if (p.error) throw p.error;
  if (t.error) throw t.error;
  return {
    candidateAliases: (c.data ?? []).map((r: any) => ({ ...r, regex: makePattern(r.alias) })),
    partyAliases:     (p.data ?? []).map((r: any) => ({ ...r, regex: makePattern(r.alias) })),
    themeKeywords:    (t.data ?? []).map((r: any) => ({ ...r, regex: makePattern(r.keyword) })),
  };
}

interface SourceRow {
  id: string;
  slug: string;
  name: string;
  rss_url: string;
  is_factcheck: boolean;
  kind: string;
  candidate_id: string | null;
}

const ARTICLE_KIND_FROM_SOURCE: Record<string, string> = {
  press: "article",
  youtube: "youtube_video",
  twitch: "twitch_clip",
  mastodon: "mastodon_post",
  bluesky: "bluesky_post",
};
function articleKindFor(sourceKind: string): string {
  return ARTICLE_KIND_FROM_SOURCE[sourceKind] ?? "article";
}

async function ingestSource(source: SourceRow, refs: Refs) {
  let items: NormalizedItem[];
  try {
    items = await fetchSourceItems(source.rss_url);
  } catch (err) {
    await supabase
      .from("news_sources")
      .update({ last_fetch_error: String(err).slice(0, 500), last_fetched_at: new Date().toISOString() })
      .eq("id", source.id);
    return { source: source.slug, error: String(err) };
  }

  if (items.length === 0) {
    await supabase
      .from("news_sources")
      .update({ last_fetch_error: "no items parsed", last_fetched_at: new Date().toISOString() })
      .eq("id", source.id);
    return { source: source.slug, inserted: 0, total: 0 };
  }

  const guids = items.map((i) => i.guid);
  const { data: existing } = await supabase
    .from("news_articles")
    .select("guid")
    .eq("source_id", source.id)
    .in("guid", guids);
  const existingSet = new Set((existing ?? []).map((e) => e.guid));

  const fresh = items.filter((i) => !existingSet.has(i.guid));
  const articleKind = articleKindFor(source.kind);
  let inserted = 0;
  for (const item of fresh) {
    const verdict = source.is_factcheck ? detectVerdict(item.title, item.summary) : null;
    const { data, error } = await supabase
      .from("news_articles")
      .insert({
        source_id: source.id,
        guid: item.guid,
        url: item.url,
        title: item.title,
        summary: item.summary,
        image_url: item.image_url,
        author: item.author,
        published_at: item.published_at,
        is_factcheck: source.is_factcheck,
        verdict,
        kind: articleKind,
      })
      .select("id")
      .single();
    if (error || !data) continue;
    inserted++;
    const tags = tagArticle(item.title, item.summary, refs);
    // Auto-attribute to source's candidate (high confidence)
    const candidateMap = new Map<string, number>();
    for (const t of tags.candidates) candidateMap.set(t.id, t.score);
    if (source.candidate_id) {
      candidateMap.set(source.candidate_id, Math.max(candidateMap.get(source.candidate_id) ?? 0, 100));
    }
    if (candidateMap.size > 0) {
      await supabase.from("article_candidates")
        .insert([...candidateMap].map(([cid, score]) => ({ article_id: data.id, candidate_id: cid, score })));
    }
    if (tags.parties.length) {
      await supabase.from("article_parties")
        .insert(tags.parties.map((t) => ({ article_id: data.id, party_id: t.id, score: t.score })));
    }
    if (tags.themes.length) {
      await supabase.from("article_themes")
        .insert(tags.themes.map((t) => ({ article_id: data.id, theme_id: t.id, score: t.score })));
    }
  }

  await supabase
    .from("news_sources")
    .update({ last_fetched_at: new Date().toISOString(), last_fetch_error: null })
    .eq("id", source.id);

  return { source: source.slug, inserted, total: items.length };
}

// ---------- Re-tag mode ----------
async function retagAllArticles(refs: Refs) {
  // Wipe existing tags
  await supabase.from("article_themes").delete().not("article_id", "is", null);
  await supabase.from("article_candidates").delete().not("article_id", "is", null);
  await supabase.from("article_parties").delete().not("article_id", "is", null);

  // Pre-fetch sources with candidate_id so we honour the auto-attach rule on retag
  const { data: sourceMap } = await supabase
    .from("news_sources")
    .select("id, candidate_id");
  const sourceCandidate = new Map<string, string>();
  for (const s of (sourceMap ?? []) as { id: string; candidate_id: string | null }[]) {
    if (s.candidate_id) sourceCandidate.set(s.id, s.candidate_id);
  }

  let offset = 0;
  const pageSize = 500;
  let totalRetagged = 0;
  let totalThemeRows = 0;
  let totalCandidateRows = 0;
  let totalPartyRows = 0;

  while (true) {
    const { data, error } = await supabase
      .from("news_articles")
      .select("id, title, summary, source_id")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    const themeRows: any[] = [];
    const candidateRows: any[] = [];
    const partyRows: any[] = [];

    for (const row of data) {
      const tags = tagArticle(row.title ?? "", row.summary ?? "", refs);
      const candidateMap = new Map<string, number>();
      for (const c of tags.candidates) candidateMap.set(c.id, c.score);
      const attached = sourceCandidate.get(row.source_id);
      if (attached) candidateMap.set(attached, Math.max(candidateMap.get(attached) ?? 0, 100));
      for (const t of tags.themes) themeRows.push({ article_id: row.id, theme_id: t.id, score: t.score });
      for (const [cid, sc] of candidateMap) candidateRows.push({ article_id: row.id, candidate_id: cid, score: sc });
      for (const p of tags.parties) partyRows.push({ article_id: row.id, party_id: p.id, score: p.score });
      totalRetagged++;
    }

    // Insert in chunks of 500 to keep payloads bounded
    const chunk = <T,>(arr: T[], n: number) => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
      return out;
    };

    for (const c of chunk(themeRows, 500))     await supabase.from("article_themes").insert(c);
    for (const c of chunk(candidateRows, 500)) await supabase.from("article_candidates").insert(c);
    for (const c of chunk(partyRows, 500))     await supabase.from("article_parties").insert(c);

    totalThemeRows += themeRows.length;
    totalCandidateRows += candidateRows.length;
    totalPartyRows += partyRows.length;

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return {
    retagged: totalRetagged,
    theme_rows: totalThemeRows,
    candidate_rows: totalCandidateRows,
    party_rows: totalPartyRows,
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const onlySlug = url.searchParams.get("source");
  const retag = url.searchParams.get("retag") === "true";

  if (retag) {
    const refs = await loadRefs();
    const result = await retagAllArticles(refs);
    return new Response(JSON.stringify({ retag: result }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const sourcesQuery = supabase
    .from("news_sources")
    .select("id, slug, name, rss_url, is_factcheck, kind, candidate_id")
    .eq("is_active", true);
  if (onlySlug) sourcesQuery.eq("slug", onlySlug);
  const { data: sources, error: srcErr } = await sourcesQuery;
  if (srcErr) return new Response(JSON.stringify({ error: srcErr.message }), { status: 500 });
  if (!sources || sources.length === 0) {
    return new Response(JSON.stringify({ results: [], note: "no active sources" }));
  }

  const refs = await loadRefs();
  const results: any[] = [];
  let totalInserted = 0;
  let firstNewTitle: string | null = null;
  for (const s of sources as SourceRow[]) {
    const res = await ingestSource(s, refs);
    results.push(res);
    if (typeof (res as any).inserted === "number") totalInserted += (res as any).inserted;
  }

  // After a full ingest pass, broadcast a single push notif if anything
  // came in. We pull the very latest article title for the body so the
  // notification feels concrete. Skipped silently if push-broadcast or
  // FCM credentials aren't deployed yet.
  if (totalInserted > 0 && !onlySlug) {
    try {
      const { data: latest } = await supabase
        .from("news_articles")
        .select("title, url")
        .order("published_at", { ascending: false })
        .limit(1);
      firstNewTitle = latest?.[0]?.title ?? null;
      const url = latest?.[0]?.url ?? null;

      await fetch(`${SUPABASE_URL}/functions/v1/push-broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          title:
            totalInserted === 1
              ? "Une nouvelle actualité"
              : `${totalInserted} nouvelles actualités`,
          body: firstNewTitle?.slice(0, 140) ?? "Ouvrez CAP 2027 pour les consulter",
          url,
        }),
      });
    } catch {
      // best-effort
    }
  }

  return new Response(JSON.stringify({ results, totalInserted }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
