#!/usr/bin/env python3
"""
SendAFun — generate-seo.py (V2)
为每张卡片生成 SEO 字段（Title / Description / OG / Intro Text）

修复：不再使用随机 audience 和模板拼接，改为：
- title: "Free {Card Name} — Send a Personalized Ecard Online | SendAFun"
- description: 150字符内，含 card/ecard 关键词
- h1: "Send a {Card Name} Online"
- intro_text: 4段，含长尾关键词和 FAQ

读取：source/cards-config.json
输出：为每张卡片写入 seo 字段

用法：
  python generate-seo.py               # 增量：只处理没有 seo 字段的卡片
  python generate-seo.py --force       # 强制重新生成所有
  python generate-seo.py --sample=N    # 只处理前 N 张（测试用）
"""

import json, random, os, sys
from pathlib import Path

ROOT       = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / 'source' / 'cards-config.json'
TAGS_PATH   = ROOT / 'source' / 'pexels-tags.json'
OG_DIR      = ROOT / 'dist' / 'images' / 'og'
R2_PUBLIC   = 'https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev'

def load_json(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def generate_seo(card, pexels_tags=None):
    """V2: 语义化 SEO 生成，不再随机拼接"""
    card_title = card.get('title', 'Greeting Card')
    category = card.get('category', 'greeting')

    # Extract key terms from card title (remove "Card", "for X" etc.)
    name_parts = card_title.replace(' Card', '').replace(' card', '').strip()
    # Clean up "for Mom/Dad/etc" suffix for title
    base_name = name_parts

    # Build proper SEO title: "Free {Card Name} — Send a Personalized Ecard Online | SendAFun"
    seo_title = f"Free {card_title} — Send a Personalized Ecard Online | SendAFun"

    # Description (140-155 chars, must include "ecard" or "greeting card")
    desc_templates = [
        f"Send a personalized {card_title.lower()} online. Add your message, choose fonts & colors, preview free. Send instantly for just $1.99. No signup needed.",
        f"Create and send a beautiful {card_title.lower()} in minutes. Fully customizable text, fonts, and colors. Free preview. Only $1.99 to send.",
        f"Looking for a {card_title.lower()}? Personalize with your own message, pick fonts & colors, and send instantly. Free preview, $1.99 per card.",
    ]
    seo_desc = random.choice(desc_templates)[:155]

    # H1: "Send a {Card Name} Online"
    h1 = f"Send a {card_title} Online"

    # Keywords: combine card title words + category + SEO terms
    title_words = card_title.lower().replace(' card', '').replace(' for ', ' ').split()
    keywords = []
    for w in title_words:
        if w not in keywords and len(w) > 2:
            keywords.append(w)
    keywords.extend([
        f"{base_name.lower()} ecard",
        "send greeting card online",
        "personalized ecard",
        "free greeting card"
    ])
    # Deduplicate
    seen = set()
    keywords = [k for k in keywords if not (k in seen or seen.add(k))]

    # Intro Text: 4 paragraphs with real keywords
    intro_text = (
        f"Looking for the perfect {card_title.lower()}? You've found it. "
        f"Our {base_name.lower()} ecard is beautifully designed, fully customizable, and ready to send in under 2 minutes. "
        f"Add your own personal message, choose from a variety of fonts and colors, preview your card for free, "
        f"and send it instantly to any email address. No signup, no subscription required.\n\n"
        f"Unlike paper greeting cards that take days to arrive and cost a fortune in postage, "
        f"a personalized {card_title.lower()} from SendAFun arrives in seconds. "
        f"Whether you're sending a birthday ecard across the country, a thank you card across the street, "
        f"or a just-because greeting to brighten someone's day, your thoughtful words make all the difference.\n\n"
        f"Each {card_title.lower()} is crafted by professional designers with attention to typography, "
        f"color harmony, and visual balance. Your personal message is the star — we provide the beautiful canvas. "
        f"Preview your card as many times as you want, make adjustments until it's perfect, then send.\n\n"
        f"Send a single personalized ecard for just $1.99, or subscribe to our all-access plan at $6.99/month "
        f"for unlimited cards. Every card includes free preview, full customization, and instant email delivery. "
        f"FAQ: Is it really free to preview? Yes, always. Can I change my message after sending? "
        f"Preview carefully before sending — once delivered, the card is final. "
        f"Do you store my recipient's email? Never. Your privacy matters."
    )

    return {
        "title": seo_title,
        "description": seo_desc,
        "og_image": f"{card['slug']}-og.webp",
        "keywords": keywords[:10],
        "h1": h1,
        "intro_text": intro_text,
    }

def main():
    force = '--force' in sys.argv
    sample_n = None
    for arg in sys.argv:
        if arg.startswith('--sample='):
            sample_n = int(arg.split('=')[1])

    config = load_json(CONFIG_PATH)
    cards = config.get('cards', [])
    if not cards:
        print("No cards found in cards-config.json")
        return

    tags_map = load_json(TAGS_PATH)
    to_process = []
    used_titles = set()

    for i, card in enumerate(cards):
        if sample_n and i >= sample_n:
            break
        if not force and card.get('seo'):
            used_titles.add(card['seo'].get('title', ''))
            continue
        to_process.append((i, card))

    if not to_process:
        print("All cards already have SEO fields. Use --force to regenerate.")
        return

    print(f"Generating SEO for {len(to_process)} cards...")

    for idx, (i, card) in enumerate(to_process):
        # Check if this card already has hand-crafted SEO (skip if so)
        seo = generate_seo(card, tags_map.get(card['slug'], []))
        # Ensure unique title
        while seo['title'] in used_titles:
            seo = generate_seo(card, tags_map.get(card['slug'], []))
        used_titles.add(seo['title'])
        cards[i]['seo'] = seo

        if (idx + 1) % 10 == 0:
            print(f"  ... {idx + 1}/{len(to_process)} done")

    config['cards'] = cards
    save_json(CONFIG_PATH, config)
    print(f"Saved SEO fields for {len(to_process)} cards to {CONFIG_PATH.name}")

    # Also write standalone SEO file
    seo_only = {c['slug']: c['seo'] for c in cards if c.get('seo')}
    seo_path = ROOT / 'source' / 'cards-seo.json'
    save_json(seo_path, seo_only)
    print(f"Saved SEO data to {seo_path.name} ({len(seo_only)} records)")

if __name__ == '__main__':
    main()
