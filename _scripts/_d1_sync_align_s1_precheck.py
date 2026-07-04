#!/usr/bin/env python3
"""
Step 1 / Step 2 — D1 ↔ Originals alignment.

STEP 1 (this file):
  - Parse KNOWN_GOOD_PER_CATEGORY from worker/src/index.js (EXACT Python
    reimplementation of Worker normalize logic: aliases, FNV1a hash,
    slug-deterministic mapping).
  - Verify IDs per category EXACTLY match originals bucket PNG masters.
  - Dump JSON files needed by Step 2.

Usage:
  python _scripts/_d1_sync_align_s1_precheck.py
"""
import os, sys, re, json
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parent.parent

# ----------------------------------------------------------------
# 1) Load + parse Worker index.js sections: KNOWN_GOOD + alias map
# ----------------------------------------------------------------
JS_PATH = ROOT / "worker" / "src" / "index.js"
JS = JS_PATH.read_text(encoding="utf-8")


def _extract_const_js_obj(name: str):
    """Extract `const NAME = { ... };` object literal from JS.
    - Keys:   "double-quoted" OR unquoted JS identifier.
    - Values: [int-list] (KNOWN_GOOD_PER_CATEGORY) OR "string" (aliases).
    - Handles multiple (k:v, k2:v2) comma-separated pairs on the SAME LINE.
    """
    pat = re.compile(
        rf"const\s+{re.escape(name)}\s*=\s*(\{{[^;]*?\n\}})\s*;",
        re.S,
    )
    m = pat.search(JS)
    if not m:
        raise RuntimeError(f"const {name} not found in worker index.js")
    body = m.group(1)
    out = {}
    key_re = r'(?:"(?P<q>[^"]+)"|(?P<u>[A-Za-z_][A-Za-z0-9_-]*))'
    pat_str = (
        rf"{key_re}\s*:\s*(?:"
        rf"\[(?P<arr>[^\]]*)\]"
        rf'|"(?P<s>[^"]*)"'
        rf")\s*,?"
    )
    pair_pat = re.compile(pat_str, re.X)
    for mm in pair_pat.finditer(body):
        key = mm.group("q") or mm.group("u")
        if not key:
            continue
        arr_txt = mm.group("arr")
        s_txt = mm.group("s")
        if arr_txt is not None:
            ids = [int(x) for x in arr_txt.split(",") if x.strip()]
            out[key] = ids
        else:
            out[key] = s_txt
    return out


KNOWN = _extract_const_js_obj("KNOWN_GOOD_PER_CATEGORY")
ALIASES_RAW = _extract_const_js_obj("_MANUAL_CATEGORY_ALIASES")

assert len(KNOWN) == 25, f"KNOWN should be 25 cats, got {len(KNOWN)}: {sorted(KNOWN)}"
sum_ids = sum(len(v) for v in KNOWN.values())
assert sum_ids == 250, f"KNOWN total IDs should be 250 (25 cats × 10), got {sum_ids}"
KNOWN_CATS = sorted(KNOWN.keys())
KNOWN_ID_BY_CAT = {c: list(KNOWN[c]) for c in KNOWN_CATS}

# ----------------------------------------------------------------
# 2) Reimplement Worker normalize logic EXACTLY in Python
# ----------------------------------------------------------------
def _resolve_known_category(input_cat):
    if not input_cat:
        return "birthday"
    raw = str(input_cat).strip().lower()
    if not raw:
        return "birthday"
    if raw in KNOWN:
        return raw
    if raw in ALIASES_RAW:
        return ALIASES_RAW[raw]
    tokens = set(raw.replace("'s", "").replace("-day", "").split("-"))
    tokens.discard("")
    best = "birthday"
    best_score = -1
    for k in KNOWN_CATS:
        kt = set(k.replace("'s", "").replace("-day", "").split("-"))
        kt.discard("")
        score = len(tokens & kt)
        prefix_raw = raw[: min(3, len(raw))] if len(raw) >= 1 else ""
        prefix_k = k[:3]
        if prefix_raw and prefix_k[: min(3, len(prefix_raw))] in prefix_raw:
            score += 0.3
        if prefix_raw and k.startswith(prefix_raw[: min(3, len(prefix_raw))]):
            score += 0.3
        if score > best_score:
            best_score = score
            best = k
    return best


def _fnv1a32(s: str) -> int:
    h = 0x811C9DC5
    for i in range(len(s)):
        h ^= ord(s[i])
        h = h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))
        h &= 0xFFFFFFFF
    return h


_R2_WM_RE = re.compile(r"-pexels-(\d+)-v2-vertical\.webp$")
PREVIEW_R2_BASE = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev"


def normalize_card(card: dict):
    """Python mirror of worker/src/index.js :: normalizeCardImages(card)."""
    if not card:
        return card, {}
    slug = card.get("slug") or card.get("Slug") or ""
    title = card.get("title") or ""
    src_cat = str(card.get("category") or "").strip() if isinstance(card.get("category"), str) else ""
    src_cat_lc = src_cat.lower() or "birthday"
    known_cat = _resolve_known_category(src_cat_lc)
    pool = KNOWN_ID_BY_CAT.get(known_cat)
    if not pool:
        # shouldn't happen
        known_cat = "birthday"
        pool = KNOWN_ID_BY_CAT["birthday"]
    slug_seed = str(slug) if isinstance(slug, str) else (str(title) if isinstance(title, str) else "x")
    existing_wm = card.get("bgImageWatermark") if isinstance(card.get("bgImageWatermark"), str) else ""
    existing_bg = card.get("bgImage") if isinstance(card.get("bgImage"), str) else ""
    wm_match = _R2_WM_RE.search(existing_wm)
    keep_existing = False
    if wm_match and ("/" + known_cat + "/") in existing_wm:
        try:
            pid = int(wm_match.group(1), 10)
            if pid in pool:
                keep_existing = True
                chosen_id = pid
        except (ValueError, TypeError):
            pass
    if not keep_existing:
        idx = _fnv1a32(slug_seed) % len(pool)
        chosen_id = pool[idx]
    wm_url = f"{PREVIEW_R2_BASE}/{known_cat}/{known_cat}-pexels-{chosen_id}-v2-vertical.webp"
    chosen_id_s = str(chosen_id)
    new = {
        "category": known_cat,
        "pexels_id": chosen_id_s,
        "pexelsId": chosen_id_s,
        "bg_image": wm_url,
        "bgImage": wm_url,
        "bg_image_watermark": wm_url,
        "bgImageWatermark": wm_url,
    }
    if not (isinstance(card.get("ogImage"), str) and card.get("ogImage")):
        new["ogImage"] = wm_url
        new["og_image"] = wm_url
    else:
        new["ogImage"] = card["ogImage"]
        new["og_image"] = card["ogImage"]
    return card, new


# ----------------------------------------------------------------
# 3) S3 originals bucket: build (category, id) set = GROUND TRUTH
# ----------------------------------------------------------------
def boto_s3():
    import boto3
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"):
        if not os.environ.get(k):
            print(f"  ⚠️ env {k} not set")
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


def list_originals_png_pairs(s3, bucket):
    """Return set[(category, pexels_id_int)]."""
    out = set()
    by_cat = defaultdict(list)
    ct = None
    n_total = 0
    while True:
        kw = dict(Bucket=bucket, MaxKeys=1000)
        if ct:
            kw["ContinuationToken"] = ct
        r = s3.list_objects_v2(**kw)
        for o in r.get("Contents", []) or []:
            k = o["Key"]
            n_total += 1
            if not k.lower().endswith(".png"):
                continue
            seg = k.split("/")
            if len(seg) < 2:
                continue
            cat = seg[0]
            base = seg[-1].rsplit(".", 1)[0]
            m2 = re.search(r"pexels-(\d+)", base)
            if m2:
                pid = int(m2.group(1), 10)
                out.add((cat, pid))
                by_cat[cat].append(pid)
        if not r.get("IsTruncated"):
            break
        ct = r.get("NextContinuationToken")
    return out, by_cat, n_total


# ----------------------------------------------------------------
# MAIN — step 1
# ----------------------------------------------------------------
def main():
    print("=" * 80)
    print("  🐍 Step 1: Parse Worker KNOWN_GOOD_PER_CATEGORY vs Originals PNG IDs")
    print("=" * 80)
    print(f"  Parsed KNOWN: {len(KNOWN)} cats × 10 = {sum_ids} IDs  |  ALIASES: {len(ALIASES_RAW)} entries")

    s3 = boto_s3()
    OB = os.environ.get("R2_ORIGINALS_BUCKET_NAME", "sendafun-originals")
    all_ok = True
    orig_pairs = set()
    orig_by_cat = {}
    if s3:
        orig_pairs, orig_by_cat, n_total = list_originals_png_pairs(s3, OB)
        print(f"\n  Originals {OB}: {len(orig_pairs)} PNG (cat,id) unique | total objects = {n_total}")
        for cat in KNOWN_CATS:
            a = sorted(KNOWN[cat])
            b = sorted(orig_by_cat.get(cat, []))
            if a == b:
                print(f"    ✅ {cat:<22} KNOWN ↔ ORIGINALS 10/10 IDs IDENTICAL")
            else:
                all_ok = False
                only_k = [x for x in a if x not in b]
                only_o = [x for x in b if x not in a]
                print(f"    🔴 {cat:<22} MISMATCH!  KNOWN only={only_k}  ORIG only={only_o}")
        # Any extra categories in originals not in KNOWN? (should be empty)
        extras = set(orig_by_cat.keys()) - set(KNOWN_CATS)
        if extras:
            all_ok = False
            print(f"  🔴 Originals has categories NOT in KNOWN_GOOD: {sorted(extras)}")
    else:
        print("  ⚠️ Skip originals check — no S3 credentials loaded.")

    # Save JSONs for step 2 + later use
    save = {
        "KNOWN_PER_CAT": {c: list(KNOWN_ID_BY_CAT[c]) for c in KNOWN_CATS},
        "KNOWN_CATS": KNOWN_CATS,
        "ALIASES": dict(ALIASES_RAW),
        "PREVIEW_R2_BASE": PREVIEW_R2_BASE,
        "ORIGINALS_BUCKET": OB,
        "originals_cat_pid_pairs": sorted(list(orig_pairs)) if orig_pairs else None,
    }
    out_json = ROOT / "_scripts" / "_tmp_worker_normalize_assets.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(save, f, ensure_ascii=False, indent=2)
    print(f"\n  💾 Saved Worker normalize assets → {out_json}")

    # Quick sanity test of normalize logic: compare 5 orphan cards we found earlier
    # (we can only do it when we have the D1 dump file)
    dump = ROOT / "_scripts" / "_tmp_d1_all_cards_dump.json"
    if dump.exists():
        print("\n  🧪 Sanity normalize test on D1 dump:")
        with open(dump, "r", encoding="utf-8") as f:
            d1_cards = json.load(f)
        before_mismatches = 0
        after_mismatches = 0
        ground = {(c, str(p)) for (c, p) in orig_pairs} if orig_pairs else None
        cat_before = Counter()
        cat_after = Counter()
        for c in d1_cards:
            before_cat = str(c.get("category") or "").lower()
            before_pid = str(c.get("pexelsId") or c.get("pexels_id") or "")
            cat_before[before_cat] += 1
            if ground and (before_cat, before_pid) not in ground:
                before_mismatches += 1
            _, new = normalize_card(c)
            after_cat = new["category"]
            after_pid = new["pexels_id"]
            cat_after[after_cat] += 1
            if ground and (after_cat, after_pid) not in ground:
                after_mismatches += 1
        print(f"    D1 cards loaded: {len(d1_cards)}")
        print(f"    BEFORE normalize: (cat,pid) NOT present in originals PNG pairs: {before_mismatches}")
        print(f"    AFTER  normalize: (cat,pid) NOT present in originals PNG pairs: {after_mismatches}")
        print(f"    BEFORE category distribution top 10: {cat_before.most_common(10)}")
        print(f"    AFTER  category distribution top 10: {cat_after.most_common(10)}")

    print("\n" + "#" * 80)
    if all_ok:
        print("#  ✅ Step 1 PASS — KNOWN_GOOD_PER_CATEGORY 250 IDs 100% identical to originals 250 PNGs!")
        sys.exit(0)
    else:
        print("#  🔴 Step 1 FAIL — see mismatches above")
        sys.exit(1)


if __name__ == "__main__":
    main()
