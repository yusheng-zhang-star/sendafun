#!/usr/bin/env python3
"""Upload all 22 R2 images from cards-config.json - no HEAD checks, just blast."""
import hashlib, hmac, datetime, json, sys
from pathlib import Path
from urllib.request import Request, urlopen

ACCOUNT_ID = "dbacad9daf4c611ca4143f74fc33c2d3"
ACCESS_KEY = "f69e5241221d849255f0e4c885035933"
SECRET_KEY = "ed04d97fbb52d04780f19704e897fc7ca162a41b54afa7e35a2142a7ac184fc2"
REGION = "wnam"
ENDPOINT = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com"
BUCKET = "sendafun-preview"
IMAGES_DIR = Path(r"E:\网站项目\sendafun\source\images")
OG_DIR = Path(r"E:\网站项目\sendafun\og-images")

def s3_sign(key, msg):
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()

def upload(r2_key, local_path):
    with open(local_path, "rb") as f:
        body = f.read()
    sz_kb = len(body) // 1024
    amz_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    date_stamp = amz_date[:8]
    ph = hashlib.sha256(body).hexdigest()
    ch = f"content-type:image/webp\nhost:{ACCOUNT_ID}.r2.cloudflarestorage.com\nx-amz-content-sha256:{ph}\nx-amz-date:{amz_date}\n"
    sh = "content-type;host;x-amz-content-sha256;x-amz-date"
    cr = f"PUT\n/{BUCKET}/{r2_key}\n\n{ch}\n{sh}\n{ph}"
    scope = f"{date_stamp}/{REGION}/s3/aws4_request"
    sts = f"AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{hashlib.sha256(cr.encode()).hexdigest()}"
    kd = s3_sign(("AWS4" + SECRET_KEY).encode(), date_stamp)
    kr = s3_sign(kd, REGION)
    ks = s3_sign(kr, "s3")
    ksign = s3_sign(ks, "aws4_request")
    sig = hmac.new(ksign, sts.encode(), hashlib.sha256).hexdigest()
    auth = f"AWS4-HMAC-SHA256 Credential={ACCESS_KEY}/{date_stamp}/{REGION}/s3/aws4_request, SignedHeaders={sh}, Signature={sig}"
    req = Request(f"{ENDPOINT}/{BUCKET}/{r2_key}", data=body, headers={"Content-Type":"image/webp","x-amz-content-sha256":ph,"x-amz-date":amz_date,"Authorization":auth}, method="PUT")
    resp = urlopen(req, timeout=60)
    ok = resp.status in (200, 201)
    return ok, sz_kb

# Collect all R2 URLs
with open(r"E:\网站项目\sendafun\source\cards-config.json", "r", encoding="utf-8") as f:
    config = json.load(f)

r2_urls = set()
for card in config["cards"]:
    for field in ["bgImage", "ogImage"]:
        url = card.get(field, "")
        if "pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/" in url:
            r2_urls.add(url)

print(f"Total to upload: {len(r2_urls)}\n")

ok = 0
fail = 0
for url in sorted(r2_urls):
    r2_key = url.split("pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/")[1]
    
    local = IMAGES_DIR / r2_key
    if not local.exists():
        local = OG_DIR / r2_key
    
    if not local.exists():
        print(f"  SKIP {r2_key} (local not found)")
        fail += 1
        continue
    
    try:
        success, size = upload(r2_key, str(local))
        if success:
            print(f"  OK  {r2_key}  [{size}KB]")
            ok += 1
        else:
            print(f"  FAIL {r2_key}")
            fail += 1
    except Exception as e:
        print(f"  FAIL {r2_key}: {e}")
        fail += 1
    sys.stdout.flush()

print(f"\nDone: {ok} ok, {fail} fail")
