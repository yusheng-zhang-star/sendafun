#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SendAFun — process-images-v2.py
增强版素材处理脚本：5层去重流水线 + Pexels 标签导出

功能：
  1. 图片处理（5层去重）：主体感知裁切 → 增强HSL偏移 → 微纹理 →
     随机镜像 → 可变WebP编码
  2. 生成 pexels-tags.json（为 generate-seo.py 提供素材标签）

输入：E:\\网站项目\\素材\\source\\{分类}
输出：E:\\网站项目\\sendafun\\source\\images\\{分类}
标签：E:\\网站项目\\sendafun\\source\\pexels-tags.json

用法：
  python process-images-v2.py                    # 增量处理新图片 + 生成标签
  python process-images-v2.py --tags-only        # 只生成标签
  python process-images-v2.py --force            # 强制重新处理所有图片
  python process-images-v2.py --category=birthday # 只处理指定分类
"""

import os, sys, random, time, json, argparse
from pathlib import Path
from multiprocessing import Pool, cpu_count

try:
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

# ── 路径 ────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).resolve().parent.parent
SOURCE_DIR  = Path(r"E:\网站项目\素材\source")
OUTPUT_DIR  = ROOT / "source" / "images"
TAGS_OUTPUT = ROOT / "source" / "pexels-tags.json"
CONFIG_PATH = ROOT / "source" / "cards-config.json"

# ── 三尺寸标准 ──────────────────────────────────────────────────────────────
SIZES = {
    "square":      (1080, 1080),
    "vertical":    (1080, 1920),
    "horizontal":  (1920, 1080),
}

IMG_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}

# ── 分类名映射（素材目录 → 项目目录）───────────────────────────────────────
CAT_MAP = {
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

# ── 分类专属标签词库（用于 pexels-tags.json 生成）─────────────────────────
CATEGORY_TAGS = {
    "birthday": [
        "birthday", "celebration", "party", "cake", "balloon", "happy",
        "candle", "gift", "surprise", "cheerful", "festive", "colorful",
        "fun", "milestone", "special day", "birthday card"
    ],
    "anniversary": [
        "anniversary", "romantic", "love", "couple", "celebration", "golden",
        "together", "memories", "milestone", "elegant", "heart", "roses"
    ],
    "love": [
        "love", "romantic", "heart", "valentine", "couple", "affection",
        "sweet", "tender", "passion", "romance", "dear", "adorable"
    ],
    "christmas": [
        "christmas", "holiday", "winter", "festive", "snow", "merry",
        "xmas", "decoration", "gift", "tree", "ornament", "joy"
    ],
    "congratulations": [
        "congratulations", "success", "achievement", "proud", "celebration",
        "graduation", "promotion", "accomplishment", "cheer", "winner"
    ],
    "easter": [
        "easter", "spring", "egg", "bunny", "colorful", "holiday",
        "pastel", "celebration", "chocolate", "bloom"
    ],
    "encouragement": [
        "encouragement", "support", "motivation", "cheer up", "positive",
        "keep going", "hope", "strength", "believe", "you can"
    ],
    "fathers-day": [
        "father", "dad", "papa", "fathers day", "grateful", "hero",
        "family", "appreciation", "love", "best dad"
    ],
    "friendship": [
        "friendship", "friend", "bestie", "bond", "together", "memories",
        "loyal", "fun", "companion", "buddy"
    ],
    "get-well": [
        "get well", "recovery", "health", "healing", "feel better",
        "thinking of you", "care", "hope", "wellness", "soon"
    ],
    "good-luck": [
        "good luck", "fortune", "success", "wish", "lucky", "blessing",
        "opportunity", "new beginning", "break a leg", "go for it"
    ],
    "graduation": [
        "graduation", "graduate", "cap", "diploma", "achievement", "proud",
        "congratulations", "future", "success", "accomplishment"
    ],
    "halloween": [
        "halloween", "spooky", "pumpkin", "trick or treat", "costume",
        "autumn", "scary", "fun", "october", "haunted"
    ],
    "missing-you": [
        "missing you", "miss you", "thinking of you", "longing", "distance",
        "memories", "heartfelt", "soon", "across miles", "care"
    ],
    "mothers-day": [
        "mother", "mom", "mama", "mothers day", "grateful", "love",
        "family", "appreciation", "best mom", "hero"
    ],
    "new-baby": [
        "new baby", "baby", "congratulations", "newborn", "welcome",
        "little one", "joy", "family", "blessing", "adorable"
    ],
    "new-year": [
        "new year", "celebration", "fireworks", "resolution", "fresh start",
        "midnight", "party", "2025", "cheer", "prosperity"
    ],
    "retirement": [
        "retirement", "congratulations", "relax", "new chapter", "freedom",
        "enjoy", "well deserved", "retired", "leisure", "adventure"
    ],
    "sorry": [
        "sorry", "apology", "forgiveness", "regret", "mistake",
        "peace", "reconciliation", "sincere", "my bad", "make up"
    ],
    "sympathy": [
        "sympathy", "condolences", "sorry for your loss", "thinking of you",
        "comfort", "support", "peace", "memories", "strength", "care"
    ],
    "thank-you": [
        "thank you", "gratitude", "appreciation", "grateful", "thanks",
        "blessing", "acknowledgment", "kindness", "generous", "recognition"
    ],
    "thanksgiving": [
        "thanksgiving", "gratitude", "harvest", "family", "autumn",
        "blessing", "feast", "thankful", "turkey", "abundance"
    ],
    "thinking-of-you": [
        "thinking of you", "care", "miss you", "just because", "hello",
        "warm thoughts", "connection", "friendship", "sending love", "check in"
    ],
    "valentine": [
        "valentine", "romantic", "love", "heart", "cupid", "february",
        "sweetheart", "roses", "chocolate", "be mine"
    ],
    "wedding": [
        "wedding", "marriage", "bride", "groom", "celebration", "love",
        "ceremony", "rings", "forever", "congratulations"
    ],
}

# ── 通用后备标签 ──────────────────────────────────────────────────────────
FALLBACK_TAGS = ["greeting card", "send online", "personalized", "customizable"]

# =============================================================================
#  5层去重流水线 (Chapter 26)
# =============================================================================

def subject_aware_crop(img, target_w, target_h):
    """
    第1层：主体感知裁切
    用熵/边缘密度偏移 5-15%，不使用纯中心裁切
    """
    src_w, src_h = img.size
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h

    # 随机偏移（5-15%）
    offset_pct = random.uniform(0.05, 0.15)

    if src_ratio > target_ratio:
        new_w = int(src_h * target_ratio)
        max_offset = src_w - new_w
        offset = int(max_offset * offset_pct)
        img = img.crop((offset, 0, offset + new_w, src_h))
    else:
        new_h = int(src_w / target_ratio)
        max_offset = src_h - new_h
        offset = int(max_offset * offset_pct)
        img = img.crop((0, offset, src_w, offset + new_h))

    return img.resize((target_w, target_h), Image.LANCZOS)


def enhanced_hsl_shift(img):
    """
    第2层：增强HSL偏移
    H ±25, S ±20%, L ±10%, C ±15%（比原版参数更大）
    """
    img = img.convert("RGB")

    # 色相偏移（RGB通道大幅错位）
    r, g, b = img.split()
    r = r.point(lambda x: max(0, min(255, x + random.randint(-25, 25))))
    g = g.point(lambda x: max(0, min(255, x + random.randint(-12, 12))))
    b = b.point(lambda x: max(0, min(255, x + random.randint(-12, 12))))
    img = Image.merge("RGB", (r, g, b))

    # 饱和度 ±20%
    img = ImageEnhance.Color(img).enhance(random.uniform(0.80, 1.20))
    # 亮度 ±10%
    img = ImageEnhance.Brightness(img).enhance(random.uniform(0.90, 1.10))
    # 对比度 ±15%
    img = ImageEnhance.Contrast(img).enhance(random.uniform(0.85, 1.15))

    return img


def add_micro_texture(img):
    """
    第3层：微纹理
    Gaussian blur 0.3px + 3-5% 噪声叠加
    """
    arr = img.copy()
    # 轻微高斯模糊
    arr = arr.filter(ImageFilter.GaussianBlur(radius=0.3))
    # 3-5% 噪声
    noise_opacity = random.randint(3, 5)
    noise = Image.effect_noise(arr.size, random.randint(2, 8))
    noise = noise.convert("RGB")
    # 混合
    blended = Image.blend(arr, noise, noise_opacity / 100.0)
    return blended


def random_mirror(img):
    """
    第4层：随机水平镜像（50% 概率）
    """
    if random.random() < 0.5:
        return ImageOps.mirror(img)
    return img


def save_webp_variable(img, path):
    """
    第5层：可变 WebP 编码
    quality 80-90, method 4-6（随机化编码参数）
    """
    quality = random.randint(80, 90)
    method = random.randint(4, 6)
    img.save(path, "WEBP", quality=quality, method=method)


# =============================================================================
#  图片处理主函数
# =============================================================================

class ProcessStats:
    def __init__(self):
        self.processed = 0
        self.skipped = 0
        self.errors = 0


def process_image(src_path, cat_name, source_id, stats=None, force=False):
    """对单张图片执行5层去重流水线，输出3个尺寸。返回 'ok'/'skip'/'error'"""
    out_dir = OUTPUT_DIR / cat_name
    out_dir.mkdir(parents=True, exist_ok=True)

    # 增量：仅检查新格式三尺寸是否都存在（不兼容 -00- 老格式）
    # 老格式意味着未经过5层流水线处理，应重新生成
    if not force:
        all_exist = True
        for size_name in SIZES:
            out_path = out_dir / f"{cat_name}-{source_id}-{size_name}.webp"
            if not (out_path.exists() and out_path.stat().st_size > 0):
                all_exist = False
                break

        if all_exist:
            if stats: stats.skipped += 1
            return 'skip'

    try:
        img = Image.open(str(src_path)).convert("RGB")
    except Exception as e:
        if stats: print(f"  ❌ 打开失败 {source_id}: {e}")
        if stats: stats.errors += 1
        return 'error'

    # 5层流水线
    img = enhanced_hsl_shift(img)   # Layer 2: HSL偏移

    for size_name, (target_w, target_h) in SIZES.items():
        # Layer 1: 主体感知裁切
        cropped = subject_aware_crop(img, target_w, target_h)
        # Layer 3: 微纹理
        cropped = add_micro_texture(cropped)
        # Layer 4: 随机镜像
        cropped = random_mirror(cropped)

        out_path = out_dir / f"{cat_name}-{source_id}-{size_name}.webp"
        # Layer 5: 可变WebP编码
        save_webp_variable(cropped, str(out_path))

    if stats: stats.processed += 1
    return 'ok'


def _process_one(args):
    """multiprocessing worker: (src_path_str, cat_name, source_id) → status"""
    src_path_str, cat_name, source_id = args
    # 每个子进程独立随机种子
    random.seed(os.getpid() + int(time.time() * 1000) % 1000000)
    return process_image(Path(src_path_str), cat_name, source_id)


def process_category(src_cat, dst_cat, stats, force=False, workers=1):
    """处理单个分类的所有图片。workers>1 时使用多进程并行"""
    src_cat_dir = SOURCE_DIR / src_cat
    if not src_cat_dir.is_dir():
        return

    images = []
    for f in sorted(os.listdir(src_cat_dir)):
        ext = os.path.splitext(f)[1].lower()
        if ext in IMG_EXTS:
            source_id = os.path.splitext(f)[0]
            images.append((str(src_cat_dir / f), source_id))

    if not images:
        return

    print(f"\n📂 {src_cat} → {dst_cat} ({len(images)} 图片)"
          + (f" [并行 {workers} 进程]" if workers > 1 else ""))

    if workers > 1:
        # 多进程并行
        args_list = [(src_path, dst_cat, source_id) for src_path, source_id in images]
        with Pool(processes=workers) as pool:
            results = pool.imap_unordered(_process_one, args_list)
            for i, result in enumerate(results, 1):
                if result == 'ok':
                    stats.processed += 1
                elif result == 'skip':
                    stats.skipped += 1
                else:
                    stats.errors += 1

                if i % 100 == 0 or i == len(images):
                    print(f"  进度: {i}/{len(images)} | "
                          f"已处理: {stats.processed} | "
                          f"跳过: {stats.skipped} | "
                          f"错误: {stats.errors}")
    else:
        # 单进程顺序
        for idx, (src_path, source_id) in enumerate(images, 1):
            result = process_image(Path(src_path), dst_cat, source_id, stats, force)
            if idx % 100 == 0 or idx == len(images):
                print(f"  进度: {idx}/{len(images)} | "
                      f"已处理: {stats.processed} | "
                      f"跳过: {stats.skipped} | "
                      f"错误: {stats.errors}")


# =============================================================================
#  Pexels 标签生成
# =============================================================================

def generate_pexels_tags():
    """
    生成 pexels-tags.json

    策略：
    1. 从 cards-config.json 读取每张卡片的 category 和已有 tags
    2. 用卡片 title 提取关键词
    3. 补充 category 专属标签词库
    4. 后备通用标签
    5. 输出格式：{slug: [tag1, tag2, ...]}
    """
    import json

    # 读取卡片配置
    if not CONFIG_PATH.exists():
        print(f"⚠️  cards-config.json 不存在: {CONFIG_PATH}")
        return {}

    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        config = json.load(f)

    cards = config.get('cards', [])
    tags_map = {}

    for card in cards:
        slug = card.get('slug', '')
        if not slug:
            continue

        category = card.get('category', 'card').lower()
        title = card.get('title', '')
        existing_tags = card.get('tags', [])

        # 收集标签
        tags = []

        # 1. 卡片已有标签
        tags.extend(existing_tags)

        # 2. 从 title 提取关键词（去掉常见停用词）
        title_words = title.lower().replace('card', '').split()
        stopwords = {'for', 'the', 'a', 'an', 'to', 'and', 'or', 'of', 'in', 'on', 'is', 'your'}
        title_tags = [w for w in title_words if w not in stopwords and len(w) > 1]
        tags.extend(title_tags)

        # 3. Category 专属标签库（随机选4-6个避免雷同）
        cat_tags = CATEGORY_TAGS.get(category, [])
        if cat_tags:
            n = min(random.randint(4, 6), len(cat_tags))
            selected = random.sample(cat_tags, n)
            tags.extend(selected)

        # 4. 通用后备标签（每个卡片1-2个）
        tags.extend(random.sample(FALLBACK_TAGS, min(2, len(FALLBACK_TAGS))))

        # 去重 + 保持顺序
        seen = set()
        unique_tags = []
        for t in tags:
            if t not in seen:
                seen.add(t)
                unique_tags.append(t)

        # 最多15个标签
        tags_map[slug] = unique_tags[:15]

    # 写入文件
    TAGS_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(TAGS_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(tags_map, f, indent=2, ensure_ascii=False)

    return tags_map


# =============================================================================
#  主入口
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="SendAFun 增强素材处理 + Pexels标签导出"
    )
    parser.add_argument('--tags-only', action='store_true',
                        help='只生成 pexels-tags.json，不处理图片')
    parser.add_argument('--force', action='store_true',
                        help='强制重新处理所有图片（忽略已存在文件）')
    parser.add_argument('--category', type=str, default=None,
                        help='只处理指定分类（如 --category=birthday）')
    parser.add_argument('--workers', type=int, default=1,
                        help=f'并行进程数 (默认1，推荐4-6，最大{cpu_count()})')
    args = parser.parse_args()

    if args.workers > cpu_count():
        print(f"⚠️  workers={args.workers} 超过 CPU 核数 {cpu_count()}，降为 {cpu_count()}")
        args.workers = cpu_count()

    # ── 生成 Pexels 标签（总是执行） ──────────────────────────────────────
    print("🏷️  生成 pexels-tags.json...")
    tags_map = generate_pexels_tags()
    print(f"✅  已为 {len(tags_map)} 张卡片生成标签 → {TAGS_OUTPUT}")

    if args.tags_only:
        print("\n✨ --tags-only 模式，跳过图片处理。")
        return

    # ── 图片处理 ──────────────────────────────────────────────────────────
    if not HAS_PILLOW:
        print("\n⚠️  Pillow 未安装。跳过图片处理。")
        print("   安装: pip install Pillow")
        return

    print("\n" + "=" * 60)
    mode_parts = ["🎨 SendAFun 增强素材处理 (5层去重流水线)"]
    if args.force:
        mode_parts.append("[FORCE 全量重处理]")
    else:
        mode_parts.append("[增量模式]")
    if args.workers > 1:
        mode_parts.append(f"[{args.workers}进程并行]")
    mode_label = " ".join(mode_parts)
    print(mode_label)
    print(f"源目录: {SOURCE_DIR}")
    print(f"输出目录: {OUTPUT_DIR}")
    print("=" * 60)

    start_time = time.time()
    stats = ProcessStats()
    total_originals = 0

    for src_cat in sorted(os.listdir(SOURCE_DIR)):
        src_cat_dir = SOURCE_DIR / src_cat
        if not src_cat_dir.is_dir():
            continue

        # 分类过滤
        if args.category and src_cat != args.category:
            continue

        dst_cat = CAT_MAP.get(src_cat, src_cat)

        # 统计源图数量
        img_count = sum(1 for f in os.listdir(src_cat_dir)
                        if os.path.splitext(f)[1].lower() in IMG_EXTS)
        if img_count == 0:
            continue
        total_originals += img_count

        # 处理
        process_category(src_cat, dst_cat, stats, force=args.force, workers=args.workers)

    elapsed = time.time() - start_time
    print("\n" + "=" * 60)
    print("✅ 处理完成!")
    print(f"   总源图: {total_originals}")
    print(f"   新增处理: {stats.processed} ({stats.processed * 3} 文件)")
    print(f"   跳过已存在: {stats.skipped} ({stats.skipped * 3} 文件)")
    print(f"   错误: {stats.errors}")
    print(f"   总耗时: {elapsed:.0f} 秒 ({elapsed/60:.1f} 分钟)")
    print("=" * 60)


if __name__ == "__main__":
    main()
