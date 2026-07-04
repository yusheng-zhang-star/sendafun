#!/usr/bin/env python3
"""Fix SendAFun category pages with complete SEO tags."""
import json, os, re
from pathlib import Path

ROOT = Path(r'E:\网站项目\sendafun')
CONFIG_PATH = ROOT / 'source' / 'cards-config.json'
CAT_DIR = ROOT / 'dist' / 'category'
SITE_URL = 'https://sendafun.com'

CATEGORY_META = {
    'birthday': {
        'title': 'Free Birthday Ecards — Send Personalized Birthday Greeting Cards Online | SendAFun',
        'desc': 'Browse our collection of beautiful birthday ecards. Send a personalized birthday card to mom, dad, friends, and family. Free preview, only $1.99 to send. Instant delivery.',
        'keywords': 'birthday cards, birthday ecards, free birthday card, send birthday card online, personalized birthday card, happy birthday ecard, birthday greeting cards',
        'h1': 'Birthday Cards — Send a Personalized Birthday Ecard',
        'intro': 'Celebrate their special day with a personalized birthday ecard from SendAFun. Our collection of birthday greeting cards features beautiful designs for every relationship — from mom and dad to best friends and colleagues. Each birthday card is fully customizable: write your own message, pick from elegant fonts and colors, and preview your creation for free. Send instantly to any email inbox for just $1.99.',
    },
    'anniversary': {
        'title': 'Free Anniversary Ecards — Send Romantic Personalized Greeting Cards | SendAFun',
        'desc': 'Browse romantic anniversary ecards. Send a personalized anniversary card to your wife, husband, or partner. Free preview, customize your message, only $1.99 to send instantly.',
        'keywords': 'anniversary cards, anniversary ecards, romantic anniversary card, send anniversary card online, personalized anniversary card, wedding anniversary ecard, anniversary greeting cards',
        'h1': 'Anniversary Cards — Send a Romantic Anniversary Ecard',
        'intro': 'Make your anniversary unforgettable with a personalized ecard from SendAFun. Our romantic anniversary cards let you express your love in your own words — with beautiful designs, custom fonts, and your choice of colors. Preview as many times as you want for free, then send instantly for $1.99. Whether it\'s your first anniversary or your fiftieth, a personalized greeting card says it best.',
    },
    'love': {
        'title': 'Free Love Ecards — Send Romantic Personalized Greeting Cards Online | SendAFun',
        'desc': 'Send a romantic love ecard to your partner. Browse our collection of love cards — fully customizable with your message, fonts & colors. Free preview, $1.99 to send instantly.',
        'keywords': 'love cards, love ecards, romantic ecard, send love card online, personalized love card, valentine ecard, romantic greeting cards',
        'h1': 'Love Cards — Send a Romantic Love Ecard Online',
        'intro': 'Say "I love you" with a personalized love card from SendAFun. Whether it\'s Valentine\'s Day, an anniversary, or just because, our romantic ecards are the perfect way to express your feelings. Customize your message, choose from romantic fonts and soft colors, preview for free, and send instantly — all in under 2 minutes.',
    },
    'congratulations': {
        'title': 'Free Congratulations Ecards — Send Personalized Congrats Cards Online | SendAFun',
        'desc': 'Browse congratulations ecards for every achievement. Send a personalized congrats card for graduation, new job, retirement, and more. Free preview, $1.99 to send instantly.',
        'keywords': 'congratulations cards, congrats ecards, congratulations greeting card, send congratulations card online, personalized congrats card, graduation card, retirement card',
        'h1': 'Congratulations Cards — Send a Personalized Congrats Ecard',
        'intro': 'Celebrate every achievement with a personalized congratulations ecard from SendAFun. From graduations and new jobs to retirements and promotions, our congratulatory cards let you share your pride in their accomplishment. Customize your message, pick celebratory fonts and colors, preview free, and send instantly for $1.99.',
    },
    'encouragement': {
        'title': 'Free Encouragement Ecards — Send Personalized Cheer Up Cards Online | SendAFun',
        'desc': 'Send an uplifting encouragement ecard to a friend. Browse our cheer up cards — customizable message, cheerful designs, instant delivery. Free preview, $1.99 to send.',
        'keywords': 'encouragement cards, cheer up cards, encouragement ecards, send encouragement card online, personalized cheer up card, supportive greeting card, best friend card',
        'h1': 'Encouragement Cards — Send a Cheer Up Ecard Online',
        'intro': 'Everyone needs a pick-me-up sometimes. Send an encouragement ecard from SendAFun and brighten someone\'s day instantly. Our cheer up cards are fully customizable — write a supportive message, choose uplifting fonts and colors, preview free, and send for $1.99. Whether they\'re having a rough week or need motivation, your personalized card will remind them someone cares.',
    },
    'miss-you': {
        'title': 'Free Thinking of You Ecards — Send Personalized Miss You Cards Online | SendAFun',
        'desc': 'Send a warm thinking of you ecard online. Browse our miss you cards — customizable message, warm designs, instant delivery. Free preview, $1.99 to send.',
        'keywords': 'thinking of you cards, miss you cards, thinking of you ecards, send miss you card online, personalized thinking of you card, family greeting card, grandma card',
        'h1': 'Thinking of You Cards — Send a Miss You Ecard Online',
        'intro': 'Distance doesn\'t mean they\'re not in your heart. Send a thinking of you ecard from SendAFun and bridge the miles with your personal message. Our miss you cards feature warm, loving designs that let you express exactly how you feel. Customize the message, font, and color, preview for free, and send instantly for $1.99.',
    },
    'new-baby': {
        'title': 'Free New Baby Ecards — Send Personalized Welcome Baby Cards Online | SendAFun',
        'desc': 'Send a cheerful welcome baby ecard online. Browse new baby cards for boys and girls — customizable message, adorable designs, instant delivery. Free preview, $1.99.',
        'keywords': 'new baby cards, baby ecards, welcome baby card, send baby card online, personalized baby card, newborn congratulations card, baby shower card',
        'h1': 'New Baby Cards — Send a Welcome Baby Ecard Online',
        'intro': 'Celebrate the new arrival with a personalized welcome baby ecard from SendAFun. Our new baby cards are cheerful, adorable, and fully customizable — write your congratulations message, pick playful fonts and colors, preview free, and send instantly for $1.99. Perfect for baby showers, birth announcements, or welcoming the little one home.',
    },
    'sympathy': {
        'title': 'Free Sympathy Ecards — Send Personalized Condolences Cards Online | SendAFun',
        'desc': 'Send a respectful sympathy ecard with your condolences online. Calm, thoughtful designs. Customize your message, preview free, send for $1.99. Express your support with grace.',
        'keywords': 'sympathy cards, condolences cards, sympathy ecards, send sympathy card online, personalized sympathy card, condolence greeting card, bereavement card',
        'h1': 'Sympathy Cards — Send a Condolences Ecard Online',
        'intro': 'Express your support during a difficult time with a personalized sympathy ecard from SendAFun. Our condolences cards feature calm, respectful designs that let your message of comfort take center stage. Write from the heart, choose gentle fonts and understated colors, preview free, and send instantly for $1.99.',
    },
    'thanks': {
        'title': 'Free Thank You Ecards — Send Personalized Gratitude Cards Online | SendAFun',
        'desc': 'Send a heartfelt thank you ecard online. Browse gratitude cards — customizable message, cheerful designs, instant delivery. Free preview, $1.99 to send. Show your appreciation.',
        'keywords': 'thank you cards, thank you ecards, gratitude cards, send thank you card online, personalized thank you card, appreciation card, grateful greeting card',
        'h1': 'Thank You Cards — Send a Personalized Thank You Ecard',
        'intro': 'Show your gratitude with a personalized thank you ecard from SendAFun. Whether it\'s for a friend who helped you move, a colleague who went above and beyond, or a family member who\'s always there — our thank you cards let you express your appreciation in your own words. Customize, preview free, and send for $1.99.',
    },
    'wellness': {
        'title': 'Free Get Well Soon Ecards — Send Personalized Wellness Cards Online | SendAFun',
        'desc': 'Send a thoughtful get well soon ecard online. Browse wellness cards — healing messages, calming designs, instant delivery. Free preview, $1.99 to send. Brighten their recovery.',
        'keywords': 'get well soon cards, get well ecards, wellness cards, send get well card online, personalized get well card, healing card, recovery card',
        'h1': 'Get Well Soon Cards — Send a Personalized Get Well Ecard',
        'intro': 'Send healing wishes with a personalized get well soon ecard from SendAFun. Our wellness cards feature calming designs that are perfect for letting someone know you\'re thinking of them during recovery. Customize your message with soothing fonts and gentle colors, preview free, and send instantly for $1.99.',
    },
}

def fix_category(cat_slug, meta):
    file_path = CAT_DIR / f'{cat_slug}.html'
    if not file_path.exists():
        print(f'  ⚠️  Not found: {file_path}')
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        html = f.read()

    cat_url = f'{SITE_URL}/category/{cat_slug}'

    # Build the complete <head> replacement
    new_head = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{meta['title']}</title>
<meta name="description" content="{meta['desc']}">
<meta name="keywords" content="{meta['keywords']}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="{cat_url}">
<meta property="og:title" content="{meta['title']}">
<meta property="og:description" content="{meta['desc']}">
<meta property="og:url" content="{cat_url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SendAFun">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{meta['title']}">
<meta name="twitter:description" content="{meta['desc']}">
<meta name="theme-color" content="#1a1a2e">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "{meta['h1']}",
  "description": "{meta['desc']}",
  "url": "{cat_url}",
  "isPartOf": {{
    "@type": "WebSite",
    "name": "SendAFun",
    "url": "{SITE_URL}"
  }}
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{"@type": "ListItem", "position": 1, "name": "Home", "item": "{SITE_URL}"}},
    {{"@type": "ListItem", "position": 2, "name": "{meta['h1']}", "item": "{cat_url}"}}
  ]
}}
</script>
'''

    # Replace everything from <!DOCTYPE to <style> or <link after head
    # Find the first <style> or <link after <head>
    style_match = re.search(r'<style>|<link\s+rel="preconnect"', html)
    if style_match:
        # Keep everything from the first <style> or <link onward
        remaining = html[style_match.start():]
        html = new_head + remaining
    else:
        # Fallback: just replace up to </head>
        head_end = html.find('</head>')
        if head_end != -1:
            html = new_head + html[head_end:]

    # Replace H1
    html = re.sub(
        r'<h1>.*?</h1>',
        f'<h1>{meta["h1"]}</h1>',
        html,
        count=1
    )

    # Add intro text after H1
    intro_html = f'\n<div class="page-subtitle">{meta["intro"]}</div>'
    if '<div class="page-subtitle">' not in html:
        html = html.replace(
            '</h1>',
            f'</h1>{intro_html}',
            1
        )

    # Fix logo from "SmartCards" to "SendAFun"
    html = html.replace('SmartCards', 'SendAFun')
    html = html.replace('smartcards', 'sendafun')

    # Write
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f'  ✅ {cat_slug}.html')


def main():
    print('📝 Fixing category pages...')
    for slug, meta in CATEGORY_META.items():
        fix_category(slug, meta)
    print(f'\n✅ Fixed {len(CATEGORY_META)} category pages')

if __name__ == '__main__':
    main()
