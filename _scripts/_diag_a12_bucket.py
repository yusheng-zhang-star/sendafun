#!/usr/bin/env python3
"""Audit sendafun-originals bucket: per-category JPG/PNG counts + size."""
import os, collections, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")
import boto3
from PIL import Image
from io import BytesIO

ACC = os.environ["R2_ACCOUNT_ID"]
KEY = os.environ["R2_ACCESS_KEY_ID"]
SEC = os.environ["R2_SECRET_ACCESS_KEY"]
s3 = boto3.client("s3", aws_access_key_id=KEY, aws_secret_access_key=SEC,
    endpoint_url=f"https://{ACC}.r2.cloudflarestorage.com", region_name="auto")

cat = collections.defaultdict(lambda: {"jpg":0,"png":0,"other":0,"jpg_ge2800":0,"png_ge2800":0,
                                       "jpg_sizes":[],"png_sizes":[]})

page = s3.list_objects_v2(Bucket="sendafun-originals")
more = True
n = 0
while more:
    for obj in page.get("Contents", []):
        k = obj["Key"]
        n += 1
        c = k.split("/")[0]
        ext = k.rsplit(".",1)[-1].lower() if "." in k else "other"
        if ext == "jpeg": ext = "jpg"
        if ext not in ("jpg","png"): ext = "other"
        cat[c][ext] += 1
        # Sample: head only first 3/cat to save bandwidth — but we need sizes: use GET range first bytes (skip).
        # Instead just read every 10th file.
        if n % 10 == 1 or ext == "jpg":
            try:
                data = s3.get_object(Bucket="sendafun-originals", Key=k)["Body"].read()
                with Image.open(BytesIO(data)) as im:
                    w, h = im.size
                    long_side = max(w,h)
                    if ext == "jpg":
                        cat[c]["jpg_sizes"].append(long_side)
                        if long_side >= 2800: cat[c]["jpg_ge2800"] += 1
                    elif ext == "png":
                        cat[c]["png_sizes"].append(long_side)
                        if long_side >= 2800: cat[c]["png_ge2800"] += 1
            except Exception as e:
                pass
    more = page.get("IsTruncated")
    if more:
        page = s3.list_objects_v2(Bucket="sendafun-originals", ContinuationToken=page["NextContinuationToken"])

print("=== TOTAL OBJECTS:", n, "===")
print(f"{'cat':<22} {'jpg#':>6} {'png#':>6} {'oth#':>5} | jpg≥2800 png≥2800 | jpg_long_avg/png_long_avg")
for c in sorted(cat):
    d = cat[c]
    ja = sum(d["jpg_sizes"])/len(d["jpg_sizes"]) if d["jpg_sizes"] else 0
    pa = sum(d["png_sizes"])/len(d["png_sizes"]) if d["png_sizes"] else 0
    print(f"{c:<22} {d['jpg']:>6} {d['png']:>6} {d['other']:>5} | {d['jpg_ge2800']:>7} {d['png_ge2800']:>8} | {ja:>6.0f} / {pa:>6.0f}")

# Totals:
tj = sum(d["jpg"] for d in cat.values()); tp = sum(d["png"] for d in cat.values())
toth = sum(d["jpg_ge2800"] for d in cat.values()); tpnth = sum(d["png_ge2800"] for d in cat.values())
print(f"\nTOTAL jpg: {tj}  png: {tp}  jpg≥2800: {toth}  png≥2800: {tpnth}")
