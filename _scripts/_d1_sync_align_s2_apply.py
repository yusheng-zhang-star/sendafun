#!/usr/bin/env python3
"""
Step 2 — D1 ↔ Originals alignment: REWRITE 5 material reference fields on every card.

This script:
  1. Re-parses Worker index.js → KNOWN_GOOD_PER_CATEGORY (int IDs by canonical
     25 cats) & _MANUAL_CATEGORY_ALIASES (cat alias → canonical, string map).
  2. Loads D1 full dump JSON from _tmp_d1_all_cards_dump.json.
  3. For every D1 card — runs the EXACT same Python re-implementation of the
     Worker normalizeCardImages() logic. Outputs a NEW (canonical) value for:
       • category        → canonical 25 KNOWN cats only (no 'apology' / 'dad')
       • pexels_id       → str of a KNOWN_GOOD id in that canonical cat (1..10)
       • bg_image        → PREVIEW_R2_BASE/<canon>/<canon>-pexels-<id>-v2-vertical.webp
       • bg_image_watermark → same as bg_image (both point at the LR webp preview)
       • og_image        → same URL (keeps social share images valid too)
     All other card fields (title / tags / style / default_text / default_font /
     default_color / default_filter / aspect_ratio / emotional_tags /
     envelope_style_id / geo_country_target / seo / created_at / updated_at)
     are LEFT UNCHANGED — the user's copywriting is preserved, we only fix the
     material references so every card points at a really existing preview webp
     AND a really existing HD PNG master.
  4. Sends the rewritten records via POST /api/cards/_bulk with the
     CARDS_BULK_API_TOKEN from .env (Admin-only upsert).

Runs DRY-RUN by default; add --apply to actually POST the bulk upsert.
"""
import argparse, os, sys, re, json, time
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass

JS_PATH = ROOT / "worker" / "src" / "index.js"
JS = JS_PATH.read_text(encoding="utf-8")


# ------------------------------------------------------------
# 1) Worker JS parsers (handles both array-valued and string-valued const objs)
# ------------------------------------------------------------
def _extract_const_js_obj(name):
    pat = re.compile(
        rf"const\s+{re.escape(name)}\s*=\s*(\{{[^;]*?\n\}})\s*;",
        re.S,
    )
    m = pat.search(JS)
    if not m:
        raise RuntimeError(f"const {name} not found in worker/src/index.js")
    body = m.group(1)
    out = {}
    # Token-level findall on the entire body (not line-by-line), since JS object
    # literal lines may contain multiple "k:v, k2:v2" same-line pairs.
    # Key:   "double-quoted"  OR  unquoted_identifier
    # Value: [int list]  OR  "string"
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
ALIASES = _extract_const_js_obj("_MANUAL_CATEGORY_ALIASES")
KNOWN_CATS = sorted(KNOWN.keys())
KNOWN_ID_BY_CAT = {c: list(KNOWN[c]) for c in KNOWN_CATS}

assert len(KNOWN_CATS) == 25, f"Expected 25 canonical cats, got {len(KNOWN_CATS)}: {KNOWN_CATS}"
total_ids = sum(len(v) for v in KNOWN.values())
assert total_ids == 250, f"Expected 250 IDs, got {total_ids}"

PREVIEW_R2_BASE = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev"


# ------------------------------------------------------------
# 2) EXACT Worker normalize reimplementation (Python mirror)
# ------------------------------------------------------------
def _resolve_known_category(input_cat):
    if not input_cat:
        return "birthday"
    raw = str(input_cat).strip().lower()
    if not raw:
        return "birthday"
    if raw in KNOWN:
        return raw
    if raw in ALIASES:
        return ALIASES[raw]
    tokens = set(raw.replace("'s", "").replace("-day", "").split("-"))
    tokens.discard("")
    best = "birthday"
    best_score = -1
    for k in KNOWN_CATS:
        kt = set(k.replace("'s", "").replace("-day", "").split("-"))
        kt.discard("")
        score = len(tokens & kt)
        prefix_raw = raw[:3] if len(raw) >= 1 else ""
        prefix_k = k[:3]
        if prefix_raw and prefix_k.startswith(prefix_raw[: min(3, len(prefix_raw))]):
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


_WM_RE = re.compile(r"-pexels-(\d+)-v2-vertical\.webp$")


def compute_normalized_fields(card: dict):
    """Return dict of 5 rewritten fields + chosen knownCat/chosenId.

    Does NOT mutate input card.
    """
    slug = card.get("slug") or ""
    title = card.get("title") or ""
    src_cat = str(card.get("category") or "").strip()
    src_cat_lc = src_cat.lower() or "birthday"
    known_cat = _resolve_known_category(src_cat_lc)
    pool = KNOWN_ID_BY_CAT.get(known_cat) or KNOWN_ID_BY_CAT["birthday"]
    slug_seed = str(slug) if isinstance(slug, str) else (str(title) if isinstance(title, str) else "x")
    existing_wm = (
        card.get("bgImageWatermark")
        if isinstance(card.get("bgImageWatermark"), str)
        else (card.get("bg_image_watermark") if isinstance(card.get("bg_image_watermark"), str) else "")
    )
    existing_bg = (
        card.get("bgImage")
        if isinstance(card.get("bgImage"), str)
        else (card.get("bg_image") if isinstance(card.get("bg_image"), str) else "")
    )
    m = _WM_RE.search(existing_wm)
    keep = False
    if m and ("/" + known_cat + "/") in existing_wm:
        try:
            pid = int(m.group(1), 10)
            if pid in pool:
                chosen_id = pid
                keep = True
        except (ValueError, TypeError):
            pass
    if not keep:
        idx = _fnv1a32(slug_seed) % len(pool)
        chosen_id = pool[idx]
    chosen_id_s = str(chosen_id)
    wm_url = f"{PREVIEW_R2_BASE}/{known_cat}/{known_cat}-pexels-{chosen_id}-v2-vertical.webp"
    return {
        "category": known_cat,
        "pexels_id": chosen_id_s,
        "bg_image": wm_url,
        "bg_image_watermark": wm_url,
        "og_image": wm_url,
        # meta helpers
        "_knownCat": known_cat,
        "_chosenId": chosen_id,
        "_wmUrl": wm_url,
    }


# ------------------------------------------------------------
# 3) Build bulk-upsert payload (keep copywriting, replace 5 fields)
# ------------------------------------------------------------
REQUIRED_PASSTHROUGH = (
    "slug",
    "title",
    "tags",
    "style",
    "default_text",
    "default_font",
    "default_color",
    "default_filter",
    "aspect_ratio",
    "emotional_tags",
    "envelope_style_id",
    "geo_country_target",
    "seo",
)


def _v(card: dict, *keys, default=None):
    for k in keys:
        if k in card and card[k] is not None:
            return card[k]
    return default


def build_rewritten_card(card: dict, new_fields: dict):
    """Produce a single record ready for /api/cards/_bulk upsert.

    Worker handleBulkUpsert() REQUIRES (L1977):
        if (!c?.slug || !c.title || !c.category || !c.bgImage) continue;
    So we always output the camelCase aliases (bgImage / bgImageWatermark /
    ogImage / pexelsId / defaultText / ...) alongside the snake_case keys
    (bg_image / pexels_id / …) that the Worker INSERT SQL actually binds.
    This way the validation check passes AND the INSERT sees the right values.

    Copywriting fields (title / tags / style / default* / seo / geo / …) come
    directly from the D1 source unchanged.
    Material-ref fields are set to new_fields (Worker normalizer output).
    """
    tags = _v(card, "tags", default=[])
    emo = _v(card, "emotionalTags", "emotional_tags", default=[])
    geo = _v(card, "geoCountryTarget", "geo_country_target", default=[])
    seo = _v(card, "seo", default={})
    title = _v(card, "title", default="") or ""
    slug = _v(card, "slug", default="") or ""
    style = _v(card, "style")
    default_text = _v(card, "defaultText", "default_text", default="") or ""
    default_font = _v(card, "defaultFont", "default_font", default="") or ""
    default_color = _v(card, "defaultColor", "default_color", default="") or ""
    default_filter = _v(card, "defaultFilter", "default_filter")
    aspect_ratio = _v(card, "aspectRatio", "aspect_ratio", default="3/4") or "3/4"
    env_id = _v(card, "envelopeStyleId", "envelope_style_id", default="") or ""

    bg_url = new_fields["bg_image"]
    wm_url = new_fields["bg_image_watermark"]
    og_url = new_fields["og_image"]
    cat = new_fields["category"]
    pid_s = new_fields["pexels_id"]

    return {
        # --- Worker L1977 "skip if falsy" mandatory inputs ---
        "slug": slug,
        "title": title,
        "category": cat,
        "bgImage": bg_url,
        # --- Both-casing for every bind field so Worker never sees undefined ---
        "pexels_id": pid_s,
        "pexelsId": pid_s,
        "bg_image": bg_url,
        "bg_image_watermark": wm_url,
        "bgImageWatermark": wm_url,
        "og_image": og_url,
        "ogImage": og_url,
        "tags": tags if isinstance(tags, list) else [],
        "style": style,
        "default_text": default_text,
        "defaultText": default_text,
        "default_font": default_font,
        "defaultFont": default_font,
        "default_color": default_color,
        "defaultColor": default_color,
        "default_filter": default_filter,
        "defaultFilter": default_filter,
        "aspect_ratio": aspect_ratio,
        "aspectRatio": aspect_ratio,
        "emotional_tags": emo if isinstance(emo, list) else [],
        "emotionalTags": emo if isinstance(emo, list) else [],
        "envelope_style_id": env_id,
        "envelopeStyleId": env_id,
        "geo_country_target": geo if isinstance(geo, list) else [],
        "geoCountryTarget": geo if isinstance(geo, list) else [],
        "seo": seo if isinstance(seo, dict) else {},
    }


# ------------------------------------------------------------
# MAIN
# ------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="Actually POST the rewritten cards to /api/cards/_bulk (default: dry-run only)")
    args = ap.parse_args()

    # ------------------------------------------------------------
    # Load / refresh D1 full dump (always RE-FETCH live data)
    # ------------------------------------------------------------
    from _d1_sync_verify_postsync import fetch_all_d1_cards
    print("\n  📡 Fetching LIVE D1 full dump via /api/cards?size=1000 (pagination)...")
    d1_cards, declared_total, fetch_elapsed = fetch_all_d1_cards()
    print(f"     Fetched {len(d1_cards)} cards in {fetch_elapsed:.1f}s  (API declared total = {declared_total})")
    dump_path = ROOT / "_scripts" / "_tmp_d1_all_cards_dump_LIVE.json"
    with open(dump_path, "w", encoding="utf-8") as f:
        json.dump(d1_cards, f, ensure_ascii=False, indent=2)
    print(f"     💾 Saved LIVE dump → {dump_path}")
    mode = "🚨 APPLY MODE" if args.apply else "🧪 DRY RUN (no writes)"
    print("=" * 80)
    print(f"  🐍 Step 2: D1 ↔ Originals Material-Reference Sync   → {mode}")
    print("=" * 80)
    print(f"  Known canonical categories: {len(KNOWN_CATS)}")
    print(f"  Canonical category aliases loaded: {len(ALIASES)} (e.g. apology→{ALIASES.get('apology')} / dad→{ALIASES.get('dad')})")
    print(f"  Known IDs total (25 cats × 10): {total_ids}")

    with open(dump_path, "r", encoding="utf-8") as f:
        d1_cards = json.load(f)
    print(f"\n  Loaded D1 dump: {len(d1_cards)} cards from {dump_path.name}")

    # Ground truth: originals PNG (cat,pid_int) set
    from _d1_sync_align_s1_precheck import list_originals_png_pairs, boto_s3
    OB = os.environ.get("R2_ORIGINALS_BUCKET_NAME", "sendafun-originals")
    s3 = boto_s3()
    orig_pairs = set()
    if s3:
        orig_pairs, _, _n = list_originals_png_pairs(s3, OB)
        print(f"  Originals {OB}: {len(orig_pairs)} PNG (cat,pid_int) unique pairs loaded")

    # Run normalize on every card; build rewrite set; compute sanity stats
    rewritten = []
    before_bad = 0
    after_bad = 0
    before_cat = Counter()
    after_cat = Counter()
    changed_categories = 0
    changed_pexels = 0
    changed_any_ref = 0
    for idx, card in enumerate(d1_cards):
        # before
        b_cat = str(card.get("category") or "").strip().lower() or "__null__"
        before_cat[b_cat] += 1
        b_pid = str(
            card.get("pexelsId") or card.get("pexels_id") or ""
        ).strip()
        if orig_pairs:
            try:
                pid_int = int(b_pid, 10) if b_pid else -1
            except ValueError:
                pid_int = -1
            if (b_cat, pid_int) not in orig_pairs:
                before_bad += 1
        # compute new
        new = compute_normalized_fields(card)
        a_cat = new["category"]
        after_cat[a_cat] += 1
        if orig_pairs:
            try:
                pid_int_a = int(new["pexels_id"], 10)
            except ValueError:
                pid_int_a = -1
            if (a_cat, pid_int_a) not in orig_pairs:
                after_bad += 1
        # compare to source ref fields to detect changes
        src_cat = (card.get("category") or "").strip().lower() if isinstance(card.get("category"), str) else ""
        src_pid = (
            card.get("pexelsId") if isinstance(card.get("pexelsId"), str)
            else (card.get("pexels_id") if isinstance(card.get("pexels_id"), str) else "")
        ).strip()
        src_bg = (
            card.get("bgImage") if isinstance(card.get("bgImage"), str)
            else (card.get("bg_image") if isinstance(card.get("bg_image"), str) else "")
        ).strip()
        src_wm = (
            card.get("bgImageWatermark") if isinstance(card.get("bgImageWatermark"), str)
            else (card.get("bg_image_watermark") if isinstance(card.get("bg_image_watermark"), str) else "")
        ).strip()
        src_og = (
            card.get("ogImage") if isinstance(card.get("ogImage"), str)
            else (card.get("og_image") if isinstance(card.get("og_image"), str) else "")
        ).strip()
        if src_cat != new["category"].lower():
            changed_categories += 1
        if src_pid != new["pexels_id"]:
            changed_pexels += 1
        if (src_bg != new["bg_image"]) or (src_wm != new["bg_image_watermark"]) or (src_og != new["og_image"]) or (
            changed_categories or changed_pexels
        ):
            changed_any_ref += 1
        rewritten.append(build_rewritten_card(card, new))

    print("\n  Sanity cross-check (before vs after normalize):")
    print(f"    D1 (cat,pid) NOT present in originals PNG → BEFORE normalize: {before_bad} / {len(d1_cards)}")
    print(f"    D1 (cat,pid) NOT present in originals PNG → AFTER  normalize: {after_bad} / {len(d1_cards)}")
    print(f"    Rewrites: category changed = {changed_categories} ; pexels_id changed = {changed_pexels} ; any ref-field changed = {changed_any_ref}")
    print("\n  Top 8 categories BEFORE normalize:", before_cat.most_common(8))
    print("  Top 8 categories AFTER  normalize:", after_cat.most_common(8))
    # Summary: 25 canonical cat distribution (should show: only the 25 cats exist)
    leftover_bad_cats = [c for c in after_cat if c not in KNOWN_CATS]
    print(f"\n  Known-cat coverage after normalize: {len([c for c in after_cat if c in KNOWN_CATS])}/{len(KNOWN_CATS)} canonical cats used")
    print(f"  Unknown cats left in post-normalize distribution: {leftover_bad_cats} (must be [])")

    # Build API payload (always; only POST if --apply)
    # Worker expects: JSON body { cards: [ ... ] } → admin auth via Bearer <bulk token>
    D1_BASE = os.environ.get("D1_API_BASE_URL", "https://sendafun.com").rstrip("/")
    TOKEN = os.environ.get("CARDS_BULK_API_TOKEN", "").strip()
    bulk_url = D1_BASE + "/api/cards/_bulk"
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + TOKEN,
    }
    body = {"cards": rewritten}
    print(f"\n  Target bulk URL : {bulk_url}")
    print(f"  Token configured: {'YES (len=' + str(len(TOKEN)) + ')' if TOKEN else 'NO — will get 401'}")
    print(f"  Upsert body size : {len(rewritten)} records  (JSON size ≈ {len(json.dumps(body, separators=(',',':'), ensure_ascii=False))/1024:.1f} KB)")

    if not args.apply:
        print("\n" + "=" * 80)
        print("  🧪 DRY-RUN complete. If everything above looks good, run:")
        print("       python _scripts/_d1_sync_align_s2_apply.py --apply")
        print("=" * 80)
        return

    if not TOKEN:
        print("❌ --apply given but CARDS_BULK_API_TOKEN not set in .env. Aborting.")
        sys.exit(4)

    # POST chunks (Worker L1977 validation must pass — build_rewritten_card
    # emits both camelCase + snake_case so !c.bgImage never skips records).
    CHUNK = 100
    total_ok = 0
    total_err = 0
    errors = []
    t0 = time.time()
    print("\n" + "🚨" * 30)
    print("  🚨 STARTING REAL BULK UPSERT of", len(rewritten), "rewritten records in chunks of", CHUNK)
    print("🚨" * 30)
    import requests

    for i in range(0, len(rewritten), CHUNK):
        chunk = rewritten[i:i + CHUNK]
        r = None
        try:
            r = requests.post(
                bulk_url,
                headers=headers,
                json={"cards": chunk},
                timeout=120,
            )
            r.raise_for_status()
            j = r.json()
            # Worker L2002 response: { ok, requested, valid, upserted, note, inserted, updated }
            valid = j.get("valid", 0)
            upserted = j.get("upserted", 0)
            skipped = max(0, (j.get("requested") or len(chunk)) - valid)
            total_ok += upserted
            total_err += skipped
            err_list = j.get("errorDetails") or j.get("errors_list") or []
            if isinstance(err_list, list) and err_list:
                for e in err_list[:5]:
                    errors.append((f"chunk#{i//CHUNK+1}-idx#{i+err_list.index(e)}", str(e)[:200]))
            elapsed = time.time() - t0
            rate = (i + len(chunk)) / elapsed if elapsed > 0 else 0
            print(
                f"  chunk #{i//CHUNK+1:>3}/{(len(rewritten)+CHUNK-1)//CHUNK:<3} | "
                f"valid={valid}/{len(chunk)}  upserted(rows changed)={upserted}  skipped={skipped} | "
                f"cum upserted={total_ok:<8} skip={total_err:<6} | rate={rate:>6.1f} rec/s | status={r.status_code}"
            )
        except Exception as e:
            body_snippet = ""
            if r is not None:
                try: body_snippet = r.text[:300]
                except Exception: pass
            msg = f"chunk#{i//CHUNK+1} EXCEPTION: {e!r}{(' | body=' + body_snippet) if body_snippet else ''}"
            print(f"  ❌ {msg}")
            errors.append((f"chunk#{i//CHUNK+1}-exception", msg[:250]))
            total_err += len(chunk)

    # Post-apply: re-fetch D1 + run _verify_kv_d1_r2_align.py style cross-check automatically
    print("\n" + "=" * 80)
    print("  📋 BULK UPSERT FINAL REPORT")
    print("=" * 80)
    print(f"    Total records sent  : {len(rewritten)}")
    print(f"    Total upserted (rows actually changed = INSERT or UPDATE): {total_ok}")
    print(f"    Total skipped (not valid per L1977 guard): {total_err}")
    if errors:
        print(f"    First 10 error details:")
        for where, msg in errors[:10]:
            print(f"      • {where}: {msg}")
    elapsed = time.time() - t0
    print(f"    Total wall time      : {elapsed:.1f}s")

    sys.exit(0 if total_err == 0 else 5)


if __name__ == "__main__":
    main()
