// Ingest a pre-fetched RSS/Atom feed into news_articles, taking the
// XML from the POST body. Used by the GitHub Actions workflow
// (.github/workflows/external-rss.yml) for sources whose RSS
// endpoint blocks the Supabase egress IP.
//
// POST /functions/v1/ingest-from-xml?source=<slug>
// Headers:  X-Ingest-Token: <INGEST_FROM_XML_TOKEN>
// Body:     raw RSS/Atom XML (Content-Type: application/xml or text/xml)
//
// Reuses the same parsing, dedup, tagging and insert logic as
// ingest-rss, just skipping the network fetch step.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INGEST_TOKEN = Deno.env.get("INGEST_FROM_XML_TOKEN");

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
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      try { return String.fromCodePoint(n); } catch { return ""; }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
      const n = parseInt(code, 16);
      try { return String.fromCodePoint(n); } catch { return ""; }
    })
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'").replace(/&apos;/gi, "'")
    .replace(/&laquo;/gi, "«").replace(/&raquo;/gi, "»")
    .replace(/&hellip;/gi, "…").replace(/&mdash;/gi, "—").replace(/&ndash;/gi, "–")
    .replace(/&lsquo;/gi, "‘").replace(/&rsquo;/gi, "’")
    .replace(/&ldquo;/gi, "“").replace(/&rdquo;/gi, "”")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim();
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
    for (const e of ensureArray(enclosure)) {
      const t = e?.["@_type"] ?? ""; const u = e?.["@_url"] ?? "";
      if (u && (t.startsWith?.("image") || /\.(jpe?g|png|webp|gif)/i.test(u))) return String(u);
    }
  }
  const mediaGroup = item["media:group"];
  if (mediaGroup) {
    const thumb = mediaGroup["media:thumbnail"];
    if (thumb) for (const m of ensureArray(thumb)) { const u = m?.["@_url"]; if (u) return String(u); }
  }
  const mediaContent = item["media:content"] ?? item.content;
  if (mediaContent) for (const m of ensureArray(mediaContent)) { const u = m?.["@_url"]; if (u) return String(u); }
  const mediaThumb = item["media:thumbnail"];
  if (mediaThumb) for (const m of ensureArray(mediaThumb)) { const u = m?.["@_url"]; if (u) return String(u); }
  const html = pickText(item.description ?? item.summary ?? item.content ?? item["content:encoded"]);
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function parseDate(item: any): string {
  const raw = pickText(item.pubDate) || pickText(item.published) || pickText(item.updated) || pickText(item["dc:date"]);
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function detectVerdict(title: string, summary: string): string | null {
  const txt = `${title} ${summary}`;
  for (const [re, verdict] of VERDICT_RULES) if (re.test(txt)) return verdict;
  return null;
}

function normalize(item: any): NormalizedItem | null {
  const title = stripHtml(pickText(item.title));
  if (!title) return null;
  const url = stripHtml(pickLink(item));
  if (!url) return null;
  const guidRaw = pickText(item.guid) || pickText(item.id) || url;
  const guid = String(guidRaw).slice(0, 500);
  const mediaGroup = item["media:group"] ?? null;
  const summary = stripHtml(
    pickText(item.description) || pickText(item.summary) ||
    pickText(item["content:encoded"]) || pickText(item.content) ||
    (mediaGroup ? pickText(mediaGroup["media:description"]) : ""),
  ).slice(0, 2000);
  return {
    guid, url, title: title.slice(0, 500), summary,
    image_url: pickImage(item),
    author: stripHtml(pickText(item.author) || pickText(item["dc:creator"])).slice(0, 200) || null,
    published_at: parseDate(item),
  };
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function makePattern(keyword: string): RegExp {
  const ascii = stripAccents(keyword);
  const escaped = ascii.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
}

// needle : mot-clé sans accents et en minuscules, pour le préfiltre de tagArticle.
function makeNeedle(keyword: string): string {
  return stripAccents(keyword).toLowerCase();
}

interface CandidateAlias { candidate_id: string; alias: string; needle: string; regex: RegExp }
interface PartyAlias    { party_id: string;    alias: string; needle: string; regex: RegExp }
interface ThemeKeyword  { theme_id: string;    keyword: string; needle: string; regex: RegExp }
interface Refs { candidateAliases: CandidateAlias[]; partyAliases: PartyAlias[]; themeKeywords: ThemeKeyword[] }

function tagArticle(title: string, summary: string, refs: Refs) {
  const titleAscii = stripAccents(title);
  const summaryAscii = stripAccents(summary);
  const titleLower = titleAscii.toLowerCase();
  const summaryLower = summaryAscii.toLowerCase();
  // Préfiltre par sous-chaîne : la regex (frontières de mot Unicode, coûteuse)
  // ne tourne que si le mot-clé apparaît dans le texte. Même résultat, mais
  // ~1 000 regex par article dépassaient les 2 s de CPU d'une Edge Function sur
  // un lot de 20 articles (Le Figaro après une semaine sans ingestion).
  const score = (needle: string, regex: RegExp) =>
    (titleLower.includes(needle) && regex.test(titleAscii) ? 2 : 0) +
    (summaryLower.includes(needle) && regex.test(summaryAscii) ? 1 : 0);
  const cMap = new Map<string, number>();
  for (const a of refs.candidateAliases) { const s = score(a.needle, a.regex); if (s) cMap.set(a.candidate_id, (cMap.get(a.candidate_id) ?? 0) + s); }
  const pMap = new Map<string, number>();
  for (const a of refs.partyAliases) { const s = score(a.needle, a.regex); if (s) pMap.set(a.party_id, (pMap.get(a.party_id) ?? 0) + s); }
  const tMap = new Map<string, number>();
  for (const k of refs.themeKeywords) { const s = score(k.needle, k.regex); if (s) tMap.set(k.theme_id, (tMap.get(k.theme_id) ?? 0) + s); }
  return {
    candidates: [...cMap.entries()].map(([id, s]) => ({ id, score: s })),
    parties:    [...pMap.entries()].map(([id, s]) => ({ id, score: s })),
    themes:     [...tMap.entries()].map(([id, s]) => ({ id, score: s })),
  };
}

async function loadRefs(): Promise<Refs> {
  const [c, p, t] = await Promise.all([
    supabase.from("candidate_aliases").select("candidate_id, alias"),
    supabase.from("party_aliases").select("party_id, alias"),
    supabase.from("theme_keywords").select("theme_id, keyword"),
  ]);
  if (c.error) throw c.error; if (p.error) throw p.error; if (t.error) throw t.error;
  return {
    candidateAliases: (c.data ?? []).map((r: any) => ({ ...r, needle: makeNeedle(r.alias), regex: makePattern(r.alias) })),
    partyAliases:     (p.data ?? []).map((r: any) => ({ ...r, needle: makeNeedle(r.alias), regex: makePattern(r.alias) })),
    themeKeywords:    (t.data ?? []).map((r: any) => ({ ...r, needle: makeNeedle(r.keyword), regex: makePattern(r.keyword) })),
  };
}

const ARTICLE_KIND_FROM_SOURCE: Record<string, string> = {
  press: "article", youtube: "youtube_video", twitch: "twitch_clip",
  mastodon: "mastodon_post", bluesky: "bluesky_post", twitter: "twitter_post",
};

Deno.serve(async (req) => {
  // Authentication via shared secret in custom header. We don't use
  // the Supabase JWT verification (verify_jwt=false on this fn) because
  // the new sb_publishable_/sb_secret_ format isn't a JWT and would
  // require accepting either; keeping a separate token is cleaner.
  if (!INGEST_TOKEN) {
    return Response.json({ error: "INGEST_FROM_XML_TOKEN secret not set" }, { status: 503 });
  }
  const presented = req.headers.get("x-ingest-token");
  if (presented !== INGEST_TOKEN) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("source");
  if (!slug) {
    return Response.json({ error: "missing ?source=<slug>" }, { status: 400 });
  }

  const { data: source, error: srcErr } = await supabase
    .from("news_sources")
    .select("id, slug, name, is_factcheck, kind, candidate_id, fetch_via_github, is_active")
    .eq("slug", slug)
    .maybeSingle();
  if (srcErr || !source) {
    return Response.json({ error: "source not found", slug }, { status: 404 });
  }
  if (!source.is_active) {
    return Response.json({ skipped: true, reason: "is_active=false", slug });
  }
  if (!source.fetch_via_github) {
    return Response.json({ error: "source not flagged fetch_via_github=true", slug }, { status: 400 });
  }

  const xml = await req.text();
  if (!xml || xml.length < 50) {
    return Response.json({ error: "empty body" }, { status: 400 });
  }

  let items: any[] = [];
  try {
    const parsed = xmlParser.parse(xml);
    if (parsed?.rss?.channel) items = ensureArray(parsed.rss.channel.item);
    else if (parsed?.feed) items = ensureArray(parsed.feed.entry);
    else if (parsed?.["rdf:RDF"]) items = ensureArray(parsed["rdf:RDF"].item);
  } catch (e: any) {
    await supabase.from("news_sources").update({
      last_fetch_error: "xml parse: " + (e?.message ?? e), last_fetched_at: new Date().toISOString(),
    }).eq("id", source.id);
    return Response.json({ error: "xml parse failed", detail: String(e?.message ?? e) }, { status: 422 });
  }

  const normalized = items.map(normalize).filter((x): x is NormalizedItem => x !== null);
  if (normalized.length === 0) {
    await supabase.from("news_sources").update({
      last_fetch_error: "no items parsed", last_fetched_at: new Date().toISOString(),
    }).eq("id", source.id);
    return Response.json({ source: source.slug, inserted: 0, total: 0 });
  }

  const refs = await loadRefs();

  const guids = normalized.map((i) => i.guid);
  const { data: existing } = await supabase
    .from("news_articles").select("guid")
    .eq("source_id", source.id).in("guid", guids);
  const existingSet = new Set((existing ?? []).map((e) => e.guid));
  const fresh = normalized.filter((i) => !existingSet.has(i.guid));

  const articleKind = ARTICLE_KIND_FROM_SOURCE[source.kind] ?? "article";
  let inserted = 0;
  for (const item of fresh) {
    const verdict = source.is_factcheck ? detectVerdict(item.title, item.summary) : null;
    const { data, error } = await supabase.from("news_articles").insert({
      source_id: source.id, guid: item.guid, url: item.url, title: item.title,
      summary: item.summary, image_url: item.image_url, author: item.author,
      published_at: item.published_at, is_factcheck: source.is_factcheck,
      verdict, kind: articleKind,
    }).select("id").single();
    if (error || !data) continue;
    inserted++;
    const tags = tagArticle(item.title, item.summary, refs);
    const cMap = new Map<string, number>();
    for (const t of tags.candidates) cMap.set(t.id, t.score);
    if (source.candidate_id) cMap.set(source.candidate_id, Math.max(cMap.get(source.candidate_id) ?? 0, 100));
    if (cMap.size) await supabase.from("article_candidates").insert([...cMap].map(([cid, score]) => ({ article_id: data.id, candidate_id: cid, score })));
    if (tags.parties.length) await supabase.from("article_parties").insert(tags.parties.map((t) => ({ article_id: data.id, party_id: t.id, score: t.score })));
    if (tags.themes.length)  await supabase.from("article_themes").insert(tags.themes.map((t) => ({ article_id: data.id, theme_id: t.id, score: t.score })));
  }

  await supabase.from("news_sources").update({
    last_fetched_at: new Date().toISOString(), last_fetch_error: null,
  }).eq("id", source.id);

  return Response.json({ source: source.slug, inserted, total: normalized.length, fresh: fresh.length });
});
