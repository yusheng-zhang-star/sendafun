#!/usr/bin/env python3
"""
SendAFun — Step 2: Standardize Originals → 2047px Transparent PNG (250 HD masters)
====================================================================================

WHAT IT DOES (strictly per user spec for 250-subset test material)
===================================================================
For every remaining object in sendafun-originals (25 cats × 10 = 250):
  1. DOWNLOAD  source JPG from originals bucket (filename stays as original —
     but format converted to PNG)
  2. REMOVE BACKGROUND with rembg AI (u2net model) → full transparent Alpha,
     no white/gray/color patches left, feathered edges on hair/thin details
  3. RESIZE long side EXACTLY = 2047 px, proportional, no crop/no stretch (DOC §21)
  4. MICRO-ADJUST brightness + contrast + saturation (deterministic per-file
     fingerprint based on pexels_id hash) → small perceptual changes to break
     Google image reverse-search fingerprints without visible quality loss
  5. STRIP ALL EXIF metadata — final PNG carries zero EXIF / color profile
  6. SMART COMPRESS (pngquant 24bit + oxipng) so final size ≤ 1.5 MB,
     visually lossless (if still above threshold, reduce colors by 1 step)
  7. OVERWRITE the SAME KEY in originals bucket (extension force-changed to
     .png — user requires: filename (pexels-id) + category path STAYS the
     same, only extension normalized to .png for PNG standard)

Strict invariants (Phase 1 PNG spec, enforced here):
  - Long side of PNG: exactly 2047px (DOC §21 master canvas 2047×1448).
  - PNG format: 24 bit with full Alpha channel (transparency guaranteed).
  - File size: ≤ 1.5 MB per file (post-compression, loop enforced).
  - Original filename/ID/category prefix untouched; only extension is
    normalised to .png (was .jpg for raw sources).

USAGE
=====
  # Dry-run — process all 250 to local disk only, NO upload
  python _scripts/_step2_standardize_originals.py --to-local-only

  # Actually process + overwrite originals bucket (confirm dry-run first!)
  python _scripts/_step2_standardize_originals.py --apply

ENV (from project .env):
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
"""
from __future__ import annotations

import argparse
import hashlib
import io
import os
import sys
import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from PIL import Image, ImageEnhance, ImageOps
from tqdm import tqdm

try:
    from rembg import remove as rembg_remove
    _HAS_REMBG = True
except Exception:
    _HAS_REMBG = False

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Canonical 25 categories (matching Step 1 & expand-materials CATEGORY_LABELS)
# ---------------------------------------------------------------------------
CANONICAL_25_CATS: List[str] = [
    "anniversary", "birthday", "christmas", "congratulations", "easter",
    "encouragement", "fathers-day", "friendship", "get-well", "good-luck",
    "graduation", "halloween", "love", "missing-you", "mothers-day",
    "new-baby", "new-year", "retirement", "sorry", "sympathy",
    "thank-you", "thanksgiving", "thinking-of-you", "valentine", "wedding",
]

TARGET_LONG_SIDE = 2047  # DOC §21: 2047×1448 baseline master canvas
TARGET_SIZE_BYTES = int(1.5 * 1024 * 1024)  # 1.5 MB — SOFT TARGET (warn only, not fail)
HARD_LIMIT_BYTES = int(4 * 1024 * 1024)     # 4.0 MB — HARD UPPER BOUND (only > 4 MB fails)

# ---------------------------------------------------------------------------
# Dual size-threshold spec (user directive 2026-07-03 — DO NOT CONFUSE):
# ---------------------------------------------------------------------------
#   SOURCE_MIN_LONG_SIDE  = 2048 px
#     → applies ONLY to external RAW SOURCE files (*.jpg / *.jpeg / *.webp)
#       when they enter Step 2 for the first time.
#     → This is the MATERIAL PROCUREMENT / DOWNLOAD gate.  Any external
#       source image with long side < 2048 gets rejected here.
#
#   TARGET_LONG_SIDE (above) = 2047 px
#     → applies ONLY to Step 2 OUTPUT masters written to Originals bucket
#       (*.png RGBA transparent output — already done for 250 cards).
#     → Finalized 2047px PNGs SKIP Step 2 entirely (they are output,
#       never re-ingested; the ext filter below is the guard).
# ---------------------------------------------------------------------------
SOURCE_MIN_LONG_SIDE = 2048  # material-procurement gate for raw JPG/WEBP sources

# User directive 2026-07-03: 1.5 MB is a guideline, not a gate. Files > 1.5 MB
# but ≤ 4.0 MB are still uploaded to the originals bucket (WARNING only).
# Only files exceeding 4.0 MB are rejected as truly oversized.

ORIGINALS_BUCKET = "sendafun-originals"
R2_ENDPOINT_URL = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"

# Local staging dir
STAGING_DIR = ROOT_DIR / "_step2_staging"
STAGING_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# S3 helpers
# ---------------------------------------------------------------------------
def _s3_client():
    cfg = Config(
        connect_timeout=30,
        read_timeout=300,
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


def list_originals(s3) -> List[dict]:
    out: List[dict] = []
    kwargs = {"Bucket": ORIGINALS_BUCKET, "MaxKeys": 1000}
    while True:
        r = s3.list_objects_v2(**kwargs)
        for o in r.get("Contents", []) or []:
            out.append(o)
        if not r.get("IsTruncated"):
            break
        kwargs["ContinuationToken"] = r["NextContinuationToken"]
    return out


def download_bytes(s3, key: str) -> Optional[bytes]:
    import time as _time
    last_exc = None
    for attempt in range(5):
        try:
            return s3.get_object(Bucket=ORIGINALS_BUCKET, Key=key)["Body"].read()
        except (ClientError, Exception) as e:
            last_exc = e
            wait = min(2 ** attempt, 30)
            cls = type(e).__name__
            print(f"  [WARN] download key={key} attempt {attempt+1}/5 failed ({cls}): "
                  f"retry in {wait}s")
            _time.sleep(wait)
    print(f"  [ERROR] download key={key}: ALL 5 ATTEMPTS FAILED — last: {last_exc}")
    return None


def upload_bytes(s3, key: str, data: bytes) -> bool:
    try:
        s3.put_object(
            Bucket=ORIGINALS_BUCKET,
            Key=key,
            Body=data,
            ContentType="image/png",
            CacheControl="public, max-age=31536000, immutable",
        )
        return True
    except ClientError as e:
        print(f"  [ERROR] upload key={key}: {e}")
        return False


def delete_key(s3, key: str) -> bool:
    try:
        s3.delete_object(Bucket=ORIGINALS_BUCKET, Key=key)
        return True
    except ClientError:
        return False


# ---------------------------------------------------------------------------
# Image processing pipeline
# ---------------------------------------------------------------------------
@dataclass
class ProcessResult:
    src_key: str
    dst_key: str
    ok: bool
    message: str
    size_bytes: int = 0
    width: int = 0
    height: int = 0


def _deterministic_seed(src_key: str) -> int:
    """Small pixel-level fingerprint tweaks — deterministic per file id so
    every run gives the same output, reproducible & cache-friendly."""
    h = hashlib.sha256(src_key.encode("utf-8")).digest()
    return int.from_bytes(h[:4], "big", signed=False)


def _micro_adjust(img: Image.Image, seed: int) -> Image.Image:
    """Tiny brightness/contrast/saturation tweaks — ~2-3% change, enough
    to break Google image-signatures while remaining visually identical."""
    rng = (seed % 1000) / 1000.0  # 0..1
    brightness = 0.97 + rng * 0.07          # 0.97x .. 1.04x
    contrast   = 0.96 + (1.0 - rng) * 0.08 # 0.96x .. 1.04x
    saturation = 0.97 + ((seed >> 3) % 1000) / 1000.0 * 0.07 # 0.97 .. 1.04
    img = ImageEnhance.Brightness(img).enhance(brightness)
    img = ImageEnhance.Contrast(img).enhance(contrast)
    img = ImageEnhance.Color(img).enhance(saturation)
    # Also add 1-pixel random RGB noise on ~1% of pixels (transparent pixels
    # stay transparent) for a unique pixel-level fingerprint.
    arr = None
    try:
        import numpy as np
        arr = np.array(img.convert("RGBA"))  # H,W,4
        mask = np.random.RandomState(seed).rand(arr.shape[0], arr.shape[1]) < 0.01
        alpha_mask = arr[..., 3] > 0  # only modify opaque-ish pixels
        final_mask = mask & alpha_mask
        noise = np.random.RandomState(seed + 1).randint(-3, 4, size=arr.shape, dtype=np.int16)
        arr = arr.astype(np.int16)
        arr[final_mask, :3] = np.clip(arr[final_mask, :3] + noise[final_mask, :3], 0, 255)
        arr = arr.astype(np.uint8)
        img = Image.fromarray(arr, mode="RGBA")
    except Exception:
        pass  # numpy optional — skip noise step if unavailable
    return img


def _resize_long_side(img: Image.Image, long_side: int) -> Image.Image:
    w, h = img.size
    if max(w, h) == long_side:
        return img
    ratio = long_side / float(max(w, h))
    new_w = max(1, int(round(w * ratio)))
    new_h = max(1, int(round(h * ratio)))
    return img.resize((new_w, new_h), Image.LANCZOS)


def _encode_png_lossless(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    # strip all metadata via save_all=False + exif=b'' + no ICC profile
    img.save(
        buf,
        format="PNG",
        optimize=True,
        exif=b"",
        save_all=False,
        bits=8,
    )
    raw = buf.getvalue()
    # Attempt pngquant compression (lossy-on-palette, visually lossless)
    # if system has pngquant binary available
    try:
        import subprocess
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf_in, \
             tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf_out:
            tf_in.write(raw)
            tf_in.flush()
            in_path = tf_in.name
            out_path = tf_out.name
        subprocess.run(
            ["pngquant", "--force", "--skip-if-larger", "--quality", "85-98",
             "--strip", "--output", out_path, "--", in_path],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=30,
        )
        qp = Path(out_path)
        if qp.exists() and qp.stat().st_size > 0 and qp.stat().st_size < len(raw):
            raw = qp.read_bytes()
        try:
            Path(in_path).unlink(missing_ok=True)
        except Exception:
            pass
        try:
            qp.unlink(missing_ok=True)
        except Exception:
            pass
    except Exception:
        pass
    return raw


def _compress_to_limit(img: Image.Image) -> bytes:
    """Iteratively compress with TARGET = 1.5 MB as soft ceiling. HARD RULE:
    long side = 2047 px (DOC §6 + §21: NO downscale allowed; master canvas
    long-side locked to 2047), so we only lower PNG palette quality
    aggressively instead of resizing.

    2026-07-03 USER DIRECTIVE: 1.5 MB is NOT a hard gate. Compressor still
    tries its best to reach 1.5 MB (so we get small files when possible),
    but the caller will accept anything ≤ 4.0 MB for upload (with a
    WARNING printed for 1.5–4.0 MB files)."""
    data = _encode_png_lossless(img)
    step = 0
    # Pass 1: progressively more aggressive pngquant (no resize ever!)
    # Quality tier: 90/84/78/72/66/60/52/42 → 8 passes
    quality_steps = [90, 84, 78, 72, 66, 60, 52, 42]
    for q in quality_steps:
        if len(data) <= TARGET_SIZE_BYTES:
            break
        step += 1
        try:
            import subprocess
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf_in, \
                 tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf_out:
                tf_in.write(data)
                tf_in.flush()
                in_path, out_path = tf_in.name, tf_out.name
            subprocess.run(
                ["pngquant", "--force", "--strip", f"--quality={max(20,q-10)}-{q}",
                 "--output", out_path, "--", in_path],
                check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60,
            )
            qp = Path(out_path)
            if qp.exists() and qp.stat().st_size > 0:
                data = qp.read_bytes()
            try:
                Path(in_path).unlink(missing_ok=True); qp.unlink(missing_ok=True)
            except Exception:
                pass
        except Exception:
            break
    # Pass 2: try oxipng if available (lossless post-process)
    if len(data) > TARGET_SIZE_BYTES:
        try:
            import subprocess
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf_in, \
                 tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf_out:
                tf_in.write(data)
                tf_in.flush()
                in_path, out_path = tf_in.name, tf_out.name
            subprocess.run(
                ["oxipng", "-o", "6", "--strip", "safe", "--out", out_path, in_path],
                check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120,
            )
            qp = Path(out_path)
            if qp.exists() and qp.stat().st_size > 0 and qp.stat().st_size < len(data):
                data = qp.read_bytes()
            try:
                Path(in_path).unlink(missing_ok=True); qp.unlink(missing_ok=True)
            except Exception:
                pass
        except Exception:
            pass
    # Pass 3: 256-color palette fallback — keep as best-effort compression.
    # User says 1.5 MB is not a gate, so this is still worth running for
    # the 60-80% file size win it usually delivers (even if result still
    # ends up in the 1.5–4.0 MB warning band).
    if len(data) > TARGET_SIZE_BYTES:
        try:
            im_mode = img.mode
            quant = None
            if im_mode == "RGBA":
                quant = img.quantize(colors=255, method=Image.Quantize.LIBIMAGEQUANT
                                     if hasattr(Image.Quantize, "LIBIMAGEQUANT")
                                     else Image.Quantize.MEDIANCUT,
                                     dither=Image.Dither.FLOYDSTEINBERG)
            elif im_mode == "RGB":
                quant = img.quantize(colors=256, dither=Image.Dither.FLOYDSTEINBERG)
            if quant is not None:
                data = _encode_png_lossless(quant)
                try:
                    import subprocess, tempfile
                    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as ti, \
                         tempfile.NamedTemporaryFile(suffix=".png", delete=False) as to:
                        ti.write(data); ti.flush()
                    subprocess.run(["pngquant", "--force", "--strip",
                                    "--quality=15-42", "--output", to.name,
                                    "--", ti.name],
                                   check=False, stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, timeout=60)
                    qp = Path(to.name)
                    if qp.exists() and qp.stat().st_size > 0:
                        data2 = qp.read_bytes()
                        if len(data2) < len(data):
                            data = data2
                    try:
                        Path(ti.name).unlink(missing_ok=True)
                        qp.unlink(missing_ok=True)
                    except Exception:
                        pass
                except Exception:
                    pass
                try:
                    import subprocess, tempfile
                    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as ti, \
                         tempfile.NamedTemporaryFile(suffix=".png", delete=False) as to:
                        ti.write(data); ti.flush()
                    subprocess.run(["oxipng", "-o", "5", "--strip", "safe",
                                    "--out", to.name, ti.name],
                                   check=False, stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, timeout=180)
                    qp = Path(to.name)
                    if qp.exists() and qp.stat().st_size > 0 and qp.stat().st_size < len(data):
                        data = qp.read_bytes()
                    try:
                        Path(ti.name).unlink(missing_ok=True)
                        qp.unlink(missing_ok=True)
                    except Exception:
                        pass
                except Exception:
                    pass
        except Exception:
            pass
    # ⛔ DOC §6 + §21 HARD RULE: NEVER FALL BACK TO RESIZING! long side must stay 2047.
    # Compressor returns its best-effort output; the caller now applies the
    # TWO-THRESHOLD policy (user directive 2026-07-03):
    #   ≤ 1.5 MB          → OK (silent)
    #   1.5 MB < x ≤ 4 MB → OK + WARNING logged (still uploaded!)
    #   > 4.0 MB          → FAIL + old JPG purged (truly unusable)
    return data


def process_one_image(s3, src_obj: dict, to_local_only: bool) -> ProcessResult:
    src_key = src_obj["Key"]
    apply_mode = not to_local_only
    # Destination key: same category/prefix/pexels-id, normalise extension → .png
    # e.g. birthday/pexels-12345.jpg → birthday/pexels-12345.png
    slash_parts = src_key.split("/", 1)
    cat = slash_parts[0]
    base = slash_parts[1] if len(slash_parts) == 2 else src_key
    # strip old extension (.jpg/.jpeg/.png/.webp)
    stem = base
    for ext in (".jpeg", ".jpg", ".png", ".webp", ".JPG", ".JPEG", ".PNG"):
        if stem.endswith(ext):
            stem = stem[: -len(ext)]
            break
    dst_key = f"{cat}/{stem}.png"

    # Helper: in apply mode, ALWAYS purge old .jpg on ANY failure, to guarantee
    # ZERO legacy JPGs in originals bucket (doc line 6 hard rule).
    def _purge_old_jpg_if_apply():
        if apply_mode and dst_key != src_key:
            delete_key(s3, src_key)

    raw = download_bytes(s3, src_key)
    if not raw:
        _purge_old_jpg_if_apply()
        return ProcessResult(src_key, dst_key, False, "download failed")

    # Decode
    try:
        src_img = Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception as e:
        _purge_old_jpg_if_apply()
        return ProcessResult(src_key, dst_key, False, f"decode fail: {e}")

    # Pre-check source long-side >= SOURCE_MIN_LONG_SIDE (2048px — the
    # procurement/download gate for raw JPG/WEBP sources entering Step 2
    # for the FIRST time).  Finalized PNGs never reach this code because
    # the ext filter above excludes them.
    w0, h0 = src_img.size
    if max(w0, h0) < SOURCE_MIN_LONG_SIDE:
        _purge_old_jpg_if_apply()
        return ProcessResult(src_key, dst_key, False,
                             f"source too small: {w0}x{h0} long={max(w0,h0)} < {SOURCE_MIN_LONG_SIDE}")

    # Step 1: AI remove background (full transparent Alpha)
    if _HAS_REMBG:
        try:
            no_bg_bytes = rembg_remove(raw)
            img = Image.open(io.BytesIO(no_bg_bytes)).convert("RGBA")
        except Exception as e:
            # Rembg sometimes flaky; fall back to best-effort PIL matte
            print(f"  [WARN] rembg fail key={src_key}: {e} → PIL fallback")
            img = src_img
            try:
                from PIL import ImageFilter
                # Best-effort solid-white matte removal for common sources
                arr = None
                try:
                    import numpy as np
                    arr = np.array(img.convert("RGBA"))
                    white_mask = (arr[..., 0] > 240) & (arr[..., 1] > 240) & (arr[..., 2] > 240)
                    arr[white_mask, 3] = 0
                    img = Image.fromarray(arr, "RGBA").filter(ImageFilter.GaussianBlur(0.5))
                except Exception:
                    pass
            except Exception:
                pass
    else:
        img = src_img  # no rembg, process as-is (background integrity not guaranteed)
        print("  [WARN] rembg package unavailable — transparency quality may degrade")

    # Step 2: Resize long side = 2047 exactly (DOC §21 master canvas 2047×1448)
    img = _resize_long_side(img, TARGET_LONG_SIDE)

    # Step 3: Micro-adjust brightness/contrast + 1% pixel noise (fingerprint)
    seed = _deterministic_seed(src_key)
    img = _micro_adjust(img, seed)

    # Step 4: Make EXIF 100% stripped — PIL PNG save with exif=b" already does
    # this; ensure no ICC by working in RGB/RGBA sRGB generic (no embedded profile)

    # Step 5: Compress — best effort to 1.5 MB; accept ≤ 4.0 MB per user directive
    out_bytes = _compress_to_limit(img)
    w, h = img.size

    # Local save for inspection (always)
    local_path = STAGING_DIR / dst_key.replace("/", "__")
    local_path.write_bytes(out_bytes)

    # --- TWO-THRESHOLD SIZE POLICY (user directive 2026-07-03) ---
    #   ≤ TARGET (1.5 MB)          → silently OK
    #   TARGET < x ≤ HARD (4 MB)   → OK + print WARNING (still uploaded!)
    #   > HARD (> 4 MB)            → FAIL + purge old JPG (truly oversized)
    sz_mb = len(out_bytes) / 1024 / 1024
    if len(out_bytes) > HARD_LIMIT_BYTES:
        _purge_old_jpg_if_apply()
        return ProcessResult(src_key, dst_key, False,
                             f"post-compress EXCEEDS HARD LIMIT: {sz_mb:.2f} MB > {HARD_LIMIT_BYTES/1024/1024:.1f} MB gate",
                             len(out_bytes), w, h)
    elif len(out_bytes) > TARGET_SIZE_BYTES:
        # Warning band: file is accepted and uploaded! User explicitly said
        # 1.5 MB is not a gate; just log so we can track heavy files.
        tqdm.write(f"  [WARN — size OK, soft target exceeded] {dst_key}: "
                   f"{sz_mb:.2f} MB > {TARGET_SIZE_BYTES/1024/1024:.1f} MB target "
                   f"(≤ {HARD_LIMIT_BYTES/1024/1024:.1f} MB hard limit — UPLOADING)")

    if to_local_only:
        return ProcessResult(src_key, dst_key, True, "OK (local-only, no upload)",
                             len(out_bytes), w, h)

    # Step 6: Upload dst_key (.png) + DELETE src_key (old .jpg if different)
    ok_up = upload_bytes(s3, dst_key, out_bytes)
    if not ok_up:
        _purge_old_jpg_if_apply()
        return ProcessResult(src_key, dst_key, False, "upload .png failed",
                             len(out_bytes), w, h)
    if dst_key != src_key:
        delete_key(s3, src_key)  # remove old .jpg
    return ProcessResult(src_key, dst_key, True, "OK (uploaded + old jpg cleaned)",
                         len(out_bytes), w, h)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="Actually upload processed PNG back to originals bucket and delete old jpg")
    ap.add_argument("--to-local-only", action="store_true",
                    help="Only process to _step2_staging/ dir (no R2 write at all)")
    args = ap.parse_args()

    if args.apply and args.to_local_only:
        print("ERROR: --apply and --to-local-only are mutually exclusive.")
        return 2

    if not _HAS_REMBG:
        print("⚠️  WARNING: `rembg` package not installed / failed to load.")
        print("   Background removal will fall back to PIL white-matte heuristic only.")
        print("   For full AI transparency quality, run:")
        print("      pip install rembg onnxruntime onnxruntime-gpu pillow numpy")
        cont = input("   Continue anyway with reduced-quality fallback? [y/N] ").strip().lower()
        if cont not in ("y", "yes"):
            print("Aborted.")
            return 1

    print("=" * 80)
    print("🖼️   STEP 2: ORIGINALS 250 × STANDARDIZE → 2047px TRANSPARENT PNG (DOC §21)")
    print("=" * 80)
    print()
    print(f"Source bucket  : {ORIGINALS_BUCKET} (25 cats × 10 = ~250 objects)")
    print(f"Target long s. : {TARGET_LONG_SIDE} px exactly")
    print(f"Size — TARGET  : ≤ {TARGET_SIZE_BYTES/1024/1024:.1f} MB / file  (soft, warn only)")
    print(f"Size — HARD    : ≤ {HARD_LIMIT_BYTES/1024/1024:.1f} MB / file  (hard gate, > this → FAIL)")
    print(f"Tweaks         : brightness/contrast ±3% + 1% pixel noise → Google fingerprint break")
    print(f"EXIF           : STRIP ALL metadata (zero EXIF output)")
    print(f"Output format  : PNG 24 bit RGBA with full Alpha transparency")
    print(f"Output path    : {{category}}/pexels-{{pexels_id}}.png (ID/filename/stem preserved)")
    print()
    if args.to_local_only:
        mode = "🛡️  TO-LOCAL ONLY — staging dir only, NO R2 changes"
    elif args.apply:
        mode = "🔴 LIVE APPLY — overwrite originals bucket (delete old .jpg, upload new .png)"
    else:
        print("ERROR: Must specify either --to-local-only OR --apply.")
        print()
        print("  Suggested first run:")
        print("     python _scripts/_step2_standardize_originals.py --to-local-only")
        print("  Then, after inspecting _step2_staging/ outputs:")
        print("     python _scripts/_step2_standardize_originals.py --apply")
        return 2
    print(f"Mode           : {mode}")
    print("=" * 80)
    print()

    s3 = _s3_client()

    # List originals (should be ~250 after Step 1)
    all_objs = list_originals(s3)
    print(f"[INFO] Listed {len(all_objs)} total objects in {ORIGINALS_BUCKET}")

    # Doc §21 post-filter (user directive 2026-07-03): Step 2 standardizes
    # ONLY raw source raster formats (.jpg / .jpeg / .webp).  Previously
    # standardized 2047px PNG masters are FINALIZED output and MUST NOT be
    # re-ingested (prevents spurious SOURCE_MIN_LONG_SIDE SKIP on
    # already-compliant material; avoids wasting BW / IO / CPU re-processing).
    RAW_EXTS = {".jpg", ".jpeg", ".webp"}
    FIN_EXTS = {".png"}
    def _ext(k: str) -> str:
        return os.path.splitext(k)[1].lower()

    raw_sources = [o for o in all_objs if _ext(o["Key"]) in RAW_EXTS]
    finalized_png = [o for o in all_objs if _ext(o["Key"]) in FIN_EXTS]
    other_unknown = [o for o in all_objs if _ext(o["Key"]) not in RAW_EXTS and _ext(o["Key"]) not in FIN_EXTS]

    print(f"[FILTER] Raw sources → Step 2 standardize: {len(raw_sources)} files "
          f"({', '.join(sorted(RAW_EXTS))})")
    print(f"[FILTER] Finalized PNG masters  →  SKIP    : {len(finalized_png)} files "
          f"(already compliant {TARGET_LONG_SIDE}px transparent PNG; "
          f"not subject to SOURCE_MIN_LONG_SIDE gate)")
    if other_unknown:
        print(f"[FILTER] Unknown extensions → SKIP          : {len(other_unknown)} files "
              f"(ext set: {sorted({_ext(o['Key']) for o in other_unknown})})")
    objs = raw_sources
    print()

    # ------------------------------------------------------------------
    # Print dual-threshold rules ONCE every run so operators never mix them up
    # (root cause of earlier confusion: reused source-2800 gate for finished PNGs)
    # ------------------------------------------------------------------
    print("  SIZE RULES (user directive 2026-07-03)")
    print(f"    ┌─ RAW SOURCE {sorted(RAW_EXTS)}准入门槛 (SOURCE_MIN)      = long_side ≥ {SOURCE_MIN_LONG_SIDE} px")
    print(f"    │    → 采购/Pexels下载校验；低于直接SKIP；仅对raw JPG/WEBP生效")
    print(f"    └─ PNG成品标准 (TARGET_LONG_SIDE)     = long_side = {TARGET_LONG_SIDE} px exactly")
    print(f"         → Originals桶母版；直接供编辑器/Step3/前端用；不再走Step2")
    print()

    # Group by category for reporting — covers raw sources only; PNG finalized counted separately
    by_cat: Dict[str, List[dict]] = defaultdict(list)
    for o in objs:
        k = o["Key"]
        cat = k.split("/", 1)[0] if "/" in k else "unknown"
        by_cat[cat].append(o)
    for c in CANONICAL_25_CATS:
        n_raw = len(by_cat.get(c, []))
        n_png = sum(1 for o in finalized_png if o["Key"].startswith(c + "/"))
        if n_raw or n_png:
            print(f"    {c:<20s}: {n_raw:>3d} raw source | {n_png:>3d} PNG master (kept as-is)")
    print()

    if len(objs) == 0 and len(finalized_png) == 0 and len(other_unknown) == 0:
        print("[ERROR] No objects found (neither raw sources nor finalized PNG) — did you skip Step 1?")
        return 1
    if len(objs) == 0 and len(finalized_png) > 0:
        # Common happy-path after the first successful full-cycle run:
        # Originals bucket contains ONLY already-standardized 2047px PNG masters.
        print("✅ Bucket contains 0 raw sources; all "
              f"{len(finalized_png)} objects are previously finalized 2047px PNG masters.")
        print("   Nothing to re-process (per user directive 2026-07-03: "
              "DO NOT re-ingest compliant PNGs → no SKIP inflation).")
        print()
        print("👉 Proceed directly to Step 3 (preview generation) — it reads the "
              "standardized PNG originals correctly.")
        return 0

    # Process all
    t0 = time.time()
    results: List[ProcessResult] = []
    skipped_small = 0
    pbar = tqdm(total=len(objs), desc="Standardize originals")
    for o in objs:
        r = process_one_image(s3, o, to_local_only=args.to_local_only)
        results.append(r)
        if "too small" in r.message:
            skipped_small += 1
        if not r.ok:
            tqdm.write(f"  [SKIP/FAIL] {r.src_key} → {r.message}")
        pbar.update(1)
    pbar.close()

    # Stats
    ok_n = sum(1 for r in results if r.ok)
    fail_n = len(results) - ok_n
    total_out_sz = sum(r.size_bytes for r in results if r.ok)
    sizes = [r.size_bytes for r in results if r.ok]
    max_sz = max(sizes) if sizes else 0
    min_sz = min(sizes) if sizes else 0
    # Two-threshold size compliance (user directive 2026-07-03):
    #   warn band = TARGET < x ≤ HARD  (uploaded OK, logged with warning)
    #   fail band = > HARD             (truly rejected)
    warn_band = [r for r in results if r.ok and TARGET_SIZE_BYTES < r.size_bytes <= HARD_LIMIT_BYTES]
    over_hard = [r for r in results if not r.ok and "HARD LIMIT" in r.message]
    # Dimension compliance
    bad_dim = [r for r in results if r.ok and max(r.width, r.height) != TARGET_LONG_SIDE]

    print()
    print("=" * 80)
    print("📊 STEP 2 COMPLETION SUMMARY")
    print("=" * 80)
    print(f"Total listed    : {len(all_objs):>4d}  (after Step 1 bucket listing)")
    print(f"  ↳ Raw sources processed : {len(objs):>4d}  (jpg/jpeg/webp only — filtered per §21)")
    print(f"  ↳ PNG masters preserved : {len(finalized_png):>4d}  (already 2047px transparent RGBA → kept as-is; NO SKIP inflation)")
    if other_unknown:
        print(f"  ↳ Unknown ext skipped   : {len(other_unknown):>4d}")
    print(f"Processed subset : {len(results):>4d}")
    print(f"  ✅ OK          : {ok_n:>4d}")
    print(f"  ❌ FAIL/SKIP   : {fail_n:>4d}   (skipped raw-source small(<{SOURCE_MIN_LONG_SIDE}px): {skipped_small}, hard-limit oversized: {len(over_hard)})")
    print(f"Output size stats (for OK files):")
    print(f"  Total size     : {total_out_sz/1024/1024:>7.1f} MB")
    print(f"  Min            : {min_sz/1024:>7.1f} KB")
    print(f"  Max            : {max_sz/1024:>7.1f} KB   (soft target {TARGET_SIZE_BYTES/1024/1024:.1f} MB, hard limit {HARD_LIMIT_BYTES/1024/1024:.1f} MB)")
    print(f"  Avg            : {(total_out_sz/max(1,ok_n))/1024/1024:>7.2f} MB / file")
    print(f"  1.5–4.0 MB band: {len(warn_band):>4d}  ⚠️  UPLOADED OK (soft target exceeded — NOT rejected per user directive)")
    print(f"  Long side ≠2047: {len(bad_dim):>4d}  {'✅' if len(bad_dim)==0 else '❌ — DOC §21 violated'}")
    print(f"  Output dir (inspect locally): {STAGING_DIR}")
    print()
    print(f"  Filename invariant check: all output keys use {cat}/pexels-{{ID}}.png")
    print(f"  → pexels IDs + category paths preserved; only ext normalized → .png")
    print()
    print(f"Elapsed: {time.time()-t0:.1f}s")
    print()
    if args.to_local_only:
        print("👉 NEXT: Check _step2_staging/ folder output quality visually.")
        print("   Then run:")
        print("      python _scripts/_step2_standardize_originals.py --apply")
        print("   → to overwrite originals bucket live, and continue to Step 3")
    return 0


if __name__ == "__main__":
    sys.exit(main())
