#!/usr/bin/env python3
"""
🧹 SendAFun — Cleanup `sendafun-originals` bucket (one-shot).

RULE (non-negotiable):
  sendafun-originals = HD PNG masters ONLY (2048px, ≤1.5MB)
  Any key NOT ending in `.png` (webp, tmp, txt, json, other) must be DELETED.

Usage:
  # SAFE DRY-RUN (no deletions, just list + statistics)
  python _scripts/clean_originals_bucket.py

  # ACTUALLY DELETE non-png objects
  python _scripts/clean_originals_bucket.py --apply
"""
import argparse, os, sys, time
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / '.env')
except ImportError:
    pass

ORIGINALS_BUCKET = os.environ.get('R2_ORIGINALS_BUCKET_NAME', 'sendafun-originals')


def boto_s3_client():
    import boto3
    for k in ('R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'):
        if not os.environ.get(k):
            print(f'  ❌ env {k} not set → cannot connect R2')
            return None
    return boto3.client(
        's3',
        endpoint_url='https://' + os.environ['R2_ACCOUNT_ID'] + '.r2.cloudflarestorage.com',
        aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
        region_name='auto',
        config=boto3.session.Config(
            signature_version='s3v4',
            connect_timeout=15, read_timeout=30,
            retries={'max_attempts': 3, 'mode': 'standard'},
            max_pool_connections=32,
            tcp_keepalive=True
        ),
    )


def classify(k: str):
    if k.lower().endswith('.png'):
        return 'png'
    if k.lower().endswith('-v2-vertical.webp'):
        return 'v2-webp (MISTAKE: copied-back preview)'
    if k.lower().endswith('-vertical.webp'):
        return 'nv-webp (MISTAKE: copied-back preview, no v2)'
    if k.lower().endswith('.webp'):
        return 'other-webp (MISTAKE)'
    return 'other (not png)'


def list_all(s3, bucket: str):
    """Return list of raw object dicts (Key/Size/LastModified) — handles pagination."""
    out = []
    ct = None
    while True:
        kw = dict(Bucket=bucket, MaxKeys=1000)
        if ct:
            kw['ContinuationToken'] = ct
        r = s3.list_objects_v2(**kw)
        for o in r.get('Contents', []) or []:
            out.append({'Key': o['Key'], 'Size': o.get('Size', 0),
                        'LastModified': o.get('LastModified')})
        if not r.get('IsTruncated'):
            break
        ct = r.get('NextContinuationToken')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true',
                    help='Actually perform the deletion (without this it is DRY RUN only)')
    ap.add_argument('--bucket', default=ORIGINALS_BUCKET)
    args = ap.parse_args()

    mode_label = '🚨 REAL-DELETE MODE 🚨' if args.apply else '🧪 DRY-RUN (no changes)'
    print('\n' + '=' * 78)
    print(f'  🧹 Cleanup bucket: sendafun-originals → Mode: {mode_label}')
    print('=' * 78)

    s3 = boto_s3_client()
    if not s3:
        print('  ❌ Cannot proceed without R2 credentials.')
        sys.exit(2)

    print(f'\n  📦 Listing all objects in s3://{args.bucket} … (this may take a few seconds)')
    objs = list_all(s3, args.bucket)
    print(f'  ✅ Total objects found: {len(objs):,}')

    by_cls = Counter()
    by_size_cls = Counter()
    keep_keys = []
    delete_keys = []
    for o in objs:
        cls = classify(o['Key'])
        by_cls[cls] += 1
        by_size_cls[cls] += o['Size']
        if cls == 'png':
            keep_keys.append(o)
        else:
            delete_keys.append(o)

    print('\n' + '-' * 78)
    print('  📊 CATEGORY STATISTICS (before cleanup):')
    print('-' * 78)
    for cls in ['png',
                'v2-webp (MISTAKE: copied-back preview)',
                'nv-webp (MISTAKE: copied-back preview, no v2)',
                'other-webp (MISTAKE)',
                'other (not png)']:
        if cls not in by_cls:
            continue
        cnt = by_cls[cls]
        siz_mb = by_size_cls[cls] / 1024 / 1024
        mark = '💎 KEEP (PNG masters)' if cls == 'png' else '❌ DELETE (violates PNG-only rule)'
        print(f'    {mark:<45} | {cls:<50} | count={cnt:>6,} | size={siz_mb:>8.1f} MB')

    print(f'\n    ➡ TOTAL KEEP     (PNG only) : {len(keep_keys):,}')
    print(f'    ➡ TOTAL DELETE  (non-PNG)  : {len(delete_keys):,}')

    if delete_keys:
        print('\n' + '-' * 78)
        print(f'  🗒  First up to 30 DELETE candidates (out of {len(delete_keys):,}):')
        print('-' * 78)
        for o in delete_keys[:30]:
            print(f'     • size={o["Size"]:>10,} B   key={o["Key"]}')
        if len(delete_keys) > 30:
            print(f'     … + {len(delete_keys)-30:,} more')

    if not args.apply:
        print('\n' + '=' * 78)
        print(f'  🧪 DRY-RUN complete. Re-run with:   python _scripts/clean_originals_bucket.py --apply')
        print('     to actually DELETE these non-PNG objects from sendafun-originals.')
        print('=' * 78)
        return

    if len(delete_keys) == 0:
        print('\n  ✅ Nothing to delete — sendafun-originals is already 100% PNG-only ✅')
        return

    # ---- REAL DELETION ----
    # Use bulk delete_objects (up to 1000 keys per request), the fastest + cheapest method.
    BATCH = 1000
    total_deleted = 0
    total_errors = 0
    errors = []
    t0 = time.time()

    print('\n' + '=' * 78)
    print(f'  🚨 STARTING REAL DELETION of {len(delete_keys):,} non-PNG objects in batches of {BATCH}…')
    print('=' * 78)
    for i in range(0, len(delete_keys), BATCH):
        batch = delete_keys[i:i + BATCH]
        keys = [{'Key': o['Key']} for o in batch]
        try:
            r = s3.delete_objects(Bucket=args.bucket, Delete={'Objects': keys, 'Quiet': False})
            total_deleted += len(r.get('Deleted', []) or [])
            for err in r.get('Errors', []) or []:
                total_errors += 1
                errors.append((err.get('Key', '?'), err.get('Code', '?'), err.get('Message', '?')))
            elapsed = time.time() - t0
            rate = (i + len(batch)) / elapsed if elapsed > 0 else 0
            print(f'     batch {i//BATCH+1:>3}/{(len(delete_keys)+BATCH-1)//BATCH:<3} | '
                  f'done so far={total_deleted:>6,}/{len(delete_keys):<6,} | '
                  f'errors so far={total_errors:<4} | rate={rate:>6.0f} keys/s')
        except Exception as e:
            print(f'     ❌ batch exception on indices {i}-{i+len(batch)}: {e!r}')
            total_errors += len(batch)

    # ---- Post-verify: list bucket again & re-count ----
    print('\n  🔍 Re-listing sendafun-originals to confirm post-delete state …')
    objs2 = list_all(s3, args.bucket)
    by_cls2 = Counter()
    for o in objs2:
        by_cls2[classify(o['Key'])] += 1

    non_png_after = sum(v for k, v in by_cls2.items() if k != 'png')
    png_after = by_cls2.get('png', 0)

    print('\n' + '=' * 78)
    print('  ✅ DELETION SUMMARY')
    print('=' * 78)
    print(f'    Non-PNG objects requested to delete : {len(delete_keys):,}')
    print(f'    Objects actually reported Deleted   : {total_deleted:,}')
    print(f'    Deletion errors (Key / Code / Msg)  : {total_errors:,}')
    if errors:
        print('    First 10 errors:')
        for ek, ec, em in errors[:10]:
            print(f'      • {ek}  → [{ec}] {em}')
    print()
    print('    Post-delete bucket counts:')
    print(f'      • PNG masters (💎 KEEP)          : {png_after:,}')
    print(f'      • Non-PNG violations (❌ should be 0) : {non_png_after:,}')

    if non_png_after == 0 and png_after >= 250:
        print(f'\n    🎉🎉🎉 PASS — sendafun-originals is now PNG-only, {png_after:,} masters ≥ 250 ✅')
    else:
        print(f'\n    ⚠️  FAIL — post-delete check not satisfied '
              f'(PNG {png_after} ≥250? {png_after >=250} ; non-PNG {non_png_after} ==0? {non_png_after ==0})')
        sys.exit(1)


if __name__ == '__main__':
    main()
