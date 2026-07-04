#!/usr/bin/env python3
"""Build KNOWN_GOOD_PER_CATEGORY: confirmed pexels IDs per category from Preview bucket + D1 category set."""
from __future__ import annotations
import os, json, sys
from pathlib import Path
from collections import defaultdict
import boto3
from botocore.config import Config
from dotenv import load_dotenv
import requests

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

PREV = "sendafun-preview"
ENDPOINT = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"

cfg = Config(connect_timeout=30, read_timeout=180, retries={"max_attempts": 3, "mode": "adaptive"})
s3 = boto3.client("s3", endpoint_url=ENDPOINT,
                 aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                 aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
                 region_name="auto", config=cfg)

# Step 1: Gather D1 categories that actually appear in card catalog (up to 500 cards)
CATEGORIES = set()
for page in range(1, 25):  # up to 24*24 = 576 cards sampled
    try:
        r = requests.get("https://sendafun.com/api/cards", params={"size":24,"page":page}, timeout=20)
        j = r.json()
    except Exception as e:
        print("D1 fetch page", page, "ERR:", e, file=sys.stderr)
        continue
    cs = j.get("cards",[])
    if not cs: break
    for c in cs:
        cat = c.get("category")
        if isinstance(cat,str) and cat:
            CATEGORIES.add(cat.strip().lower())

print(f"[Step 1] D1 unique categories sampled: {len(CATEGORIES)} -> {sorted(CATEGORIES)}", file=sys.stderr)

# Step 2: For each category, list objects in PREVIEW bucket up to 100, extract photo IDs
# Key format: {cat}/{cat}-pexels-{ID}-v2-vertical.webp
import re
ID_RE = re.compile(r"pexels-(\d+)-v2-vertical\.webp$")
KNOWN = defaultdict(list)

for cat in sorted(CATEGORIES):
    n = 0
    try:
        kw = {"Bucket": PREV, "Prefix": cat + "/", "MaxKeys": 100}
        while True:
            r = s3.list_objects_v2(**kw)
            cs = r.get("Contents",[]) or []
            for o in cs:
                k = o["Key"]
                m = ID_RE.search(k)
                if m:
                    pid = int(m.group(1))
                    if pid not in KNOWN[cat]:
                        KNOWN[cat].append(pid)
                        n += 1
            if not r.get("IsTruncated") or n >= 30:
                break
            kw["ContinuationToken"] = r["NextContinuationToken"]
        print(f"  {cat:25s}: {n} known IDs", file=sys.stderr)
    except Exception as e:
        print(f"  {cat:25s}: ERROR {type(e).__name__}: {e}", file=sys.stderr)

# For categories with 0 known IDs, fall back to a universal pool (use sorry or anniversary IDs which are known existing in at least one category — but we can't reuse across categories because the folder prefix differs). So we'll instead use a CATEGORY_FALLBACK_MAP for missing cats: pick the nearest alias from keys that DO have IDs.
cat_keys = set(KNOWN.keys())
missing = sorted([c for c in CATEGORIES if c not in cat_keys or len(KNOWN[c])==0])
if missing:
    print(f"[WARN] {len(missing)} categories have 0 preview keys: {missing}", file=sys.stderr)

# Also output fallback aliases rules for common name variants:
# e.g. "father's-day" vs "fathers-day", "new-year" vs "new-years", "valentine" vs "valentines-day" etc.
ALIASES = [
    # list from similar missing → resolved known key
]

# Export as JS ready to paste into Worker source + comment
out = {}
for c, ids in sorted(KNOWN.items()):
    out[c] = sorted(ids)[:30]  # cap at 30 IDs/cat = plenty for deterministic hash

print("\n// KNOWN_GOOD_PER_CATEGORY: " + str(sum(len(v) for v in out.values())) + " total photo IDs across " + str(len(out)) + " categories")
print("const KNOWN_GOOD_PER_CATEGORY = " + json.dumps(out, indent=2, ensure_ascii=False) + ";")

# Missing categories with 0 IDs need special handling
if missing:
    print("\n// CATEGORIES MISSING IN PREVIEW BUCKET (" + str(len(missing)) + "): " + ", ".join(missing))
    # Suggestion: use one of the KNOWN categories that HAS IDs as backup by alias
    # We'll create a mapping table for missing → nearest known by name similarity
    def similarity(a, b):
        sa, sb = set(a.replace("'s","").replace("-day","").replace("s-day","").split("-")), set(b.replace("'s","").replace("-day","").replace("s-day","").split("-"))
        inter = sa & sb
        return len(inter) + (0.5 if sa and sb else 0)
    alias_map = {}
    known_list = sorted(k for k,v in out.items() if len(v) > 0)
    for mc in missing:
        best = max(known_list, key=lambda k: similarity(mc, k)) if known_list else (known_list[0] if known_list else "sorry")
        alias_map[mc] = best
    print("const CATEGORY_ALIAS_MAP = " + json.dumps(alias_map, indent=2, ensure_ascii=False) + ";")
