#!/usr/bin/env python3
"""A4: Quick dual-bucket audit + 1:1 key mapping check."""
from __future__ import annotations
import os, sys, re
from pathlib import Path
from collections import defaultdict

import boto3
from botocore.config import Config
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

ORIG = "sendafun-originals"
PREV = "sendafun-preview"
ENDPOINT = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"

def s3():
    cfg = Config(connect_timeout=30, read_timeout=120,
                 retries={"max_attempts": 3, "mode": "adaptive"}, tcp_keepalive=True)
    return boto3.client("s3", endpoint_url=ENDPOINT,
                        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
                        region_name="auto", config=cfg)

def list_all(c, bucket):
    out = []
    kw = {"Bucket": bucket, "MaxKeys": 1000}
    while True:
        r = c.list_objects_v2(**kw)
        for o in r.get("Contents", []) or []:
            out.append(o)
        if not r.get("IsTruncated"):
            break
        kw["ContinuationToken"] = r["NextContinuationToken"]
    return out

CANON = ["anniversary","birthday","christmas","congratulations","easter",
         "encouragement","fathers-day","friendship","get-well","good-luck",
         "graduation","halloween","love","missing-you","mothers-day",
         "new-baby","new-year","retirement","sorry","sympathy",
         "thank-you","thanksgiving","thinking-of-you","valentine","wedding"]
CAT_SET = set(CANON)

def main():
    c = s3()
    oo = list_all(c, ORIG)
    pp = list_all(c, PREV)

    orig_by_cat = defaultdict(list)
    orig_ids = set()
    bad_orig = []
    for o in oo:
        k = o["Key"]
        parts = k.split("/", 1)
        if len(parts) != 2 or parts[0] not in CAT_SET:
            bad_orig.append(k); continue
        cat, fn = parts
        m = re.match(r"^pexels-(\d+)\.png$", fn, re.I)
        if not m:
            bad_orig.append(k); continue
        pid = m.group(1)
        orig_by_cat[cat].append((pid, k, o.get("Size", 0)))
        orig_ids.add((cat, pid))

    prev_by_cat = defaultdict(list)
    prev_ids = set()
    bad_prev = []
    for o in pp:
        k = o["Key"]
        parts = k.split("/", 1)
        if len(parts) != 2 or parts[0] not in CAT_SET:
            bad_prev.append(k); continue
        cat, fn = parts
        m = re.match(r"^([a-z0-9-]+)-pexels-(\d+)-v2-vertical\.webp$", fn, re.I)
        if not m:
            bad_prev.append(k); continue
        if m.group(1) != cat:
            bad_prev.append(k + " [cat prefix mismatch]"); continue
        pid = m.group(2)
        prev_by_cat[cat].append((pid, k, o.get("Size", 0)))
        prev_ids.add((cat, pid))

    print("=" * 80)
    print("A-4  DUAL-BUCKET CLOSURE AUDIT  (25 cats × 10 target)")
    print("=" * 80)
    print()
    print(f"Originals bucket : {ORIG}  →  {len(oo):>4d} objects  ({sum(o['Size'] for o in oo)/1024/1024:.1f} MB)")
    print(f"Preview bucket   : {PREV}  →  {len(pp):>4d} objects  ({sum(o['Size'] for o in pp)/1024/1024:.1f} MB)")
    print(f"Originals parse OK: {len(orig_ids)} ids, bad keys: {len(bad_orig)}")
    print(f"Preview   parse OK: {len(prev_ids)} ids, bad keys: {len(bad_prev)}")
    print()

    # 1:1 mapping check
    missing_prev = orig_ids - prev_ids
    extra_prev = prev_ids - orig_ids
    matched = orig_ids & prev_ids
    print(f"✅ 1:1 matched      : {len(matched)} / {len(orig_ids)} originals")
    print(f"❌ Missing preview  : {len(missing_prev)}  (orig → no preview)")
    if missing_prev:
        for mp in sorted(missing_prev)[:10]:
            print(f"    · {mp[0]}/pexels-{mp[1]}.png → NO PREVIEW")
    print(f"⚠️  Extra preview    : {len(extra_prev)}  (preview → no orig)")
    if extra_prev:
        for ep in sorted(extra_prev)[:10]:
            print(f"    · {ep[0]}/{ep[0]}-pexels-{ep[1]}-v2-vertical.webp → NO ORIG")

    print()
    print("Per-category counts (orig / preview / target 10):")
    print("-" * 58)
    all_perfect = True
    for cat in CANON:
        on = len(orig_by_cat[cat])
        pn = len(prev_by_cat[cat])
        mark = "✅" if (on == 10 and pn == 10) else "❌"
        if on != 10 or pn != 10: all_perfect = False
        print(f"  {cat:<22s}  {on:>2d} / {pn:>2d} / 10   {mark}")
    print("-" * 58)
    print(f"Overall per-category 25×10: {'✅ PERFECT' if all_perfect else '❌ INCOMPLETE'}")
    print()

    # Sample size stats
    orig_sizes = sorted([s for _,_,s in sum(orig_by_cat.values(), [])])
    prev_sizes = sorted([s for _,_,s in sum(prev_by_cat.values(), [])])
    def stat(arr, label):
        if not arr: return
        total = sum(arr)/1024/1024
        print(f"{label}: n={len(arr)} total={total:.1f}MB  "
              f"min={arr[0]/1024:.1f}KB  "
              f"p50={arr[len(arr)//2]/1024:.1f}KB  "
              f"p95={arr[int(len(arr)*0.95)]/1024:.1f}KB  "
              f"max={arr[-1]/1024:.1f}KB  "
              f"avg={sum(arr)/len(arr)/1024:.1f}KB")
    stat(orig_sizes, "Originals (PNG)")
    stat(prev_sizes, "Previews  (WebP)")

    # Volume band report for Originals (per user 1.5 soft / 4.0 hard)
    TARGET = int(1.5 * 1024 * 1024)
    HARD   = int(4.0 * 1024 * 1024)
    bands = {"≤1.5MB (soft OK)": 0, "1.5-4MB (warn OK)": 0, ">4MB (FAIL)": 0}
    for s in orig_sizes:
        if s <= TARGET: bands["≤1.5MB (soft OK)"] += 1
        elif s <= HARD: bands["1.5-4MB (warn OK)"] += 1
        else:           bands[">4MB (FAIL)"] += 1
    print()
    print("Originals size-band report (user policy: 1.5MB soft, 4.0MB hard):")
    for k, v in bands.items():
        print(f"  · {k:<22s} : {v:>3d} / {len(orig_sizes)}")
    if bands[">4MB (FAIL)"] > 0:
        print("  ⚠️  WARNING: files exceeding 4MB hard limit detected!")
    else:
        print("  ✅ ZERO files exceed 4.0MB hard limit.")
    print()

    # Closure verdict
    print("=" * 80)
    all_ok = (len(oo) == 250 == len(pp)
              and len(bad_orig) == 0 and len(bad_prev) == 0
              and len(missing_prev) == 0 and len(extra_prev) == 0
              and all_perfect
              and bands[">4MB (FAIL)"] == 0)
    if all_ok:
        print("🏆  A-4 VERDICT: FULL CLOSURE — 25×10 = 250 PAIRS MATCHED PERFECTLY")
    else:
        print("⚠️  A-4 VERDICT: ISSUES FOUND — review details above")
        sys.exit(1)
    print("=" * 80)

if __name__ == "__main__":
    main()
