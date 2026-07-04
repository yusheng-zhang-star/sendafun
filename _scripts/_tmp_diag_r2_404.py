import os, json, urllib.request, ssl, boto3
ctx = ssl._create_unverified_context()
S3 = boto3.client(
    's3',
    endpoint_url='https://' + os.environ['R2_ACCOUNT_ID'] + '.r2.cloudflarestorage.com',
    aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
    region_name='auto',
    config=boto3.session.Config(signature_version='s3v4'),
)

def list_n(bucket, n=10):
    keys = []
    r = S3.list_objects_v2(Bucket=bucket, MaxKeys=n)
    for o in r.get('Contents', []) or []:
        keys.append((o['Key'], o['Size']))
    total = r.get('KeyCount', 0)
    trunc = r.get('IsTruncated', False)
    return total, trunc, keys

print('=== PREVIEW BUCKET (sendafun-preview): list first 10 keys ===')
total, trunc, keys = list_n('sendafun-preview', 10)
print('total=', total, 'trunc=', trunc)
for k, sz in keys:
    print('  KEY=' + k + '  SIZE=' + str(sz) + 'B')

print()
print('=== ORIGINALS BUCKET (sendafun-originals): list first 10 keys ===')
total, trunc, keys = list_n('sendafun-originals', 10)
print('total=', total, 'trunc=', trunc)
for k, sz in keys:
    print('  KEY=' + k + '  SIZE=' + str(sz) + 'B')

print()
print('=== D1 cards API bgImage + bgImageWatermark FULL URL (3 samples) ===')
for cat in ['thanksgiving', 'christmas', 'love']:
    url = 'https://sendafun.com/api/cards?category=' + cat + '&size=1'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    with urllib.request.urlopen(req, timeout=25, context=ctx) as r:
        data = json.loads(r.read())
    c = data['cards'][0]
    print()
    print('CATEGORY=' + cat)
    print('  bgImage            : ' + c['bgImage'])
    print('  bgImageWatermark   : ' + c['bgImageWatermark'])

print()
print('=== Expected Step3 preview key pattern ===')
print('  {cat}/{cat}-pexels-{ID}-v2-vertical.webp')
print('Expected originals key pattern (png masters):')
print('  {cat}/{cat}-pexels-{ID}.png')
