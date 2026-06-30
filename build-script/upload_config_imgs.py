#!/usr/bin/env python3
"""Upload ONLY the 22 images referenced in cards-config.json, one by one."""
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
OG_DIR = Path(r"E:\网站项目\sendafun\dist\og-images")

def s3_sign(key, msg):
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()

def head_exists(r2_key):
    amz_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    date_stamp = amz_date[:8]
    ph = hashlib.sha256(b"").hexdigest()
    ch = f"host:{ACCOUNT_ID}.r2.cloudflarestorage.com\nx-amz-content-sha256:{ph}\nx-amz-date:{amz_date}\n"
    sh = "host;x-amz-content-sha256;x-amz-date"
    cr = f"HEAD\n/{BUCKET}/{r2_key}\n\n{ch}\n{sh}\n{ph}"
    scope = f"{date_stamp}/{REGION}/s3/aws4_request"
    sts = f"AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{hashlib.sha256(cr.encode()).hexdigest()}"
    kd = s3_sign(("AWS4" + SECRET_KEY).encode(), date_stamp)
    kr = s3_sign(kd, REGION)
    ks = s3_sign(kr, "s3")
    ksign = s3_sign(ks, "aws4_request")
    sig = hmac.new(ksign, sts.encode(), hashlib.sha256).hexdigest()
    auth = f"AWS4-HMAC-SHA256 Credential={ACCESS_KEY}/{date_stamp}/{REGION}/s3/aws4_request, SignedHeaders={sh}, Signature={sig}"
    try:
        req = Request(f"{ENDPOINT}/{BUCKET}/{r2_key}", headers={"x-amz-content-sha256": ph, "x-amz-date": amz_date, "Authorization": auth}, method="HEAD")
        return urlopen(req, timeout=10).status == 200
    except:
        return False

def upload_to_r2(r2_key, local_path):
    with open(local_path, "rb") as f:
        body = f.read()
    amz_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    date_stamp = amz_date[:8]
    ph = hashlib.sha256(body).hexdigest()
    uri = f"/{BUCKET}/{r2_key}"
    ch = f"content-type:image/webp\nhost:{ACCOUNT_ID}.r2.cloudflarestorage.com\nx-amz-content-sha256:{ph}\nx-amz-date:{amz_date}\n"
    sh = "content-type;host;x-amz-content-sha256;x-amz-date"
    cr = f"PUT\n{uri}\n\n{ch}\n{sh}\n{ph}"
    scope = f"{date_stamp}/{REGION}/s3/aws4_request"
    sts = f"AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{hashlib.sha256(cr.encode()).hexdigest()}"
    kd = s3_sign(("AWS4" + SECRET_KEY).encode(), date_stamp)
    kr = s3_sign(kd, REGION)
    ks = s3_sign(kr, "s3")
    ksign = s3_sign(ks, "aws4_request")
    sig = hmac.new(ksign, sts.encode(), hashlib.sha256).hexdigest()
    auth = f"AWS4-HMAC-SHA256 Credential={ACCESS_KEY}/{date_stamp}/{REGION}/s3/aws4_request, SignedHeaders={sh}, Signature={sig}"
    req = Request(f"{ENDPOINT}/{BUCKET}/{r2_key}", data=body, headers={"Content-Type": "image/webp", "x-amz-content-sha256": ph, "x-amz-date": amz_date, "Authorization": auth}, method="PUT")
    resp = urlopen(req, timeout=60)
    return resp.status in (200, 201)

# Read config and extract all R2 URLs
with open(r"E:\网站项目\sendafun\source\cards-config.json", "r", encoding="utf-8") as f:
    config = json.load(f)

r2_urls = set()
for card in config["cards"]:
    for field in ["bgImage", "ogImage"]:
        url = card.get(field, "")
        if "pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/" in url:
            r2_urls.add(url)

print(f"Unique R2 URLs in config: {len(r2_urls)}\n")

missing = []
for url in sorted(r2_urls):
    r2_key = url.split("pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/")[1]
    exists = head_exists(r2_key)
    status = "OK" if exists else "MISSING"
    print(f"  [{status}] {r2_key}")
    sys.stdout.flush()
    if not exists:
        missing.append(r2_key)

print(f"\nMissing: {len(missing)}")

if not missing:
    print("Done - everything already in R2.")
    sys.exit(0)

# Find local files for each missing key
no_local = []
for r2_key in missing:
    # Try source/images first (vertical images in subdirs)
    local = IMAGES_DIR / r2_key
    if local.exists():
        print(f"\nUploading: {r2_key}")
        sys.stdout.flush()
        try:
            if upload_to_r2(r2_key, str(local)):
                print(f"  OK")
            else:
                print(f"  FAIL")
        except Exception as e:
            print(f"  ERROR: {e}")
        continue

    # Try OG images
    local = OG_DIR / r2_key
    if local.exists():
        print(f"\nUploading: {r2_key}")
        sys.stdout.flush()
        try:
            if upload_to_r2(r2_key, str(local)):
                print(f"  OK")
            else:
                print(f"  FAIL")
        except Exception as e:
            print(f"  ERROR: {e}")
        continue

    print(f"\n  LOCAL NOT FOUND for {r2_key}")
    no_local.append(r2_key)

if no_local:
    print(f"\nLocal not found ({len(no_local)}):")
    for k in no_local:
        print(f"  {k}")
else:
    print("\nDone!")
