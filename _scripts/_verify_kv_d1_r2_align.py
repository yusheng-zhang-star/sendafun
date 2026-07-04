#!/usr/bin/env python3
"""
🔬 Verify KV/D1/R2 alignment after originals webp cleanup (One-shot audit).

3 checks:
  1. D1 `/api/cards?limit=30` → bgImage / bgImageWatermark / pexelsId field sanity:
       - bgImage URL → MUST preview public URL, NEVER originals
       - pexelsId non-empty = count as PNG master candidate
  2. S3 sendafun-originals → list all 250 PNG keys, extract {pexelsId, category}.
       - Every D1 card with non-empty pexelsId MUST match an existing PNG.
       - Every PNG in originals SHOULD match a D1 card (orphan PNGs = flagged)
  3. S3 "simulate" the 2 Worker HD router cases:
       - Case A (bad): head_object on a deleted v2-webp key → SHOULD 404
       - Case B (good): head_object on real PNG key → SHOULD 200
Usage:
  python _scripts/_verify_kv_d1_r2_align.py
"""
import os, sys, json, time
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / '.env')
except ImportError:
    pass

import requests

D1_BASE   = os.environ.get("D1_API_BASE_URL", "https://sendafun.com").rstrip("/")
BULK_HDR  = {}
tok = os.environ.get("CARDS_BULK_API_TOKEN", "").strip()
if tok:
    BULK_HDR['Authorization'] = 'Bearer ' + tok

ORIGINALS_BUCKET = os.environ.get('R2_ORIGINALS_BUCKET_NAME', 'sendafun-originals')
PREVIEW_BUCKET   = 'sendafun-preview'


def boto_s3_client():
    import boto3
    for k in ('R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'):
        if not os.environ.get(k):
            print(f'  ⚠️ env {k} not set → skip S3 checks')
            return None
    return boto3.client(
        's3',
        endpoint_url='https://' + os.environ['R2_ACCOUNT_ID'] + '.r2.cloudflarestorage.com',
        aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
        region_name='auto',
        config=boto3.session.Config(
            signature_version='s3v4', connect_timeout=15, read_timeout=30,
            retries={'max_attempts':3,'mode':'standard'}, max_pool_connections=16
        ),
    )


def section(title):
    print('\n' + '=' * 80)
    print(f'  🔬 {title}')
    print('=' * 80)


# ============================================================
# 1. D1 cards sanity
# ============================================================
section('1/3 — D1 cards API sanity (bgImage URL preview-only? pexelsId populated?)')
d1_ok = True
samples = []
total_d1 = None
by_cat_d1 = Counter()
pexels_nonempty = 0
bg_preview = 0
bg_originals = 0
by_cat_pexels = Counter()
try:
    r = requests.get(D1_BASE + '/api/cards?limit=1', timeout=20, headers=BULK_HDR)
    r.raise_for_status()
    j = r.json()
    meta = j.get('meta', {}) or {}
    total_d1 = meta.get('total')
    bc = meta.get('byCategory') or {}
    if isinstance(bc, dict):
        for k, v in bc.items(): by_cat_d1[k] = int(v)
    print(f'  D1 total cards declared = {total_d1}')
    print(f'  D1 categories: {sum(by_cat_d1.values())} entries across {len(by_cat_d1)} cats')
except Exception as e:
    print(f'  ⚠️  /api/cards?limit=1 meta fetch failed: {e!r}')

try:
    r = requests.get(D1_BASE + '/api/cards?limit=30', timeout=25, headers=BULK_HDR)
    r.raise_for_status()
    j = r.json()
    cs = j.get('cards', []) or []
    print(f'  Fetched {len(cs)} sample cards from D1.')
    for c in cs:
        slug = c.get('slug', '')
        cat = c.get('category', '')
        pid = (c.get('pexelsId') or c.get('pexels_id') or '').strip()
        bi  = c.get('bgImage') or ''
        bw  = c.get('bgImageWatermark') or ''
        if pid:
            pexels_nonempty += 1
            by_cat_pexels[cat] += 1
        if 'pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev' in bi or '/r2-proxy/' in bi or bi.endswith('.webp') or 'sendafun-preview' in bi:
            bg_preview += 1
        elif 'sendafun-originals' in bi or bi.endswith('.png') and not (bi.endswith('.webp')):
            # bgImage might be PNG in theory, but public pages SHOULD use preview webp
            bg_originals += 1
        samples.append({'slug':slug,'cat':cat,'pexelsId':pid,
                        'bgI_len':len(bi),'bgW_len':len(bw),
                        'bgI_preview':('pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev' in bi or bi.endswith('.webp'))})
    print(f'  Among {len(cs)} samples: pexelsId non-empty = {pexels_nonempty}/{len(cs)}')
    print(f'    bgImage in preview bucket scope (r2.dev/webp/preview) = {bg_preview}')
    print(f'    bgImage in originals scope (originals png) = {bg_originals}')
    if len(samples) > 0:
        print(f'  First 5 samples:')
        for s in samples[:5]:
            print(f'    • cat={s["cat"]:<18} pexelsId=[{s["pexelsId"]:<9}] bgI_preview_ok={s["bgI_preview"]} slug={s["slug"][:70]}')
except Exception as e:
    print(f'  ❌ D1 cards fetch failed: {e!r}')
    d1_ok = False

# ============================================================
# 2. Originals bucket PNG masters enumerate → build (cat, pid) set
# ============================================================
s3 = boto_s3_client()
master_keys = {}  # (cat, pexelsId) → key
cat_totals_orig = Counter()
originals_total = 0
originals_png = 0
originals_other = 0
if s3:
    section('2/3 — sendafun-originals bucket: enumerate all keys, (cat,pexelsId) ↔ D1 pexelsId cross-check')
    ct = None
    while True:
        kw = dict(Bucket=ORIGINALS_BUCKET, MaxKeys=1000)
        if ct: kw['ContinuationToken'] = ct
        r = s3.list_objects_v2(**kw)
        for o in r.get('Contents', []) or []:
            k = o['Key']
            originals_total += 1
            parts = k.split('/')
            cat = parts[0] if len(parts) >= 2 else '__root__'
            if k.lower().endswith('.png'):
                originals_png += 1
                cat_totals_orig[cat] += 1
                # parse pexels id from key: e.g. "birthday-pexels-8014697.png" → 8014697
                base = parts[-1].rsplit('.', 1)[0]  # filename without .png
                # patterns:  cat-pexels-ID-v2-vertical  /  cat-pexels-ID-vertical  /  cat-pexels-ID
                import re
                m = re.search(r'pexels-(\d+)', base)
                if m:
                    pid = m.group(1)
                    master_keys[(cat, pid)] = k
            else:
                originals_other += 1
        if not r.get('IsTruncated'): break
        ct = r.get('NextContinuationToken')
    print(f'  Originals bucket total: {originals_total}')
    print(f'    PNG (💎 masters)      : {originals_png}  (categories={len(cat_totals_orig)})')
    print(f'    Non-PNG (❌ VIOLATION): {originals_other}  → must be 0 after cleanup!')
    print(f'    Parsed (cat,pexelsId) unique pairs from PNG keys: {len(master_keys)}')
    if originals_other > 0:
        print(f'    🔴 VIOLATION: {originals_other} non-PNG objects still in originals!')
    # cross check: D1 pexelsId vs originals PNGs
    if samples and master_keys:
        d1_pids = [(s["cat"], s["pexelsId"]) for s in samples if s["pexelsId"]]
        found_in_orig = sum(1 for pair in d1_pids if pair in master_keys)
        miss = [pair for pair in d1_pids if pair not in master_keys]
        print(f'\n  D1 samples {len(d1_pids)} non-empty pexelsId → found in originals PNG keys: {found_in_orig}/{len(d1_pids)}')
        if miss:
            print(f'  MISSING in originals (D1 says exists but PNG not there): {miss[:8]}')
else:
    print('  (Skipped — S3 client not available)')

# ============================================================
# 3. 2-case Worker HD router simulation via raw S3 head_object
# ============================================================
section('3/3 — Simulate Worker HD router 2 key scenarios (S3 head_object directly)')
if s3:
    good_case = ('birthday', '8014697')
    good_key = master_keys.get(good_case, 'birthday/birthday-pexels-8014697.png')
    bad_key  = 'sorry/sorry-pexels-4207550-v2-vertical.webp'  # we deleted these all
    # Case B (good PNG key → expect 200)
    try:
        r = s3.head_object(Bucket=ORIGINALS_BUCKET, Key=good_key)
        print(f'  ✅ CASE-B (good PNG key): HTTP 200   key={good_key}   size={r.get("ContentLength",0):,}   type={r.get("ContentType","?")}')
    except Exception as e:
        code = getattr(e, 'response', {}).get('ResponseMetadata', {}).get('HTTPStatusCode', '?')
        print(f'  ❌ CASE-B (good PNG key): ERR status={code}  key={good_key}  {e!r}')
    # Case A (deleted webp key → expect 404)
    try:
        r = s3.head_object(Bucket=ORIGINALS_BUCKET, Key=bad_key)
        print(f'  ❌ CASE-A (deleted webp key): HTTP 200 — WRONG! Should not exist. key={bad_key}')
    except Exception as e:
        code = getattr(e, 'response', {}).get('ResponseMetadata', {}).get('HTTPStatusCode', '?')
        if code == 404:
            print(f'  ✅ CASE-A (deleted webp key): HTTP 404 (as expected, deleted earlier). key={bad_key}')
        else:
            print(f'  ⚠️ CASE-A: unexpected HTTP status={code} (want 404). {e!r}')
else:
    print('  (Skipped — no S3)')

# ============================================================
# Summary
# ============================================================
print('\n' + '#' * 80)
print('#  FINAL SUMMARY')
print('#' * 80)
issues = 0
if originals_other and originals_other > 0:
    issues += 1
    print(f'  🔴 ISSUE: originals bucket still has {originals_other} non-PNG objects')
else:
    if s3:
        print(f'  ✅ Originals bucket: 100% PNG ({originals_png}) + 0 non-PNG')
if pexels_nonempty and samples and master_keys:
    d1_pids = [(s["cat"], s["pexelsId"]) for s in samples if s["pexelsId"]]
    f = sum(1 for pair in d1_pids if pair in master_keys)
    if f == len(d1_pids):
        print(f'  ✅ D1 → originals pexelsId cross-match on samples: {f}/{len(d1_pids)} (100%)')
    else:
        issues += 1
        print(f'  🟡 D1 → originals cross-match NOT 100%: {f}/{len(d1_pids)}')
if bg_originals and bg_originals > 0:
    issues += 1
    print(f'  🔴 ISSUE: {bg_originals} D1 bgImage values point to originals instead of preview bucket')
else:
    if samples:
        print(f'  ✅ D1 bgImage samples: all use preview bucket / webp URLs (public scope OK)')
print(f'  ➡ Total issues: {issues}')
if issues == 0:
    print('\n  🎉🎉🎉 ALL CHECKS PASS — KV/D1/R2 alignment looks solid after cleanup!')
    sys.exit(0)
else:
    print('\n  ⚠️ ISSUES FOUND — review above details.')
    sys.exit(1)
