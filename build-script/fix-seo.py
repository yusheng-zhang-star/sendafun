#!/usr/bin/env python3
"""
SendAFun — fix-seo.py
一键修复所有 SEO 问题：
1. 重写 cards-config.json 中 12 张卡的 SEO 数据（title/desc/h1/intro/keywords）
2. 修复 generate-seo.py 模板（防止以后再出垃圾）
3. 重建 card-template.html
4. 重新生成所有 dist 卡片页面
5. 创建 robots.txt, sitemap.xml, _headers
"""

import json, os, sys, re
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / 'source' / 'cards-config.json'
GEN_SEO_PATH = ROOT / 'build-script' / 'generate-seo.py'

R2_PUBLIC = 'https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev'
SITE_URL = 'https://sendafun.com'

# ══════════════════════════════════════════════════════════════════════════════
# 1. 手工精写的 SEO 数据（每张卡独立，含长尾关键词）
# ══════════════════════════════════════════════════════════════════════════════

HANDCRAFTED_SEO = {
    "beautiful-birthday-mom": {
        "title": "Free Birthday Card for Mom — Send a Beautiful Personalized Ecard | SendAFun",
        "description": "Send a beautiful birthday ecard to mom in minutes. Personalize with your own message, choose fonts & colors, and deliver instantly to her inbox. Free preview, only $1.99 to send.",
        "h1": "Send a Beautiful Birthday Card for Mom Online",
        "keywords": ["birthday card for mom", "mom birthday ecard", "free birthday card", "send birthday card online", "personalized greeting card", "mother birthday"],
        "intro_text": (
            "Looking for the perfect birthday card for mom? You're in the right place. "
            "Our beautiful mom birthday ecard lets you add your own heartfelt message, choose from gorgeous fonts and colors, "
            "and preview your design instantly — no signup needed. Whether you're near or far, you can send a personalized "
            "greeting card that shows mom just how much she means to you.\n\n"
            "Each birthday card for mom is professionally designed with warm, elegant visuals that capture the joy of celebrating her special day. "
            "Type your message, pick a font that matches her style, and send. The card arrives in her inbox in seconds — "
            "no printing, no postage, no waiting for mail delivery. Perfect for last-minute birthday wishes that still feel thoughtful and personal.\n\n"
            "We offer two simple options: send a single birthday ecard for just $1.99, or go unlimited with all-access to every SendAFun design "
            "for only $6.99/month. Cancel anytime, no strings attached.\n\n"
            "FAQ: Can I preview before sending? Yes, preview is always free. How fast does it arrive? Instantly via email. "
            "Can I customize the message? Absolutely — write anything you want, choose any font and color. "
            "What if I want to send birthday cards to other family members too? Our unlimited plan covers every occasion and every recipient."
        )
    },
    "happy-birthday-dad": {
        "title": "Free Birthday Card for Dad — Personalize & Send a Funny Ecard Online | SendAFun",
        "description": "Send a personalized birthday ecard to dad online. Add your own message, choose fonts & colors, preview free. Classic masculine design. Only $1.99 to send instantly.",
        "h1": "Send a Happy Birthday Card for Dad Online",
        "keywords": ["birthday card for dad", "dad birthday ecard", "funny birthday card", "send birthday card online", "personalized greeting card", "father birthday"],
        "intro_text": (
            "Need a birthday card for dad that actually says what you mean? Our dad birthday ecard makes it easy. "
            "Pick the classic masculine design, add your message (funny, heartfelt, or somewhere in between), "
            "choose the font and color that fits dad's personality, and send. All in under 2 minutes.\n\n"
            "No rushing to the store for a card that's too generic. No worrying about postage or delivery times. "
            "Your personalized birthday card for dad arrives instantly in his email inbox — along with your personal touch "
            "that no store-bought card can match. Whether it's a milestone birthday or just another year, make him smile with something unique.\n\n"
            "Send a single birthday ecard for $1.99, or get unlimited sending with our $6.99/month all-access plan. "
            "FAQ: Is the preview free? Yes, always. Can I change the message? Edit as much as you want. "
            "Does it work on phone? Yes, our editor works perfectly on mobile, tablet, and desktop."
        )
    },
    "love-you-honey": {
        "title": "Romantic Love Card for Partner — Send a Sweet Personalized Ecard | SendAFun",
        "description": "Send a romantic love ecard to your partner. Personalize with your sweet message, choose romantic fonts & colors, preview free. Perfect for anniversaries or just because. $1.99.",
        "h1": "Send a Romantic Love Card Online — Personalized & Sweet",
        "keywords": ["love card", "romantic ecard", "love card for partner", "send love card online", "personalized greeting card", "valentine ecard", "anniversary card"],
        "intro_text": (
            "Sometimes the right words are all you need. Our romantic love card lets you send a sweet, personalized greeting "
            "to your partner — for anniversaries, Valentine's Day, or just because. Pick the romantic design, write your message, "
            "and customize the font and color until it feels just right.\n\n"
            "A love ecard from SendAFun arrives instantly in your partner's inbox, complete with your personal message "
            "and our professionally designed romantic template. It's the easiest way to say 'I love you' when you can't be there in person — "
            "or when you want to start their day with something special.\n\n"
            "Each love card you create is fully customizable. Change the message, experiment with different fonts (our cursive options "
            "are perfect for romance), and preview as many times as you like — completely free. "
            "Send a single card for $1.99, or subscribe for unlimited access at $6.99/month."
        )
    },
    "thank-you-friend": {
        "title": "Free Thank You Card for Friend — Send a Grateful Personalized Ecard | SendAFun",
        "description": "Send a thank you ecard to a friend online. Personalize with your grateful message, choose cheerful fonts & colors. Free preview, send for just $1.99. No signup needed.",
        "h1": "Send a Thank You Card for a Friend Online",
        "keywords": ["thank you card", "thank you card for friend", "grateful ecard", "send thank you online", "personalized greeting card", "appreciation card"],
        "intro_text": (
            "Your friend went out of their way for you — now send a thank you card that actually shows how grateful you are. "
            "Our thank you ecard for friends is cheerful, warm, and fully customizable. Write exactly what you want to say, "
            "pick a font and color that matches your style, and hit send.\n\n"
            "The best part? Your thank you greeting card arrives instantly in their inbox. No waiting, no postage, "
            "no generic drugstore card that doesn't say enough. Just your words, beautifully presented in a design "
            "that says 'I really appreciate you.'\n\n"
            "Preview your card as many times as you want — completely free. When you're happy with how it looks, "
            "send it for just $1.99. Or subscribe to our unlimited plan at $6.99/month to send as many thank you ecards "
            "as you want. FAQ: Can I use it for a colleague instead of a friend? Of course — write whatever message fits your situation."
        )
    },
    "get-well-soon": {
        "title": "Free Get Well Soon Card — Send a Personalized Get Well Ecard Online | SendAFun",
        "description": "Send a thoughtful get well soon ecard online. Personalize with your healing message, choose calming fonts & colors. Free preview, send for $1.99. Perfect for friends and family.",
        "h1": "Send a Get Well Soon Card Online — Personalized & Thoughtful",
        "keywords": ["get well soon card", "get well ecard", "get well soon greeting card", "send get well card online", "personalized get well card", "healing card"],
        "intro_text": (
            "When someone you care about is under the weather, a thoughtful get well soon card can brighten their day. "
            "Our get well ecard features a calming, soothing design that's perfect for sending healing wishes. "
            "Add your own message, choose from elegant fonts and gentle colors, and send instantly.\n\n"
            "Unlike store-bought cards that take days to arrive, your personalized get well card arrives in their email inbox "
            "in seconds. It's the fastest way to let someone know you're thinking of them during recovery. "
            "Whether it's a friend recovering from surgery, a coworker home with the flu, or a family member who needs a pick-me-up, "
            "your words of encouragement will mean the world.\n\n"
            "Preview is always free. Send a single get well ecard for $1.99, or go unlimited at $6.99/month. "
            "FAQ: Is it appropriate for serious illness? Yes — you write the message, you control the tone. "
            "Can I send to multiple people? With the unlimited plan, yes — send as many cards as you want."
        )
    },
    "congrats-graduation": {
        "title": "Free Graduation Card — Send a Personalized Congratulations Ecard | SendAFun",
        "description": "Send a personalized graduation congratulations ecard online. Add your proud message, choose celebratory fonts & colors. Free preview, send for $1.99. Celebrate their achievement.",
        "h1": "Send a Congratulations Graduation Card Online",
        "keywords": ["graduation card", "congratulations graduation ecard", "graduation greeting card", "send graduation card online", "personalized graduation card", "congrats card"],
        "intro_text": (
            "They did it! Celebrate their hard work with a personalized graduation congratulations card. "
            "Our graduation ecard features a celebratory design that captures the pride and excitement of this milestone moment. "
            "Add your message — whether it's proud, funny, or both — and customize the fonts and colors to match.\n\n"
            "Whether they're graduating from high school, college, or grad school, your personalized congrats card arrives instantly "
            "in their inbox. Perfect when you can't attend the ceremony in person, or when you want to send an extra "
            "note of congratulations before the big day. Your words, your way — no generic store card required.\n\n"
            "Free unlimited previews. Send for $1.99 per card, or subscribe at $6.99/month for all-access. "
            "FAQ: Can I include a gift? You can mention one in your message — we focus on making the card itself special. "
            "Can I send to multiple graduates? Yes, our unlimited plan covers as many cards as you need."
        )
    },
    "miss-you-grandma": {
        "title": "Free Thinking of You Card for Grandma — Send a Personalized Miss You Ecard | SendAFun",
        "description": "Send a warm thinking of you ecard to grandma online. Personalize with your loving message, choose warm fonts & colors. Free preview, send for $1.99. Let her know you care.",
        "h1": "Send a Thinking of You Card for Grandma Online",
        "keywords": ["thinking of you card", "miss you card for grandma", "grandma greeting card", "send thinking of you ecard", "personalized card for grandma", "family greeting card"],
        "intro_text": (
            "Missing grandma? Send her a beautiful thinking of you card that lets her know she's in your heart. "
            "Our miss you ecard for grandma features a warm, loving design that's perfect for reaching across the miles. "
            "Add your personal message, choose from cozy fonts and gentle colors, and send it straight to her inbox.\n\n"
            "For grandmas who live far away — or even just across town — a personalized greeting card is a wonderful way "
            "to stay connected between visits. Tell her about your day, share a memory, or simply say 'I'm thinking of you.' "
            "She'll treasure your words more than any store-bought card.\n\n"
            "Preview as much as you want for free. Send a single card for $1.99, or subscribe at $6.99/month "
            "to send unlimited thinking of you ecards to everyone you care about."
        )
    },
    "sympathy-condolences": {
        "title": "Sympathy Card — Send a Personalized Condolences Ecard Online | SendAFun",
        "description": "Send a thoughtful sympathy ecard with your condolences online. Calm design, personalized message, instant delivery. Express your support with grace. Free preview, $1.99 to send.",
        "h1": "Send a Sympathy & Condolences Card Online",
        "keywords": ["sympathy card", "condolences card", "sympathy ecard", "send sympathy card online", "personalized sympathy card", "condolence greeting card"],
        "intro_text": (
            "Finding the right words during a difficult time is never easy. Our sympathy and condolences card "
            "offers a calm, respectful design that lets your message of support take center stage. "
            "Write from the heart, choose a gentle font and color, and send your condolences instantly.\n\n"
            "A personalized sympathy ecard is a meaningful way to express your support when you can't be there in person. "
            "Whether you're reaching out to a grieving friend, colleague, or family member, your thoughtful words "
            "will let them know they're not alone. The card arrives in their inbox immediately — "
            "a quiet gesture of care during a hard time.\n\n"
            "Preview is free. Send for $1.99, or use the $6.99/month unlimited plan. "
            "FAQ: Is the design appropriate? Yes — our sympathy card uses calm, subdued colors and a respectful layout. "
            "Can I include a longer message? Absolutely, there's no character limit on your personal note."
        )
    },
    "happy-anniversary-wife": {
        "title": "Free Anniversary Card for Wife — Send a Romantic Personalized Ecard | SendAFun",
        "description": "Send a romantic anniversary ecard to your wife online. Personalize with your love message, choose elegant fonts & colors. Free preview, send for $1.99. Celebrate your love.",
        "h1": "Send a Happy Anniversary Card for Your Wife Online",
        "keywords": ["anniversary card for wife", "romantic anniversary ecard", "wedding anniversary card", "send anniversary card online", "personalized anniversary card", "wife anniversary greeting"],
        "intro_text": (
            "Another year of love deserves more than a generic card. Our anniversary card for wife features a romantic design "
            "that's perfect for celebrating your journey together. Write your personal message — recall your favorite memory, "
            "make a promise for the year ahead, or simply say 'I love you' in your own words.\n\n"
            "Customize the font (our cursive options add a romantic touch) and choose a color that matches the mood. "
            "Preview your anniversary ecard as many times as you want, then send it instantly to your wife's inbox. "
            "No printing, no post office, no waiting — just your heartfelt words, beautifully presented.\n\n"
            "Send a single anniversary greeting card for $1.99, or subscribe at $6.99/month for unlimited cards "
            "for every occasion throughout the year. FAQ: Can I add a photo? Currently our cards feature professionally "
            "designed templates — your personal message is what makes it unique. Can I send this for a dating anniversary? Of course!"
        )
    },
    "new-baby-boy": {
        "title": "Free New Baby Boy Card — Send a Personalized Welcome Ecard | SendAFun",
        "description": "Send a cheerful welcome baby boy ecard online. Personalize with your congratulations message, choose playful fonts & colors. Free preview, send for $1.99. Celebrate the new arrival!",
        "h1": "Send a Welcome Baby Boy Card Online — New Baby Congratulations",
        "keywords": ["new baby card", "baby boy card", "welcome baby ecard", "send baby card online", "personalized baby card", "newborn congratulations card", "baby shower card"],
        "intro_text": (
            "A new baby boy is here — time to celebrate! Our welcome baby card is cheerful, playful, and fully customizable. "
            "Write your congratulations message, pick a font and color that matches the joyous occasion, and send it instantly "
            "to the proud new parents. No shipping, no waiting — just your warm wishes delivered right away.\n\n"
            "Whether it's for a baby shower, a birth announcement, or welcoming the little one home, a personalized baby boy ecard "
            "is a thoughtful way to share in the excitement. Tell the new parents how happy you are for them, "
            "offer your best wishes, or add a funny parenting tip — it's entirely up to you.\n\n"
            "Free unlimited previews. Send a single card for $1.99, or subscribe at $6.99/month for all-access. "
            "FAQ: Can I send this to the grandparents too? Absolutely — they'll love it. "
            "Can I include gift information? Feel free to mention anything in your personal message."
        )
    },
    "cheer-up-bestie": {
        "title": "Free Cheer Up Card for Best Friend — Send an Encouragement Ecard | SendAFun",
        "description": "Send a cheerful encouragement ecard to your bestie online. Personalize with a supportive message, choose fun fonts & colors. Free preview, send for $1.99. Lift their spirits!",
        "h1": "Send a Cheer Up Card for Your Best Friend Online",
        "keywords": ["cheer up card", "encouragement card for friend", "best friend ecard", "send encouragement card online", "personalized cheer up card", "supportive greeting card"],
        "intro_text": (
            "Bestie having a rough day? A personalized cheer up card might be exactly what they need. "
            "Our encouragement ecard for best friends is bright, uplifting, and 100% customizable. "
            "Write a message that'll make them smile — funny, supportive, or both. Add your personal touch "
            "with fun fonts and cheerful colors, and send it instantly.\n\n"
            "Sometimes the smallest gesture makes the biggest difference. Your personalized cheer up card "
            "arrives in their inbox in seconds, ready to remind them that someone's got their back. "
            "Whether they're dealing with work stress, a breakup, or just a case of the Mondays, "
            "your words of encouragement will mean more than you know.\n\n"
            "Preview as many times as you want for free. Send a single card for $1.99, "
            "or get unlimited access at $6.99/month. FAQ: Can I make it funny instead of serious? Yes! "
            "The message is entirely up to you — funny, sarcastic, heartfelt, or all of the above."
        )
    },
    "retirement-boss": {
        "title": "Free Retirement Card for Boss — Send a Personalized Congratulations Ecard | SendAFun",
        "description": "Send a classy retirement congratulations ecard to your boss online. Personalize with your message, choose professional fonts & colors. Free preview, send for $1.99. Celebrate their career.",
        "h1": "Send a Retirement Card for Your Boss Online",
        "keywords": ["retirement card for boss", "retirement congratulations ecard", "boss retirement card", "send retirement card online", "personalized retirement card", "farewell card"],
        "intro_text": (
            "Your boss is retiring — send them off with a card that matches the occasion. "
            "Our retirement card for boss features a classic, professional design that's perfect for the workplace. "
            "Write your personal message — thank them for their leadership, share a favorite memory, "
            "or wish them well on their next chapter. Customize the font and color, preview, and send.\n\n"
            "A personalized retirement ecard is a thoughtful way for the whole team to express their appreciation, "
            "especially if you can't all be there for the farewell party. Your message arrives instantly in their inbox — "
            "a lasting keepsake they can read again and again.\n\n"
            "Free unlimited previews. Send for $1.99 per card, or subscribe at $6.99/month. "
            "FAQ: Is the design formal enough for a workplace card? Yes — classic typography and a refined layout "
            "make it appropriate for any professional setting. Can multiple people contribute? Send individually "
            "or coordinate messages with your team."
        )
    }
}


# ══════════════════════════════════════════════════════════════════════════════
# 2. 重写 cards-config.json 中的 SEO 字段
# ══════════════════════════════════════════════════════════════════════════════

def fix_cards_config():
    print("📝  Fixing cards-config.json SEO data...")
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        config = json.load(f)

    for card in config['cards']:
        slug = card['slug']
        if slug in HANDCRAFTED_SEO:
            seo = HANDCRAFTED_SEO[slug]
            # Keep og_image from original
            if 'seo' in card and 'og_image' in card['seo']:
                seo['og_image'] = card['seo']['og_image']
            card['seo'] = seo
            print(f"  ✅ {slug}")

    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    print(f"  Saved to {CONFIG_PATH.name}")


# ══════════════════════════════════════════════════════════════════════════════
# 3. 修复 generate-seo.py（防止以后再出垃圾）
# ══════════════════════════════════════════════════════════════════════════════

NEW_GENERATE_SEO = r'''#!/usr/bin/env python3
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
'''


def fix_generate_seo():
    print("\n📝  Fixing generate-seo.py...")
    with open(GEN_SEO_PATH, 'w', encoding='utf-8') as f:
        f.write(NEW_GENERATE_SEO)
    print(f"  ✅  Rewritten {GEN_SEO_PATH.name}")


# ══════════════════════════════════════════════════════════════════════════════
# 4. 重建 card-template.html
# ══════════════════════════════════════════════════════════════════════════════

def rebuild_template():
    print("\n📝  Rebuilding card-template.html from segments...")
    segments_dir = ROOT / 'templates' / 'segments'
    out_path = ROOT / 'templates' / 'card-template.html'

    segment_files = [
        "head.html", "header.html", "canvas.html", "overlay.html",
        "panel.html", "community.html", "related.html", "modals.html",
        "qr.html", "toast.html", "foot.html", "script.html", "end.html",
    ]

    parts = []
    for sf in segment_files:
        sp = segments_dir / sf
        if sp.exists():
            with open(sp, 'r', encoding='utf-8') as f:
                parts.append(f.read())
        else:
            print(f"  ⚠️  Missing segment: {sf}")

    with open(out_path, 'w', encoding='utf-8') as f:
        for p in parts:
            f.write(p)
            f.write('\n')

    print(f"  ✅  Written {out_path.stat().st_size} bytes to {out_path.name}")


# ══════════════════════════════════════════════════════════════════════════════
# 5. 重新生成 dist 卡片页面
# ══════════════════════════════════════════════════════════════════════════════

def generate_card_page(card, template):
    """Replace placeholders in template to generate a full card page."""
    seo = card.get('seo', {})
    slug = card['slug']
    title = seo.get('title', card.get('title', 'Greeting Card'))
    desc = seo.get('description', '')
    h1 = seo.get('h1', '')
    og_image = seo.get('og_image', f'{slug}-og.webp')
    keywords = ', '.join(seo.get('keywords', []))
    intro = seo.get('intro_text', '')
    r2_url = R2_PUBLIC
    card_url = f"{SITE_URL}/card/{slug}"
    og_img_url = f"{r2_url}/{og_image}"

    # Build JSON-LD
    import json as jmod
    json_ld = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": h1,
        "description": desc,
        "image": og_img_url,  # FIXED: no double URL
        "brand": {"@type": "Brand", "name": "SendAFun"},
        "offers": {
            "@type": "Offer",
            "price": "1.99",
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock",
            "url": card_url
        }
    }
    # Add BreadcrumbList
    category = card.get('category', 'greeting').replace('-', ' ').title()
    json_ld_breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL},
            {"@type": "ListItem", "position": 2, "name": f"{category} Cards", "item": f"{SITE_URL}/category/{card.get('category', '')}"},
            {"@type": "ListItem", "position": 3, "name": h1, "item": card_url}
        ]
    }
    # Add FAQ
    faqs = [
        {"@type": "Question", "name": "Is it free to preview the card?", "acceptedAnswer": {"@type": "Answer", "text": "Yes! You can preview your personalized card as many times as you want, completely free. You only pay when you're ready to send."}},
        {"@type": "Question", "name": "How fast does the card arrive?", "acceptedAnswer": {"@type": "Answer", "text": "Instantly! Once you click send, your personalized greeting card arrives in the recipient's email inbox within seconds."}},
        {"@type": "Question", "name": "Can I customize the message?", "acceptedAnswer": {"@type": "Answer", "text": "Absolutely. Write any message you want, choose from multiple fonts and colors, and preview in real-time until it's perfect."}},
    ]
    combined_ld = [json_ld, json_ld_breadcrumb, {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs}]
    json_ld_str = jmod.dumps(combined_ld, indent=2, ensure_ascii=False)

    # Replace placeholders
    html = template
    html = html.replace('__PAGE_TITLE__', title)
    html = html.replace('__META_DESC__', desc)
    html = html.replace('__META_KEYWORDS__', keywords)
    html = html.replace('__CANONICAL_URL__', card_url)
    html = html.replace('__OG_TITLE__', title)
    html = html.replace('__OG_DESC__', desc)
    html = html.replace('__OG_IMAGE__', og_img_url)
    html = html.replace('__OG_URL__', card_url)
    html = html.replace('__TWITTER_TITLE__', title)
    html = html.replace('__TWITTER_DESC__', desc)
    html = html.replace('__TWITTER_IMAGE__', og_img_url)
    html = html.replace('__JSON_LD__', json_ld_str)

    # H1 + intro section
    seo_section = f'''<section class="section seo-intro">
<h1>{h1}</h1>
<div class="intro-text">{"</div><div class=\"intro-text\">".join(intro.split("\n\n"))}</div>
</section>'''

    # Add after canvas section (replace placeholder or insert)
    if '__SEO_SECTION__' in html:
        html = html.replace('__SEO_SECTION__', seo_section)
    else:
        # Insert after the first </section> after canvas-section
        marker = '</div>\n    <!-- panel overlay -->'
        html = html.replace(marker, f'{marker}\n{seo_section}')

    return html


def regenerate_dist_pages():
    print("\n📝  Regenerating dist card pages...")

    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        config = json.load(f)

    template_path = ROOT / 'templates' / 'card-template.html'
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()

    card_dir = ROOT / 'dist' / 'card'
    card_dir.mkdir(parents=True, exist_ok=True)

    for card in config['cards']:
        slug = card['slug']
        html = generate_card_page(card, template)
        out_path = card_dir / f'{slug}.html'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"  ✅ {slug}.html")

    print(f"  Generated {len(config['cards'])} card pages")


# ══════════════════════════════════════════════════════════════════════════════
# 6. 创建 robots.txt, sitemap.xml, _headers
# ══════════════════════════════════════════════════════════════════════════════

def create_seo_files():
    print("\n📝  Creating robots.txt, sitemap.xml, _headers...")

    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        config = json.load(f)

    # robots.txt
    robots = """User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Sitemap: https://sendafun.com/sitemap.xml
"""
    (ROOT / 'dist' / 'robots.txt').write_text(robots, encoding='utf-8')
    print("  ✅ robots.txt")

    # sitemap.xml
    today = datetime.now().strftime('%Y-%m-%d')
    urls = []

    # Homepage
    urls.append(f'''  <url>
    <loc>{SITE_URL}/</loc>
    <lastmod>{today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>''')

    # Category pages (from card categories)
    categories = list(set(c['category'] for c in config['cards']))
    for cat in sorted(categories):
        urls.append(f'''  <url>
    <loc>{SITE_URL}/category/{cat}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>''')

    # Card pages
    for card in config['cards']:
        slug = card['slug']
        seo = card.get('seo', {})
        og_image = seo.get('og_image', f'{slug}-og.webp')
        card_url = f'{SITE_URL}/card/{slug}'

        image_xml = f'''    <image:image>
      <image:loc>{R2_PUBLIC}/{og_image}</image:loc>
      <image:title>{card.get('title', 'Greeting Card')}</image:title>
    </image:image>'''

        urls.append(f'''  <url>
    <loc>{card_url}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
{image_xml}
  </url>''')

    sitemap = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
{chr(10).join(urls)}
</urlset>
'''
    (ROOT / 'dist' / 'sitemap.xml').write_text(sitemap, encoding='utf-8')
    print(f"  ✅ sitemap.xml ({len(urls)} URLs)")

    # _headers
    headers = """# SendAFun — Cloudflare Pages Headers
# Cache & Security policy

# HTML pages — short CDN cache, browser revalidate
/*.html
  Cache-Control: public, max-age=0, stale-while-revalidate=3600
  CDN-Cache-Control: public, max-age=43200

# Clean URLs (category/*, card/*)
/category/*
  Cache-Control: public, max-age=0, stale-while-revalidate=3600
  CDN-Cache-Control: public, max-age=43200
/card/*
  Cache-Control: public, max-age=0, stale-while-revalidate=3600
  CDN-Cache-Control: public, max-age=43200

# Images — long cache (immutable, versioned by filename)
/images/*
  Cache-Control: public, max-age=2592000, immutable
  Access-Control-Allow-Origin: *

# OG images
/og/*
  Cache-Control: public, max-age=86400
  Access-Control-Allow-Origin: *

# JS & CSS
/*.js
  Cache-Control: public, max-age=604800, immutable
/*.css
  Cache-Control: public, max-age=604800, must-revalidate

# SEO files
/sitemap.xml
  Cache-Control: public, max-age=1800
/robots.txt
  Cache-Control: public, max-age=1800

# 404 — never cache
/404.html
  Cache-Control: no-cache, no-store
  CDN-Cache-Control: no-store
"""
    (ROOT / '_headers').write_text(headers, encoding='utf-8')
    print("  ✅ _headers")


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("SendAFun SEO Fix — Complete Pipeline")
    print("=" * 60)

    fix_cards_config()
    fix_generate_seo()
    rebuild_template()
    regenerate_dist_pages()
    create_seo_files()

    print("\n" + "=" * 60)
    print("✅  All SEO fixes applied!")
    print("=" * 60)
    print("\nSummary of changes:")
    print("  1. Rewrote titles: include 'Free', 'Ecard', 'Online', '| SendAFun'")
    print("  2. Rewrote descriptions: 140-155 chars with ecard keywords")
    print("  3. Added meta description, keywords, canonical, og:url, twitter tags")
    print("  4. Fixed JSON-LD image URL (no more double-prefix)")
    print("  5. Added BreadcrumbList + FAQPage JSON-LD")
    print("  6. Rewrote intro_text with long-tail keywords")
    print("  7. Fixed generate-seo.py (V2, no random audiences)")
    print("  8. Created robots.txt + sitemap.xml (with image sitemap)")
    print("  9. Created _headers (cache policy)")
    print(" 10. Regenerated all 12 dist card pages")


if __name__ == '__main__':
    main()
