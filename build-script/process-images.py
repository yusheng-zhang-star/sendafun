#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量处理贺卡素材：HSL偏移 → 裁剪三尺寸 → 转WebP
输入：E:\网站项目\素材\source\{分类}\
输出：E:\网站项目\sendafun\source\images\{分类}\

保留原有处理逻辑（HSL偏移、尺寸裁剪），但输出到新项目目录。
支持增量处理：输出文件已存在则跳过。
"""

import os, sys, random, time, json
from PIL import Image, ImageEnhance

SOURCE_DIR = r"E:\网站项目\素材\source"
OUTPUT_DIR = r"E:\网站项目\sendafun\source\images"

# 三尺寸标准 (width, height)
SIZES = {
    "square": (1080, 1080),
    "vertical": (1080, 1920),
    "horizontal": (1920, 1080),
}

# 支持的图片扩展名
IMG_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}

# 分类名映射（素材目录 → 新项目目录）
CAT_MAP = {
    "anniversary": "anniversary",
    "birthday": "birthday",
    "christmas": "christmas",
    "congratulations": "congratulations",
    "easter": "easter",
    "encouragement": "encouragement",
    "fathers_day": "fathers-day",
    "friendship": "friendship",
    "get_well": "get-well",
    "good_luck": "good-luck",
    "graduation": "graduation",
    "halloween": "halloween",
    "love": "love",
    "missing_you": "missing-you",
    "mothers_day": "mothers-day",
    "new_baby": "new-baby",
    "new_year": "new-year",
    "retirement": "retirement",
    "sorry": "sorry",
    "sympathy": "sympathy",
    "thank_you": "thank-you",
    "thanksgiving": "thanksgiving",
    "thinking_of_you": "thinking-of-you",
    "valentine": "valentine",
    "wedding": "wedding",
}

processed = 0
skipped = 0
errors = 0


def hsl_shift(img):
    """HSL偏移：色相±15、饱和度±10%、亮度±5%（保持原逻辑）"""
    img = img.convert("RGB")
    
    # 色相偏移（RGB通道轻微错位）
    r, g, b = img.split()
    r = r.point(lambda x: max(0, min(255, x + random.randint(-15, 15))))
    g = g.point(lambda x: max(0, min(255, x + random.randint(-8, 8))))
    b = b.point(lambda x: max(0, min(255, x + random.randint(-8, 8))))
    img = Image.merge("RGB", (r, g, b))
    
    # 饱和度 ±15%
    img = ImageEnhance.Color(img).enhance(random.uniform(0.85, 1.15))
    # 亮度 ±8%
    img = ImageEnhance.Brightness(img).enhance(random.uniform(0.92, 1.08))
    # 对比度 ±10%
    img = ImageEnhance.Contrast(img).enhance(random.uniform(0.9, 1.1))
    
    return img


def crop_center(img, target_w, target_h):
    """中心裁切到目标比例"""
    src_w, src_h = img.size
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h
    
    if src_ratio > target_ratio:
        new_w = int(src_h * target_ratio)
        offset = (src_w - new_w) // 2
        img = img.crop((offset, 0, offset + new_w, src_h))
    else:
        new_h = int(src_w / target_ratio)
        offset = (src_h - new_h) // 2
        img = img.crop((0, offset, src_w, offset + new_h))
    
    return img.resize((target_w, target_h), Image.LANCZOS)


def process_image(src_path, cat_name, source_id):
    """处理单张图片并输出3个尺寸"""
    global processed, skipped, errors
    
    out_dir = os.path.join(OUTPUT_DIR, cat_name)
    os.makedirs(out_dir, exist_ok=True)
    
    # 检查是否全部三个尺寸已存在
    all_exist = True
    for size_name in SIZES:
        out_path = os.path.join(out_dir, f"{cat_name}-{source_id}-{size_name}.webp")
        if not os.path.exists(out_path) or os.path.getsize(out_path) == 0:
            all_exist = False
            break
    
    if all_exist:
        skipped += 1
        return
    
    # 打开图片
    try:
        img = Image.open(src_path).convert("RGB")
    except Exception as e:
        print(f"  ❌ 打开失败 {source_id}: {e}")
        errors += 1
        return
    
    # HSL偏移
    img_variant = hsl_shift(img)
    
    # 输出三个尺寸
    for size_name, (target_w, target_h) in SIZES.items():
        cropped = crop_center(img_variant, target_w, target_h)
        out_path = os.path.join(out_dir, f"{cat_name}-{source_id}-{size_name}.webp")
        cropped.save(out_path, "WEBP", quality=85, method=6)
    
    processed += 1


def main():
    global processed, skipped, errors
    
    print("=" * 60)
    print("🎨 SendAFun 素材处理脚本")
    print(f"源目录: {SOURCE_DIR}")
    print(f"输出目录: {OUTPUT_DIR}")
    print("=" * 60)
    
    start_time = time.time()
    total_originals = 0
    
    for src_cat in sorted(os.listdir(SOURCE_DIR)):
        src_cat_dir = os.path.join(SOURCE_DIR, src_cat)
        if not os.path.isdir(src_cat_dir):
            continue
        
        # 映射分类名
        dst_cat = CAT_MAP.get(src_cat, src_cat)
        
        # 获取该分类所有图片文件
        images = []
        for f in sorted(os.listdir(src_cat_dir)):
            ext = os.path.splitext(f)[1].lower()
            if ext in IMG_EXTS:
                source_id = os.path.splitext(f)[0]
                src_path = os.path.join(src_cat_dir, f)
                images.append((src_path, source_id))
        
        if not images:
            continue
        
        total_originals += len(images)
        print(f"\n📂 {src_cat} → {dst_cat} ({len(images)} 图片)")
        
        for idx, (src_path, source_id) in enumerate(images, 1):
            process_image(src_path, dst_cat, source_id)
            
            # 每50张报告进度
            if idx % 50 == 0 or idx == len(images):
                elapsed = time.time() - start_time
                print(f"  进度: {idx}/{len(images)} | 已处理: {processed} | 跳过: {skipped} | 错误: {errors} | 耗时: {elapsed:.0f}s")
    
    elapsed = time.time() - start_time
    print("\n" + "=" * 60)
    print(f"✅ 处理完成!")
    print(f"   总源图: {total_originals}")
    print(f"   新增处理: {processed} ({processed * 3} 文件)")
    print(f"   跳过已存在: {skipped} ({skipped * 3} 文件)")
    print(f"   错误: {errors}")
    print(f"   总耗时: {elapsed:.0f} 秒 ({elapsed/60:.1f} 分钟)")
    print("=" * 60)


if __name__ == "__main__":
    main()
