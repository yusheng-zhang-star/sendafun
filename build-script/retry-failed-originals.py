#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重传 15 个失败的 originals JPG 文件到 sendafun-originals 桶"""

import hashlib, hmac, datetime, time, sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ACCOUNT_ID = "dbacad9daf4c611ca4143f74fc33c2d3"
ENDPOINT = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com"
ACCESS_KEY = "f69e5241221d849255f0e4c885035933"
SECRET_KEY = "ed04d97fbb52d04780f19704e897fc7ca162a41b54afa7e35a2142a7ac184fc2"
BUCKET = "sendafun-originals"
REGION = "wnam"

# 素材目录名 → R2 目录名 (下划线 → 连字符)
CAT_MAP = {
    "birthday":       "birthday",
    "encouragement":  "encouragement",
    "fathers_day":    "fathers-day",
    "good_luck":      "good-luck",
    "graduation":     "graduation",
    "halloween":      "halloween",
    "new_baby":       "new-baby",
    "new_year":       "new-year",
    "sympathy":       "sympathy",
}

# 15 个失败文件
FAILED = [
    ("birthday",       "pixabay-8523662.jpg"),
    ("encouragement",  "pexels-5489337.jpg"),
    ("fathers_day",    "pexels-28800247.jpg"),
    ("good_luck",      "pexels-13638116.jpg"),
    ("good_luck",      "pexels-17857749.jpg"),
    ("graduation",     "pexels-32787072.jpg"),
    ("halloween",      "pexels-18664995.jpg"),
    ("new_baby",       "pexels-19976471.jpg"),
    ("new_year",       "pexels-13521418.jpg"),
    ("new_year",       "pexels-13521419.jpg"),
    ("new_year",       "pexels-13521432.jpg"),
    ("sympathy",       "pexels-29868724.jpg"),
    ("sympathy",       "pexels-33768992.jpg"),
    ("sympathy",       "pexels-37563462.jpg"),
    ("sympathy",       "pexels-38059586.jpg"),
]

SOURCE = Path(r"E:\网站项目\素材\source")
MAX_RETRIES = 3
TIMEOUT = 180  # 3 分钟超时


def s3_sign(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def s3_sigv4(method, bucket, key, body, content_type):
    amz_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    date_stamp = amz_date[:8]
    canonical_uri = f"/{bucket}/{key}"
    payload_hash = hashlib.sha256(body).hexdigest()
    canonical_headers = (
        f"content-type:{content_type}\n"
        f"host:{ACCOUNT_ID}.r2.cloudflarestorage.com\n"
        f"x-amz-content-sha256:{payload_hash}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date"
    canonical_request = f"PUT\n{canonical_uri}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
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


def upload_one(src_dir_name, fname):
    """上传单个文件，带重试"""
    local_path = SOURCE / src_dir_name / fname
    r2_dir = CAT_MAP[src_dir_name]
    r2_key = f"{r2_dir}/{fname}"
    size_mb = local_path.stat().st_size / (1024 * 1024)

    data = local_path.read_bytes()
    content_type = "image/jpeg"

    for attempt in range(1, MAX_RETRIES + 1):
        label = f"[{attempt}/{MAX_RETRIES}]" if attempt > 1 else ""
        try:
            amz_date, payload_hash, auth = s3_sigv4("PUT", BUCKET, r2_key, data, content_type)
            url = f"{ENDPOINT}/{BUCKET}/{r2_key}"
            headers = {
                "Content-Type": content_type,
                "x-amz-content-sha256": payload_hash,
                "x-amz-date": amz_date,
                "Authorization": auth,
            }
            req = Request(url, data=data, headers=headers, method="PUT")
            resp = urlopen(req, timeout=TIMEOUT)
            if resp.status in (200, 201):
                print(f"  ✅ {label} {r2_key}  ({size_mb:.1f}MB)")
                return True
            else:
                print(f"  ⚠️  {label} HTTP {resp.status} {r2_key}")
        except HTTPError as e:
            print(f"  ⚠️  {label} HTTP {e.code} {r2_key}: {e.reason}")
        except Exception as e:
            print(f"  ⚠️  {label} ERR {r2_key}: {e}")

        if attempt < MAX_RETRIES:
            wait = 5 * attempt
            print(f"      等待 {wait}s 后重试...")
            time.sleep(wait)

    print(f"  ❌ 最终失败: {r2_key}")
    return False


def main():
    total = len(FAILED)
    ok = 0
    ng = 0

    print(f"重传 {total} 个失败的 originals 文件 → {BUCKET}")
    print(f"超时: {TIMEOUT}s | 最大重试: {MAX_RETRIES}")
    print(f"开始: {datetime.datetime.now().strftime('%H:%M:%S')}\n")

    for i, (src_dir, fname) in enumerate(FAILED, 1):
        local_path = SOURCE / src_dir / fname
        if not local_path.exists():
            print(f"  ❌ [{i}/{total}] 文件不存在: {local_path}")
            ng += 1
            continue

        if upload_one(src_dir, fname):
            ok += 1
        else:
            ng += 1
        sys.stdout.flush()

    print(f"\n{'='*50}")
    print(f"完成: 成功 {ok}/{total}  失败 {ng}/{total}")
    print(f"结束: {datetime.datetime.now().strftime('%H:%M:%S')}")


if __name__ == "__main__":
    main()
