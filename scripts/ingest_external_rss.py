#!/usr/bin/env python3
"""
Fetch RSS/Atom feeds for any news_sources flagged fetch_via_github=true,
then POST the raw XML to the ingest-from-xml edge function so it
parses + dedups + tags + inserts via the existing pipeline.

Used by .github/workflows/external-rss.yml. Runs from the GitHub
Actions IP pool, so it can reach endpoints that block the Supabase
egress IP (Le Figaro, X mirrors via nitter, etc.).

Required env:
    SUPABASE_URL              public, ok in workflow file
    SUPABASE_PUBLISHABLE_KEY  public anon key, ok in workflow file
    INGEST_FROM_XML_TOKEN     shared secret, MUST be a GitHub secret
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
RSS_TIMEOUT_S = 30
POST_TIMEOUT_S = 120
PER_SOURCE_DELAY_S = 1.0  # be nice to upstream + edge function


def env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.stderr.write(f"missing env var: {name}\n")
        sys.exit(2)
    return v


def list_sources(supabase_url: str, key: str) -> list[dict[str, Any]]:
    url = (
        f"{supabase_url}/rest/v1/news_sources"
        "?fetch_via_github=eq.true&is_active=eq.true"
        "&select=slug,name,rss_url"
    )
    req = urllib.request.Request(
        url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def fetch_rss(rss_url: str) -> bytes:
    req = urllib.request.Request(
        rss_url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=RSS_TIMEOUT_S) as r:
        return r.read()


def post_xml(supabase_url: str, slug: str, token: str, xml: bytes) -> tuple[int, dict[str, Any]]:
    url = f"{supabase_url}/functions/v1/ingest-from-xml?source={urllib.parse.quote(slug)}"
    req = urllib.request.Request(
        url,
        data=xml,
        method="POST",
        headers={
            "X-Ingest-Token": token,
            "Content-Type": "application/xml",
        },
    )
    with urllib.request.urlopen(req, timeout=POST_TIMEOUT_S) as r:
        body = r.read()
        try:
            return r.status, json.loads(body)
        except json.JSONDecodeError:
            return r.status, {"raw": body.decode("utf-8", errors="replace")[:500]}


def main() -> int:
    supabase_url = env("SUPABASE_URL").rstrip("/")
    publishable_key = env("SUPABASE_PUBLISHABLE_KEY")
    ingest_token = env("INGEST_FROM_XML_TOKEN")

    try:
        sources = list_sources(supabase_url, publishable_key)
    except Exception as e:
        print(f"ERR listing sources: {e}", flush=True)
        return 2
    if not sources:
        print("No sources flagged fetch_via_github=true. Nothing to do.")
        return 0

    print(f"Sources to fetch: {len(sources)}")
    summary: list[dict[str, Any]] = []
    for src in sources:
        slug = src["slug"]
        rss_url = src["rss_url"]
        print(f"\n=== {slug} ({src.get('name')}) ===")
        print(f"  GET {rss_url}")
        try:
            xml = fetch_rss(rss_url)
            print(f"  fetched {len(xml):,} bytes")
        except urllib.error.HTTPError as e:
            err = f"HTTP {e.code}"
            print(f"  FETCH FAIL: {err}")
            summary.append({"slug": slug, "fetch_error": err})
            continue
        except Exception as e:
            print(f"  FETCH FAIL: {e}")
            summary.append({"slug": slug, "fetch_error": str(e)})
            continue

        try:
            status, body = post_xml(supabase_url, slug, ingest_token, xml)
            print(f"  POST → HTTP {status}: {json.dumps(body, ensure_ascii=False)[:300]}")
            summary.append({"slug": slug, "status": status, **{k: v for k, v in body.items() if k != "error"}})
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", errors="replace")[:500]
            print(f"  POST FAIL: HTTP {e.code}: {body_text}")
            summary.append({"slug": slug, "post_error": f"HTTP {e.code}: {body_text}"})
        except Exception as e:
            print(f"  POST FAIL: {e}")
            summary.append({"slug": slug, "post_error": str(e)})

        time.sleep(PER_SOURCE_DELAY_S)

    print("\n=== Summary ===")
    print(json.dumps(summary, indent=2, ensure_ascii=False))

    # Exit non-zero only if every source failed — partial success is OK.
    failures = [s for s in summary if "fetch_error" in s or "post_error" in s]
    if failures and len(failures) == len(summary):
        print("All sources failed — exit 1")
        return 1
    if failures:
        print(f"{len(failures)}/{len(summary)} sources failed (partial success)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
