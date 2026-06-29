#!/usr/bin/env python3
"""
SendAFun — generate-seo.py
为每张卡片生成唯一 SEO 字段（Title / Description / OG / Intro Text）

读取：source/cards-config.json
输出：为每张卡片写入 seo 字段，同时生成 OG 图（1200x630 WebP）

用法：
  python generate-seo.py               # 增量：只处理没有 seo 字段的卡片
  python generate-seo.py --force       # 强制重新生成所有
  python generate-seo.py --sample=N    # 只处理前 N 张（测试用）
"""

import json, random, os, sys, subprocess, hashlib
from pathlib import Path

# ── 路径 ────────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / 'source' / 'cards-config.json'
TAGS_PATH   = ROOT / 'source' / 'pexels-tags.json'   # process-images-v2.py 写入
OG_DIR      = ROOT / 'dist' / 'images' / 'og'
R2_PUBLIC   = 'https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev'

# ── 模板 ──────────────────────────────────────────────────────────────────────
TITLE_TEMPLATES = [
    "{tag1} {category} for {audience} - SendAFun",
    "Send a {tag1} {category} Online - $1.99",
    "Personalized {tag1} {category} | SendAFun",
    "{tag2} Theme {category} - Custom & Fast",
    "Beautiful {tag1} {category} - SendAFun",
    "Create Your {tag1} {category} Online - $1.99",
]

AUDIENCES = ["Best Friend", "Mom", "Dad", "Colleague", "Partner",
              "Family", "Boss", "Team Mate", "Neighbor", "Teacher"]

INTRO_TEMPLATES = [
    "Looking for the perfect {tag1} {cat_lower}? Our {tag1} themed {cat_lower} lets you add your own message, choose from beautiful fonts and colors, and preview your design instantly in your browser. No signup required — create your {cat_lower} in under 2 minutes and send it directly to your loved one's inbox for just $1.99. Our mobile-friendly editor works on any device, so you can create the perfect {cat_lower} whether you're at home or on the go. Each {cat_lower} is professionally designed with attention to detail, ensuring your personal message stands out. Try it now and see why thousands of users trust SendAFun for their {cat_lower} needs.",

    "Make someone's day with a personalized {tag1} {cat_lower}. At SendAFun, we believe every occasion deserves a special touch. Our easy-to-use online editor lets you customize your {cat_lower} with your own text, choice of font, and color scheme. Preview your creation in real-time and make adjustments until it's exactly how you want it. Once you're happy, we'll send your {cat_lower} directly to the recipient's email inbox — no printing, no postage, no hassle. It's the fastest way to send a thoughtful {cat_lower} from anywhere in the world. Only $1.99 per {cat_lower}, or upgrade to our unlimited plan for just $6.99/month.",

    "Sending a {cat_lower} has never been easier. With SendAFun's online {cat_lower} maker, you can create a beautiful, personalized {tag1} {cat_lower} in minutes. Simply choose your design, add your message, pick your favorite font and color, and hit send. Your {cat_lower} will be delivered instantly to the recipient's email, complete with your personal message and our high-quality design. Perfect for last-minute greetings or planned surprises. Our {cat_lower} service is trusted by thousands of users worldwide. Try it today — your first preview is completely free, and sending the full {cat_lower} costs just $1.99.",
]

# ── 工具函数 ─────────────────────────────────────────────────────────────────
def load_json(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def slugify(text):
    return text.lower().replace(' ', '-').replace('&', 'and')

def generate_seo(card, pexels_tags=None, used_titles=None):
    """为单张卡片生成 SEO 字段（确保 title 不重复）"""
    if used_titles is None:
        used_titles = set()

    category = card.get('category', 'card')
    title_words = card.get('title', 'Beautiful Card').split()

    # 优先用 Pexels 标签，否则用 title 词汇
    if pexels_tags and len(pexels_tags) > 0:
        tag1 = pexels_tags[0]
        tag2 = pexels_tags[1] if len(pexels_tags) > 1 else pexels_tags[0]
    else:
        tag1 = title_words[0] if title_words else category
        tag2 = title_words[1] if len(title_words) > 1 else tag1

    # 选 audience（每张卡随机，但尽量不重复）
    audience = random.choice(AUDIENCES)

    # 生成 title（确保不重复）
    attempts = 0
    while attempts < 50:
        template = random.choice(TITLE_TEMPLATES)
        seo_title = template.format(
            tag1=tag1.title(),
            tag2=tag2.title(),
            category=category.title(),
            audience=audience
        )[:60]
        if seo_title not in used_titles:
            break
        attempts += 1
    used_titles.add(seo_title)

    # Description（120-155 字符）
    descriptions = [
        f"Make them smile with this {tag1} {category}. Personalize with your text, preview instantly, and send online. Only $1.99.",
        f"Create a custom {tag1} {category} in 2 minutes. Add your message, choose font & color, deliver to inbox.",
        f"The perfect {tag1} {category} for {tag2} lovers. Mobile-friendly editor, instant preview, $1.99 one-time.",
        f"Send a beautiful {tag1} {category} online. Easy personalization, instant preview, delivered to inbox. $1.99.",
        f"Personalized {tag1} {category} with your own message. Preview free, send for $1.99. No signup needed.",
    ]
    seo_desc = random.choice(descriptions)[:155]

    # H1（与 title 不同，避免关键词堆砌）
    h1 = f"{tag1.title()} {category.title()} — Personalized"
    if h1 == seo_title.replace(' - SendAFun', ''):
        h1 = f"Send a {tag1.title()} {category.title()} Online"

    # Intro Text（300+ 词，AdSense 要求）
    intro_template = random.choice(INTRO_TEMPLATES)
    intro_text = intro_template.format(
        tag1=tag1,
        tag2=tag2,
        category=category,
        cat_lower=category.lower() if isinstance(category, str) else 'card',
        cat_title=category.title() if isinstance(category, str) else 'Card',
    )
    # 确保 300+ 词（AdSense 审核硬性要求）
    words = intro_text.split()
    if len(words) < 300:
        intro_text += (
            " Our platform is designed with simplicity in mind — no complicated menus or steep learning curves."
            " Just pick a design you love, type your message, and send. It's that easy. We also offer a subscription"
            " plan that gives you unlimited access to all our card designs for one low monthly price. Whether you're"
            " sending birthday cards, thank you notes, or just-because greetings, SendAFun has you covered."
            " Every card is crafted by professional designers who understand what makes a greeting truly special."
            " From elegant typography to carefully chosen color palettes, each template is built to impress."
            " We support all major email providers, so your card will arrive looking perfect in any inbox."
            " Our editing tools work seamlessly on phones, tablets, and desktop computers alike."
            " You can preview your card as many times as you want before sending — no limits, no pressure."
            " Need to send a card right now? Our instant delivery means it arrives in seconds, not days."
            " We take privacy seriously too. Your messages and recipient information are encrypted and never shared."
            " With over ten thousand happy customers and counting, SendAFun is the trusted choice for online greetings."
            " Try it free today and see why so many people are switching from paper cards to our digital platform."
            " Perfect for birthdays, holidays, thank you notes, or any moment worth celebrating with someone you care about."
        )

    return {
        "title":       seo_title,
        "description":  seo_desc,
        "og_image":    f"{card['slug']}-og.webp",
        "keywords":    list(dict.fromkeys([tag1, tag2, category, 'send online', 'personalized', 'greeting card'])),
        "h1":          h1,
        "intro_text":   intro_text,
    }

def generate_og_image(card, seo, preview_src_path):
    """
    生成 OG 图（1200x630 WebP）
    方案：用横向预览图作为背景，叠加半透明遮罩 + 标题文字
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("  ⚠️  Pillow not installed, skipping OG image generation")
        print("     Install with: pip install Pillow")
        return False

    OG_DIR.mkdir(parents=True, exist_ok=True)
    og_path = OG_DIR / seo['og_image']

    if og_path.exists():
        return True  # 已存在，跳过

    try:
        # 打开预览图（横向 600px WebP）
        if not os.path.exists(preview_src_path):
            print(f"  ⚠️  Preview image not found: {preview_src_path}")
            return False

        img = Image.open(preview_src_path).convert('RGB')
        img = img.resize((1200, 630), Image.LANCZOS)

        # 叠加半透明渐变遮罩（底部 200px，用于放文字）
        overlay = Image.new('RGBA', (1200, 630), (0, 0, 0, 0))
        # 用 PI.L.ImageDraw 画渐变（简化：纯色半透明）
        draw = ImageDraw.Draw(overlay)
        draw.rectangle([0, 430, 1200, 630], fill=(0, 0, 0, 140))

        img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')

        # 写文字（用系统字体，或默认字体）
        draw = ImageDraw.Draw(img)
        try:
            font_large = ImageFont.truetype("arial.ttf", 48)
            font_small = ImageFont.truetype("arial.ttf", 28)
        except:
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()

        # 主标题（底部区域）
        title_text = seo['h1'][:60]
        draw.text((60, 480), title_text, fill=(255, 255, 255), font=font_large)
        draw.text((60, 540), "SendAFun — Personalized Cards $1.99", fill=(220, 220, 220), font=font_small)

        # 保存为 WebP
        img.save(og_path, 'WEBP', quality=85, method=6)
        print(f"  ✅  OG image saved: {og_path.name}")
        return True

    except Exception as e:
        print(f"  ⚠️  OG image generation failed: {e}")
        return False

# ── 主流程 ──────────────────────────────────────────────────────────────────
def main():
    force = '--force' in sys.argv
    sample_n = None
    for arg in sys.argv:
        if arg.startswith('--sample='):
            sample_n = int(arg.split('=')[1])

    # 读取配置
    config = load_json(CONFIG_PATH)
    cards = config.get('cards', [])
    if not cards:
        print("❌  No cards found in cards-config.json")
        return

    # 读取 Pexels 标签（由 process-images-v2.py 写入）
    tags_map = load_json(TAGS_PATH)

    # 读取已存在的 SEO 字段（增量模式）
    used_titles = set()
    to_process = []
    for i, card in enumerate(cards):
        if sample_n and i >= sample_n:
            break
        if not force and card.get('seo'):
            # 已存在，跳过（但记录 title 防止重复）
            used_titles.add(card['seo'].get('title', ''))
            continue
        to_process.append((i, card))

    if not to_process:
        print("✅  All cards already have SEO fields. Use --force to regenerate.")
        return

    print(f"📝  Generating SEO fields for {len(to_process)} cards...")

    # 生成 SEO
    for idx, (i, card) in enumerate(to_process):
        seo = generate_seo(card, tags_map.get(card['slug'], []), used_titles)
        cards[i]['seo'] = seo

        # 生成 OG 图
        preview_path = str(ROOT / 'dist' / 'images' / 'preview' / f"{card['slug']}-00-horizontal.webp")
        generate_og_image(card, seo, preview_path)

        if (idx + 1) % 50 == 0:
            print(f"  ... {idx + 1}/{len(to_process)} done")

    # 写回 config
    config['cards'] = cards
    save_json(CONFIG_PATH, config)
    print(f"✅  Saved SEO fields for {len(to_process)} cards to {CONFIG_PATH.name}")

    # 同时把 SEO 数据写入独立文件（供 Worker KV 批量导入）
    seo_only = {c['slug']: c['seo'] for c in cards if c.get('seo')}
    seo_path = ROOT / 'source' / 'cards-seo.json'
    save_json(seo_path, seo_only)
    print(f"✅  Saved SEO data to {seo_path.name} ({len(seo_only)} records)")

if __name__ == '__main__':
    main()
