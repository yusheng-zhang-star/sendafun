#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SendAFun — upload-to-r2.py
将素材上传到 Cloudflare R2 双桶（纯 Python 内置库，零依赖）

用法：
  python upload-to-r2.py                     # 全量上传 preview 桶
  python upload-to-r2.py --originals          # 上传 originals 桶
  python upload-to-r2.py --all                # 两个桶都上传
  python upload-to-r2.py --dry-run            # 预演（不实际上传）
  python upload-to-r2.py --workers=16         # 并发数（默认 8）
"""

import os, sys, json, hashlib, hmac, datetime, argparse, threading, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "source" / "images"
ORIGINALS_DIR = Path(r"E:\网站项目\素材\source")

# ── R2 配置 ──────────────────────────────────────────────────────────────────
ACCOUNT_ID = "dbacad9daf4c611ca4143f74fc33c2d3"
ENDPOINT = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com"
ACCESS_KEY = "f69e5241221d849255f0e4c885035933"
SECRET_KEY = "ed04d97fbb52d04780f19704e897fc7ca162a41b54afa7e35a2142a7ac184fc2"
PUBLIC_URL = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev"

PREVIEW_BUCKET = "sendafun-preview"
ORIGINALS_BUCKET = "sendafun-originals"
REGION = "wnam"

# 素材目录 → R2 桶的映射
CAT_MAP_MATERIAL = {
    "anniversary":      "anniversary",
    "birthday":         "birthday",
    "christmas":        "christmas",
    "congratulations":  "congratulations",
    "easter":           "easter",
    "encouragement":    "encouragement",
    "fathers_day":      "fathers-day",
    "friendship":       "friendship",
    "get_well":         "get-well",
    "good_luck":        "good-luck",
    "graduation":       "graduation",
    "halloween":        "halloween",
    "love":             "love",
    "missing_you":      "missing-you",
    "mothers_day":      "mothers-day",
    "new_baby":         "new-baby",
    "new_year":         "new-year",
    "retirement":       "retirement",
    "sorry":            "sorry",
    "sympathy":         "sympathy",
    "thank_you":        "thank-you",
    "thanksgiving":     "thanksgiving",
    "thinking_of_you":  "thinking-of-you",
    "valentine":        "valentine",
    "wedding":          "wedding",
}

stats_lock = threading.Lock()
stats = {"uploaded": 0, "skipped": 0, "failed": 0, "errors": []}


def s3_sign(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def s3_sigv4(method, bucket, key, body, content_type):
    """生成 AWS Signature V4"""
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


def check_exists(bucket, r2_key):
    """HEAD 请求检查 R2 文件是否已存在"""
    amz_date, payload_hash, auth = s3_sigv4("HEAD", bucket, r2_key, b"", "application/octet-stream")
    url = f"{ENDPOINT}/{bucket}/{r2_key}"
    headers = {
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
        "Authorization": auth,
    }
    try:
        req = Request(url, headers=headers, method="HEAD")
        resp = urlopen(req, timeout=10)
        return resp.status == 200
    except:
        return False


def upload_file(local_path, bucket, r2_key, content_type="application/octet-stream", skip_existing=False):
    """上传单个文件到 R2"""
    if skip_existing and check_exists(bucket, r2_key):
        with stats_lock:
            stats["skipped"] += 1
        return "skipped"

    try:
        with open(local_path, "rb") as f:
            body = f.read()
    except Exception as e:
        with stats_lock:
            stats["failed"] += 1
            stats["errors"].append(f"READ {local_path}: {e}")
        return False

    amz_date, payload_hash, auth = s3_sigv4("PUT", bucket, r2_key, body, content_type)

    url = f"{ENDPOINT}/{bucket}/{r2_key}"
    headers = {
        "Content-Type": content_type,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
        "Authorization": auth,
    }

    try:
        req = Request(url, data=body, headers=headers, method="PUT")
        resp = urlopen(req, timeout=60)
        if resp.status in (200, 201):
            with stats_lock:
                stats["uploaded"] += 1
            return True
        else:
            with stats_lock:
                stats["failed"] += 1
                stats["errors"].append(f"HTTP {resp.status} {r2_key}")
            return False
    except HTTPError as e:
        with stats_lock:
            stats["failed"] += 1
            stats["errors"].append(f"HTTP {e.code} {r2_key}: {e.reason}")
        return False
    except Exception as e:
        with stats_lock:
            stats["failed"] += 1
            stats["errors"].append(f"ERR {r2_key}: {e}")
        return False


def upload_preview(dry_run=False, workers=8, batch=1000, resume=False):
    """分批上传 processed WebP 到 sendafun-preview（每文件实时输出）"""
    print(f"Upload PREVIEW images → {PREVIEW_BUCKET}")
    print(f"Workers: {workers}\n")

    tasks = []
    for cat_dir in sorted(IMAGES_DIR.iterdir()):
        if not cat_dir.is_dir() or cat_dir.name == "watermark":
            continue
        for f in cat_dir.iterdir():
            if f.suffix == ".webp":
                r2_key = f"{cat_dir.name}/{f.name}"
                tasks.append((str(f), r2_key))

    total = len(tasks)
    print(f"Total: {total} files\n")

    if dry_run:
        for lp, rk in tasks[:20]:
            print(f"  [DRY] {rk}")
        return

    content_types = {".webp": "image/webp"}

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                upload_file, lp, PREVIEW_BUCKET, rk,
                content_types.get(Path(lp).suffix.lower(), "application/octet-stream"),
                skip_existing=resume
            ): (rk, idx) for idx, (lp, rk) in enumerate(tasks)
        }

        for future in as_completed(futures):
            rk, idx = futures[future]
            try:
                result = future.result()
                if result == "skipped":
                    print(f"  ⏭  [{idx+1}/{total}] {rk} (skipped)")
                elif result:
                    print(f"  ✅ [{idx+1}/{total}] {rk}")
                else:
                    print(f"  ❌ [{idx+1}/{total}] {rk} FAILED")
            except Exception as e:
                print(f"  ❌ [{idx+1}/{total}] {rk} ERROR: {e}")
            sys.stdout.flush()

    print(f"\nDone: uploaded={stats['uploaded']} skipped={stats['skipped']} failed={stats['failed']}")


def upload_originals(dry_run=False, workers=8):
    """上传原始高清图到 sendafun-originals"""
    print("\n" + "=" * 60)
    print(f"Upload ORIGINAL images → {ORIGINALS_BUCKET}")
    print("=" * 60)

    tasks = []
    for mat_dir_name, proj_cat in CAT_MAP_MATERIAL.items():
        mat_path = ORIGINALS_DIR / mat_dir_name
        if not mat_path.exists():
            continue
        for f in mat_path.iterdir():
            if f.suffix.lower() in (".jpg", ".jpeg", ".png"):
                r2_key = f"{proj_cat}/{f.name}"
                tasks.append((str(f), proj_cat, f.name, r2_key))

    total = len(tasks)
    print(f"Found {total} original files to upload")

    if dry_run:
        print("\n[DRY RUN] Would upload:")
        for i, (local_path, cat, fname, r2_key) in enumerate(tasks[:20]):
            print(f"  {r2_key}")
        if total > 20:
            print(f"  ... and {total - 20} more")
        return

    print(f"Uploading with {workers} workers...")
    print(f"Progress report every 5 min | Start: {datetime.datetime.now().strftime('%H:%M:%S')}\n")
    content_types = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}

    last_report = time.time()
    REPORT_INTERVAL = 300

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                upload_file, lp, ORIGINALS_BUCKET, rk,
                content_types.get(Path(lp).suffix.lower(), "application/octet-stream")
            ): (rk, i + 1)
            for i, (lp, _, _, rk) in enumerate(tasks)
        }

        for future in as_completed(futures):
            rk, idx = futures[future]
            try:
                future.result()
            except:
                pass
            if idx % 100 == 0 or idx == total:
                with stats_lock:
                    print(f"  [{idx}/{total}] uploaded={stats['uploaded']} "
                          f"failed={stats['failed']}", end="\r")
            now = time.time()
            if now - last_report >= REPORT_INTERVAL:
                with stats_lock:
                    pct = stats['uploaded'] / total * 100 if total else 0
                    print(f"\n  ⏱  {datetime.datetime.now().strftime('%H:%M:%S')}  "
                          f"[{stats['uploaded']}/{total}] ({pct:.1f}%)  "
                          f"failed={stats['failed']}")
                last_report = now

    pct = stats['uploaded'] / total * 100 if total else 0
    print(f"\n✅ Done. {stats['uploaded']}/{total} ({pct:.1f}%) uploaded, {stats['failed']} failed")


def main():
    parser = argparse.ArgumentParser(description="Upload SendAFun assets to Cloudflare R2")
    parser.add_argument("--originals", action="store_true", help="Upload original high-res images")
    parser.add_argument("--all", action="store_true", help="Upload both preview and originals")
    parser.add_argument("--dry-run", action="store_true", help="Dry run (no actual upload)")
    parser.add_argument("--workers", type=int, default=8, help="Concurrent workers (default: 8)")
    parser.add_argument("--batch-size", type=int, default=1000, help="Files per batch (default: 1000)")
    parser.add_argument("--resume", action="store_true", help="Skip already-uploaded files (HEAD check)")
    args = parser.parse_args()

    if args.all:
        upload_preview(dry_run=args.dry_run, workers=args.workers, batch=args.batch_size, resume=args.resume)
        upload_originals(dry_run=args.dry_run, workers=args.workers)
        print(f"\nPublic CDN base: {PUBLIC_URL}")
    elif args.originals:
        upload_originals(dry_run=args.dry_run, workers=args.workers)
    else:
        upload_preview(dry_run=args.dry_run, workers=args.workers, batch=args.batch_size, resume=args.resume)

    if stats["errors"]:
        print(f"\n{len(stats['errors'])} errors (first 20):")
        for e in stats["errors"][:20]:
            print(f"  {e}")

    print(f"\nPublic CDN base: {PUBLIC_URL}")


if __name__ == "__main__":
    main()
