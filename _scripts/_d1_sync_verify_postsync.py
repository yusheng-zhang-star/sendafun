#!/usr/bin/env python3
"""
POST-SYNC verify:
  1. Re-fetch ALL 500 D1 cards via /api/cards (pagination).
  2. Load Originals bucket 250 PNG (canonical_category, pexels_id_int) set = GROUND TRUTH.
  3. CROSS CHECK: every D1 card (category, pexelsId) must be present in GROUND TRUTH.
  4. CROSS CHECK: every D1 card's bg_image / bg_image_watermark / og_image points at
     the CORRECT preview URL (<cat>/<cat>-pexels-<id>-v2-vertical.webp).
  5. Summary report + exit code.
"""
import os, sys, re, json, time
from pathlib import Path
from collections import Counter, defaultdict
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

# ------------------------------------------------------------
# 0) Re-use worker constants parser from Step 2 (same Python)
# ------------------------------------------------------------
sys.path.insert(0, str(ROOT / "_scripts"))
from _d1_sync_align_s2_apply import (
    compute_normalized_fields,
    ALIASES,
    KNOWN_CATS,
    KNOWN_ID_BY_CAT,
)
from _d1_sync_align_s1_precheck import list_originals_png_pairs, boto_s3

PREVIEW_R2_BASE = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev"
_WM_RE = re.compile(r"-pexels-(\d+)-v2-vertical\.webp$")


def fetch_all_d1_cards():
    import requests
    base = os.environ.get("D1_API_BASE_URL", "https://sendafun.com").rstrip("/")
    url = base + "/api/cards"
    token = os.environ.get("CARDS_BULK_API_TOKEN", "").strip()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    page = 1
    out = []
    t0 = time.time()
    total_declared = 0
    while True:
        # Worker uses q.get('size'), not 'limit'. Default=24, max=10000.
        r = requests.get(url, params={"page": page, "size": 1000}, headers=headers, timeout=90)
        r.raise_for_status()
        j = r.json()
        arr = j.get("cards") or j.get("data") or j.get("items") or j.get("rows") or []
        if not isinstance(arr, list):
            arr = []
        out.extend(arr)
        total_declared = int(j.get("total") or j.get("totalCards") or total_declared or 0)
        p = j.get("pageInfo") or {}
        pn = j.get("pagination") or {}
        has_next = (
            p.get("hasNextPage")
            or pn.get("hasMore")
            or j.get("hasMore")
        )
        # Stop conditions
        if len(arr) == 0:
            break
        if total_declared and len(out) >= total_declared:
            break
        if (p or pn) and has_next is False:
            break
        if page >= 500:   # 11067 cards / 1000 per page = 12 pages max
            break
        page += 1
    elapsed = time.time() - t0
    return out, total_declared, elapsed


def safe_pid(card):
    return (
        card.get("pexelsId") if isinstance(card.get("pexelsId"), str)
        else (str(card.get("pexels_id")) if card.get("pexels_id") is not None else "")
    ).strip()


def safe_cat(card):
    c = card.get("category") if isinstance(card.get("category"), str) else ""
    return (c or "").strip().lower() or "__null__"


def safe_url(card, *keys):
    for k in keys:
        v = card.get(k)
        if isinstance(v, str) and v:
            return v.strip()
    return ""


def main():
    print("=" * 80)
    print("  🧪 POST-SYNC VERIFY: D1 ↔ Originals bucket (PNG master set)")
    print("=" * 80)

    # 1) Originals bucket ground truth
    s3 = boto_s3()
    OB = os.environ.get("R2_ORIGINALS_BUCKET_NAME", "sendafun-originals")
    if not s3:
        print("❌ can't load S3 credentials")
        sys.exit(2)
    orig_pairs, orig_by_cat, _ = list_originals_png_pairs(s3, OB)
    print(f"  Originals {OB}: {len(orig_pairs)} PNG unique (category, pexels_id) pairs")
    print(f"  Aliases loaded: {len(ALIASES)}  |  Known canonical cats: {len(KNOWN_CATS)}")

    # 2) Re-fetch fresh D1
    print(f"\n  Fetching ALL D1 cards via /api/cards (pagination)...")
    cards, declared_total, elapsed = fetch_all_d1_cards()
    print(f"    Fetched {len(cards)} cards in {elapsed:.1f}s  (API declared total = {declared_total})")

    save = ROOT / "_scripts" / "_tmp_d1_all_cards_dump_POSTSYNC.json"
    with open(save, "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)
    print(f"    💾 Saved fresh dump → {save}")

    # 3) Cross check: (category, pexelsId) present in originals PNG set?
    before_bad = 0
    url_mismatches = 0
    bad_pairs = Counter()
    bad_examples = []
    by_cat_counts = Counter()
    pids_by_cat_in_d1 = defaultdict(set)
    for idx, card in enumerate(cards):
        cat = safe_cat(card)
        pid_str = safe_pid(card)
        by_cat_counts[cat] += 1
        try:
            pid_int = int(pid_str, 10)
        except ValueError:
            pid_int = -1
        pids_by_cat_in_d1[cat].add(pid_int)
        if (cat, pid_int) not in orig_pairs:
            before_bad += 1
            bad_pairs[(cat, pid_str)] += 1
            if len(bad_examples) < 5:
                bad_examples.append((idx, card.get("slug"), cat, pid_str, safe_url(card, "bg_image")))

        # 4) URL correctness: bg_image / bg_image_watermark / og_image should all
        #    equal PREVIEW_R2_BASE/<canonical_cat>/<canonical_cat>-pexels-<pid>-v2-vertical.webp
        expected_url = f"{PREVIEW_R2_BASE}/{cat}/{cat}-pexels-{pid_str}-v2-vertical.webp"
        bg = safe_url(card, "bg_image", "bgImage")
        wm = safe_url(card, "bg_image_watermark", "bgImageWatermark")
        og = safe_url(card, "og_image", "ogImage")
        if not (bg == expected_url and wm == expected_url and (og == expected_url or og == "")):
            url_mismatches += 1

    # Distribution: every KNOWN cat in D1 should have subset of pexels ids = KNOWN[cat]
    unknown_cats_d1 = [c for c in by_cat_counts if c not in KNOWN_CATS]
    pids_vs_known_mismatch = []
    for cat in KNOWN_CATS:
        if cat not in pids_by_cat_in_d1:
            continue
        d1_set = pids_by_cat_in_d1[cat]
        known_set = set(KNOWN_ID_BY_CAT.get(cat, []))
        extra_in_d1 = sorted(d1_set - known_set)
        missing_in_d1 = sorted(known_set - d1_set)
        if extra_in_d1 or missing_in_d1:
            pids_vs_known_mismatch.append((cat, extra_in_d1, missing_in_d1))

    # 5) Report
    print("\n" + "#" * 80)
    print("#  ✅ RESULTS")
    print("#" * 80)
    print(f"   Category set: D1 uses {len([c for c in by_cat_counts if c in KNOWN_CATS])}/{len(KNOWN_CATS)} canonical cats")
    print(f"   Unknown category keys in D1: {unknown_cats_d1 if unknown_cats_d1 else '(none, perfect!)'}")
    print(f"   D1 (category, pexelsId) NOT present in Originals PNG set — BEFORE mismatch count (current D1 after sync):")
    print(f"       🎯 {before_bad} / {len(cards)} bad pairs  {'(0 is PERFECT! ✅)' if before_bad == 0 else f' 🔴 MISMATCH! Top bad: {bad_pairs.most_common(5)}'}")
    print(f"   Material reference URLs (bg_image / bgImageWatermark / og_image) match expected URL:")
    print(f"       🎯 mismatches = {url_mismatches} / {len(cards)}  {'(0 is PERFECT! ✅)' if url_mismatches == 0 else ' 🔴 WRONG URLs!'}")
    print(f"\n   Per-category pexelsId distribution (D1):")
    for cat, cnt in sorted(by_cat_counts.items()):
        pids = sorted(pids_by_cat_in_d1.get(cat, set()))
        mark = "🔴" if cat not in KNOWN_CATS else "  "
        print(f"     {mark} {cat:<22} ×{cnt:<5} card(s)   unique pexels_ids={pids}")
    if pids_vs_known_mismatch:
        print(f"\n   🔴 KNOWN_GOOD subset violations (cat, ids):")
        for cat, extra, miss in pids_vs_known_mismatch:
            if extra: print(f"     • {cat}: pexelsIds in D1 NOT in KNOWN_GOOD: {extra}")
    if bad_examples:
        print(f"\n   First 5 bad (cat,pid) examples:")
        for idx, slug, cat, pid, url in bad_examples:
            print(f"     • #{idx} slug={slug}  ({cat},{pid})  bg={url}")
    print("\n   D1 categories distribution (top) → card counts:")
    print("    ", by_cat_counts.most_common(8))

    if before_bad == 0 and url_mismatches == 0 and not unknown_cats_d1 and not pids_vs_known_mismatch:
        print("\n" + "🎉" * 20)
        print("  🎉 POST-SYNC PASS — 100% D1 ↔ Originals PNG alignment!")
        print("🎉" * 20)
        sys.exit(0)
    else:
        print("\n" + "🔴" * 20)
        print("  🔴 POST-SYNC FAIL — see mismatches above")
        print("🔴" * 20)
        sys.exit(1)


if __name__ == "__main__":
    main()
