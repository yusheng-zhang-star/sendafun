#!/usr/bin/env python3
"""Upload only missing webp files to R2 preview bucket."""
import hashlib, hmac, datetime
from pathlib import Path
from urllib.request import Request, urlopen

ACCOUNT_ID = "dbacad9daf4c611ca4143f74fc33c2d3"
ACCESS_KEY = "f69e5241221d849255f0e4c885035933"
SECRET_KEY = "ed04d97fbb52d04780f19704e897fc7ca162a41b54afa7e35a2142a7ac184fc2"
REGION = "wnam"
ENDPOINT = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com"
BUCKET = "sendafun-preview"
IMAGES = Path(r"E:\网站项目\sendafun\source\images")


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
        req = Request(
            f"{ENDPOINT}/{BUCKET}/{r2_key}",
            headers={"x-amz-content-sha256": ph, "x-amz-date": amz_date, "Authorization": auth},
            method="HEAD",
        )
        return urlopen(req, timeout=10).status == 200
    except Exception:
        return False


def upload_file(r2_key, local_path):
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

    req = Request(
        f"{ENDPOINT}/{BUCKET}/{r2_key}",
        data=body,
        headers={"Content-Type": "image/webp", "x-amz-content-sha256": ph, "x-amz-date": amz_date, "Authorization": auth},
        method="PUT",
    )
    resp = urlopen(req, timeout=60)
    return resp.status in (200, 201)


def main():
    # Scan all webp files locally
    all_files = []
    for cat in sorted(IMAGES.iterdir()):
        if not cat.is_dir() or cat.name == "watermark":
            continue
        for f in cat.iterdir():
            if f.suffix == ".webp":
                r2_key = f"{cat.name}/{f.name}"
                all_files.append((r2_key, str(f)))

    print(f"Local webp files: {len(all_files)}")

    # Check which are missing in R2
    missing = []
    for r2_key, lp in all_files:
        if not head_exists(r2_key):
            missing.append((r2_key, lp))
            print(f"  MISSING: {r2_key}")

    print(f"\nMissing: {len(missing)}")

    if not missing:
        print("All files already in R2.")
        return

    # Upload missing
    print("\n--- Uploading ---")
    ok = 0
    fail = 0
    for r2_key, lp in missing:
        try:
            if upload_file(r2_key, lp):
                print(f"  OK  {r2_key}")
                ok += 1
            else:
                print(f"  FAIL {r2_key}")
                fail += 1
        except Exception as e:
            print(f"  FAIL {r2_key}: {e}")
            fail += 1

    print(f"\nDone. OK={ok} FAIL={fail}")


if __name__ == "__main__":
    main()
