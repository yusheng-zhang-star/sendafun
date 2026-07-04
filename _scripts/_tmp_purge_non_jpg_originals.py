#!/usr/bin/env python3
"""Purge ALL .png / .webp objects from sendafun-originals, keep only true source JPG/JPEG."""
import os, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")
import boto3

BUCKET = "sendafun-originals"
s3 = boto3.client("s3",
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
    region_name="auto")

n = 0; removed = 0; kept = 0
page = s3.list_objects_v2(Bucket=BUCKET)
more = True
while more:
    for obj in page.get("Contents", []):
        n += 1
        k = obj["Key"]
        ext = k.rsplit(".",1)[-1].lower() if "." in k else "none"
        if ext in ("png","webp","gif","bmp","tiff"):
            try:
                s3.delete_object(Bucket=BUCKET, Key=k)
                removed += 1
            except Exception:
                pass
        else:
            kept += 1
    more = page.get("IsTruncated")
    if more:
        page = s3.list_objects_v2(Bucket=BUCKET, ContinuationToken=page["NextContinuationToken"])
print(f"Scanned: {n}  Removed non-JPG: {removed}  Kept JPG/JPEG: {kept}")
