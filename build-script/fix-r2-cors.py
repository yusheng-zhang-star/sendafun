#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix R2 CORS: ensure GET responses also include Access-Control-Allow-Origin:*"""

import hashlib, hmac, datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import xml.etree.ElementTree as ET

ACCOUNT_ID = "dbacad9daf4c611ca4143f74fc33c2d3"
ENDPOINT = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com"
ACCESS_KEY = "f69e5241221d849255f0e4c885035933"
SECRET_KEY = "ed04d97fbb52d04780f19704e897fc7ca162a41b54afa7e35a2142a7ac184fc2"
BUCKET = "sendafun-preview"
REGION = "wnam"


def s3_sign(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def s3_sigv4(method, bucket, key, body, content_type):
    amz_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    date_stamp = amz_date[:8]
    canonical_uri = f"/{bucket}/{key}" if key else f"/{bucket}"
    canonical_querystring = "?cors" if "cors" in key else ""
    payload_hash = hashlib.sha256(body).hexdigest()
    canonical_headers = (
        f"content-type:{content_type}\n"
        f"host:{ACCOUNT_ID}.r2.cloudflarestorage.com\n"
        f"x-amz-content-sha256:{payload_hash}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date"
    canonical_request = f"{method}\n{canonical_uri}\n{canonical_querystring}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
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


def read_cors():
    """Read current CORS config"""
    amz_date, payload_hash, auth = s3_sigv4("GET", BUCKET, "?cors", b"", "application/xml")
    url = f"{ENDPOINT}/{BUCKET}?cors"
    headers = {
        "Content-Type": "application/xml",
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
        "Authorization": auth,
    }
    try:
        req = Request(url, headers=headers, method="GET")
        resp = urlopen(req, timeout=30)
        body = resp.read().decode()
        print(f"Current CORS config ({resp.status}):")
        print(body[:2000] if body else "(empty)")
        return resp.status, body
    except HTTPError as e:
        print(f"HTTP {e.code}: {e.reason}")
        body = e.read().decode() if e.fp else ""
        print(body[:500])
        return e.code, body


def set_cors():
    """Set CORS to allow all origins, GET+HEAD methods, expose headers for canvas"""
    cors_xml = '''<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>Content-Type</ExposeHeader>
    <ExposeHeader>Content-Length</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>'''

    body = cors_xml.encode("utf-8")
    amz_date, payload_hash, auth = s3_sigv4("PUT", BUCKET, "?cors", body, "application/xml")
    url = f"{ENDPOINT}/{BUCKET}?cors"
    headers = {
        "Content-Type": "application/xml",
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
        "Authorization": auth,
    }

    try:
        req = Request(url, data=body, headers=headers, method="PUT")
        resp = urlopen(req, timeout=30)
        print(f"✅ CORS set successfully! Status: {resp.status}")
        return True
    except HTTPError as e:
        print(f"❌ HTTP {e.code}: {e.reason}")
        print(e.read().decode()[:500] if e.fp else "")
        return False


def verify():
    """Verify CORS via GET request with Origin header"""
    import urllib.request
    url = f"https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-10165858-vertical.webp"
    req = Request(url, headers={"Origin": "https://sendafun.com"})
    req.method = "GET"
    try:
        resp = urlopen(req, timeout=10)
        acao = resp.headers.get("Access-Control-Allow-Origin", "MISSING!")
        print(f"\nVerify GET response: Access-Control-Allow-Origin = {acao}")
        if acao == "*":
            print("✅ CORS header present on GET response!")
        else:
            print("❌ CORS header still missing on GET response!")
    except Exception as e:
        print(f"❌ Verify failed: {e}")


if __name__ == "__main__":
    print("=== Step 1: Read current CORS ===\n")
    read_cors()

    print("\n=== Step 2: Set CORS ===\n")
    if set_cors():
        print("\n=== Step 3: Verify ===\n")
        verify()
    else:
        print("\n❌ Failed to set CORS. Check credentials.")
