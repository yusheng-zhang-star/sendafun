#!/usr/bin/env python3
"""
Generate OG social sharing images (1200x630) for SendAFun cards.
Downloads vertical card images from R2, creates OG versions with title overlay.
"""

import json
import os
import sys
import urllib.request
import urllib.error
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

R2_BASE = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev"
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "source", "cards-config.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "og-images")

# OG size
OG_W, OG_H = 1200, 630

# Font settings - try common Chinese/English fonts
FONT_PATHS = [
    "C:/Windows/Fonts/msyh.ttc",       # Microsoft YaHei
    "C:/Windows/Fonts/msyhbd.ttc",     # Microsoft YaHei Bold
    "C:/Windows/Fonts/simsun.ttc",     # SimSun
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/seguiemj.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
]


def find_font(size=48):
    """Find an available font, returning PIL ImageFont."""
    for fp in FONT_PATHS:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                continue
    return ImageFont.load_default()


def download_image(url, timeout=30):
    """Download image from URL, return PIL Image."""
    req = urllib.request.Request(url, headers={"User-Agent": "SendAFun-OG-Generator/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            return Image.open(BytesIO(data))
    except urllib.error.HTTPError as e:
        print(f"    HTTP {e.code}: {url}")
        return None
    except Exception as e:
        print(f"    Error: {e} - {url}")
        return None


def create_og_image(card_img, title, slug):
    """Create a 1200x630 OG image with card bg and title overlay."""
    if card_img is None:
        print(f"    ⚠️  No image, creating placeholder for {slug}")
        og = Image.new("RGB", (OG_W, OG_H), "#1a1a2e")
    else:
        # Resize card image to cover OG dimensions
        card_img = card_img.convert("RGB")
        cw, ch = card_img.size
        scale = max(OG_W / cw, OG_H / ch)
        new_w, new_h = int(cw * scale), int(ch * scale)
        card_img = card_img.resize((new_w, new_h), Image.LANCZOS)

        # Center crop
        left = (new_w - OG_W) // 2
        top = (new_h - OG_H) // 2
        og = card_img.crop((left, top, left + OG_W, top + OG_H))

    # Add semi-transparent overlay at bottom for text readability
    overlay = Image.new("RGBA", (OG_W, OG_H), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    # Gradient-like bottom bar
    for y in range(OG_H - 200, OG_H):
        alpha = int(min(180, (y - (OG_H - 200)) * 0.9))
        overlay_draw.rectangle([(0, y), (OG_W, y + 1)], fill=(0, 0, 0, alpha))

    og = og.convert("RGBA")
    og.paste(overlay, (0, 0), overlay)

    # Add title text
    draw = ImageDraw.Draw(og)
    font_title = find_font(38)
    font_url = find_font(22)

    # Draw site name
    bbox = draw.textbbox((0, 0), "SendAFun", font=font_url)
    site_w = bbox[2] - bbox[0]
    draw.text((OG_W - site_w - 40, OG_H - 80), "SendAFun", fill=(255, 255, 255, 200), font=font_url)

    # Draw card title with word wrap
    max_width = OG_W - 80
    title_font = find_font(36)
    lines = wrap_text(title, title_font, max_width)

    total_h = len(lines) * 50
    start_y = OG_H - 180 - total_h + 50

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=title_font)
        tw = bbox[2] - bbox[0]
        x = (OG_W - tw) // 2
        draw.text((x, start_y), line, fill=(255, 255, 255, 240), font=title_font)
        start_y += 50

    # Convert back to RGB for saving
    og = og.convert("RGB")
    return og


def wrap_text(text, font, max_width):
    """Simple word wrap."""
    words = text.split(" ")
    lines = []
    current = ""

    for word in words:
        test = current + " " + word if current else word
        bbox = font.getbbox(test)
        if bbox[2] - bbox[0] > max_width and current:
            lines.append(current)
            current = word
        else:
            current = test

    if current:
        lines.append(current)

    return lines if lines else [text]


def upload_to_r2(local_path, object_key):
    """Upload file to R2 using S3 API."""
    import hashlib
    import hmac
    import datetime
    import urllib.parse

    access_key = "f69e5241221d849255f0e4c885035933"
    secret_key = "ed04d97fbb52d04780f19704e897fc7ca162a41b54afa7e35a2142a7ac184fc2"
    endpoint = "https://dbacad9daf4c611ca4143f74fc33c2d3.r2.cloudflarestorage.com"
    bucket = "sendafun-preview"
    region = "wnam"

    with open(local_path, "rb") as f:
        data = f.read()

    content_type = "image/webp"
    now = datetime.datetime.now(datetime.timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")

    # Create canonical request
    method = "PUT"
    canonical_uri = f"/{bucket}/{object_key}"
    canonical_querystring = ""
    payload_hash = hashlib.sha256(data).hexdigest()

    headers = {
        "host": urllib.parse.urlparse(endpoint).netloc,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
    }

    signed_headers = ";".join(sorted(headers.keys()))
    canonical_headers = "".join(
        f"{k}:{headers[k]}\n" for k in sorted(headers.keys())
    )

    canonical_request = f"{method}\n{canonical_uri}\n{canonical_querystring}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"

    # Sign
    algorithm = "AWS4-HMAC-SHA256"
    credential_scope = f"{date_stamp}/{region}/s3/aws4_request"
    string_to_sign = f"{algorithm}\n{amz_date}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode()).hexdigest()}"

    def sign(key, msg):
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    k_date = sign(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = sign(k_date, region)
    k_service = sign(k_region, "s3")
    k_signing = sign(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    authorization = (
        f"{algorithm} Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    url = f"{endpoint}{canonical_uri}"
    req_headers = {
        "Authorization": authorization,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
        "Content-Type": content_type,
        "Host": headers["host"],
    }

    req = urllib.request.Request(url, data=data, headers=req_headers, method="PUT")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            if resp.status == 200:
                return True
            else:
                print(f"    Upload failed: HTTP {resp.status}")
                return False
    except urllib.error.HTTPError as e:
        print(f"    Upload failed: HTTP {e.code} - {e.reason}")
        body = e.read().decode()
        if body:
            print(f"    Body: {body[:200]}")
        return False
    except Exception as e:
        print(f"    Upload error: {e}")
        return False


def main():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)

    cards = config.get("cards", [])
    print(f"\n🎴 Generating OG images for {len(cards)} cards...\n")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    success = 0
    failed = 0

    for i, card in enumerate(cards, 1):
        slug = card["slug"]
        og_filename = f"{slug}-og.webp"
        local_path = os.path.join(OUTPUT_DIR, og_filename)
        r2_key = og_filename  # Upload to root of bucket

        print(f"  [{i}/{len(cards)}] {slug}")

        # Download vertical image
        card_url = card.get("bgImageWatermark") or card.get("bgImage")
        card_img = download_image(card_url)

        # Create OG image
        title = card.get("title", slug.replace("-", " ").title())
        og_img = create_og_image(card_img, title, slug)

        # Save locally
        og_img.save(local_path, "WEBP", quality=85)
        file_size = os.path.getsize(local_path)
        print(f"    Saved: {local_path} ({file_size//1024}KB)")

        # Upload to R2
        if upload_to_r2(local_path, r2_key):
            print(f"    ✅ Uploaded to R2: {r2_key}")
            success += 1
        else:
            print(f"    ❌ Upload failed: {r2_key}")
            failed += 1

        if card_img and hasattr(card_img, "close"):
            card_img.close()

    print(f"\n{'─'*50}")
    print(f"  Done! Success: {success}, Failed: {failed}")
    print(f"  Local files: {OUTPUT_DIR}")
    print(f"  R2 URL: {R2_BASE}/{{slug}}-og.webp\n")


if __name__ == "__main__":
    main()
