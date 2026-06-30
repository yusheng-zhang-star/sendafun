#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SendAFun — validate-and-fix-r2-urls.py
扫描 sendafun-preview 桶的真实 key，对比 cards-config 中每张卡的 bgImage，
把所有 404 的卡：
  A) 若同分类下还有真实素材可用 → 重映射到真实素材（循环取）
  B) 否则 → 从 cards-config 中移除
最后覆盖写回 source/cards-config.json 并报告统计。
"""

import sys, os, json, re, math, random
from pathlib import Path
from collections import defaultdict, Counter
from importlib.machinery import SourceFileLoader

ROOT = Path(__file__).resolve().parent.parent
BUILD_DIR = ROOT / "build-script"
CONFIG_PATH = ROOT / "source" / "cards-config.json"
MAPPING_PATH = ROOT / "source" / "card-image-mapping.json"

sys.path.insert(0, str(BUILD_DIR))
mod = SourceFileLoader("map_cards", str(BUILD_DIR / "map-cards-to-images.py")).load_module()
list_r2_keys = mod.list_r2_keys
PREVIEW_BUCKET = mod.PREVIEW_BUCKET
R2_CDN = mod.R2_CDN

def key_from_url(url: str) -> str:
    """从 URL https://{cdn}/{key} 里抠出 R2 key"""
    if not url.startswith("http"):
        return url.lstrip("/")
    return url.replace(R2_CDN, "", 1).lstrip("/")

def url_from_key(key: str) -> str:
    return f"{R2_CDN}/{key}"

# ── 1. 拿桶里真实 key（筛选 vertical，按分类分桶） ──────────────────────
print(f"[1/5] Scanning R2 preview bucket: {PREVIEW_BUCKET} ...")
all_keys = list_r2_keys(PREVIEW_BUCKET)
print(f"      Total objects in bucket: {len(all_keys)}")

cat_real_keys = defaultdict(list)   # category → list[vertical_keys]
for k in all_keys:
    # key pattern: {category}/{category}-(pexels|pixabay|unsplash)-{id}-{aspect}.webp
    if "-vertical.webp" not in k:
        continue
    parts = k.split("/")
    if len(parts) != 2:
        continue
    cat_real_keys[parts[0]].append(k)

total_vertical = sum(len(v) for v in cat_real_keys.values())
print(f"      Vertical preview images: {total_vertical} across {len(cat_real_keys)} categories")
for c, ks in sorted(cat_real_keys.items(), key=lambda x: -len(x[1]))[:10]:
    print(f"        · {c}: {len(ks)} vertical")

# ── 2. 读 cards-config ──────────────────────────────────────────────────
print(f"\n[2/5] Loading {CONFIG_PATH.name} ...")
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    cfg = json.load(f)
cards = cfg.get("cards", [])
print(f"      Cards in config: {len(cards)}")

# ── 3. 校验每张卡的 bgImage key 是否真实存在 ─────────────────────────────
print(f"\n[3/5] Validating URLs ...")
not_found = []         # list[(idx, card, bad_key)]
cat_counter_before = Counter()
for i, c in enumerate(cards):
    cat_counter_before[c["category"]] += 1
    key = key_from_url(c["bgImage"])
    real_keys = cat_real_keys.get(c["category"], [])
    if key not in real_keys:
        not_found.append((i, c, key))

print(f"      Cards with 404 bgImage: {len(not_found)} / {len(cards)} "
      f"({(len(not_found)/len(cards)*100):.1f}%)")
if not_found:
    sample_bad = not_found[:5]
    for i, c, k in sample_bad:
        print(f"        · [{c['category']}] {k}")

# ── 4. 修复策略：优先重映射到同分类真实素材，不够才删除 ──────────────────
print(f"\n[4/5] Fixing cards ...")

# 为了让 slug 继续保持唯一性（因为 slug 末尾可能带有原素材ID），我们重映射时：
# - 保持 slug 不变（因为URL slug 不需要和实际素材ID严格绑定）
# - 替换 bgImage / bgImageWatermark 到真正存在的素材 key（同分类内循环拿）
cat_real_iters = {cat: iter(ks) for cat, ks in cat_real_keys.items()}
cat_real_cycle = {}
for cat, ks in cat_real_keys.items():
    random.seed(42)
    pool = list(ks)
    random.shuffle(pool)
    cat_real_cycle[cat] = iter(pool * 10000)   # 足够大的循环池

remapped = 0
removed_indices = set()

for i, c, bad_key in not_found:
    cat = c["category"]
    pool = cat_real_keys.get(cat, [])
    if not pool:
        # 该分类在真实桶里一张都没有 → 删除
        removed_indices.add(i)
        continue
    # 从循环池取下一张真实素材
    new_key = next(cat_real_cycle[cat])
    new_url = url_from_key(new_key)
    c["bgImage"] = new_url
    c["bgImageWatermark"] = new_url
    # 同步更新 mapping 字段（如果有）
    if "imageKey" in c:
        c["imageKey"] = new_key
    remapped += 1

# 如果是删除（真实桶里没有该分类）→ 构建新 cards 列表
if removed_indices:
    kept_cards = [c for i, c in enumerate(cards) if i not in removed_indices]
    print(f"      Removed {len(removed_indices)} cards (category has zero real assets in R2)")
else:
    kept_cards = cards

cfg["cards"] = kept_cards

# 同步更新 card-image-mapping.json：
# 格式： { cardSlug: { bgImage, bgImageWatermark, imageKey, category } }
mapping = {}
for c in kept_cards:
    mapping[c["slug"]] = {
        "category": c["category"],
        "bgImage": c["bgImage"],
        "bgImageWatermark": c["bgImageWatermark"],
        "imageKey": key_from_url(c["bgImage"]),
    }

# ── 5. 写回磁盘 + 报告 ──────────────────────────────────────────────────
print(f"\n[5/5] Writing back ...")
with open(CONFIG_PATH, "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)
with open(MAPPING_PATH, "w", encoding="utf-8") as f:
    json.dump(mapping, f, ensure_ascii=False, indent=2)

# ── 最终统计 ────────────────────────────────────────────────────────────
cat_after = Counter(c["category"] for c in kept_cards)
print(f"\n=====  FINAL REPORT  =====")
print(f"Cards before          : {len(cards)}")
print(f"  Bad (404)           : {len(not_found)}")
print(f"  → Remapped to real  : {remapped}")
print(f"  → Removed (no pool) : {len(removed_indices)}")
print(f"Cards after           : {len(kept_cards)}")
print(f"\nPer-category (before → after):")
all_cats = set(cat_counter_before) | set(cat_after)
for cat in sorted(all_cats):
    b = cat_counter_before.get(cat, 0)
    a = cat_after.get(cat, 0)
    real = len(cat_real_keys.get(cat, []))
    mark = " ← mismatch" if a != 0 and real == 0 else ""
    print(f"  {cat:20s} {b:5d} → {a:5d}   (real vertical in bucket: {real}){mark}")

# 快速自我校验：所有剩余卡的 bgImage key 都确实存在桶里
bad_count = 0
for c in kept_cards:
    key = key_from_url(c["bgImage"])
    if key not in cat_real_keys.get(c["category"], []):
        bad_count += 1
print(f"\nPost-check: remaining cards with still-bad bgImage: {bad_count}")
print("All OK ✓" if bad_count == 0 else "!! FAILED post-check !!")
print(f"\nOutput files:")
print(f"  · {CONFIG_PATH}")
print(f"  · {MAPPING_PATH}")
