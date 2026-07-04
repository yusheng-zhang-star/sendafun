import os, boto3, re, sys
from collections import Counter

ACCOUNT = os.environ['R2_ACCOUNT_ID']
S3 = boto3.client(
    's3',
    endpoint_url='https://' + ACCOUNT + '.r2.cloudflarestorage.com',
    aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
    region_name='auto',
    config=boto3.session.Config(signature_version='s3v4'),
)

SRC_BUCKET = 'sendafun-preview'
DST_BUCKET = 'sendafun-originals'

# Step 1. List preview bucket ALL objects (250 expected; KEY=cat/cat-pexels-ID-v2-vertical.webp)
print('Listing', SRC_BUCKET, '...', flush=True)
src_keys = []
ct = None
while True:
    kwargs = dict(Bucket=SRC_BUCKET, MaxKeys=1000)
    if ct: kwargs['ContinuationToken'] = ct
    r = S3.list_objects_v2(**kwargs)
    for o in r.get('Contents', []) or []:
        src_keys.append(o['Key'])
    if not r.get('IsTruncated'):
        break
    ct = r['NextContinuationToken']
print(f'  preview objects: {len(src_keys)}')
if not src_keys:
    print('[ERROR] no preview objects — did Step3 apply complete?'); sys.exit(1)

# Step 2. For each preview key (v2-vertical), produce two destination keys:
#  a) DST_BUCKET/<same key>  (带v2 suffix)
#  b) DST_BUCKET/<key with -v2-vertical replaced by -vertical>  (无v2 suffix)
PAT = re.compile(r'^([^/]+)/\1-pexels-(\d+)-v2-vertical\.webp$')

def dual_targets(src_key: str):
    m = PAT.match(src_key)
    if not m:
        # Fallback: try simple pattern
        if src_key.endswith('-v2-vertical.webp'):
            a = src_key
            b = src_key.replace('-v2-vertical.webp', '-vertical.webp')
            return a, b
        return None, None
    cat, pid = m.group(1), m.group(2)
    a = f'{cat}/{cat}-pexels-{pid}-v2-vertical.webp'      # 带v2
    b = f'{cat}/{cat}-pexels-{pid}-vertical.webp'         # 无v2
    return a, b

total = 0
errs = []
for sk in src_keys:
    a, b = dual_targets(sk)
    if not a:
        errs.append('UNMATCHED_KEY:' + sk); continue
    src_copy_src = {'Bucket': SRC_BUCKET, 'Key': sk}
    for dk in (a, b):
        try:
            S3.copy_object(
                Bucket=DST_BUCKET,
                CopySource=src_copy_src,
                Key=dk,
                ContentType='image/webp',
                CacheControl='public, max-age=31536000, immutable',
                MetadataDirective='REPLACE',
            )
            total += 1
        except Exception as e:
            errs.append(f'COPY_FAIL src={sk!r} dst={dk!r} err={e!r}')

print(f'  server-side copies done: {total}')
print(f'  errors: {len(errs)}')
if errs[:10]:
    print('Sample errors (first 10):')
    for e in errs[:10]: print(' ', e)

# Step 3. Verification: list DST bucket and count new webp keys (should have +500 entries approx)
print('Verifying DST bucket webp count...', flush=True)
by_suffix = Counter()
ct = None
total_dst = 0
while True:
    kwargs = dict(Bucket=DST_BUCKET, MaxKeys=1000)
    if ct: kwargs['ContinuationToken'] = ct
    r = S3.list_objects_v2(**kwargs)
    for o in r.get('Contents', []) or []:
        total_dst += 1
        k = o['Key']
        if k.endswith('.png'): by_suffix['png'] += 1
        elif k.endswith('-v2-vertical.webp'): by_suffix['v2-vertical.webp'] += 1
        elif k.endswith('-vertical.webp'): by_suffix['vertical.webp'] += 1
        else: by_suffix['other'] += 1
    if not r.get('IsTruncated'):
        break
    ct = r['NextContinuationToken']
print(f'DST bucket total: {total_dst}')
for k, v in sorted(by_suffix.items()):
    print(f'  suffix {k}: {v}')
print()
print('Expected after success:')
print(f'  v2-vertical.webp >= {len(src_keys)}  |  vertical.webp >= {len(src_keys)}  |  png == 250')
