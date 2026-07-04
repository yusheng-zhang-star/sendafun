#!/usr/bin/env python3
"""快速调用Worker POST /api/db/_rebuild_fts 修复FTS5损坏"""
import json, os, sys, requests
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError: pass

TOKEN = os.environ.get("CARDS_BULK_API_TOKEN", "").strip()
if not TOKEN:
    print("ERROR: CARDS_BULK_API_TOKEN not set"); sys.exit(2)

import argparse
ap = argparse.ArgumentParser()
ap.add_argument("--base-url", default=os.environ.get("D1_API_BASE_URL","https://sendafun.com"))
ap.add_argument("--dry-run", action="store_true")
args = ap.parse_args()

endpoint = args.base_url.rstrip("/") + "/api/db/_rebuild_fts"
headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
body = {"dry_run": bool(args.dry_run)}
print(f"POST {endpoint}  dry_run={args.dry_run}")
r = requests.post(endpoint, headers=headers, json=body, timeout=180)
print(f"HTTP {r.status_code}")
j = r.json()
print(json.dumps(j, indent=2, ensure_ascii=False)[:6000])
sys.exit(0 if r.status_code==200 and j.get("ok") else 1)
