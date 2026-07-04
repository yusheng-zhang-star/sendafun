#!/usr/bin/env python3
"""Build KNOWN_GOOD_PER_CATEGORY by scanning ENTIRE PREVIEW bucket (few thousand objects)."""
from __future__ import annotations
import os, json, sys, re
from pathlib import Path
from collections import defaultdict
import boto3
from botocore.config import Config
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
PREV = "sendafun-preview"
ENDPOINT = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"

cfg = Config(connect_timeout=30, read_timeout=180, retries={"max_attempts": 3, "mode": "adaptive"})
s3 = boto3.client("s3", endpoint_url=ENDPOINT,
                 aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                 aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
                 region_name="auto", config=cfg)

ID_RE = re.compile(r"pexels-(\d+)-v2-vertical\.webp$")
CAT_RE = re.compile(r"^([^/]+)/")
KNOWN = defaultdict(list)
total = 0

kw = {"Bucket": PREV, "MaxKeys": 1000}
pages = 0
while True:
    pages += 1
    r = s3.list_objects_v2(**kw)
    cs = r.get("Contents",[]) or []
    for o in cs:
        total += 1
        k = o["Key"]
        cm = CAT_RE.match(k)
        if not cm: continue
        cat = cm.group(1).strip().lower()
        m = ID_RE.search(k)
        if not m: continue
        pid = int(m.group(1))
        if pid not in KNOWN[cat]:
            KNOWN[cat].append(pid)
    if not r.get("IsTruncated"): break
    kw["ContinuationToken"] = r["NextContinuationToken"]
    if pages % 5 == 0: print(f"  scanned {pages} pages... {total} objects, {len(KNOWN)} cats", file=sys.stderr)

print(f"[DONE] {total} objects scanned | {len(KNOWN)} unique categories | {sum(len(v) for v in KNOWN.values())} photo IDs", file=sys.stderr)

# Sort IDs per category for determinism
SORTED = {c: sorted(set(ids)) for c, ids in KNOWN.items()}

# Also capture total objects per category to spot "categories with IDs that exist but few"
cat_counts = defaultdict(int)
for c, ids in SORTED.items():
    cat_counts[c] = len(ids)

print()
print("// ====================================================")
print("// KNOWN_GOOD_PER_CATEGORY: ALL confirmed Preview IDs from S3 full scan")
print(f"// Categories: {len(SORTED)} | IDs total: {sum(len(v) for v in SORTED.values())}")
print(f"// Generated from bucket full scan ({total} objects)")
print("// ====================================================")
print("const KNOWN_GOOD_PER_CATEGORY = " + json.dumps(SORTED, indent=2, ensure_ascii=False) + ";")

# Print categories sorted by count descending for sanity
print()
print("// Categories by ID count:")
for c, n in sorted(cat_counts.items(), key=lambda x: -x[1]):
    print(f"//   {c:30s} {n:4d} IDs")
