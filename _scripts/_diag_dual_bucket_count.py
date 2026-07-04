#!/usr/bin/env python3
"""Simple dual-bucket object counter (no name pattern filtering)."""
from __future__ import annotations
import os, sys
from pathlib import Path
from collections import Counter
import boto3
from botocore.config import Config
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

ORIG = "sendafun-originals"
PREV = "sendafun-preview"
ENDPOINT = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"

def s3():
    cfg = Config(connect_timeout=30, read_timeout=120, retries={"max_attempts": 3, "mode": "adaptive"})
    return boto3.client("s3", endpoint_url=ENDPOINT,
                        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
                        region_name="auto", config=cfg)

def count_all(c, bucket):
    n = 0; total_size = 0; exts = Counter(); cats = Counter()
    kw = {"Bucket": bucket, "MaxKeys": 1000}
    while True:
        r = c.list_objects_v2(**kw)
        for o in r.get("Contents", []) or []:
            n += 1
            total_size += o.get("Size", 0)
            k = o["Key"]
            if "/" in k:
                cat = k.split("/", 1)[0]
                cats[cat] += 1
            ext = "." + k.rsplit(".", 1)[1].lower() if "." in k else "(noext)"
            exts[ext] += 1
        if not r.get("IsTruncated"):
            break
        kw["ContinuationToken"] = r["NextContinuationToken"]
    return n, total_size, exts, cats

c = s3()
print("=" * 70)
print("DUAL-BUCKET OBJECT COUNT (no name filter)")
print("=" * 70)
for name, b in [("ORIGINALS (高清PNG母版桶)", ORIG), ("PREVIEW (WebP带水印预览桶)", PREV)]:
    try:
        n, sz, exts, cats = count_all(c, b)
        print(f"\n✅ {name}")
        print(f"   Bucket:   {b}")
        print(f"   Objects:  {n}")
        print(f"   Size:     {sz/1024/1024:.1f} MB")
        print(f"   Exts:     " + ", ".join(f"{k}={v}" for k,v in sorted(exts.items())))
        print(f"   Top cats: " + ", ".join(f"{k}={v}" for k,v in cats.most_common(10)))
        print(f"   Unique categories: {len(cats)}")
    except Exception as e:
        print(f"❌ {name}: {e}")

print()
# Also D1 count
try:
    import requests
    r = requests.get("https://sendafun.com/api/cards?limit=1", timeout=20)
    j = r.json()
    print(f"📋 D1 cards (实际模板总数 /api/cards): {j.get('total')} 条 (含warm/playful/heartfelt 3变体/张母图)")
except Exception as e:
    print(f"⚠️ D1 fetch fail: {e}")
