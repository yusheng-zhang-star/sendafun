#!/usr/bin/env python3
"""
ONE-SHOT FIX SCRIPT (idempotent safe)
3 tasks sequentially for the 250 R2 PNG masters (25 cats × 10):
  1. Regenerate watermarked preview webp (1080px wide) → upload to PREVIEW bucket ONLY with VARIANT v2-vertical
     ⚠️ HARD RULE: originals bucket = PNG masters ONLY. Preview webp MUST NOT be copied / uploaded to originals.
  2. For each category, fetch top-10 cards from D1 /api/cards → pick their slug/title/category for UPSERT
  3. POST /api/cards/_bulk with 250 cards: bgImage/bgImageWatermark rewritten to aligned R2 real URLs

Usage:
  set PYTHONIOENCODING=utf-8
  set R2_ACCOUNT_ID=...
  set R2_ACCESS_KEY_ID=...
  set R2_SECRET_ACCESS_KEY=...
  # CARDS_BULK_API_TOKEN + D1_API_BASE_URL are auto-read from .env via dotenv
  python _scripts/_tmp_fix_step3_and_d1_250.py --apply
"""
import os, sys, io, re, json, argparse, time, threading
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / '.env')
except ImportError:
    pass

import boto3
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import requests

# ============================================================
# CONSTANTS (copied from _step3_generate_previews.py for consistency)
# ============================================================
VARIANT_NAME = "v2-vertical"       # preview key suffix: {cat}-pexels-{ID}-v2-vertical.webp
PREVIEW_FIXED_WIDTH = 1080         # px
WM_TEXT = "SendAFun.com"
WM_FONT_SIZE = 72
WM_OPACITY = 55                    # percent
WM_MARGIN_PCT = 0.02
R2_ACCOUNT = os.environ['R2_ACCOUNT_ID']
_REAL_S3 = boto3.client(
    's3',
    endpoint_url='https://' + R2_ACCOUNT + '.r2.cloudflarestorage.com',
    aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
    region_name='auto',
    config=boto3.session.Config(signature_version='s3v4'),
)
ORIGINALS_BUCKET = 'sendafun-originals'
PREVIEW_BUCKET   = 'sendafun-preview'
PUB_BASE = 'https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev'   # from D1 URLs


# ============================================================
# SAFEGUARD WRAPPER (non-negotiable):
#   ANY write (put_object / copy_object) to ORIGINALS_BUCKET
#   MUST have a target key that ends with `.png`.
#   Otherwise → loud AssertionError BEFORE any S3 call.
# This prevents a repeat of the COPY×2 webp → originals bug.
# ============================================================
class _GuardedS3Client:
    def __init__(self, real):
        self.__real = real

    @staticmethod
    def _enforce_originals_only_png(target_bucket, target_key, op_name):
        if target_bucket != ORIGINALS_BUCKET:
            return  # preview bucket / other buckets: no restriction
        if not (isinstance(target_key, str) and target_key.lower().endswith('.png')):
            raise AssertionError(
                f"[SAFEGUARD BLOCKED] {op_name} to {ORIGINALS_BUCKET!r} but "
                f"target key {target_key!r} does NOT end with .png. "
                f"Originals bucket = PNG masters ONLY. Webp/other previews "
                f"belong exclusively in {PREVIEW_BUCKET!r}. Refusing to write."
            )

    # --- Guarded write methods ---
    def put_object(self, Bucket=None, Key=None, **kwargs):
        self._enforce_originals_only_png(Bucket, Key, 'S3.put_object')
        return self.__real.put_object(Bucket=Bucket, Key=Key, **kwargs)

    def copy_object(self, Bucket=None, Key=None, CopySource=None, **kwargs):
        self._enforce_originals_only_png(Bucket, Key, 'S3.copy_object')
        return self.__real.copy_object(Bucket=Bucket, Key=Key, CopySource=CopySource, **kwargs)

    def copy(self, **kwargs):
        Bucket = kwargs.get('Bucket')
        Key = kwargs.get('Key')
        self._enforce_originals_only_png(Bucket, Key, 'S3.copy (high-level)')
        return self.__real.copy(**kwargs)

    # --- Everything else: transparent passthrough ---
    def __getattr__(self, item):
        return getattr(self.__real, item)


S3 = _GuardedS3Client(_REAL_S3)

BULK_TOKEN = os.environ.get("CARDS_BULK_API_TOKEN", "").strip()
D1_BASE   = os.environ.get("D1_API_BASE_URL", "https://sendafun.com").rstrip("/")
THREADS   = 16

# ============================================================
# Step 3 Watermark Preview Generator (exact step3 logic)
# ============================================================
def render_preview(src_img_rgba: Image.Image) -> bytes:
    """Return bytes of watermarked webp (1080px wide). Mirrors step3 logic exactly."""
    w0, h0 = src_img_rgba.size
    # Resize so width = 1080; aspect preserved.
    target_w = PREVIEW_FIXED_WIDTH
    target_h = max(1, round(h0 * target_w / w0))
    resized = src_img_rgba.resize((target_w, target_h), Image.LANCZOS)

    # Build white base (webp supports alpha but compose over white for previews)
    base = Image.new('RGBA', (target_w, target_h), (255,255,255,255))
    base.paste(resized, (0,0), resized)

    # Watermark overlay
    ov = Image.new('RGBA', (target_w, target_h), (0,0,0,0))
    draw = ImageDraw.Draw(ov)
    # Try to pick a font
    font = None
    for candidate in (
        'C:/Windows/Fonts/arial.ttf',
        '/Library/Fonts/Arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ):
        if os.path.exists(candidate):
            try: font = ImageFont.truetype(candidate, WM_FONT_SIZE); break
            except Exception: pass
    if font is None:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0,0), WM_TEXT, font=font)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    mx = int(target_w * WM_MARGIN_PCT)
    my = int(target_h * WM_MARGIN_PCT)
    x = target_w - tw - mx
    y = target_h - th - my
    # Draw subtle shadow then white text with 55% opacity
    alpha = int(round(WM_OPACITY * 255 / 100))
    draw.text((x+2, y+2), WM_TEXT, font=font, fill=(0,0,0,max(30,alpha//3)))
    draw.text((x, y), WM_TEXT, font=font, fill=(255,255,255,alpha))
    ov = ov.filter(ImageFilter.GaussianBlur(0.35))
    final = Image.alpha_composite(base, ov).convert('RGB')

    buf = io.BytesIO()
    final.save(buf, format='WEBP', quality=82, method=6)
    return buf.getvalue()

# ============================================================
# STEP A: Load originals bucket 250 PNG masters
# ============================================================
def list_png_masters():
    out = []
    ct = None
    while True:
        kw = dict(Bucket=ORIGINALS_BUCKET, MaxKeys=1000)
        if ct: kw['ContinuationToken'] = ct
        r = S3.list_objects_v2(**kw)
        for o in r.get('Contents',[]) or []:
            k = o['Key']
            if not k.endswith('.png'): continue
            parts = k.split('/')
            if len(parts) != 2: continue
            cat, file = parts
            m = re.match(r'pexels-(\d+)\.png$', file)
            if not m: continue
            pid = int(m.group(1))
            out.append({'cat': cat, 'pid': pid, 'png_key': k})
        if not r.get('IsTruncated'): break
        ct = r['NextContinuationToken']
    # Group by cat, take up to 10 each (should already be 10 each)
    by_cat = defaultdict(list)
    for rec in out: by_cat[rec['cat']].append(rec)
    for cat in list(by_cat.keys()):
        by_cat[cat].sort(key=lambda r: r['pid'])
        by_cat[cat] = by_cat[cat][:10]
    flat = []
    for cat, recs in sorted(by_cat.items()):
        for r in recs: flat.append(r)
    print(f'[A] Loaded {len(flat)} PNG masters across {len(by_cat)} categories')
    for cat in sorted(by_cat.keys()):
        print(f'    {cat}: {len(by_cat[cat])} pids={[r["pid"] for r in by_cat[cat][:3]]}...')
    return flat, by_cat

# ============================================================
# STEP B: For each master → generate preview → upload preview bucket (ONLY — no writes to originals)
# ============================================================
def process_one_master(rec):
    cat, pid, png_key = rec['cat'], rec['pid'], rec['png_key']

    # 1. Download PNG master from originals bucket (in-memory)
    get = S3.get_object(Bucket=ORIGINALS_BUCKET, Key=png_key)
    with Image.open(io.BytesIO(get['Body'].read())) as im:
        im = im.convert('RGBA')
        webp_bytes = render_preview(im)

    # 2. Upload to preview bucket with v2 key
    preview_key = f'{cat}/{cat}-pexels-{pid}-v2-vertical.webp'
    S3.put_object(
        Bucket=PREVIEW_BUCKET, Key=preview_key, Body=webp_bytes,
        ContentType='image/webp',
        CacheControl='public, max-age=31536000, immutable'
    )

    # NOTE: 3. Server-side COPY to ORIGINALS bucket — DISABLED per requirement.
    # Originals bucket must contain ONLY PNG HD masters. Low-res webp previews
    # live exclusively in sendafun-preview and must never be copied back.
    return rec

def run_tasks_B(masters, apply):
    total = len(masters)
    print(f'[B] Regenerating previews + upload preview bucket only: {total} masters')
    if not apply:
        print(f'    DRY-RUN: would process {total} (no network writes except S3 reads)')
        return 0, 0
    ok = fail = 0
    pbar_lock = threading.Lock()
    def worker(rec):
        nonlocal ok, fail
        try:
            process_one_master(rec)
            with pbar_lock: ok += 1
        except Exception as e:
            with pbar_lock: fail += 1
            print(f'    FAIL {rec["png_key"]!r}: {e!r}')
        if (ok+fail) % 25 == 0:
            with pbar_lock: print(f'    progress: {ok+fail}/{total} ok={ok} fail={fail}')
    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        futs = [ex.submit(worker, r) for r in masters]
        for f in as_completed(futs): f.result()
    print(f'[B] DONE ok={ok} fail={fail}')
    return ok, fail

# ============================================================
# STEP C: Per cat, fetch top-10 D1 cards, pick slug/title → pair with R2 masters
# ============================================================
def build_upsert_payload(by_cat):
    sess = requests.Session()
    payload_cards = []
    stats = defaultdict(lambda: [0,0])
    print(f'[C] Fetching top-10 per category from D1: {len(by_cat)} categories')
    for cat, recs in sorted(by_cat.items()):
        pids = [r['pid'] for r in recs]
        try:
            r = sess.get(f'{D1_BASE}/api/cards', params={'category': cat, 'size': min(20, len(pids)*2)}, timeout=45)
            r.raise_for_status()
            cards = (r.json() or {}).get('cards', []) or []
        except Exception as e:
            print(f'    FAIL fetch {cat}: {e!r} — skip D1 upsert pair')
            continue
        # Keep only cards that have valid slug/title
        valid = [c for c in cards if c.get('slug') and c.get('title')]
        # Pair 1:1 with masters (up to 10)
        for (master, card) in zip(recs, valid[:len(recs)]):
            pid = master['pid']
            webp_v2 = f'{PUB_BASE}/{cat}/{cat}-pexels-{pid}-v2-vertical.webp'
            payload_cards.append({
                'slug': card['slug'],
                'title': card['title'],
                'category': cat,
                'pexelsId': str(pid),
                'bgImage': webp_v2,           # 母版字段也写v2 webp（前端bgImageWatermark优先，这个够用）
                'bgImageWatermark': webp_v2,
                'tags': card.get('tags') or [],
                'style': card.get('style') or '',
                'defaultText': card.get('defaultText') or '',
                'defaultFont': card.get('defaultFont') or "'Inter', sans-serif",
                'defaultColor': card.get('defaultColor') or '#1a1a1a',
                'aspectRatio': card.get('aspectRatio') or '3/4',
                'ogImage': card.get('ogImage') or webp_v2,
                'emotionalTags': card.get('emotionalTags') or [],
                'envelopeStyleId': card.get('envelopeStyleId') or '',
                'geoCountryTarget': card.get('geoCountryTarget') or [],
                'seo': card.get('seo') or {},
            })
        paired = min(len(recs), len(valid))
        stats[cat] = [paired, len(cards)]
        unpaired = max(0, len(recs)-paired)
        if unpaired: print(f'    ⚠️  {cat}: only {paired}/{len(recs)} masters paired with D1 cards (fetched {len(cards)} total, {len(valid)} valid)')
    print(f'[C] Built {len(payload_cards)} upsert cards from {len(stats)} categories')
    return payload_cards

def run_upsert(payload_cards, apply, batch=50):
    print(f'[D] UPSERT 250 → /api/cards/_bulk on {D1_BASE} ({len(payload_cards)} cards, batch={batch})')
    if not BULK_TOKEN:
        print(f'    ❌ CARDS_BULK_API_TOKEN missing → SKIP UPSERT')
        return 0
    if not payload_cards:
        return 0
    if not apply:
        print(f'    DRY-RUN: would POST {len(payload_cards)} in {max(1,(len(payload_cards)+batch-1)//batch)} batches')
        return 0
    endpoint = D1_BASE + '/api/cards/_bulk'
    headers = {'Authorization': f'Bearer {BULK_TOKEN}', 'Content-Type':'application/json'}
    sess = requests.Session()
    upserted = 0
    for i in range(0, len(payload_cards), batch):
        batch_cards = payload_cards[i:i+batch]
        r = sess.post(endpoint, headers=headers, json={'cards': batch_cards}, timeout=120)
        if r.status_code != 200:
            print(f'    ❌ batch {i//batch}: HTTP {r.status_code} {r.text[:300]}')
            time.sleep(2); continue
        j = r.json()
        up = int(j.get('upserted', 0) or 0)
        upserted += up
        print(f'    batch {i//batch}: valid={j.get("valid")} upserted={up} → cum={upserted}')
    print(f'[D] UPSERT DONE total written: {upserted}')
    return upserted

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    print('='*80)
    print(f'MODE: {"APPLY 🟢" if args.apply else "DRY-RUN 🟡 (no R2 writes / no D1 POST)"}')
    print(f'Target: {D1_BASE}, Preview bucket={PREVIEW_BUCKET}, Originals bucket={ORIGINALS_BUCKET}')
    print('='*80)
    masters, by_cat = list_png_masters()
    run_tasks_B(masters, args.apply)
    payload = build_upsert_payload(by_cat)
    run_upsert(payload, args.apply)
    print('\n====== ALL DONE ======')
    print('Next step: run _tmp_crosscheck_d1_vs_r2.py or final_verify_10x2.ps1 to confirm 100% HTTP200')
    return 0

if __name__ == '__main__':
    try: sys.exit(main())
    except KeyboardInterrupt: print('\nInterrupted')
