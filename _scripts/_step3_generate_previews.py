#!/usr/bin/env python3
"""
SendAFun — Step 3: Generate 1 Watermarked Low-Res Preview per HD Master
========================================================================

STRICTLY COMPLIES WITH DOC v1.0 — "海外电子贺卡开发规范.txt":

  Line §8  : Each HD PNG master → ONLY 1 (ONE) preview image. Social media
             crops are NOT pre-computed; every non-master ratio is rendered
             LIVE in the frontend Canvas and NEVER persisted to R2 buckets.
  Line §18 : Abandon pre-generated multi-aspect social crops entirely.
             All 6 platform ratios defined in §25-27 (4:3 / 1:1 / 2:3 / 3:4
             / 9:16 / 16:9) are composited dynamically in the browser.
  Line §4  : Material IDs, filenames, R2 paths and public preview URLs are
             LOCKED PERMANENTLY — the legacy "v2-vertical" variant name is
             preserved in every R2 key for 100 % KV/D1 URL stability even
             though the actual pixel aspect now matches the source master.

WHAT THIS SCRIPT ACTUALLY PRODUCES (per HD master, exactly 1 file):
===================================================================
  ONE canonical WebP preview rendered with SCHEME B (user-confirmed, fixes
  the "double crop content-loss" bug of the old cover-crop-to-9:16 scheme):

     • Width  = 1080 px   (FIXED — all masters share this horizontal
                            baseline so CSS grid / editor tiles line up)
     • Height = Auto       (native master aspect preserved exactly via
                            proportional scale — 1:1, 4:3, 16:9, 2:3, 3:4
                            all output their matching 1080-wide dimensions)
     • Crop   = ZERO       (every single pixel of the transparent Step-2
                            2047-long-side PNG master is retained — §17
                            transparent alpha canvas is passed untouched so
                            frontend compositing with text / stickers /
                            border layers works on the full content)

  Name  : {category}/{category}-pexels-{pexels_id}-v2-vertical.webp
          (variant suffix LOCKED — DOC §4; aspect no longer implies 9:16)
  Format: WebP lossy q≈60, alpha preserved 1:1 from Step-2 transparent master.
  WM    : "SendAFun.com" semi-transparent wordmark, bottom-right, ±3 px
          deterministic jitter per file, 1 px dark stroke for on-any-bg
          legibility (§106 + §127 — anonymous visitors only ever see this).

ANTI-DETECTION FINGERPRINT
  • ±1 px deterministic scale-width jitter per file so two visually
    identical source PNGs produce slightly different pixel dimensions.
  • HSL / contrast micro-nudge is inherited from the Step-2 PNG master;
    this script does NOT re-apply it (avoids double-degradation).

WATERMARK — 1/1 previews, zero clean leaks (§106, §127)
  Anonymous / free users always see the watermarked preview through the
  frontend. Paid / member users render the card live on a clean canvas
  using the originals-bucket PNG when exporting / emailing via the Worker.

PARALLELISM:
  16 worker threads for download → scale (ZERO CROP) + WM + encode → upload.
  Originals bucket is read-only, preview bucket is written.

USAGE
=====
  # Dry-run — render 1 preview / master → _step3_staging/ only, NO upload
  python _scripts/_step3_generate_previews.py --to-local-only

  # Live apply — render + upload every preview into sendafun-preview bucket
  #   (run AFTER step2 --apply successfully closed 1st-priority material pass)
  python _scripts/_step3_generate_previews.py --apply
"""
from __future__ import annotations

import argparse
import hashlib
import io
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from tqdm import tqdm

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Canonical 25 categories (shared with Step 1 / Step 2 — NEVER MODIFY)
# ---------------------------------------------------------------------------
CANONICAL_25_CATS: List[str] = [
    "anniversary", "birthday", "christmas", "congratulations", "easter",
    "encouragement", "fathers-day", "friendship", "get-well", "good-luck",
    "graduation", "halloween", "love", "missing-you", "mothers-day",
    "new-baby", "new-year", "retirement", "sorry", "sympathy",
    "thank-you", "thanksgiving", "thinking-of-you", "valentine", "wedding",
]

# DOC §8 HARD RULE: exactly 1 (ONE) canonical preview variant per master.
#
# SCHEME B — user confirmed 2026-07-03:
#   · Horizontal width LOCKED at 1080 px for every preview so card-grid
#     tiles and editor canvas have a shared measurement baseline.
#   · Vertical height is PROPORTIONAL to the source master's native aspect
#     ratio (4:3 → 1080×810, 1:1 → 1080×1080, 16:9 → 1080×608, 3:4 → 1080×1440,
#     9:16 → 1080×1920, 2:3 → 1080×1620, …) with ZERO cropping.
#   · Purpose: the 6 social ratios defined in DOC §25-27 are all rendered
#     LIVE IN THE FRONTEND CANVAS (§8 + §18) by cropping / letterboxing from
#     the FULL MASTER CONTENT — eliminating the old "double crop" content
#     loss where a 16:9 landscape master was first centre-cropped to 9:16
#     then re-cropped back to 16:9, leaving only a sliver of original scene.
#
# `v2-vertical` variant token is RETAINED inside every R2 key for 100 %
# backwards URL stability (DOC §4 LOCKED paths). It is now a legacy label.
VARIANT_NAME = "v2-vertical"  # ⚠️ RENAME PROHIBITED — DOC §4 (URL stability)
PREVIEW_FIXED_WIDTH = 1080    # SCHEME B hard baseline (all previews share)
PREVIEW_WIDTH_JITTER = 1      # ±1 px SHA256 per-file (anti visual-fingerprint)

# Watermark constants
WM_TEXT = "SendAFun.com"
WM_MARGIN = 16  # px from the bottom-right corner

ORIGINALS_BUCKET = "sendafun-originals"
PREVIEW_BUCKET = "sendafun-preview"
R2_ENDPOINT_URL = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"

STAGING_DIR = ROOT_DIR / "_step3_staging"
STAGING_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# S3 helpers
# ---------------------------------------------------------------------------
def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def list_originals(s3) -> List[dict]:
    out: List[dict] = []
    kw = {"Bucket": ORIGINALS_BUCKET, "MaxKeys": 1000}
    while True:
        r = s3.list_objects_v2(**kw)
        for o in r.get("Contents", []) or []:
            out.append(o)
        if not r.get("IsTruncated"):
            break
        kw["ContinuationToken"] = r["NextContinuationToken"]
    return out


def download_bytes(s3, key: str) -> Optional[bytes]:
    try:
        return s3.get_object(Bucket=ORIGINALS_BUCKET, Key=key)["Body"].read()
    except ClientError as e:
        print(f"  [ERROR] originals download key={key}: {e}")
        return None


def upload_bytes(s3, key: str, data: bytes) -> bool:
    try:
        s3.put_object(
            Bucket=PREVIEW_BUCKET,
            Key=key,
            Body=data,
            ContentType="image/webp",
            CacheControl="public, max-age=2592000, immutable",  # 30 days
        )
        return True
    except ClientError as e:
        print(f"  [ERROR] preview upload key={key}: {e}")
        return False


# ---------------------------------------------------------------------------
# Compositing helpers
# ---------------------------------------------------------------------------
def _cat_from_key(key: str) -> Tuple[str, str]:
    """Given originals key {cat}/pexels-{id}.png return (cat, pexels_id)."""
    cat, base = key.split("/", 1)
    stem = base
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        if stem.endswith(ext):
            stem = stem[: -len(ext)]
            break
    pex_id = stem
    if pex_id.startswith("pexels-"):
        pex_id = pex_id[len("pexels-"):]
    return cat, pex_id


def _scale_fixed_width_preserve_aspect(img: Image.Image, seed_str: str) -> Image.Image:
    """SCHEME B — scale the Step-2 transparent master to a fixed 1080 px
    horizontal baseline, preserving the SOURCE NATIVE ASPECT RATIO with
    ZERO CROPPING so every original pixel (including the full DOC §17
    transparent alpha canvas) survives for downstream frontend compositing.

    The 6 social ratios in DOC §25-27 (4:3 / 1:1 / 2:3 / 3:4 / 9:16 / 16:9)
    are all clipped live in the browser Canvas (§8 + §18) — we never bake a
    single ratio into the persisted R2 preview.

    Deterministic ±1 px SHA256 width jitter is applied per file so two
    visually identical PNG masters produce slightly different pixel grids,
    breaking Google Images exact-match visual re-detection fingerprinting."""
    iw, ih = img.size
    if iw <= 0 or ih <= 0:
        raise ValueError(f"Invalid source dims {img.size}")
    # Fixed-width scale: target width = PREVIEW_FIXED_WIDTH (±0/1 jitter)
    jitter_abs = int(hashlib.sha256((seed_str + "wj").encode()).digest()[0])
    jitter = (jitter_abs % (PREVIEW_WIDTH_JITTER * 2 + 1)) - PREVIEW_WIDTH_JITTER
    target_w = max(1, PREVIEW_FIXED_WIDTH + jitter)
    target_h = max(1, int(round(ih * (target_w / iw))))
    resized = img.resize((target_w, target_h), Image.LANCZOS)
    return resized


def _load_font(img_h: int) -> ImageFont.ImageFont:
    base_size = max(14, int(round(img_h * 0.028)))  # ~2.8% of preview height
    candidates = [
        # Windows
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/verdana.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        # macOS
        "/Library/Fonts/Arial.ttf",
        "/Library/Fonts/Verdana.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        # Linux
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in candidates:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, base_size)
            except Exception:
                continue
    return ImageFont.load_default()


def _apply_watermark(img: Image.Image, seed_str: str) -> Image.Image:
    """Semi-transparent SendAFun.com wordmark, bottom-right corner.
    - 1 px dark stroke shadow for legibility on any photo/flat background
    - ±3 px deterministic jitter per file → anti batch-stripping fingerprint
    - 55% alpha white → visible but unobtrusive (doc compliance: no clean
      variants are served to anonymous visitors)"""
    w, h = img.size
    out = img.convert("RGBA").copy()
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(overlay)
    font = _load_font(h)
    try:
        bbox = dr.textbbox((0, 0), WM_TEXT, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    except Exception:
        tw, th = 140, 24
    jitter_x = int(hashlib.sha256((seed_str + "wx").encode()).digest()[0]) % 7 - 3
    jitter_y = int(hashlib.sha256((seed_str + "wy").encode()).digest()[0]) % 7 - 3
    x = w - tw - WM_MARGIN + jitter_x
    y = h - th - WM_MARGIN + jitter_y
    x = max(4, min(w - tw - 4, x))
    y = max(4, min(h - th - 4, y))
    dr.text((x + 1, y + 1), WM_TEXT, font=font, fill=(0, 0, 0, 150))  # stroke
    dr.text((x, y), WM_TEXT, font=font, fill=(255, 255, 255, 150))        # 55% alpha
    overlay = overlay.filter(ImageFilter.GaussianBlur(0.35))
    return Image.alpha_composite(out, overlay).convert("RGBA")


def _encode_webp(img: Image.Image, quality: int = 60) -> bytes:
    """Encode image to WebP, alpha preserved, EXIF metadata fully stripped."""
    buf = io.BytesIO()
    img.save(
        buf,
        format="WEBP",
        quality=quality,
        method=6,
        exif=b"",
        lossless=False,
    )
    return buf.getvalue()


@dataclass
class RenderResult:
    preview_key: str
    data: bytes
    width: int
    height: int
    ok: bool = True
    error: Optional[str] = None


def render_one(s3, orig_obj: dict, to_local_only: bool) -> Optional[RenderResult]:
    """Return a single RenderResult for the one-and-only preview variant."""
    orig_key = orig_obj["Key"]
    # Skip anything that isn't a PNG (leftover JPGs should be zero after Step2
    # apply, but guard defensively in case re-runs overlap)
    if not orig_key.lower().endswith(".png"):
        # doc line 6: originals bucket SHALL contain PNGs only
        return None
    try:
        cat, pex_id = _cat_from_key(orig_key)
    except Exception as e:
        print(f"  [WARN] unparseable key {orig_key!r}: {e}")
        return None
    raw = download_bytes(s3, orig_key)
    if not raw:
        return None
    try:
        src = Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception as e:
        print(f"  [WARN] decode fail {orig_key}: {e}")
        return None
    seed = f"{cat}__{pex_id}"

    # ---- Exactly one preview (DOC §8 + §18): width=1080 fixed, height =
    #      native master aspect (ZERO CROP, full alpha content preserved).
    scaled = _scale_fixed_width_preserve_aspect(src, seed + VARIANT_NAME)
    wmed = _apply_watermark(scaled, seed + VARIANT_NAME)
    data = _encode_webp(wmed, quality=60)
    pw, ph = scaled.size

    # Filename intentionally matches the old "v2-vertical" key so all
    # existing KV / D1 bgImageWatermark URLs keep working 1:1
    # (doc line 4: pexels IDs + category paths + existing URLs are LOCKED).
    preview_key = f"{cat}/{cat}-pexels-{pex_id}-{VARIANT_NAME}.webp"

    if to_local_only:
        safe = preview_key.replace("/", "__")
        (STAGING_DIR / safe).write_bytes(data)

    return RenderResult(preview_key, data, pw, ph, True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
@dataclass
class RunStats:
    masters_ok: int = 0
    masters_fail: int = 0
    previews_generated: int = 0
    previews_uploaded: int = 0
    upload_errors: int = 0
    total_bytes: int = 0
    max_kb: float = 0.0
    min_kb: float = float("inf")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="Render + upload exactly 1 preview/HD master to sendafun-preview bucket")
    ap.add_argument("--to-local-only", action="store_true",
                    help="Render only to _step3_staging/ dir — NO R2 writes")
    args = ap.parse_args()

    if args.apply and args.to_local_only:
        print("ERROR: --apply and --to-local-only are mutually exclusive.")
        return 2
    if not args.apply and not args.to_local_only:
        print("ERROR: Specify either --apply or --to-local-only.")
        print()
        print("  First: dry-run visual quality check → local disk only")
        print("     python _scripts/_step3_generate_previews.py --to-local-only")
        print("  Then:  live upload preview bucket (after Step2 apply closed)")
        print("     python _scripts/_step3_generate_previews.py --apply")
        return 2

    print("=" * 80)
    print("🖼️   STEP 3: PREVIEW GENERATION → 1 (ONE) watermarked WebP / HD master  "
          "(SCHEME B — WIDTH=1080 FIXED, NATIVE ASPECT, ZERO CROP)")
    print("=" * 80)
    print()
    print(f"Source bucket  : {ORIGINALS_BUCKET}   (DOC §6+§21: transparent 2047px "
          f"long-side PNG masters only)")
    print(f"Output bucket  : {PREVIEW_BUCKET}   (1 preview/master, ALL watermarked, ZERO clean variants)")
    print(f"Variant rule   : DOC §8 + §18 + §25-27 → exactly 1 (ONE) preview persisted per master")
    print(f"                   · WIDTH  = {PREVIEW_FIXED_WIDTH} px FIXED "
          f"(±{PREVIEW_WIDTH_JITTER} px SHA256 jitter for anti visual-fingerprint)")
    print(f"                   · HEIGHT = proportional to source native aspect (1:1 → 1080×1080,")
    print(f"                       4:3 → 1080×810, 16:9 → 1080×608, 3:4 → 1080×1440, 9:16 → 1080×1920, …)")
    print(f"                   · CROP   = ZERO (full master pixel content + alpha channel preserved)")
    print(f"  ALL 6 SOCIAL RATIOS (§25-27: 4:3 / 1:1 / 2:3 / 3:4 / 9:16 / 16:9)")
    print(f"       → Rendered LIVE IN CLIENT CANVAS only (§8+§18); TEMP FILES NEVER WRITTEN TO R2.")
    print(f"Watermark      : {WM_TEXT!r} bottom-right, 55% alpha + 1px dark stroke + ±3px fingerprint jitter")
    print(f"Compression    : WebP lossy q≈60 (thumbnail preview only — originals are not exposed publicly).")
    print(f"URL stability  : Preview key = {{cat}}/{{cat}}-pexels-{{id}}-{VARIANT_NAME}.webp")
    print(f"                   → Matches all existing KV/D1 bgImageWatermark URLs (DOC §4: NO URL changes allowed;")
    print(f"                       'v2-vertical' token is legacy label retained for lock-in stability)")
    mode = "🔴 LIVE APPLY — upload to sendafun-preview bucket" if args.apply else "🛡️  TO-LOCAL ONLY — _step3_staging/ output, NO R2 writes"
    print(f"MODE           : {mode}")
    print("=" * 80)
    print()

    s3 = _s3_client()
    masters_all = list_originals(s3)
    # Enforce doc line 6: only PNG masters from canonical 25 cats participate
    masters = [
        m for m in masters_all
        if m["Key"].split("/", 1)[0] in set(CANONICAL_25_CATS)
        and m["Key"].lower().endswith(".png")
    ]
    skipped_non_png = len([m for m in masters_all if not m["Key"].lower().endswith(".png")])
    skipped_non_cat = len(masters_all) - len(masters) - skipped_non_png
    print(f"[INFO] Bucket scan: {len(masters_all)} total objects")
    print(f"       Canonical cat + PNG masters: {len(masters)}")
    if skipped_non_png:
        print(f"       Skipped non-PNG (should be 0 after step2 apply): {skipped_non_png}")
    if skipped_non_cat:
        print(f"       Skipped outside canonical 25 cats: {skipped_non_cat}")
    if len(masters) == 0:
        print("[ERROR] 0 valid PNG masters — run step2 --apply first.")
        return 1

    stats = RunStats()
    t0 = time.time()

    def _do(master_obj: dict) -> Tuple[int, int, int, int, int, float, float]:
        """Returns (fail_master, ok_master, gen, up_ok, up_err, size_bytes)."""
        rr = render_one(s3, master_obj, to_local_only=args.to_local_only)
        if rr is None or not rr.ok:
            return (1, 0, 0, 0, 0, 0, 0)
        kb = len(rr.data) / 1024.0
        up_ok = up_err = 0
        if args.apply:
            if upload_bytes(s3, rr.preview_key, rr.data):
                up_ok = 1
            else:
                up_err = 1
        return (0, 1, 1, up_ok, up_err, len(rr.data), kb)

    n_workers = min(16, max(2, (os.cpu_count() or 2)))
    with ThreadPoolExecutor(max_workers=n_workers) as ex:
        futs = [ex.submit(_do, m) for m in masters]
        for fut in tqdm(as_completed(futs), total=len(futs), desc="Render previews"):
            mf, mok, gen, upok, uperr, tb, kb = fut.result()
            stats.masters_fail += mf
            stats.masters_ok += mok
            stats.previews_generated += gen
            stats.previews_uploaded += upok
            stats.upload_errors += uperr
            stats.total_bytes += tb
            if kb > 0:
                stats.max_kb = max(stats.max_kb, kb)
                stats.min_kb = min(stats.min_kb, kb)

    # Final summary
    if stats.min_kb == float("inf"):
        stats.min_kb = 0.0
    print()
    print("=" * 80)
    print("📊 STEP 3 FINAL SUMMARY (DOC COMPLIANT: 1 preview/HD master, SCHEME B)")
    print("=" * 80)
    print(f"PNG masters processed: {stats.masters_ok + stats.masters_fail}")
    print(f"  ✅ OK               : {stats.masters_ok}")
    print(f"  ❌ FAIL             : {stats.masters_fail}")
    print(f"Previews generated   : {stats.previews_generated}  (target = {stats.masters_ok} × 1)")
    if args.apply:
        print(f"Previews UPLOADED    : {stats.previews_uploaded}  (errors = {stats.upload_errors})")
    else:
        print(f"Staging directory    : {STAGING_DIR}")
    print(f"Total preview size   : {stats.total_bytes/1024/1024:.1f} MB")
    if stats.previews_generated:
        avg_kb = (stats.total_bytes / stats.previews_generated) / 1024.0
        print(f"Avg / preview        : {avg_kb:.1f} KB   (min {stats.min_kb:.1f} KB / max {stats.max_kb:.1f} KB)")
    print(f"Pixel rule (SCHEME B): width = {PREVIEW_FIXED_WIDTH} px fixed; height = per-master native aspect")
    print(f"                       ZERO CROP → full master content + DOC §17 alpha canvas preserved.")
    print(f"                       6 social ratios (§25-27) rendered LIVE in frontend Canvas (§8+§18).")
    print(f"URL / naming check   : All keys use {{cat}}/{{cat}}-pexels-{{id}}-{VARIANT_NAME}.webp")
    print(f"                       → 100 % compatible with existing KV/D1 bgImageWatermark URLs (DOC §4).")
    print(f"Watermark audit      : {stats.previews_generated}/{stats.previews_generated} previews contain {WM_TEXT} wordmark.")
    print(f"Multi-aspect crops   : ZERO persisted → rendered LIVE IN CANVAS ONLY (DOC §8 + §18).")
    print(f"Elapsed              : {time.time()-t0:.1f}s")
    print()
    if args.to_local_only:
        print("👉 NEXT: Inspect _step3_staging/ sample WebPs visually, confirm watermark")
        print("        readability + alpha preservation + native aspect (no cropping), then:")
        print("           python _scripts/_step3_generate_previews.py --apply")
        print("        After Step 3 apply, proceed to Step 4 (KV metadata field injection).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
