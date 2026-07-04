#!/usr/bin/env python3
"""
Dynamic category indexer — SEND-A-FUN S3 directory → single source of truth.

WHY:
  Until now the list of card categories and their pexels ID pools was
  hardcoded in 4 DIFFERENT PLACES:
    • worker/src/index.js :: KNOWN_GOOD_PER_CATEGORY (25 cats × 10 ids = 250)
    • worker/src/index.js :: _MANUAL_CATEGORY_ALIASES (90 aliases)
    • _scripts/phase1-process-originals.py :: _ALL_CATEGORIES (27 entries)
    • _scripts/expand-materials.py        :: CATEGORY_LABELS / RECIPIENT_MULT
  Adding a new folder in sendafun-originals (e.g. "teachers-day/") required
  editing ALL four places + re-running migration + praying everything matched.

RULE (after this script is used everywhere):
    >> The FIRST-LEVEL prefixes of *.png objects inside sendafun-originals ARE
       the ONE AND ONLY canonical category list. <<

  • Adding <new_cat>/pexels-<id>.png files to sendafun-originals + running this
    script produces an updated index.
  • All downstream consumers (worker normalizer, card generator, D1 sync,
    frontend category nav) read the SAME JSON and automatically pick up the
    new category / new pexels IDs — zero Worker source edits required.

OUTPUTS (written atomically):
  • public/_category_index.json  — shipped to the public static bucket (also
                                  uploaded to sendafun-preview R2 so Worker
                                  can read it at boot without bundling a new
                                  release).
  • _scripts/_tmp_known_good.json — legacy consumers during transition.

Index shape:
{
  "schema_version": 2,
  "generated_at_utc": "2026-07-04T12:34:56Z",
  "bucket": "sendafun-originals",
  "total_masters": 250,
  "total_categories": 25,
  "by_category": {
    "birthday": {
      "master_count": 10,
      "pexels_ids": [8014697, 8014703, 8014709, ...],
      "masters": [
        {"key": "birthday/pexels-8014697.png", "pexels_id": 8014697, "size": 1234567}
      ],
      "preview_url_template": "https://pub-....r2.dev/birthday/birthday-pexels-{pexels_id}-v2-vertical.webp",
      "original_url_template": "/api/r2-image/originals/birthday/pexels-{pexels_id}.png"
    },
    ...
  },
  "category_aliases": {
    "apology": "sorry", "dad": "fathers-day", ...   # 90 stable aliases
  },
  "category_keys": ["anniversary", "birthday", ...]  # sorted, canonical order
}
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass

# ---------------------------------------------------------------------------
# Stable 90 aliases (will never come from S3 — user intent must still map to a
# canonical category; users typing "apology" should land on /sorry/). We keep
# them embedded here because they are semantic, not structural. Adding a NEW
# alias just means editing this ONE dict + re-running the indexer.
# ---------------------------------------------------------------------------
STABLE_ALIASES: Dict[str, str] = {
    "apology": "sorry", "apologies": "sorry", "forgive": "sorry",
    "dad": "fathers-day", "dads": "fathers-day", "daddy": "fathers-day",
    "father": "fathers-day", "papa": "fathers-day",
    "fathers": "fathers-day", "dad-day": "fathers-day",
    "mom": "mothers-day", "moms": "mothers-day", "mum": "mothers-day",
    "mothers": "mothers-day", "mother": "mothers-day",
    "mum-day": "mothers-day", "mom-day": "mothers-day",
    "valentines": "valentine", "valentines-day": "valentine",
    "saint-valentine": "valentine",
    "new-years": "new-year", "new-years-eve": "new-year", "nye": "new-year",
    "congrats": "congratulations",
    "thanks": "thank-you", "appreciation": "thank-you", "gratitude": "thank-you",
    "thankyou": "thank-you",
    "encourage": "encouragement", "motivational": "encouragement",
    "support": "encouragement",
    "recovery": "get-well", "healing": "get-well", "feelbetter": "get-well",
    "wellness": "get-well",
    "funeral": "sympathy", "condolence": "sympathy", "condolences": "sympathy",
    "loss": "sympathy", "grief": "sympathy", "bereavement": "sympathy",
    "rip": "sympathy",
    "graduate": "graduation", "grad": "graduation", "diploma": "graduation",
    "bday": "birthday", "happybirthday": "birthday",
    "marry": "wedding", "marriage": "wedding", "engagement": "love",
    "bridal": "wedding",
    "bestfriend": "friendship", "bff": "friendship", "squad": "friendship",
    "friend": "friendship",
    "romantic": "love", "romance": "love", "i-love-you": "love",
    "for-her": "love", "for-him": "love",
    "miss-you": "missing-you", "missyou": "missing-you",
    "retire": "retirement", "retired": "retirement",
    "newborn": "new-baby", "babyshower": "new-baby", "baby-shower": "new-baby",
    "pregnancy": "new-baby", "welcome-baby": "new-baby", "its-a-boy": "new-baby",
    "its-a-girl": "new-baby",
    "xmas": "christmas", "noel": "christmas", "yule": "christmas",
    "christmas-day": "christmas",
    "thankful": "thanksgiving", "turkey": "thanksgiving",
    "fall-holiday": "thanksgiving",
    "spooky": "halloween", "trick-or-treat": "halloween",
    "happy-easter": "easter", "spring": "easter",
    "luck": "good-luck", "best-of-luck": "good-luck", "fortune": "good-luck",
    "thinkofyou": "thinking-of-you", "thoughtofyou": "thinking-of-you",
    "wedding-anniversary": "anniversary",
}

ALIAS_PREVIEW_R2_BASE = (
    os.environ.get("R2_PREVIEW_BASE_URL")
    or "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev"
).rstrip("/")
ALIAS_ORIGINALS_PUBLIC_ROUTE = "/api/r2-image/originals"
PNG_RE = re.compile(r"^(.+)/pexels-(\d+)\.png$", re.I)
PID_EXTRACT = re.compile(r"pexels-(\d+)", re.I)


def boto_s3():
    import boto3  # local import so import-errors are actionable
    for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"):
        if not os.environ.get(k):
            print(f"[indexer] ❌ env {k} not set")
            return None
    return boto3.client(
        "s3",
        endpoint_url="https://" + os.environ["R2_ACCOUNT_ID"] + ".r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=boto3.session.Config(
            signature_version="s3v4",
            connect_timeout=15, read_timeout=30,
            retries={"max_attempts": 3, "mode": "standard"},
            max_pool_connections=16,
        ),
    )


def upload_bytes_to_r2(s3, bucket: str, key: str, data: bytes, content_type: str) -> None:
    """Upload a small index JSON to R2 (preview bucket = public read)."""
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
        CacheControl="public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    )
    print(f"[indexer] ☁️  uploaded s3://{bucket}/{key}  ({len(data)/1024:.1f} KB)")


def list_all(s3, bucket: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    ct = None
    while True:
        kw: Dict[str, Any] = dict(Bucket=bucket, MaxKeys=1000)
        if ct:
            kw["ContinuationToken"] = ct
        r = s3.list_objects_v2(**kw)
        for o in r.get("Contents", []) or []:
            out.append({"Key": o["Key"], "Size": int(o.get("Size") or 0),
                        "LastModified": o.get("LastModified")})
        if not r.get("IsTruncated"):
            break
        ct = r.get("NextContinuationToken")
    return out


def build_index(objects: List[Dict[str, Any]], bucket: str) -> Dict[str, Any]:
    by_cat: Dict[str, Dict[str, Any]] = {}
    total_masters = 0
    for o in objects:
        k = o["Key"]
        if not k.lower().endswith(".png"):
            continue
        # Canonical key format: <category>/pexels-<pid>.png
        m = PNG_RE.match(k)
        if not m:
            seg = k.split("/")
            if len(seg) < 2:
                continue
            pid_m = PID_EXTRACT.search(seg[-1])
            if not pid_m:
                continue
            cat = seg[0]
            pid = int(pid_m.group(1), 10)
        else:
            cat = m.group(1)
            pid = int(m.group(2), 10)
        if not cat:
            continue
        entry = by_cat.setdefault(cat, {"master_count": 0, "pexels_ids": [], "masters": []})
        # Dedup same pid (shouldn't happen, but guard)
        if pid in entry["pexels_ids"]:
            continue
        entry["pexels_ids"].append(pid)
        entry["masters"].append({"key": k, "pexels_id": pid, "size": o["Size"]})
        total_masters += 1
    # Finalize each cat: sort ids asc, sort masters asc by pid, inject templates
    for cat in list(by_cat.keys()):
        e = by_cat[cat]
        e["pexels_ids"].sort()
        e["masters"].sort(key=lambda m: m["pexels_id"])
        e["master_count"] = len(e["pexels_ids"])
        e["preview_url_template"] = (
            f"{ALIAS_PREVIEW_R2_BASE}/{cat}/{cat}-pexels-{{pexels_id}}-v2-vertical.webp"
        )
        e["original_url_template"] = (
            f"{ALIAS_ORIGINALS_PUBLIC_ROUTE}/{cat}/pexels-{{pexels_id}}.png"
        )
    cat_keys = sorted(by_cat.keys())
    return {
        "schema_version": 2,
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "bucket": bucket,
        "total_masters": total_masters,
        "total_categories": len(by_cat),
        "by_category": by_cat,
        "category_aliases": STABLE_ALIASES,
        "category_keys": cat_keys,
    }


def write_public_index(idx: Dict[str, Any]) -> Path:
    out = ROOT / "public" / "_category_index.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".json.tmp")
    data = json.dumps(idx, ensure_ascii=False, indent=2, sort_keys=False).encode("utf-8")
    tmp.write_bytes(data)
    os.replace(tmp, out)
    # legacy mirror for old python scripts (only the KNOWN-good map)
    legacy = {c: list(idx["by_category"][c]["pexels_ids"]) for c in idx["category_keys"]}
    leg_path = ROOT / "_scripts" / "_tmp_known_good.json"
    leg_path.parent.mkdir(parents=True, exist_ok=True)
    leg_path.write_text(json.dumps(legacy, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    print(f"[indexer] 💾 wrote {out}  ({len(data)/1024:.1f} KB, "
          f"{idx['total_categories']} cats × Σ masters = {idx['total_masters']})")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-upload", action="store_true",
                    help="Write public/_category_index.json only; do NOT push to R2 preview bucket")
    ap.add_argument("--also-originals", action="store_true",
                    help="Also push the index JSON to sendafun-originals (private; Worker can still read via bound bucket)")
    ap.add_argument("--only-category", type=str, default=None, help="Reserved; ignored today")
    args = ap.parse_args()

    s3 = boto_s3()
    if not s3:
        print("[indexer] ❌ abort: no S3 credentials")
        return 2

    ob = os.environ.get("R2_ORIGINALS_BUCKET_NAME", "sendafun-originals")
    pb = os.environ.get("R2_PREVIEW_BUCKET_NAME", "sendafun-preview")
    print("=" * 78)
    print("  🧭 SEND-A-FUN DYNAMIC CATEGORY INDEXER  |  S3 directory → single source of truth")
    print("=" * 78)
    print(f"   Originals bucket  : {ob}")
    print(f"   Preview bucket    : {pb}")
    t0 = time.time()
    objs = list_all(s3, ob)
    print(f"   Listed {len(objs)} total objects in originals bucket")
    idx = build_index(objs, ob)
    print(f"   Indexed {idx['total_categories']} canonical categories with "
          f"{idx['total_masters']} PNG masters")
    for c in idx["category_keys"]:
        e = idx["by_category"][c]
        print(f"     • {c:<22}  {e['master_count']:>3} masters  first3={e['pexels_ids'][:3]}   last3={e['pexels_ids'][-3:]}")
    out_path = write_public_index(idx)
    if not args.no_upload:
        data = out_path.read_bytes()
        upload_bytes_to_r2(s3, pb, "_category_index.json", data, "application/json; charset=utf-8")
        if args.also_originals:
            upload_bytes_to_r2(s3, ob, "_meta/_category_index.json", data, "application/json; charset=utf-8")
    # Basic integrity checks
    cat_keys = idx["category_keys"]
    expected_aliases_can = sorted({v for v in STABLE_ALIASES.values()})
    missing = [a for a in expected_aliases_can if a not in cat_keys]
    if missing:
        print(f"[indexer] ⚠️  STABLE_ALIASES point to these canonical categories NOT present in originals bucket: {missing}")
    multi_less_10 = [c for c in cat_keys if idx["by_category"][c]["master_count"] < 10]
    if multi_less_10:
        print(f"[indexer] ⚠️  The following categories have fewer than 10 PNG masters (worker normalizer will still work, but coverage may be thin): {multi_less_10}")
    elapsed = time.time() - t0
    print(f"[indexer] ✅ Done in {elapsed:.1f}s.")
    print("   Next steps after adding new originals files:")
    print("     1. python _scripts/_s3_category_indexer.py")
    print("     2. python _scripts/_d1_sync_align_s2_apply.py --apply   # rewrites card refs")
    print("     3. python _scripts/expand-materials.py --upload-only    # optional, to generate new card entries for new categories")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(130)
