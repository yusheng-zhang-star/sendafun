import os, boto3, requests, json

ACCOUNT = os.environ['R2_ACCOUNT_ID']
S3 = boto3.client(
    's3',
    endpoint_url='https://' + ACCOUNT + '.r2.cloudflarestorage.com',
    aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
    region_name='auto',
    config=boto3.session.Config(signature_version='s3v4'),
)

# 1. Print ALL 750 keys in originals bucket grouped by suffix type
print('=== SEND ANALYSIS: sendafun-originals bucket FULL LIST ===')
ct = None
all_originals = []
while True:
    kwargs = dict(Bucket='sendafun-originals', MaxKeys=1000)
    if ct: kwargs['ContinuationToken'] = ct
    r = S3.list_objects_v2(**kwargs)
    for o in r.get('Contents', []) or []:
        all_originals.append(o['Key'])
    if not r.get('IsTruncated'): break
    ct = r['NextContinuationToken']
print(f'Total keys in originals: {len(all_originals)}')

# Group by cat
from collections import defaultdict
by_cat_keys = defaultdict(list)
for k in all_originals: by_cat_keys[k.split('/')[0]].append(k)
print(f'Categories with keys: {len(by_cat_keys)}')
for cat in sorted(by_cat_keys.keys()):
    ks = sorted(by_cat_keys[cat])
    print(f'  {cat}: {len(ks)} keys')
    for k in ks[:5]: print(f'    {k}')
    if len(ks) > 5: print(f'    ... ({len(ks)-5} more)')

# 2. For each of 10 test categories, ask D1 API -> print bgImageWatermark URL -> HEAD via boto3 in originals bucket
test_cats = ['thanksgiving','christmas','easter','birthday','love','valentine','new-baby','wedding','graduation','halloween']
API = 'https://sendafun.com/api/cards'
print()
print('=== D1 API + ORIGINALS BUCKET HEAD CROSS-CHECK (10 CATS) ===')
# Get PUB bucket domain for direct HTTP check from D1 URL itself
for cat in test_cats:
    print(f'\n--- {cat} ---')
    try:
        r = requests.get(API, params={'category': cat, 'size': 1}, timeout=30)
        d = r.json()
        cards = d.get('cards') or []
        if not cards: print('  API returned 0 cards'); continue
        c = cards[0]
        url = c.get('bgImageWatermark') or ''
        print(f'  D1 bgImageWatermark URL: {url}')
        print(f'  D1 bgImage URL:           {c.get("bgImage")}')
        # Extract key: remove https://pub-xxx.r2.dev/
        key = url.replace('https://', '').split('/', 1)[-1] if url else ''
        print(f'  → extracted R2 object key: {key!r}')
        # HEAD bucket
        if key:
            try:
                S3.head_object(Bucket='sendafun-originals', Key=key)
                print(f'  → BUCKET HEAD: EXISTS ✅')
            except Exception as e:
                print(f'  → BUCKET HEAD: ❌ MISSING! ({e!r})')
            # Also direct public HTTP HEAD
            try:
                hr = requests.head(url, timeout=25, allow_redirects=True,
                    headers={'User-Agent':'Mozilla/5.0 Chrome/126'})
                print(f'  → PUBLIC HTTP HEAD: HTTP {hr.status_code} | CL={hr.headers.get("Content-Length","?")} | CT={hr.headers.get("Content-Type","?")}')
            except Exception as e2:
                print(f'  → PUBLIC HTTP HEAD: ❌ EXCEPTION {e2!r}')
    except Exception as e:
        print(f'  API ERROR: {e!r}')
