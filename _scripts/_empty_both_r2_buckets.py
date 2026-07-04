#!/usr/bin/env python3
"""清空 sendafun-preview 和 sendafun-originals 两个 R2 桶的全部对象（高危！不可逆）。"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import boto3
from botocore.config import Config

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

acc = os.getenv("R2_ACCOUNT_ID", "").strip()
ak = os.getenv("R2_ACCESS_KEY_ID", "").strip()
sk = os.getenv("R2_SECRET_ACCESS_KEY", "").strip()
pb = os.getenv("R2_BUCKET_NAME", "").strip()
ob = os.getenv("R2_ORIGINALS_BUCKET_NAME", "").strip()

if not all([acc, ak, sk, pb, ob]):
    print("❌ 缺少 .env 变量：R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME / R2_ORIGINALS_BUCKET_NAME")
    sys.exit(2)

endpoint = f"https://{acc}.r2.cloudflarestorage.com"
cfgs = dict(
    region_name="auto",
    aws_access_key_id=ak,
    aws_secret_access_key=sk,
    endpoint_url=endpoint,
    config=Config(s3={"addressing_style": "virtual"}, signature_version="s3v4"),
)
s3 = boto3.client("s3", **cfgs)

def empty_bucket(bucket_name: str):
    print(f"\n{'='*60}")
    print(f"🚨 开始清空桶: {bucket_name}")
    print(f"{'='*60}")
    total = 0
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket_name):
        objs = page.get("Contents", []) or []
        if not objs:
            continue
        keys = [o["Key"] for o in objs]
        r = s3.delete_objects(
            Bucket=bucket_name,
            Delete={"Objects": [{"Key": k} for k in keys], "Quiet": True},
        )
        errs = r.get("Errors", []) or []
        ok_n = len(keys) - len(errs)
        total += ok_n
        print(f"   删 {ok_n} 个（本批 {len(keys)}，失败 {len(errs)}）累计 {total}")
        if errs:
            for e in errs[:5]:
                print(f"      ❌ {e.get('Key')}: {e.get('Code')} {e.get('Message')}")
    # 再列一次确认空
    r = s3.list_objects_v2(Bucket=bucket_name, MaxKeys=3)
    left = r.get("KeyCount", 0)
    print(f"   ✅ 桶 {bucket_name} 清空完成，剩余对象数={left}，累计删除={total}")
    return total, left == 0

if __name__ == "__main__":
    print("⚠️  3 秒后开始清空两个桶（Ctrl+C 取消）！两个桶 = sendafun-preview + sendafun-originals")
    import time
    time.sleep(3)
    t1, ok1 = empty_bucket(pb)
    t2, ok2 = empty_bucket(ob)
    print("\n" + "="*60)
    print(f"📊 总结：preview 删 {t1} 张，originals 删 {t2} 张")
    print(f"   preview 空桶? {ok1}  originals 空桶? {ok2}")
    if ok1 and ok2:
        print("✅ 双桶已清空。下一步：重新下载长边≥2048px高清原图。")
    else:
        print("❌ 还有残留对象，再跑一次本脚本清理。")
        sys.exit(1)
