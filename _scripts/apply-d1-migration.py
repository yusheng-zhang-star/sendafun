#!/usr/bin/env python3
"""
SendAFun — 调用线上Worker的POST /api/db/_migrate接口补D1 cards表的4个缺失列
(pexels_id + emotional_tags + envelope_style_id + geo_country_target)

Worker DB binding本身就有D1完整读写权限，所以用HTTP调Worker即可，
不需要wrangler CLI有D1权限（解决CF_API_TOKEN只有Cache Purge权限的问题）。

用法：
    python _scripts/apply-d1-migration.py --dry-run
    python _scripts/apply-d1-migration.py
"""
import argparse
import json
import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 缺少依赖，请先运行：python -m pip install -r _scripts/requirements.txt")
    sys.exit(1)

ROOT_DIR = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT_DIR / ".env")
except ImportError:
    pass

TOKEN = os.environ.get("CARDS_BULK_API_TOKEN", "").strip()


def main() -> int:
    p = argparse.ArgumentParser(description="Call Worker POST /api/db/_migrate to patch D1 cards table columns")
    p.add_argument("--base-url", type=str, default=os.environ.get("D1_API_BASE_URL", "https://sendafun.com"),
                   help="Worker API base URL (default: https://sendafun.com)")
    p.add_argument("--dry-run", action="store_true", help="Only diff columns, do not execute ALTER TABLE")
    args = p.parse_args()

    if not TOKEN:
        print("ERROR: CARDS_BULK_API_TOKEN not set in .env (or Cloudflare Worker Secrets).")
        return 2

    endpoint = args.base_url.rstrip("/") + "/api/db/_migrate"
    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    body = {"dry_run": bool(args.dry_run)}

    mode = "DRY-RUN (schema diff only)" if args.dry_run else "LIVE (will ALTER TABLE)"
    print(f"[D1-Migrate] Target: {endpoint}  |  Mode: {mode}")
    print(f"[D1-Migrate] Patching columns: pexels_id, emotional_tags, envelope_style_id, geo_country_target")

    try:
        r = requests.post(endpoint, headers=headers, json=body, timeout=60)
    except Exception as e:
        print(f"[ERROR] HTTP request failed: {e}")
        return 1

    if r.status_code != 200:
        print(f"[ERROR] HTTP {r.status_code}: {r.text[:500]}")
        return 1

    j = r.json()
    print(f"\n====== D1 Schema Patch Result (ok={j.get('ok')}) ======")
    if "dry_run" in j:
        print(f"  dry_run: {j['dry_run']}")
    if j.get("added"):
        print(f"  Columns added/pending:  {len(j['added'])}")
        for a in j["added"]:
            print(f"    - {a}")
    if j.get("skipped"):
        print(f"  Columns skipped (already exist): {len(j['skipped'])}")
        for s in j["skipped"]:
            print(f"    - {s}")
    if j.get("errors"):
        print(f"  ERRORS ({len(j['errors'])}):")
        for e in j["errors"]:
            print(f"    ! {e}")
    print(f"  Total columns after patch: {j.get('total_columns_after', '?')}")
    if j.get("columns_after"):
        names = sorted(c["name"] for c in j["columns_after"])
        print(f"  Column list: {', '.join(names)}")
    if j.get("note"):
        print(f"  Note: {j['note']}")

    expected = {
        "slug", "title", "category", "tags", "style", "bg_image", "bg_image_watermark",
        "default_text", "default_font", "default_color", "default_filter",
        "aspect_ratio", "og_image", "pexels_id", "emotional_tags",
        "envelope_style_id", "geo_country_target", "seo", "created_at", "updated_at",
    }
    have = {c["name"] for c in (j.get("columns_after") or [])}
    missing = expected - have
    if missing:
        print(f"\n  ⚠️  MISSING REQUIRED COLUMNS: {sorted(missing)}")
        return 3
    print("\n  ✅ All 20 required columns present in D1 cards table!")
    if args.dry_run:
        print("  (Dry-run — re-run without --dry-run to actually apply ALTER TABLE.)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(130)
