#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""仅重传 3 个之前失败的 preview 文件"""

import hashlib, hmac, datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ACCOUNT_ID = "dbacad9daf4c611ca4143f74fc33c2d3"
ENDPOINT = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com"
ACCESS_KEY = "f69e5241221d849255f0e4c885035933"
SECRET_KEY = "ed04d97fbb52d04780f19704e897fc7ca162a41b54afa7e35a2142a7ac184fc2"
BUCKET = "sendafun-preview"
REGION = "wnam"
PUBLIC_URL = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev"

def s3_sign(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

def s3_sigv4(method, bucket, key, body, content_type):
    amz_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    date_stamp = amz_date[:8]
    canonical_uri = f"/{bucket}/{key}"
    canonical_querystring = ""
    payload_hash = hashlib.sha256(body).hexdigest()
    canonical_headers = (
        f"content-type:{content_type}\n"
        f"host:{ACCOUNT_ID}.r2.cloudflarestorage.com\n"
        f"x-amz-content-sha256:{payload_hash}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date"
    canonical_request = f"PUT\n{canonical_uri}\n{canonical_querystring}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    scope = f"{date_stamp}/{REGION}/s3/aws4_request"
    string_to_sign = f"AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    k_date = s3_sign(("AWS4" + SECRET_KEY).encode("utf-8"), date_stamp)
    k_region = s3_sign(k_date, REGION)
    k_service = s3_sign(k_region, "s3")
    k_signing = s3_sign(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    authorization = (
        f"AWS4-HMAC-SHA256 "
        f"Credential={ACCESS_KEY}/{date_stamp}/{REGION}/s3/aws4_request, "
        f"SignedHeaders={signed_headers}, "
        f"Signature={signature}"
    )
    return amz_date, payload_hash, authorization

# ── 3 个失败文件 ──────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "source" / "images"

files = [
    ("new-year",    "new-year-pexels-31196840-horizontal.webp"),
    ("retirement",  "retirement-pexels-15796817-horizontal.webp"),
    ("thanksgiving","thanksgiving-pexels-1549627-square.webp"),
]

print(f"重传 3 个失败文件 → {BUCKET}\n")

for cat, fname in files:
    local = IMAGES / cat / fname
    if not local.exists():
        print(f"  ❌ 文件不存在: {local}")
        continue

    data = local.read_bytes()
    r2_key = f"{cat}/{fname}"
    content_type = "image/webp"

    amz_date, payload_hash, auth = s3_sigv4("PUT", BUCKET, r2_key, data, content_type)
    url = f"{ENDPOINT}/{BUCKET}/{r2_key}"
    headers = {
        "Content-Type": content_type,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
        "Authorization": auth,
    }

    try:
        req = Request(url, data=data, headers=headers, method="PUT")
        resp = urlopen(req, timeout=120)
        if resp.status in (200, 201):
            print(f"  ✅ {r2_key}")
        else:
            print(f"  ❌ HTTP {resp.status} {r2_key}")
    except HTTPError as e:
        print(f"  ❌ HTTP {e.code} {r2_key}: {e.reason}")
    except Exception as e:
        print(f"  ❌ ERR {r2_key}: {e}")

print(f"\nCDN: {PUBLIC_URL}")
