#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SendAFun — map-cards-to-images.py
将每张卡片映射到 R2 CDN 中的实际图片，更新 cards-config.json

R2 CDN 路径格式:
  https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/{category}/{category}-pexels-{id}-{size}.webp

输出:
  - 更新 source/cards-config.json 的 bgImage/bgImageWatermark
  - 生成 source/card-image-mapping.json（完整映射，含 SEO name）
"""

import json, os, re
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "source" / "images"
CONFIG_PATH = ROOT / "source" / "cards-config.json"
MAPPING_PATH = ROOT / "source" / "card-image-mapping.json"

R2_CDN = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev"


def scan_images():
    """扫描所有已处理图片，按分类+pexels_id 分组"""
    # {category: {pexels_id: {size: filename}}}
    images = defaultdict(lambda: defaultdict(dict))

    for cat_dir in sorted(IMAGES_DIR.iterdir()):
        if not cat_dir.is_dir() or cat_dir.name == "watermark":
            continue
        category = cat_dir.name
        for f in cat_dir.iterdir():
            if not f.name.endswith(".webp"):
                continue
            # 解析: {category}-{source}-{id}-{size}.webp  (source = pexels | pixabay)
            m = re.match(rf"^{re.escape(category)}-(pexels|pixabay)-(\d+)-(square|vertical|horizontal)\.webp$", f.name)
            if m:
                source = m.group(1)
                img_id = f"{source}-{m.group(2)}"
                size = m.group(3)
                images[category][img_id][size] = f.name

    return images


def pick_image_for_card(card, images):
    """为卡片选择代表图片"""
    category = card.get("category", "")
    slug = card.get("slug", "")

    # 分类名映射（cards-config.json 中的分类名 → 实际目录名）
    cat_map = {
        "thanks": "thank-you",
        "wellness": "get-well",
        "miss-you": "missing-you",
    }
    actual_cat = cat_map.get(category, category)

    if actual_cat not in images or not images[actual_cat]:
        print(f"  ⚠️  {slug}: 分类 '{category}' (→ '{actual_cat}') 无图片")
        return None

    # 取第一个可用的 pexels_id
    img_ids = sorted(images[actual_cat].keys())
    picked_id = img_ids[0]
    sizes = images[actual_cat][picked_id]

    return {
        "img_id": picked_id,
        "category": actual_cat,
        "sizes": sizes,
    }


def generate_seo_name(card):
    """生成 SEO 友好的文件名"""
    slug = card.get("slug", "card")
    return slug.replace("_", "-")


def main():
    images = scan_images()

    # 统计
    total_pexels = sum(len(v) for v in images.values())
    print(f"扫描结果: {len(images)} 个分类, {total_pexels} 个唯一 pexels ID")

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    cards = config.get("cards", [])

    mapping = {}

    for card in cards:
        slug = card["slug"]
        category = card["category"]
        seo_name = generate_seo_name(card)

        picked = pick_image_for_card(card, images)
        if not picked:
            continue

        pexels_id = picked["img_id"]
        sizes = picked["sizes"]
        actual_cat = picked["category"]

        # R2 CDN 全路径
        r2_paths = {}
        for size in ("square", "vertical", "horizontal"):
            if size in sizes:
                r2_paths[size] = f"{R2_CDN}/{actual_cat}/{sizes[size]}"

        # SEO 元数据
        seo_data = card.get("seo", {})

        # 更新 cards-config.json
        card["bgImage"] = r2_paths.get("vertical", r2_paths.get("square", ""))
        card["bgImageWatermark"] = r2_paths.get("vertical", r2_paths.get("square", ""))
        # 更新 ogImage 为 R2 CDN
        og_img = seo_data.get("og_image", f"{slug}-og.webp")
        card["ogImage"] = f"{R2_CDN}/{og_img}"

        # 构建映射条目
        mapping[slug] = {
            "category": actual_cat,
            "img_id": pexels_id,
            "seo_name": seo_name,
            "r2_paths": r2_paths,
            "alt_text": f"{card['title']} — free personalized ecard, send online at SendAFun",
            "seo": seo_data,
            "version": 1,
            "updated_at": "2026-06-29",
        }

        print(f"  ✅ {slug} → {pexels_id} ({actual_cat})")
        for size, url in r2_paths.items():
            print(f"       {size}: {url}")

    # 写回 cards-config.json
    CONFIG_PATH.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✅ cards-config.json 已更新 ({len(cards)} 张卡片)")

    # 写入映射文件
    MAPPING_PATH.write_text(json.dumps(mapping, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"✅ card-image-mapping.json 已生成 ({len(mapping)} 条映射)")


if __name__ == "__main__":
    main()
