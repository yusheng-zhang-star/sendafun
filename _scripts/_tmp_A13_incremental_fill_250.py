#!/usr/bin/env python3
"""
SendAFun — PLAN A-1.3: Incrementally fill 25-cat × 10 = 250 target
=============================================================

Current state after A11 (2026-07-03):
  · sendafun-originals bucket: 215 PNGs (0 JPGs, clean!)
  · 14 categories below 10-count target → TOTAL MISSING = 35

What this script does:
  1. List sendafun-originals → map (category → set of already-used pexels_ids)
  2. Scan raw-originals → filter (cat ∈ 14 deficit, long_side ≥ 2800, ID NOT used)
  3. For each deficit category, sort candidates by long_side DESC, TOP K needed
  4. Upload those K files as  {category}/pexels-{pexels_id}.jpg  to Originals
     (Step 2 will next convert .jpg → .png transparent 2047, delete old jpg,
      guaranteeing zero leftover JPGs.)
  5. Print a final summary so user can run Step2 + Step3.

Target: after Step 2 runs → exactly 250 PNGs in originals bucket (25×10).
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
from typing import Dict, List, Optional, Set, Tuple

import boto3
from botocore.config import Config
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
PER_CAT_TARGET = 10
MIN_LONG_SIDE = 2800

ORIGINALS_BUCKET = "sendafun-originals"
R2_ENDPOINT_URL = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"


def _s3_client():
    cfg = Config(
        connect_timeout=30,
        read_timeout=120,
        retries={"max_attempts": 5, "mode": "adaptive"},
        tcp_keepalive=True,
    )
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=cfg,
    )


# ---------- Parsers ----------
_FN_RE = re.compile(r"^(?P<cat>[a-z0-9-]+)_pexels_(?P<id>\d+)\.(?P<ext>jpe?g|png|webp)$", re.I)

@dataclass
class Candidate:
    path: Path
    cat: str
    pexels_id: str
    ext: str
    long_side: int
    short_side: int


def list_originals_ids(s3) -> Dict[str, Set[str]]:
    """Return {category: set(pexels_ids_already_in_bucket)}."""
    out: Dict[str, Set[str]] = {c: set() for c in CANONICAL_25_CATS}
    kwargs = {"Bucket": ORIGINALS_BUCKET, "MaxKeys": 1000}
    while True:
        r = s3.list_objects_v2(**kwargs)
        for o in r.get("Contents", []) or []:
            k = o["Key"]
            parts = k.split("/", 1)
            if len(parts) != 2:
                continue
            cat, base = parts
            if cat not in CAT_SET:
                continue
            stem = base
            for ext in (".jpeg", ".jpg", ".png", ".webp", ".JPG", ".JPEG", ".PNG"):
                if stem.endswith(ext):
                    stem = stem[: -len(ext)]
                    break
            # pexels-12345
            m = re.match(r"^pexels-(?P<id>\d+)$", stem)
            if m:
                out[cat].add(m.group("id"))
        if not r.get("IsTruncated"):
            break
        kwargs["ContinuationToken"] = r["NextContinuationToken"]
    return out


def scan_raw_candidates() -> Dict[str, List[Candidate]]:
    """Walk raw-originals/, measure long-side, filter ≥ MIN_LONG_SIDE."""
    if not RAW_DIR.exists():
        print(f"[FATAL] {RAW_DIR} missing. Run expand-materials.py first.")
        sys.exit(3)
    all_files = [f for f in RAW_DIR.iterdir() if f.is_file()]
    print(f"[SCAN] raw-originals/ → {len(all_files)} files; measuring long-side with PIL...")
    buckets: Dict[str, List[Candidate]] = {c: [] for c in CANONICAL_25_CATS}

    def _measure(f: Path) -> Optional[Candidate]:
        m = _FN_RE.match(f.name)
        if not m:
            return None
        cat, pid, ext = m.group("cat"), m.group("id"), m.group("ext").lower()
        ext = "jpg" if ext == "jpeg" else ext
        if cat not in CAT_SET:
            return None
        try:
            with Image.open(f) as im:
                w, h = im.size
        except Exception:
            return None
        ls = max(w, h)
        ss = min(w, h)
        if ls < MIN_LONG_SIDE:
            return None
        return Candidate(f, cat, pid, ext, ls, ss)

    with ThreadPoolExecutor(max_workers=max(2, min(12, (os.cpu_count() or 2)))) as ex:
        futs = [ex.submit(_measure, f) for f in all_files]
        for fut in tqdm(as_completed(futs), total=len(futs), desc="Scan raw-originals"):
            try:
                c = fut.result()
            except Exception:
                continue
            if not c:
                continue
            buckets[c.cat].append(c)
    for c in CANONICAL_25_CATS:
        buckets[c].sort(key=lambda x: (-x.long_side, -x.short_side, x.pexels_id))
    return buckets


def upload_candidate(s3, cand: Candidate, dry_run: bool) -> Tuple[str, bool, str]:
    dst_key = f"{cand.cat}/pexels-{cand.pexels_id}.jpg"
    if dry_run:
        return dst_key, True, f"DRY long={cand.long_side}"
    try:
        body = cand.path.read_bytes()
        s3.put_object(
            Bucket=ORIGINALS_BUCKET,
            Key=dst_key,
            Body=body,
            ContentType="image/jpeg",
            CacheControl="public, max-age=31536000, immutable",
        )
        return dst_key, True, f"OK long={cand.long_side} size={len(body)//1024}KB"
    except Exception as e:
        return dst_key, False, f"FAIL: {e}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="Actually upload missing JPGs to originals bucket (default: dry-run).")
    args = ap.parse_args()
    apply_mode = bool(args.apply)
    dry_run = not apply_mode

    print("=" * 80)
    print("🧩 A-1.3 INCREMENTAL FILL: 25 cats × 10 PNG = 250 target")
    print("=" * 80)
    print(f"Mode : {'🔴 LIVE APPLY (upload JPGs)' if apply_mode else '🛡️  DRY-RUN (no upload)'}")
    print(f"Per-cat target : {PER_CAT_TARGET}")
    print(f"Min long side  : ≥ {MIN_LONG_SIDE} px")
    print(f"Source dir     : {RAW_DIR}")
    print(f"Dest bucket    : {ORIGINALS_BUCKET} (as {{cat}}/pexels-{{id}}.jpg → Step2 converts to .png)")
    print("=" * 80)
    print()

    s3 = _s3_client()

    # Step 1: current state
    print("[1/3] Listing originals bucket current IDs...")
    existing = list_originals_ids(s3)
    current_counts = {c: len(existing[c]) for c in CANONICAL_25_CATS}
    deficit: Dict[str, int] = {}
    for c in CANONICAL_25_CATS:
        cur = current_counts[c]
        if cur < PER_CAT_TARGET:
            deficit[c] = PER_CAT_TARGET - cur
    total_current = sum(current_counts.values())
    total_missing = sum(deficit.values())
    print(f"      Current PNGs in bucket: {total_current}")
    print(f"      Total missing to 250  : {total_missing} (across {len(deficit)} categories)")
    print()
    print(f"{'cat':<22} {'cur':>4} {'need':>4} {'note':<30}")
    print("-" * 80)
    for c in CANONICAL_25_CATS:
        cur = current_counts[c]
        need = deficit.get(c, 0)
        tag = "✅ OK" if need == 0 else f"⬇️  need {need} more"
        print(f"{c:<22} {cur:>4} {need:>4} {tag}")
    print("-" * 80)
    print()

    if total_missing == 0:
        print("🎉 Already at 25×10 = 250! Nothing to do.")
        return 0

    # Step 2: scan raw-originals candidates
    print("[2/3] Scanning raw-originals for candidates ≥ 2800px long-side...")
    raw_cands = scan_raw_candidates()
    # Filter out already-used IDs per category
    picks: List[Candidate] = []
    print()
    print("Per-category candidate selection (dedup against bucket IDs):")
    for c in CANONICAL_25_CATS:
        need = deficit.get(c, 0)
        if need == 0:
            continue
        used = existing[c]
        # Exclude any candidate whose pexels_id already appears in the bucket
        avail = [x for x in raw_cands[c] if x.pexels_id not in used]
        if len(avail) == 0:
            print(f"  ⚠️  {c:<22} need {need:>2} but NO ≥2800px candidates left in raw-originals! "
                  f"(raw had {len(raw_cands[c])}, all IDs already in bucket)")
            continue
        take = avail[:need]
        if len(take) < need:
            print(f"  ⚠️  {c:<22} need {need:>2} raw available {len(avail)} → SHORT by {need-len(take)}; "
                  f"long min/max = {take[-1].long_side if take else '-'}/{take[0].long_side if take else '-'}")
        else:
            print(f"  ✅ {c:<22} picked {len(take):>2} / {need:>2} "
                  f"(long {take[-1].long_side}–{take[0].long_side} px)")
        picks.extend(take)

    total_picked = len(picks)
    print(f"\nTotal candidates picked for upload : {total_picked} (target missing {total_missing})")
    if total_picked < total_missing:
        print(f"⚠️  Raw-originals only has {total_picked} eligible left; "
              f"remaining {total_missing - total_picked} shortfall cannot be auto-filled.")
    print()

    # Step 3: upload
    print(f"[3/3] {'Uploading' if apply_mode else 'DRY: preview uploading'} {total_picked} JPGs → originals bucket...")
    ok = 0
    fail = 0
    t0 = time.time()
    pbar = tqdm(total=total_picked, desc="Upload JPGs" if apply_mode else "Preview uploads")
    with ThreadPoolExecutor(max_workers=max(2, min(8, (os.cpu_count() or 2)))) as ex:
        futs = [ex.submit(upload_candidate, s3, c, dry_run) for c in picks]
        for fut in as_completed(futs):
            try:
                key, success, msg = fut.result()
            except Exception as e:
                fail += 1
                pbar.write(f"  [EXCEPTION] {e}")
            else:
                if success:
                    ok += 1
                else:
                    fail += 1
                    pbar.write(f"  [FAIL] {key} → {msg}")
            pbar.update(1)
    pbar.close()

    print()
    print("=" * 80)
    print("📊 A-1.3 SUMMARY")
    print("=" * 80)
    print(f"Target missing          : {total_missing}")
    print(f"Candidates eligible     : {total_picked}")
    print(f"Uploaded / Preview-OK   : {ok}")
    print(f"Failed                  : {fail}")
    print(f"Elapsed                 : {time.time()-t0:.1f}s")
    print()
    if apply_mode and ok > 0:
        next_total = total_current + ok
        print(f"👉 Bucket now has ~{next_total} source objects (mix of JPG+PNG).")
        print("   NEXT STEPS (run in order):")
        print("   (1) python _scripts/_step2_standardize_originals.py --apply")
        print("          → converts all JPGs to 2047px transparent PNGs,")
        print("            deletes all old .jpg → bucket ends with ALL PNGs,")
        print("            count target ~250 (25×10).")
        print("   (2) python _scripts/_step3_generate_previews.py --apply")
        print("          → generates 1 preview PNG per master into preview bucket.")
        print("   (3) Run _diag_a12_bucket.py again to verify 25×10.")
    elif not apply_mode:
        print("👉 No uploads made (dry-run). Re-run with --apply to actually send.")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(130)
