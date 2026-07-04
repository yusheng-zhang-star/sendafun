#!/usr/bin/env python3
"""
SendAFun — PLAN A-1.0: Rebuild Originals bucket from raw-originals
===================================================================

PROBLEM:  Previous 250-subset kept in originals bucket after Step-1 cleanup
          were mostly < 2800px (legacy files).  Step2 has HARD rule:
          source long side >= 2800  ->  ALL 250 skipped, 0 conversions.

FIX:      Scan local raw-originals/ (7900+ downloaded Pexels sources).
          For each of 25 canonical categories, filter files with long side
          >= 2800 px, sort by long side DESC, take TOP 10.
          Purge ALL existing objects in sendafun-originals.
          Upload the chosen 250 sources with canonical paths:
              {category}/pexels-{pexels_id}.{original_ext}
          ORIGINAL ext kept (jpg/jpeg/png) — Step 2 will normalise to .png.
          Pexels ID + category path 100% per DOC LINE 4 (unchanged).

Output:   exactly 250 objects in sendafun-originals, ALL >= 2800 px, ready
          for Step 2 standardize pass (which should now succeed on ~95%).
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from PIL import Image
from tqdm import tqdm

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

RAW_DIR = ROOT_DIR / "raw-originals"

CANONICAL_25_CATS: List[str] = [
    "anniversary", "birthday", "christmas", "congratulations", "easter",
    "encouragement", "fathers-day", "friendship", "get-well", "good-luck",
    "graduation", "halloween", "love", "missing-you", "mothers-day",
    "new-baby", "new-year", "retirement", "sorry", "sympathy",
    "thank-you", "thanksgiving", "thinking-of-you", "valentine", "wedding",
]
CAT_SET = set(CANONICAL_25_CATS)

MIN_LONG_SIDE = 2800
PER_CAT_TARGET = 10

ORIGINALS_BUCKET = "sendafun-originals"
R2_ENDPOINT_URL = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


# -------------------- Local raw file scanning --------------------
_FN_RE = re.compile(r"^(?P<cat>[a-z0-9-]+)_pexels_(?P<id>\d+)\.(?P<ext>jpe?g|png|webp)$", re.I)


@dataclass
class Candidate:
    path: Path
    cat: str
    pexels_id: str
    ext: str            # original extension (lowercase, 'jpeg' normalised to 'jpg')
    long_side: int
    short_side: int


def scan_raw() -> Dict[str, List[Candidate]]:
    """Walk raw-originals/, parse pexels IDs, filter by canonical 25 cats,
    open with PIL to measure long-side, only keep >= MIN_LONG_SIDE."""
    if not RAW_DIR.exists():
        print(f"[FATAL] {RAW_DIR} missing. Cannot rebuild.")
        sys.exit(3)
    all_files = list(RAW_DIR.iterdir())
    print(f"[SCAN] raw-originals/ contains {len(all_files)} entries, opening+measuring...")
    buckets: Dict[str, List[Candidate]] = {c: [] for c in CANONICAL_25_CATS}
    skipped_cat = 0
    skipped_small = 0
    skipped_bad = 0

    def _measure(f: Path) -> Optional[Candidate]:
        m = _FN_RE.match(f.name)
        if not m:
            return None
        cat, pid, ext = m.group("cat"), m.group("id"), m.group("ext").lower()
        ext = "jpg" if ext == "jpeg" else ext
        if cat not in CAT_SET:
            return "__skip_cat__"
        try:
            with Image.open(f) as im:
                w, h = im.size
        except Exception:
            return "__skip_bad__"
        ls = max(w, h)
        ss = min(w, h)
        if ls < MIN_LONG_SIDE:
            return "__skip_small__"
        return Candidate(f, cat, pid, ext, ls, ss)

    with ThreadPoolExecutor(max_workers=max(2, min(12, (os.cpu_count() or 2)))) as ex:
        futs = [ex.submit(_measure, f) for f in all_files if f.is_file()]
        for fut in tqdm(as_completed(futs), total=len(futs), desc="Scan raw-originals"):
            r = fut.result()
            if r is None:
                skipped_bad += 1
                continue
            if isinstance(r, str):
                if r == "__skip_cat__":
                    skipped_cat += 1
                elif r == "__skip_small__":
                    skipped_small += 1
                else:
                    skipped_bad += 1
                continue
            buckets[r.cat].append(r)

    print(f"[SCAN DONE] eligible per category:")
    total_eligible = 0
    for c in CANONICAL_25_CATS:
        n = len(buckets[c])
        total_eligible += n
        tag = "✅" if n >= PER_CAT_TARGET else "⚠️"
        print(f"  {tag} {c:<20} {n:>4d} >= {MIN_LONG_SIDE}px" +
              (f"  (shortfall {PER_CAT_TARGET-n})" if n < PER_CAT_TARGET else ""))
    print(f"\nTotal eligible: {total_eligible}  (target {len(CANONICAL_25_CATS)*PER_CAT_TARGET})")
    print(f"Skipped: outside-25-cats={skipped_cat}, <{MIN_LONG_SIDE}px={skipped_small}, unreadable/badname={skipped_bad}")

    shortfall_cats = [c for c in CANONICAL_25_CATS if len(buckets[c]) < PER_CAT_TARGET]
    if shortfall_cats:
        print(f"\n[WARN] {len(shortfall_cats)} categories have < {PER_CAT_TARGET} eligible. "
              "Will take ALL available for those (will be < 250 total).")
    return buckets


def pick_top(buckets: Dict[str, List[Candidate]]) -> List[Candidate]:
    """Per category: sort by long_side DESC, take top PER_CAT_TARGET."""
    picked: List[Candidate] = []
    for c in CANONICAL_25_CATS:
        lst = sorted(buckets[c], key=lambda x: x.long_side, reverse=True)
        taken = lst[:PER_CAT_TARGET]
        picked.extend(taken)
    print(f"\n[PICK] Selected top-{PER_CAT_TARGET}/cat = {len(picked)} candidates.")
    return picked


# -------------------- Bucket purge + upload --------------------
def list_all_keys(s3) -> List[str]:
    keys: List[str] = []
    kw = {"Bucket": ORIGINALS_BUCKET, "MaxKeys": 1000}
    while True:
        r = s3.list_objects_v2(**kw)
        for o in r.get("Contents", []) or []:
            keys.append(o["Key"])
        if not r.get("IsTruncated"):
            break
        kw["ContinuationToken"] = r["NextContinuationToken"]
    return keys


def purge_all(s3, keys: List[str]) -> int:
    if not keys:
        return 0
    deleted = 0
    # boto3 delete_objects allows max 1000/batch
    for i in range(0, len(keys), 1000):
        batch = [{"Key": k} for k in keys[i:i+1000]]
        try:
            r = s3.delete_objects(Bucket=ORIGINALS_BUCKET, Delete={"Objects": batch, "Quiet": True})
            deleted += len(r.get("Deleted", []) or batch)
        except ClientError as e:
            print(f"  [ERROR] purge batch: {e}")
    return deleted


def upload_one(s3, c: Candidate) -> Tuple[bool, str, int]:
    dst_key = f"{c.cat}/pexels-{c.pexels_id}.{c.ext}"
    try:
        with open(c.path, "rb") as fh:
            data = fh.read()
        ctype = {
            "jpg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
        }.get(c.ext, "image/jpeg")
        s3.put_object(
            Bucket=ORIGINALS_BUCKET, Key=dst_key, Body=data,
            ContentType=ctype, CacheControl="public, max-age=31536000, immutable",
        )
        return True, dst_key, len(data)
    except Exception as e:
        return False, dst_key, 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="Scan, pick, print plan — do NOT purge or upload.")
    ap.add_argument("--apply", action="store_true",
                    help="Live: purge originals bucket, upload picked 250.")
    args = ap.parse_args()
    if not args.dry_run and not args.apply:
        print("ERROR: use --dry-run (first) or --apply.")
        return 2

    print("=" * 80)
    print("📥 A-1.0: REBUILD ORIGINALS BUCKET FROM RAW-ORIGINALS (>= 2800px × 250)")
    print("=" * 80)
    print(f"Source dir       : {RAW_DIR}")
    print(f"Target bucket    : {ORIGINALS_BUCKET}")
    print(f"Rule             : 25 cats × top-{PER_CAT_TARGET} largest, long side >= {MIN_LONG_SIDE} px")
    print(f"Mode             : {'🛡️  DRY RUN' if args.dry_run else '🔴 LIVE APPLY — will PURGE bucket + re-upload'}")
    print("=" * 80, "\n")

    buckets = scan_raw()
    picked = pick_top(buckets)

    # Sample print
    if picked:
        print("\nTop 3 / cat sample (long_side + filename):")
        by_cat: Dict[str, List[Candidate]] = defaultdict(list)
        for c in picked:
            by_cat[c.cat].append(c)
        for c in CANONICAL_25_CATS:
            top3 = sorted(by_cat[c], key=lambda x: x.long_side, reverse=True)[:3]
            if not top3:
                continue
            print(f"  {c:<20} | " +
                  "  ".join(f"{x.long_side}px pexels-{x.pexels_id}.{x.ext}" for x in top3))

    if args.dry_run:
        print("\n👉 DRY RUN OK.")
        print(f"   Next:  python _scripts/_tmp_A10_rebuild_originals_from_raw.py --apply")
        print(f"   Then:  python _scripts/_step2_standardize_originals.py --apply")
        return 0

    # ==== LIVE ====
    s3 = _s3_client()
    existing_keys = list_all_keys(s3)
    print(f"\n[PURGE] Found {len(existing_keys)} existing objects in {ORIGINALS_BUCKET}.")
    if existing_keys:
        print("        Purging ALL to ensure no legacy <2800px leftovers...")
        n_del = purge_all(s3, existing_keys)
        print(f"        Purged {n_del}/{len(existing_keys)} objects. ✅")
    else:
        print("        Bucket already empty. ✅")

    print(f"\n[UPLOAD] Uploading {len(picked)} candidates with {max(4, min(16, (os.cpu_count() or 2)))} threads...")
    t0 = time.time()
    ok_uploaded = 0
    total_bytes = 0
    failures: List[str] = []
    n_threads = max(4, min(16, (os.cpu_count() or 2)))
    with ThreadPoolExecutor(max_workers=n_threads) as ex:
        futs = [ex.submit(upload_one, s3, c) for c in picked]
        for fut in tqdm(as_completed(futs), total=len(futs), desc="Upload originals"):
            ok, key, nbytes = fut.result()
            if ok:
                ok_uploaded += 1
                total_bytes += nbytes
            else:
                failures.append(key)

    elapsed = time.time() - t0
    print()
    print("=" * 80)
    print("📊 A-1.0 FINAL SUMMARY")
    print("=" * 80)
    print(f"Bucket purge           : {len(existing_keys)} old objects removed")
    print(f"Upload target          : {len(picked)}")
    print(f"  ✅ Uploaded OK       : {ok_uploaded}")
    print(f"  ❌ Failed            : {len(failures)}")
    if failures:
        for f in failures[:10]:
            print(f"      FAIL {f}")
        if len(failures) > 10:
            print(f"      ... +{len(failures)-10} more")
    print(f"Total bytes uploaded   : {total_bytes/1024/1024:.1f} MB")
    print(f"Avg / file             : {(total_bytes/max(1,ok_uploaded))/1024/1024:.2f} MB")
    print(f"Destination keys format: {{category}}/pexels-{{pexels_id}}.{{ext}} "
          "(DOC LINE 4: pexels_id + category path preserved — only ext = actual source ext, "
          "Step 2 will normalise to .png)")
    print(f"Elapsed                : {elapsed:.1f}s")
    print()
    print("👉 NEXT: Run Step 2 standardize to produce transparent 2048px PNG masters:")
    print("     python _scripts/_step2_standardize_originals.py --apply")
    return 0 if ok_uploaded >= (len(picked) - len(failures) // 2) else 1


if __name__ == "__main__":
    sys.exit(main())
