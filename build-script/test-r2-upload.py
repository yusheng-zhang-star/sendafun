#!/usr/bin/env python3
"""Test single-file R2 upload"""
import hashlib, hmac, datetime
from urllib.request import Request, urlopen

ACCOUNT_ID = "dbacad9daf4c611ca4143f74fc33c2d3"
ACCESS_KEY = "f69e5241221d849255f0e4c885035933"
SECRET_KEY = "ed04d97fbb52d04780f19704e897fc7ca162a41b54afa7e35a2142a7ac184fc2"
REGION = "wnam"
BUCKET = "sendafun-preview"

def s3_sign(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

def s3_sigv4(method, bucket, key, body):
    amz_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    date_stamp = amz_date[:8]
    canonical_uri = f"/{bucket}/{key}"
    payload_hash = hashlib.sha256(body).hexdigest()
    canonical_headers = (
        f"content-type:image/webp\n"
        f"host:{ACCOUNT_ID}.r2.cloudflarestorage.com\n"
        f"x-amz-content-sha256:{payload_hash}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date"
    canonical_request = f"{method}\n{canonical_uri}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    scope = f"{date_stamp}/{REGION}/s3/aws4_request"
    string_to_sign = f"AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    k_date = s3_sign(("AWS4" + SECRET_KEY).encode("utf-8"), date_stamp)
    k_region = s3_sign(k_date, REGION)
    k_service = s3_sign(k_region, "s3")
    k_signing = s3_sign(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    auth = f"AWS4-HMAC-SHA256 Credential={ACCESS_KEY}/{date_stamp}/{REGION}/s3/aws4_request, SignedHeaders={signed_headers}, Signature={signature}"
    return amz_date, payload_hash, auth

# Test with a small file
test_key = "test-upload.webp"
test_body = b"R2 upload test"

amz_date, payload_hash, auth = s3_sigv4("PUT", BUCKET, test_key, test_body)

url = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com/{BUCKET}/{test_key}"
headers = {
    "Content-Type": "image/webp",
    "x-amz-content-sha256": payload_hash,
    "x-amz-date": amz_date,
    "Authorization": auth,
}

print(f"Uploading test file to: {url}")
req = Request(url, data=test_body, headers=headers, method="PUT")
try:
    resp = urlopen(req, timeout=30)
    print(f"SUCCESS: {resp.status}")
except Exception as e:
    print(f"FAILED: {e}")
    if hasattr(e, "read"):
        print(e.read().decode())
