#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SendAFun — kv-import.py
将 SEO 数据批量导入 Cloudflare KV

输入：source/cards-config.json + source/cards-seo.json
输出：source/cards-kv-bulk.json（wrangler bulk put 格式）

用法：
  # 1. 生成 bulk JSON 文件
  python kv-import.py --generate

  # 2. 用 wrangler 导入（需要先 wrangler login）
  wrangler kv:bulk put --namespace-id=7cd3408c3caf4fe9948cd156f6883acb source/cards-kv-bulk.json

  # 3. 或用 Cloudflare API 直接导入（需要 CF_API_TOKEN 环境变量）
  python kv-import.py --import

KV Key 格式:  asset:{category}:{display_id}  (如 asset:birthday:beautiful-birthday-mom)
"""

import json, os, sys, argparse, urllib.request, urllib.error
from pathlib import Path
from datetime import datetime, timezone

ROOT        = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "source" / "cards-config.json"
SEO_PATH    = ROOT / "source" / "cards-seo.json"
MAPPING_PATH = ROOT / "source" / "card-image-mapping.json"
BULK_PATH   = ROOT / "source" / "cards-kv-bulk.json"

# Cloudflare 配置（从 wrangler.toml）
CF_ACCOUNT_ID    = "dbacad9daf4c611ca4143f74fc33c2d3"
CF_KV_NAMESPACE  = "7cd3408c3caf4fe9948cd156f6883acb"
CF_API_BASE      = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}"
CF_BULK_URL      = f"{CF_API_BASE}/storage/kv/namespaces/{CF_KV_NAMESPACE}/bulk"

R2_PUBLIC = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev"


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def generate_bulk_json():
    """
    生成 wrangler kv:bulk put 格式的 JSON 文件
    
    每行格式：
    {"key": "asset:{category}:{slug}", "value": "{...JSON...}"}
    """
    config = load_json(CONFIG_PATH)
    seo_data = load_json(SEO_PATH)
    cards = config.get("cards", [])

    # 读取图片映射（含真实 R2 路径）
    img_mapping = {}
    if MAPPING_PATH.exists():
        img_mapping = load_json(MAPPING_PATH)

    if not cards:
        print("❌  No cards found in cards-config.json")
        return

    bulk = []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for card in cards:
        slug = card.get("slug", "")
        category = card.get("category", "card").lower()
        key = f"asset:{category}:{slug}"

        seo = seo_data.get(slug, card.get("seo", {}))

        # 从 card-image-mapping.json 获取真实 R2 路径
        mapped = img_mapping.get(slug, {})
        r2_paths = mapped.get("r2_paths", {})
        actual_category = mapped.get("category", category)

        # 构建 KV value
        value = {
            "display_id": slug,
            "category": actual_category,
            "card_title": card.get("title", ""),
            "upload_date": today,
            "last_replaced": None,
            "replace_count": 0,
            "version": 1,
            # R2 图片路径（从 card-image-mapping.json）
            "r2_preview_paths": {
                "horizontal": r2_paths.get("horizontal", card.get("bgImage", "")),
                "vertical":   r2_paths.get("vertical", card.get("bgImage", "")),
                "square":     r2_paths.get("square", card.get("bgImage", "")),
            },
            "img_id": mapped.get("img_id", ""),
            "seo_name": mapped.get("seo_name", slug),
            # SEO 字段
            "seo": {
                "title":       seo.get("title", ""),
                "description":  seo.get("description", ""),
                "og_image":    f"{R2_PUBLIC}/{seo.get('og_image', slug + '-og.webp')}",
                "keywords":    seo.get("keywords", []),
                "h1":          seo.get("h1", ""),
                "intro_text":   seo.get("intro_text", ""),
            }
        }

        bulk.append({
            "key": key,
            "value": json.dumps(value, ensure_ascii=False),
            # 可选 metadata
            "metadata": {
                "category": category,
                "version": 1,
            }
        })

    # 写入文件
    BULK_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(BULK_PATH, 'w', encoding='utf-8') as f:
        json.dump(bulk, f, indent=2, ensure_ascii=False)

    print(f"✅  已生成 {len(bulk)} 条 KV 记录 → {BULK_PATH}")
    print(f"\n📋  导入命令：")
    print(f"   wrangler kv:bulk put --namespace-id={CF_KV_NAMESPACE} {BULK_PATH}")
    print(f"\n   需要先登录 Cloudflare: wrangler login")


def import_via_api():
    """
    通过 Cloudflare REST API 直接导入（需要 CF_API_TOKEN 环境变量）
    API 限制：每次最多 10,000 条，body < 100MB
    """
    api_token = os.environ.get("CF_API_TOKEN") or os.environ.get("CLOUDFLARE_API_TOKEN")
    if not api_token:
        print("❌  CF_API_TOKEN 环境变量未设置")
        print("   设置方法：")
        print("   - PowerShell: $env:CF_API_TOKEN = 'your-token'")
        print("   - 或在 Cloudflare Dashboard → API Tokens 创建（Workers KV Storage 权限）")
        return

    if not BULK_PATH.exists():
        print("❌  bulk JSON 文件不存在，请先运行 --generate")
        return

    bulk = load_json(BULK_PATH)
    if not bulk:
        print("❌  bulk JSON 为空")
        return

    print(f"📤  通过 API 导入 {len(bulk)} 条记录到 KV...")

    req = urllib.request.Request(
        CF_BULK_URL,
        data=json.dumps(bulk, ensure_ascii=False).encode('utf-8'),
        headers={
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        },
        method="PUT",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            if result.get("success"):
                print(f"✅  KV 导入成功！")
            else:
                errors = result.get("errors", [])
                print(f"❌  KV 导入失败: {errors}")
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f"❌  HTTP {e.code}: {body[:500]}")
    except Exception as e:
        print(f"❌  请求失败: {e}")


def show_stats():
    """显示当前 KV 导入状态"""
    config = load_json(CONFIG_PATH)
    cards = config.get("cards", [])
    with_seo = sum(1 for c in cards if c.get("seo"))
    print(f"📊  KV 导入状态：")
    print(f"   总卡片数: {len(cards)}")
    print(f"   有 SEO 数据: {with_seo}")
    print(f"   待导入: {with_seo}")
    if BULK_PATH.exists():
        bulk = load_json(BULK_PATH)
        print(f"   bulk 文件已生成: {len(bulk)} 条记录")
    else:
        print(f"   bulk 文件未生成")


def main():
    parser = argparse.ArgumentParser(description="SendAFun KV SEO 数据导入工具")
    parser.add_argument("--generate", action="store_true", help="生成 bulk JSON 文件")
    parser.add_argument("--import", action="store_true", dest="do_import", help="通过 API 导入 KV")
    parser.add_argument("--stats", action="store_true", help="显示导入状态")
    args = parser.parse_args()

    if args.stats:
        show_stats()
    elif args.do_import:
        # 先确保 bulk 文件存在
        if not BULK_PATH.exists():
            generate_bulk_json()
        import_via_api()
    elif args.generate:
        generate_bulk_json()
    else:
        # 默认：生成 + 显示状态
        generate_bulk_json()
        show_stats()


if __name__ == "__main__":
    main()
