#!/usr/bin/env python3
"""List key patterns in PREVIEW R2 bucket and compare to known D1 broken keys."""
from __future__ import annotations
import os, sys
from pathlib import Path
from collections import Counter
import boto3
from botocore.config import Config
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
ORIG = "sendafun-originals"
PREV = "sendafun-preview"
ENDPOINT = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"

cfg = Config(connect_timeout=30, read_timeout=120, retries={"max_attempts": 3, "mode": "adaptive"})
c = boto3.client("s3", endpoint_url=ENDPOINT,
                 aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                 aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
                 region_name="auto", config=cfg)

BROKEN_KEYS = [
    "sorry/sorry-pexels-6935080-v2-vertical.webp",
    "congratulations/congratulations-pexels-10477179-vertical.webp",
    "encouragement/encouragement-pexels-11561039-vertical.webp",
    "love/love-pixabay-10067260-vertical.webp",
    "birthday/birthday-pexels-10165858-vertical.webp",
    "thank-you/thank-you-pexels-10287392-vertical.webp",
    "get-well/get-well-pexels-10521321-vertical.webp",
]

def iter_keys(bucket, limit=3000):
    kw = {"Bucket": bucket, "MaxKeys": 1000}
    got = 0
    while got < limit:
        r = c.list_objects_v2(**kw)
        cs = r.get("Contents",[]) or []
        for o in cs:
            yield o["Key"]
            got += 1
            if got >= limit: return
        if not r.get("IsTruncated"): return
        kw["ContinuationToken"] = r["NextContinuationToken"]

for name, bucket in [("PREVIEW (sample 3000)", PREV), ("ORIGINALS (sample 3000)", ORIG)]:
    print(f"\n{'='*70}\n{name} keys\n{'='*70}")
    exts = Counter()
    cats = Counter()
    sample_keys = []
    has_vertical = 0; has_v2 = 0; has_pexels = 0; has_pixabay = 0; has_unsplash = 0
    count = 0
    for k in iter_keys(bucket, 3000):
        count += 1
        if len(sample_keys) < 40: sample_keys.append(k)
        if "." in k: exts[k.rsplit(".",1)[1].lower()] += 1
        else: exts["(noext)"] += 1
        if "/" in k: cats[k.split("/",1)[0]] += 1
        lk = k.lower()
        if "vertical" in lk: has_vertical += 1
        if "-v2" in lk or "/v2" in lk: has_v2 += 1
        if "pexels" in lk: has_pexels += 1
        if "pixabay" in lk: has_pixabay += 1
        if "unsplash" in lk: has_unsplash += 1
    N = max(1,count)
    print(f"  Sampled {count} keys")
    print(f"  Exts:  " + ", ".join(f"{e}={n}({100.0*n/N:.0f}%)" for e,n in exts.most_common(10)))
    print(f"  Cats (top 10): " + ", ".join(f"{c}={n}" for c,n in cats.most_common(10)))
    print(f"  has_vertical: {has_vertical}/{N} ({100.0*has_vertical/N:.1f}%)")
    print(f"  has_v2:       {has_v2}/{N} ({100.0*has_v2/N:.1f}%)")
    print(f"  has_pexels:   {has_pexels}/{N} ({100.0*has_pexels/N:.1f}%)")
    print(f"  has_pixabay:  {has_pixabay}/{N} ({100.0*has_pixabay/N:.1f}%)")
    print(f"  has_unsplash: {has_unsplash}/{N} ({100.0*has_unsplash/N:.1f}%)")
    print(f"  Sample 40 keys:")
    for k in sample_keys: print(f"    {k}")

    # Now test BROKEN_KEYS existence in bucket: do prefix/exists check
    print(f"\n  Checking 7 BROKEN D1 keys vs bucket:")
    for bk in BROKEN_KEYS:
        cat = bk.split("/",1)[0]
        fname = bk.split("/",1)[1]
        # check exact
        try:
            c.head_object(Bucket=bucket, Key=bk)
            s = "EXISTS"
        except Exception as _e:
            s = "MISSING"
        print(f"    [{s}] {bk}")
        if s == "MISSING":
            # list prefix in bucket (cat/)
            try:
                prefs = c.list_objects_v2(Bucket=bucket, Prefix=cat + "/", MaxKeys=20)
                xs = [o["Key"] for o in (prefs.get("Contents") or [])]
                print(f"         {cat}/ actual sample in bucket:")
                for x in xs[:6]: print(f"           - {x}")
            except Exception as e2:
                print(f"         prefix list error: {e2}")
