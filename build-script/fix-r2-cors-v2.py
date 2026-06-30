#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Set R2 bucket CORS via Cloudflare REST API (not S3 API)"""

import json, ssl
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ACCOUNT_ID = "dbacad9daf4c611ca4143f74fc33c2d3"
BUCKET = "sendafun-preview"

# 尝试用现有的 API tokens
TOKENS = [
    "cfut_yOiZJyHtnQ6hXBrnyix0LOm2skHziYCowEpZdDXp8ae6da8b",  # 全权限
    "cfat_4ss29WGmdQdBES4hGgF0DKtRxrpCsvmS9tL5OggY9ce3556d",  # Email Routing (account级)
]

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# CORS rules
cors_rules = {
    "cors_rules": [{
        "allowed_origins": ["*"],
        "allowed_methods": ["GET", "HEAD"],
        "allowed_headers": ["*"],
        "expose_headers": ["ETag", "Content-Type", "Content-Length"],
        "max_age_seconds": 3600
    }]
}

for token in TOKENS:
    print(f"\n--- Trying token: {token[:10]}... ---")
    
    # Try to set CORS
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/r2/buckets/{BUCKET}/cors"
    data = json.dumps(cors_rules).encode("utf-8")
    
    req = Request(url, data=data, method="PUT")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    
    try:
        resp = urlopen(req, timeout=30, context=ctx)
        result = json.loads(resp.read().decode())
        print(f"Status: {resp.status}")
        print(json.dumps(result, indent=2)[:500])
        if result.get("success"):
            print("✅ CORS set successfully!")
            break
    except HTTPError as e:
        body = e.read().decode()[:500] if e.fp else ""
        print(f"HTTP {e.code}: {body}")

# Verify
print("\n=== Verify CORS on GET response ===")
url = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-10165858-vertical.webp"
req = Request(url, headers={"Origin": "https://sendafun.com"})
req.method = "GET"
try:
    resp = urlopen(req, timeout=10)
    acao = resp.headers.get("Access-Control-Allow-Origin", "MISSING!")
    print(f"Access-Control-Allow-Origin: {acao}")
    print("✅ CORS working!" if acao == "*" else "❌ CORS still missing!")
except Exception as e:
    print(f"❌ Verify failed: {e}")
