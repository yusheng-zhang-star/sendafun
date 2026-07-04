#!/usr/bin/env python3
"""
SendAFun — Step 1: Cleanup 2 R2 Buckets (25×10 test subset only)
================================================================

WHAT IT DOES
============
Originals bucket (sendafun-originals):
  Group objects by 25 category prefixes, KEEP ONLY 10 objects per category
  (sorted alphabetically by key), DELETE everything else inside those
  categories + any orphan object that doesn't belong to any of the 25
  canonical categories.

Preview bucket (sendafun-preview):
  DELETE EVERYTHING — full purge, no exceptions.

New total kept after this step:
  Originals: 25 categories × 10 = 250 HD PNG master files
  Preview:   0 objects (will be regenerated fresh in Step 3)

USAGE
=====
  # Dry-run — print stats, NO changes
  python _scripts/_step1_cleanup_r2_buckets.py

  # Actually execute deletions (review dry-run first!)
  python _scripts/_step1_cleanup_r2_buckets.py --apply

ENV (from project .env):
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Tuple

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Canonical 25 categories (exactly matching CATEGORY_LABELS in expand-materials)
# ---------------------------------------------------------------------------
CANONICAL_25_CATS: List[str] = [
    "anniversary", "birthday", "christmas", "congratulations", "easter",
    "encouragement", "fathers-day", "friendship", "get-well", "good-luck",
    "graduation", "halloween", "love", "missing-you", "mothers-day",
    "new-baby", "new-year", "retirement", "sorry", "sympathy",
    "thank-you", "thanksgiving", "thinking-of-you", "valentine", "wedding",
]
CANONICAL_25_SET = set(CANONICAL_25_CATS)
KEEP_PER_CATEGORY = 10

ORIGINALS_BUCKET = "sendafun-originals"
PREVIEW_BUCKET = "sendafun-preview"
R2_ENDPOINT_URL = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def list_all_objects(s3, bucket: str) -> List[dict]:
    """Paginate ListObjectsV2 until done."""
    out: List[dict] = []
    kwargs = {"Bucket": bucket, "MaxKeys": 1000}
    while True:
        try:
            r = s3.list_objects_v2(**kwargs)
        except ClientError as e:
            print(f"  [ERROR] list_objects_v2 bucket={bucket}: {e}")
            raise
        for o in r.get("Contents", []) or []:
            out.append(o)
        if not r.get("IsTruncated"):
            break
        kwargs["ContinuationToken"] = r["NextContinuationToken"]
    return out


def classify_originals(objects: List[dict]) -> Tuple[Dict[str, List[dict]], List[dict]]:
    """
    Group originals objects by category prefix.
    Returns (grouped_by_cat, orphan_objects_not_in_any_25_cat).
    """
    grouped: Dict[str, List[dict]] = {c: [] for c in CANONICAL_25_CATS}
    orphans: List[dict] = []
    for o in objects:
        key = o["Key"]
        if "/" not in key:
            orphans.append(o)
            continue
        cat = key.split("/", 1)[0]
        if cat in CANONICAL_25_SET:
            grouped[cat].append(o)
        else:
            orphans.append(o)
    # Sort each group alphabetically by key for deterministic keep selection
    for cat in grouped:
        grouped[cat].sort(key=lambda x: x["Key"])
    orphans.sort(key=lambda x: x["Key"])
    return grouped, orphans


def build_originals_deletions(grouped: Dict[str, List[dict]], orphans: List[dict]) -> Tuple[List[dict], List[dict]]:
    """
    Keep first KEEP_PER_CATEGORY in each canonical cat group; delete the rest.
    All orphans → delete.
    Returns (kept_objects, delete_objects).
    """
    kept: List[dict] = []
    delete: List[dict] = []
    for cat in CANONICAL_25_CATS:
        lst = grouped[cat]
        kept.extend(lst[:KEEP_PER_CATEGORY])
        delete.extend(lst[KEEP_PER_CATEGORY:])
    delete.extend(orphans)
    return kept, delete


def bulk_delete(s3, bucket: str, keys: List[str]) -> Tuple[int, int, int]:
    """
    S3 DeleteObjects max 1000 keys per call.
    Returns (deleted_count, error_count, bytes_freed).
    """
    deleted = 0
    errs = 0
    freed = 0
    chunk_sz = 1000
    for i in range(0, len(keys), chunk_sz):
        chunk = keys[i:i + chunk_sz]
        # Need to HEAD each to get Size before deletion — simpler: use sizes map caller passed?
        # We only pass plain keys here; caller reports size stats separately.
        try:
            r = s3.delete_objects(
                Bucket=bucket,
                Delete={"Objects": [{"Key": k} for k in chunk], "Quiet": False},
            )
        except ClientError as e:
            print(f"    [ERROR] DeleteObjects chunk #{i // chunk_sz + 1}: {e}")
            errs += len(chunk)
            continue
        for d in r.get("Deleted", []) or []:
            deleted += 1
        for e in r.get("Errors", []) or []:
            errs += 1
            print(f"    [WARN] Delete error Key={e.get('Key')} Code={e.get('Code')} Msg={e.get('Message')}")
        if (i // chunk_sz + 1) % 3 == 0:
            pct = (i + len(chunk)) / max(1, len(keys)) * 100
            print(f"    delete progress {pct:.0f}% ({i + len(chunk)}/{len(keys)}) deleted={deleted} errors={errs}")
    return deleted, errs, freed


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Actually execute deletions (default: dry-run only)")
    args = ap.parse_args()

    print("=" * 80)
    print("🪣  STEP 1: R2 BUCKETS CLEANUP — 25×10 TEST SUBSET")
    print("=" * 80)
    print()
    print(f"Originals bucket: {ORIGINALS_BUCKET} → keep 10 / cat, delete the rest + orphans")
    print(f"Preview bucket:   {PREVIEW_BUCKET} → full purge (all objects deleted)")
    print(f"Canonical cats:   {len(CANONICAL_25_CATS)}  →  {', '.join(CANONICAL_25_CATS[:5])} ...")
    print()
    if not args.apply:
        print("⚠️  DRY-RUN MODE — NO CHANGES WILL BE MADE")
        print("   Add --apply after confirming counts above to actually execute.")
    else:
        print("🔴 LIVE MODE — deletions will be executed against live R2 buckets")
    print("=" * 80)
    print()

    s3 = _s3_client()

    # ========================================================================
    # [A] ORIGINALS BUCKET
    # ========================================================================
    print("[A/2] ORIGINALS BUCKET (sendafun-originals): listing objects...")
    orig_objs = list_all_objects(s3, ORIGINALS_BUCKET)
    total_n_orig = len(orig_objs)
    total_sz_orig = sum(o.get("Size", 0) for o in orig_objs)
    print(f"      Total objects: {total_n_orig:>6d}   size={total_sz_orig / 1024 / 1024:.0f} MB ({total_sz_orig / 1024 / 1024 / 1024:.2f} GB)")
    print()

    grouped, orphans = classify_originals(orig_objs)
    kept, to_del_orig = build_originals_deletions(grouped, orphans)
    kept_sz = sum(o.get("Size", 0) for o in kept)
    del_sz_orig = sum(o.get("Size", 0) for o in to_del_orig)

    print("    Category breakdown (keep first 10 by key, delete rest):")
    print(f"    {'CAT':<20s} {'TOTAL':>6s} {'KEEP':>5s} {'DELETE':>7s}   {'KEEP_SIZE':>9s}")
    print("    " + "-" * 70)
    for cat in CANONICAL_25_CATS:
        lst = grouped[cat]
        n = len(lst)
        k = min(KEEP_PER_CATEGORY, n)
        d = n - k
        ksz = sum(o.get("Size", 0) for o in lst[:KEEP_PER_CATEGORY])
        print(f"    {cat:<20s} {n:>6d} {k:>5d} {d:>7d}   {ksz/1024/1024:>8.1f} MB")
    orph_n = len(orphans)
    orph_sz = sum(o.get("Size", 0) for o in orphans)
    print(f"    {'ORPHANS (non-25-cat)':<20s} {orph_n:>6d} {0:>5d} {orph_n:>7d}   {0.0:>8.1f} MB")
    print("    " + "-" * 70)
    print(f"    {'TOTAL':<20s} {total_n_orig:>6d} {len(kept):>5d} {len(to_del_orig):>7d}   kept={kept_sz/1024/1024:.0f} MB | delete={del_sz_orig/1024/1024:.0f} MB ({del_sz_orig/1024/1024/1024:.2f} GB freed)")
    print()
    # Sanity check — we should end up with exactly 250 kept or less
    print(f"    ✅ Sanity kept count = {len(kept)} / target 250 (25 cats × 10)")
    if len(kept) < 250:
        missing_cats = [c for c in CANONICAL_25_CATS if len(grouped[c]) < KEEP_PER_CATEGORY]
        print(f"       ⚠️  Under-target categories (<10 objects): {', '.join(missing_cats)}")
    print()

    # ========================================================================
    # [B] PREVIEW BUCKET — FULL PURGE
    # ========================================================================
    print("[B/2] PREVIEW BUCKET (sendafun-preview): listing objects...")
    prev_objs = list_all_objects(s3, PREVIEW_BUCKET)
    total_n_prev = len(prev_objs)
    total_sz_prev = sum(o.get("Size", 0) for o in prev_objs)
    print(f"      Total objects: {total_n_prev:>6d}   size={total_sz_prev / 1024 / 1024:.0f} MB ({total_sz_prev / 1024 / 1024 / 1024:.2f} GB)")
    print(f"      Action → FULL PURGE (all {total_n_prev} objects will be deleted)")
    print()

    # ========================================================================
    # EXECUTE (if --apply)
    # ========================================================================
    t0 = time.time()
    if not args.apply:
        print("[EXEC] 🛡️  DRY-RUN — skipping actual deletions.")
        print("       Run with --apply to actually delete.")
        print()
    else:
        print("[EXEC] 🔴 LIVE — Originals bucket deletions...")
        del_keys_orig = [o["Key"] for o in to_del_orig]
        od, oe, _ = bulk_delete(s3, ORIGINALS_BUCKET, del_keys_orig)
        print(f"      Originals DELETE done: ok={od} errors={oe}  ~freed {del_sz_orig/1024/1024:.0f} MB")
        print()
        print("[EXEC] 🔴 LIVE — Preview bucket FULL PURGE...")
        del_keys_prev = [o["Key"] for o in prev_objs]
        pd, pe, _ = bulk_delete(s3, PREVIEW_BUCKET, del_keys_prev)
        print(f"      Preview DELETE done: ok={pd} errors={pe}  ~freed {total_sz_prev/1024/1024:.0f} MB")
        print()

    # ========================================================================
    # FINAL SUMMARY
    # ========================================================================
    print("=" * 80)
    print("📊 STEP 1 FINAL SUMMARY")
    print("=" * 80)
    print(f"Originals bucket BEFORE: {total_n_orig:>6d} objs   {total_sz_orig/1024/1024:.0f} MB")
    print(f"Originals bucket AFTER : {len(kept):>6d} objs   {kept_sz/1024/1024:.0f} MB  (keep 10 / 25 cats = 250 max)")
    print(f"  → Originals freed     : {len(to_del_orig):>6d} objs   {del_sz_orig/1024/1024:.0f} MB ({del_sz_orig/1024/1024/1024:.2f} GB)")
    print()
    print(f"Preview bucket BEFORE  : {total_n_prev:>6d} objs   {total_sz_prev/1024/1024:.0f} MB")
    print(f"Preview bucket AFTER   : {0:>6d} objs   0.0 MB  (full purge — regenerate fresh in Step 3)")
    print(f"  → Preview freed       : {total_n_prev:>6d} objs   {total_sz_prev/1024/1024:.0f} MB ({total_sz_prev/1024/1024/1024:.2f} GB)")
    print()
    print(f"Total across 2 buckets  : FREE {len(to_del_orig) + total_n_prev:>6d} objs / {(del_sz_orig + total_sz_prev)/1024/1024/1024:.2f} GB")
    print(f"Elapsed total: {time.time() - t0:.1f}s")
    print()
    if not args.apply:
        print("👉 NEXT: After confirming dry-run counts look right, run:")
        print("   python _scripts/_step1_cleanup_r2_buckets.py --apply")
        print("   → then proceed to Step 2 (standardize originals to 2048px transparent PNG)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
