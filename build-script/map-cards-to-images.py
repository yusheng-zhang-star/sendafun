#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SendAFun — map-cards-to-images.py (v2)
扫描 source/images 下所有 R2 已上传素材，为每套唯一图片生成一张卡片配置。
输出 cards-config.json（唯一配置源）和 card-image-mapping.json。
"""

import json
import os
import re
import html
import ssl
import hmac
import hashlib
import datetime
import urllib.request
import urllib.parse
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "source" / "images"
CONFIG_PATH = ROOT / "source" / "cards-config.json"
MAPPING_PATH = ROOT / "source" / "card-image-mapping.json"

# ── 读取 .env（纯内置库，零依赖） ─────────────────────────────────────────
def load_env(p):
    if not p.exists(): return {}
    env = {}
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        k = k.strip(); v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'): v = v[1:-1]
        env[k] = v
        os.environ.setdefault(k, v)
    return env

ENV = load_env(ROOT / ".env")
R2_CDN = (ENV.get("R2_PUBLIC_URL")
          or os.environ.get("R2_PUBLIC_URL")
          or "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev").rstrip("/")
ACCOUNT = (ENV.get("CLOUDFLARE_ACCOUNT_ID") or os.environ.get("CLOUDFLARE_ACCOUNT_ID") or "")
AK = (ENV.get("R2_ACCESS_KEY_ID") or os.environ.get("R2_ACCESS_KEY_ID") or "")
SK = (ENV.get("R2_SECRET_ACCESS_KEY") or os.environ.get("R2_SECRET_ACCESS_KEY") or "")
REGION = (ENV.get("R2_REGION") or os.environ.get("R2_REGION") or "wnam")
PREVIEW_BUCKET = (ENV.get("R2_PREVIEW_BUCKET") or os.environ.get("R2_PREVIEW_BUCKET") or "sendafun-preview")

# ── 每个分类最多取多少张卡（None = 用满 R2 桶里所有可用素材） ─────────────
PER_CATEGORY = None   # 改成具体数字比如 50 可以限制每分类最多 50 张
                      # None = 直接用桶里实际存在的上限 → 总计 ~3548 张卡

# ── S3 列出 R2 桶全部对象（支持分页，1000×N） ─────────────────────────────
def _sign(k, m): return hmac.new(k, m.encode("utf-8"), hashlib.sha256).digest()

def list_r2_keys(bucket):
    """Return every key in an R2 bucket using AWS SigV4 signed requests."""
    if not (ACCOUNT and AK and SK):
        print("[WARN] R2 credentials missing in .env; aborting R2 scan.")
        return []
    all_keys = []
    ct = None
    while True:
        q = {"list-type": "2", "max-keys": "1000"}
        if ct: q["continuation-token"] = ct
        amz_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        ds = amz_date[:8]
        host = f"{ACCOUNT}.r2.cloudflarestorage.com"
        canonical_uri = f"/{bucket}/"
        qp = sorted(q.items())
        enc_q = "&".join(f"{urllib.parse.quote(str(k), safe='')}={urllib.parse.quote(str(v), safe='')}" for k, v in qp)
        payload_hash = hashlib.sha256(b"").hexdigest()
        ch = (f"host:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n")
        sh = "host;x-amz-content-sha256;x-amz-date"
        cr = f"GET\n{canonical_uri}\n{enc_q}\n{ch}\n{sh}\n{payload_hash}"
        scope = f"{ds}/{REGION}/s3/aws4_request"
        sts = f"AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{hashlib.sha256(cr.encode('utf-8')).hexdigest()}"
        k_date    = _sign(("AWS4" + SK).encode("utf-8"), ds)
        k_region  = _sign(k_date, REGION)
        k_service = _sign(k_region, "s3")
        k_signing = _sign(k_service, "aws4_request")
        signature = hmac.new(k_signing, sts.encode("utf-8"), hashlib.sha256).hexdigest()
        auth = (f"AWS4-HMAC-SHA256 Credential={AK}/{ds}/{REGION}/s3/aws4_request, "
                f"SignedHeaders={sh}, Signature={signature}")
        url = f"https://{host}/{bucket}/?{enc_q}"
        req = urllib.request.Request(url, headers={
            "Host": host, "x-amz-content-sha256": payload_hash,
            "x-amz-date": amz_date, "Authorization": auth,
        }, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=30, context=ssl.create_default_context()) as r:
                xml = r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            print(f"  [ERROR] R2 list {bucket}: HTTP {e.code} {e.reason}")
            print(e.read().decode("utf-8", errors="replace")[:500])
            break
        i = 0
        while True:
            s = xml.find("<Key>", i)
            if s < 0: break
            e = xml.find("</Key>", s)
            all_keys.append(xml[s + 5:e])
            i = e + 1
        tk_s = xml.find("<NextContinuationToken>")
        if tk_s < 0: break
        tk_e = xml.find("</NextContinuationToken>", tk_s)
        ct = xml[tk_s + len("<NextContinuationToken>"):tk_e]
    return all_keys

CATEGORY_TEMPLATES = {
    "birthday": {
        "display_name": "Birthday",
        "styles": ["warm", "classic", "cheerful", "elegant", "playful"],
        "fonts": ["'Playfair Display', serif", "'Montserrat', sans-serif", "'Caveat', cursive", "'Inter', sans-serif"],
        "colors": ["#2d6a4f", "#1a365d", "#744210", "#9b2c2c", "#b83280", "#2b6cb0"],
        "filters": ["warm", "classic", "cheerful", "soft", "vibrant"],
        "titles": [
            "Happy Birthday Card — Personalized Wishes",
            "Beautiful Birthday Greeting Card Online",
            "Send a Birthday Card With Your Custom Message",
            "Warm Birthday Wish Card for Someone Special",
            "Elegant Birthday Ecard — Customize & Send",
            "Playful Birthday Card for a Fun Celebration",
            "Classic Birthday Card — Personalize Instantly",
            "Cheerful Birthday Wishes Ecard Online",
            "Heartfelt Birthday Card You Can Customize",
            "Stylish Birthday Ecard for Any Recipient",
            "Colorful Birthday Card — Personalize Free",
            "Modern Birthday Wish Card to Send Online",
            "Lovely Birthday Ecard — Your Message Inside",
            "Thoughtful Birthday Card for a Special Day",
            "Vibrant Birthday Celebration Card Online",
            "Sweet Birthday Wishes Card — Send Instantly",
            "Premium Birthday Ecard With Custom Text",
            "Joyful Birthday Card for Any Age",
            "Warmest Birthday Wishes — Personalized Ecard",
            "Special Birthday Card Designed to Surprise",
        ],
        "default_texts": [
            "Hope your birthday is filled with love, laughter, and everything that makes you smile. 🎉❤️",
            "Wishing you the happiest of birthdays and a wonderful year ahead. You deserve it all! 🎂✨",
            "Another trip around the sun, and you're still amazing. Happy birthday! 🥳🌟",
            "Celebrating you today and every day. Happy birthday to someone truly special. 🎈💕",
            "May your birthday be as wonderful, bright, and beautiful as you are. Happy birthday! 🌸🎁",
            "Sending you the biggest birthday hug and warmest wishes. Have an amazing day! 🤗🎊",
            "Today is your day — shine bright, laugh loud, and enjoy every moment. Happy birthday! ⭐🎉",
            "You make the world a better place just by being in it. Happy birthday! 💖🎂",
            "Wishing you endless happiness, love, and cake on your special day. Happy birthday! 🎉🍰",
            "May this birthday bring you all the joy your heart can hold. Cheers to you! 🥂🎈",
            "Happy birthday! Thank you for being such a wonderful person in my life. 💝✨",
            "Here's to another year of amazing memories and beautiful dreams. Happy birthday! 🎊🌟",
            "Your birthday is the perfect excuse to tell you how much you mean to me. Love you! 💗🎁",
            "Celebrating the amazing person you are today. Happy birthday with all my heart. 💞🎉",
            "May all your birthday wishes come true. You deserve every bit of happiness. 🌟🎂",
            "Happy birthday to someone who makes every day brighter. Sending all my love! ☀️💕",
            "Another year of being fantastic. Keep shining — the world needs your light. 💫🎈",
            "Warm wishes on your birthday. May your year ahead be filled with beautiful surprises. 🎁✨",
            "To the best [recipient] ever — have the best birthday ever. You earned it! 🥳🎊",
            "Birthdays come and go, but people like you stay in our hearts forever. Happy birthday! 💖🎉",
        ],
        "tags_variants": [
            ["warm", "love", "celebration"],
            ["classic", "cheerful", "elegant"],
            ["fun", "playful", "joyful"],
            ["heartfelt", "sweet", "caring"],
            ["modern", "stylish", "vibrant"],
        ],
    },
    "love": {
        "display_name": "Love",
        "styles": ["romantic", "sweet", "warm", "elegant", "tender"],
        "fonts": ["'Dancing Script', cursive", "'Playfair Display', serif", "'Caveat', cursive", "'Inter', sans-serif"],
        "colors": ["#9b2c2c", "#c53030", "#b83280", "#d53f8c", "#742a2a"],
        "filters": ["romantic", "soft", "warm", "dreamy", "classic"],
        "titles": [
            "Romantic Love Card for Someone Special",
            "Sweet 'I Love You' Ecard — Personalize & Send",
            "Send a Love Card With Your Heartfelt Message",
            "Tender Love Ecard for Your Partner",
            "Romantic Greeting Card — Express Your Love",
            "Beautiful Love Card for Him or Her Online",
            "From the Heart — Custom Love Note Ecard",
            "Love You More Than Words Ecard",
            "Classic Romantic Card to Send Online",
            "Warm Love Card for Your Soulmate",
            "Sweetest Love Ecard — Your Message Inside",
            "Elegant Love Note Card for Any Occasion",
            "Just Because I Love You Ecard Online",
            "Forever Yours — Romantic Greeting Card",
            "You & Me — Personalized Love Card",
            "All My Love — Custom Ecard for Your Love",
            "My Heart Belongs to You — Love Card",
            "Always & Forever — Romantic Ecard Online",
            "Thinking of You With Love — Sweet Card",
            "A Thousand Times 'I Love You' Card",
        ],
        "default_texts": [
            "Every love story is beautiful, but ours is my favorite. I love you more than words. 💕",
            "You are my today and all of my tomorrows. Forever and always, I love you. 💖",
            "In a world full of billions, my heart chose you. And I'd choose you again and again. 💗",
            "I love you — not only for what you are, but for what I am when I'm with you. 💞",
            "You're the best thing that ever happened to me. My heart is yours, always and forever. 💓",
            "Just a little reminder: you are loved, you are cherished, you are everything to me. 💝",
            "I fall in love with you more every single day. Thank you for being mine. 💘",
            "My heart calls yours 'home.' I love you more with every beat. 💕✨",
            "You're my sunshine on a rainy day, my calm in every storm. I love you always. ☀️💖",
            "Words would never be enough to tell you how much I love you. But I'll keep trying. 💗",
            "From the moment I met you, I knew you were the one. I love you, always. 💞",
            "If I had a flower for every time you made me smile, I'd have an endless garden. 💐💕",
            "I love the way you laugh, the way you care, the way you're you. I love everything. 💖",
            "You are my favorite notification, my happiest thought, my safest place. I love you. 💗",
            "Loving you is the easiest and most beautiful thing I've ever done. Always yours. 💞",
            "To the world you may be one person, but to me you are the world. I love you. 🌍💕",
            "I love you — yesterday, today, tomorrow, and every day after that. Forever yours. 💖",
            "The best love is the kind that awakens the soul. That's what you do for me. 💗✨",
            "I choose you. And I'll choose you over and over and over. Without pause, without a doubt. 💞",
            "Every day with you is Valentine's Day. I love you more than yesterday, less than tomorrow. 💕",
        ],
        "tags_variants": [
            ["romantic", "partner", "valentine"],
            ["sweet", "love", "heartfelt"],
            ["soulmate", "tender", "forever"],
            ["romance", "passion", "warm"],
            ["elegant", "dreamy", "love"],
        ],
    },
    "thank-you": {
        "display_name": "Thank You",
        "styles": ["grateful", "cheerful", "warm", "elegant", "sincere"],
        "fonts": ["'Caveat', cursive", "'Inter', sans-serif", "'Playfair Display', serif", "'Montserrat', sans-serif"],
        "colors": ["#276749", "#2d6a4f", "#1a365d", "#5a67d8", "#2c5282"],
        "filters": ["cheerful", "warm", "soft", "classic", "bright"],
        "titles": [
            "Thank You Card — Send a Grateful Ecard Online",
            "Personalized 'Thank You' Greeting Card",
            "Show Your Gratitude With a Custom Thank You Card",
            "Sincere Thank You Ecard for Any Occasion",
            "Warm Thank You Card to Brighten Their Day",
            "Elegant Thank You Note — Customize & Send",
            "Heartfelt Thank You Ecard for Friends & Family",
            "Cheerful Thank You Card Online — Free Preview",
            "Grateful For You — Personalized Thanks Card",
            "Beautiful Thank You Note Ecard",
            "Say Thanks in Style — Custom Thank You Card",
            "Appreciation Thank You Ecard for Colleagues",
            "Thank You Kindly — Personalized Gratitude Card",
            "You're Amazing — Thank You Ecard Online",
            "Grateful Heart — Thank You Card to Send",
            "Warmest Thanks — Custom Thank You Ecard",
            "Simple Thank You — Personalized Greeting Card",
            "Meaningful Thank You — Your Own Words",
            "A Big Thank You — Custom Ecard Online",
            "So Very Thankful — Gratitude Ecard",
        ],
        "default_texts": [
            "Just wanted to say thank you — from the bottom of my heart. You're amazing. 💛🌟",
            "Thank you for everything you do. Your kindness means more than you'll ever know. 🙏💝",
            "I'm so grateful for you. Thank you for being such an incredible person. ✨💛",
            "You didn't have to, but I'm so glad you did. Thank you — it means the world to me. 🌍🙏",
            "Sending a huge thank you your way. You make everything better just by being you. 💖✨",
            "I don't say it enough, so I'm saying it now: thank you. For everything. Always. 💛",
            "Thank you for your kindness, your generosity, and your beautiful heart. 🙏💕",
            "A simple 'thank you' feels too small for all you've done. But it comes with all my heart. 💝",
            "You make my world a better place. Thank you for being in my life. 🌟🙏",
            "Thank you for being you — the wonderful, amazing, special person you are. 💛✨",
            "I appreciate you more than words can say. Thank you from the very bottom of my heart. 💙",
            "Whenever I think about the good things in my life, I think of you. Thank you. 💛",
            "You're one in a million, and I'm so grateful. Thank you for everything. 🙏🌟",
            "Thank you for showing up, for caring, for being exactly who you are. 💝✨",
            "My heart is full of gratitude for you. Thank you — for everything, big and small. 💛",
            "Some people make the world brighter just by being in it. You're one of them. Thank you. 🌟",
            "Thank you for your patience, your love, and your unwavering support. I'm so lucky. 💙🙏",
            "I want you to know how much I truly appreciate you. Thank you — today and always. 💛",
            "Grateful doesn't cover it. Blessed, lucky, and deeply thankful — that's how you make me feel. 🙏💝",
            "You deserve more than a thank you card. But it's a start. Thank you with all my heart. 💛✨",
        ],
        "tags_variants": [
            ["grateful", "thankful", "appreciation"],
            ["cheerful", "warm", "kindness"],
            ["sincere", "heartfelt", "genuine"],
            ["elegant", "classic", "gratitude"],
            ["friendly", "warm", "caring"],
        ],
    },
    "get-well": {
        "display_name": "Get Well",
        "styles": ["calm", "warm", "cheerful", "gentle", "hopeful"],
        "fonts": ["'Inter', sans-serif", "'Playfair Display', serif", "'Caveat', cursive", "'Montserrat', sans-serif"],
        "colors": ["#285e61", "#276749", "#2c5282", "#5a67d8", "#2d6a4f"],
        "filters": ["calm", "soft", "warm", "bright", "gentle"],
        "titles": [
            "Get Well Soon Card — Send Healing Wishes Online",
            "Personalized Get Well Ecard for a Speedy Recovery",
            "Warm Get Well Wishes — Custom Card Online",
            "Healing Thoughts — Get Well Soon Card",
            "Gentle Get Well Ecard for Friends & Family",
            "Feel Better Soon — Personalized Greeting Card",
            "Wishing You a Speedy Recovery — Get Well Card",
            "Comforting Get Well Soon Ecard Online",
            "Hope You're Feeling Better — Custom Card",
            "Warm & Cozy Get Well Wishes Card",
            "Sending Healing Vibes — Get Well Soon Ecard",
            "Rest & Recover — Personalized Get Well Card",
            "Thinking of You — Get Well Soon Card Online",
            "Bright Get Well Wishes for a Quick Recovery",
            "Healing Hugs — Personalized Get Well Ecard",
            "Strength & Love — Get Well Soon Card",
            "Get Well Wishes Wrapped in Love — Ecard",
            "Peaceful Recovery — Personalized Get Well Card",
            "Tender Get Well Soon Ecard to Send Online",
            "Warmest Recovery Wishes — Custom Card",
        ],
        "default_texts": [
            "Sending you healing thoughts, warm hugs, and wishes for a speedy recovery. Get well soon! 🌸💛",
            "Hope you're feeling better every day. Rest, relax, and let the healing begin. Love you! 🌿💙",
            "Wishing you strength, comfort, and a quick return to health. You're in my thoughts always. 💪💕",
            "Take it one day at a time. Sending you all my love and biggest get-well wishes. 💗✨",
            "Get well soon! The world is a brighter place with you in it, and we need you back. 🌞💛",
            "Healing takes time, and so does rest. Take all the time you need — I'm right here. 💙🌸",
            "Sending you oceans of love and mountains of strength. Feel better soon, dearest. 🌊💖",
            "Your body already knows how to heal. I'm just sending love and positive energy to help. ✨💛",
            "May your days ahead be filled with rest, warmth, and gentle healing. Get well soon. 🌿💙",
            "Thinking of you with every get-well wish I have. Take care, rest up, feel better. 💗🙏",
            "Get well soon! Miss your laugh, your smile, and your amazing presence. Come back to us soon. 😊💛",
            "Wishing you comfort on difficult days, smiles on sad days, and hope on every day. 🌸💕",
            "Recovery might feel slow, but every day you're one step closer to feeling like yourself again. 💙✨",
            "Sending warm soup, cozy blankets, and the biggest get-well hugs. Feel better soon! 🤗💛",
            "Take care of yourself first. Everything else can wait. Get well soon — with all my love. 💗🌸",
            "May your recovery be smooth, your spirits stay high, and your days be gentle. Get well. 💙🙏",
            "Just a little hello and a big get-well wish. You're stronger than you know. 💪✨💛",
            "Every day without you feeling well is one day too many. Sending healing — get better soon. 🌿💖",
            "Hope each new day finds you feeling stronger and brighter. Sending all my love. ☀️💗",
            "You're being so brave. Rest easy, heal well, and know I'm sending love every step of the way. 💙🌸",
        ],
        "tags_variants": [
            ["healing", "health", "recovery"],
            ["calm", "gentle", "warm"],
            ["hopeful", "strength", "comfort"],
            ["get-well", "cheerful", "support"],
            ["care", "love", "healing"],
        ],
    },
    "congratulations": {
        "display_name": "Congratulations",
        "styles": ["celebratory", "cheerful", "proud", "elegant", "joyful"],
        "fonts": ["'Playfair Display', serif", "'Montserrat', sans-serif", "'Caveat', cursive", "'Inter', sans-serif"],
        "colors": ["#744210", "#1a365d", "#2d6a4f", "#d69e2e", "#2b6cb0"],
        "filters": ["celebratory", "warm", "vibrant", "classic", "bright"],
        "titles": [
            "Congratulations Card — Celebrate Their Big Win",
            "Personalized Congrats Ecard for Any Achievement",
            "Proud of You — Custom Congratulations Card",
            "Celebrate With a Cheers — Congrats Ecard Online",
            "Huge Congratulations — Personalized Greeting",
            "Elegant Congratulations Card to Send Online",
            "Well Done You — Custom Congratulations Ecard",
            "Warm Congratulations on Your Achievement",
            "Cheers to Your Success — Congrats Card",
            "Woohoo! — Personalized Congratulations Card",
            "So Proud of You — Custom Congrats Ecard",
            "Big News, Big Congrats — Greeting Card Online",
            "You Earned It — Personalized Congratulations",
            "Bravo! — Custom Congrats Ecard to Send",
            "Amazing Achievement — Congratulations Card",
            "Hats Off to You — Congratulations Ecard",
            "What a Win! — Personalized Congrats Card",
            "Warmest Congratulations — Custom Greeting",
            "Be Proud — You Deserve This Congratulations Card",
            "Way to Go! — Custom Congratulations Ecard",
        ],
        "default_texts": [
            "Congratulations! Your hard work, dedication, and passion paid off. You deserve every bit of this. 🎉✨",
            "You did it! I'm so incredibly proud of you. This is just the beginning of all the amazing things ahead. 🌟🎊",
            "Huge congratulations on this wonderful achievement. Watching you succeed brings me so much joy. 🥳💛",
            "Cheers to you! You've earned this moment and then some. Enjoy every second — you deserve it. 🥂🎉",
            "Wow, I'm absolutely thrilled for you. Congratulations — this is well-deserved and long-awaited. 💖🎊",
            "You believed, you worked, you conquered. Congratulations — I knew you could do it all along. 💪✨",
            "What fantastic news! Sending you the biggest congratulations and the warmest wishes for what's next. 🎉🌟",
            "Bravo! You amaze me every single day. This achievement is no exception. So proud. 🏆💛",
            "Congratulations — you're officially unstoppable. This is just one of many wins in your future. 🚀🎊",
            "Screaming congratulations from the rooftops! You did it, and I could not be more proud. 🎉💙",
            "Some people dream of success — you woke up and worked for it. Congratulations! ☀️🏆",
            "Well done, you! This milestone is yours, and it's beautiful to witness. Celebrate big! 🥂✨",
            "Congratulations on crossing this finish line. Now, onto the next great adventure! 🎉🌟",
            "You turned 'someday' into 'today.' That takes courage. Congratulations, superstar! ⭐🎊",
            "Warmest congratulations on this exciting chapter. Your future has never looked brighter. ☀️💖",
            "I knew from the start you had it in you. Congratulations — you make us all so proud. 💛🏆",
            "Dreams + dedication = your reality today. Congratulations on making it happen! ✨🎉",
            "Pop the confetti, raise a glass — today we celebrate YOU. Massive congratulations! 🎊🥂",
            "Every late night, every early morning — it all led to this. Congratulations, champion! 🏆💪",
            "Congratulations! The best part is, you're just getting started. Excited for what's next. 🚀✨",
        ],
        "tags_variants": [
            ["celebration", "success", "proud"],
            ["cheerful", "win", "achievement"],
            ["milestone", "joyful", "congrats"],
            ["elegant", "proud", "success"],
            ["happy", "cheers", "celebratory"],
        ],
    },
    "missing-you": {
        "display_name": "Missing You",
        "styles": ["warm", "tender", "heartfelt", "soft", "loving"],
        "fonts": ["'Caveat', cursive", "'Dancing Script', cursive", "'Playfair Display', serif", "'Inter', sans-serif"],
        "colors": ["#b83280", "#5a67d8", "#d53f8c", "#2c5282", "#9b2c2c"],
        "filters": ["warm", "soft", "dreamy", "gentle", "romantic"],
        "titles": [
            "Missing You Card — Send Love Across the Miles",
            "Personalized 'I Miss You' Ecard Online",
            "Wish You Were Here — Custom Miss You Card",
            "Warm Thinking of You — Miss You Ecard",
            "Distance Means So Little When Someone Means So Much Card",
            "Tender Miss You Card for Family or Friends",
            "Counting Days Until We Meet Again Ecard",
            "My Heart Misses You — Custom Card Online",
            "So Far Away But Always Close — Miss You Card",
            "Miss Your Face — Personalized I Miss You Ecard",
            "You're Always in My Thoughts — Miss You Card",
            "A Little Note to Say I Miss You — Custom Ecard",
            "When Can I See You Again? — Miss You Card",
            "Hugs From Afar — Personalized Missing You Ecard",
            "My Day Feels Off Without You — Miss You Card",
            "The World Feels Too Big Without You — Ecard",
            "Just Because I Miss You — Custom Card",
            "You're Missed More Than Words — Ecard Online",
            "Come Back Soon — Personalized I Miss You Card",
            "Half of My Heart is With You — Miss You Ecard",
        ],
        "default_texts": [
            "Just sitting here thinking about you and missing you more than I can say. Come back soon. 💗🌙",
            "Missing you today, tomorrow, and all the days in between. Distance may separate us, but never my heart. 💙✨",
            "I miss your laugh, your smile, your voice, and your everything. When do I get to see you again? 😢💕",
            "You're not here, and every part of me feels it. Sending love and missing you like crazy. 💗🤗",
            "The world just isn't the same without you in it. Counting down the moments until we're together again. ⏳💙",
            "I didn't know how much I'd miss you until you were gone. Come home soon — my heart is waiting. 💗🏠",
            "Missing you is a gentle ache in my heart that never fully goes away. Love you always and forever. 💙🌙",
            "If I had a single flower for every time I thought about you, I could walk forever in my garden. 💐💕",
            "You're the first person I want to share good news with, and the first I run to when things are hard. I miss you. 💗",
            "Missing you isn't the hard part — it's knowing I can't hug you whenever I want that breaks my heart a little. 🤗💙",
            "Just a little 'I miss you' message from my heart to yours. We may be far, but you're so close in thought. 💕✨",
            "I see things everywhere that remind me of you. That's how I know you're always with me. Still miss you though. 😊💗",
            "Life's just a little less bright, laughter a little less loud, and days a little less fun when you're not around. 💙",
            "You're probably busy living your best life — just wanted to say I'm over here missing you like crazy. 😘💕",
            "Come back soon. My couch, my kitchen, my days, and my heart all have a 'missing you' shaped hole. 🛋️💗",
            "I thought I was busy enough to forget to miss you. Turns out, I'm busy but still missing you all the time. 💙✨",
            "Missing someone is your heart's way of reminding you that you love them. Consider this your reminder. 💗💕",
            "There's a hole in my day shaped exactly like you. Hurry home and fill it. I miss you more than words. 💙🚗",
            "Wish I could teleport you here right now. We'd hug, we'd talk, we'd laugh, and I'd finally feel complete again. 💗🤗",
            "Every 'good morning' text I don't get and every 'good night' call that doesn't come — that's all I miss about you. 💙🌙",
        ],
        "tags_variants": [
            ["miss-you", "long-distance", "love"],
            ["tender", "warm", "family"],
            ["heartfelt", "friends", "thinking-of-you"],
            ["hugs", "come-back", "missing"],
            ["romantic", "gentle", "distance"],
        ],
    },
    "sympathy": {
        "display_name": "Sympathy",
        "styles": ["calm", "gentle", "respectful", "soft", "peaceful"],
        "fonts": ["'Inter', sans-serif", "'Playfair Display', serif", "'Montserrat', sans-serif"],
        "colors": ["#4a5568", "#2d3748", "#1a202c", "#2c5282", "#285e61"],
        "filters": ["calm", "soft", "gentle", "peaceful", "warm"],
        "titles": [
            "Sympathy Card — Send Comforting Condolences",
            "Personalized Condolences Ecard With Love",
            "With Deepest Sympathy — Custom Card Online",
            "Peaceful Sympathy Card for Grieving Hearts",
            "Thinking of You in Your Loss — Sympathy Ecard",
            "Gentle Words of Sympathy — Personalized Card",
            "With Sympathy & Love — Custom Ecard Online",
            "Holding You in My Heart — Sympathy Card",
            "Sending Strength — Condolences Ecard",
            "Warm Sympathy Card — Your Message of Care",
            "With Love and Sympathy — Custom Greeting",
            "Respectful Sympathy Card to Send Online",
            "My Heart is With You — Sympathy Ecard",
            "May You Find Peace — Personalized Sympathy Card",
            "Loving Sympathy Card — Comfort in Words",
            "You're Not Alone in Your Grief — Ecard",
            "With Heavy Heart and Deep Sympathy — Card",
            "May Memories Bring You Comfort — Sympathy",
            "Warmest Condolences — Personalized Ecard",
            "Prayers & Sympathy — Custom Card for Support",
        ],
        "default_texts": [
            "I am so deeply sorry for your loss. May cherished memories bring you comfort in the days ahead. 🕊️💙",
            "Words cannot express how sorry I am. Sending you all my love, strength, and sympathy. 💙🙏",
            "My heart is with you during this difficult time. May you find peace and feel surrounded by love. 🕊️💗",
            "I can't imagine what you're going through. Please know I'm here — anytime, anything. Sending my deepest sympathy. 💙",
            "They were so loved, and will be so missed. Holding you close in my heart. Sending my condolences. 🤗🕯️",
            "May the love of those around you give you strength, and may memories of [name] bring you peace. 💙🕊️",
            "There are no beautiful words for this. Just love, sympathy, and a promise that I'm here whenever you need. 💗🤗",
            "Your [loved one] lives on in the love you shared, the memories you made, and the hearts they touched. So sorry. 💙🕯️",
            "I wish there was something I could say to take even a little of the pain away. I'm so, so sorry. 🕊️💗",
            "Grief is love with nowhere to go. May all that love gently hold you. My deepest condolences. 💙🙏",
            "May your heart and soul find gentle peace in the days ahead. I'm so sorry for your loss. 🕊️",
            "Thinking of you with sympathy, sending you with love, and hoping you feel held today and always. 💙🤗",
            "Your family is in my heart and my prayers during this time of profound sorrow. May God be with you. 🙏💗🕊️",
            "The world lost an amazing soul, and heaven gained one. I'm so sorry for your loss. 💙🌠",
            "I'll remember their smile, their kindness, and the way they lit up every room. You're in every thought. 🕯️💗",
            "May the outpouring of love around you be a small comfort. Sending my sincere condolences. 🤗💙",
            "Loss reminds us how deeply we can love. Hold tight to that love — it's the greatest gift. So sorry. 🕊️💗",
            "I'm not going to say 'I know how you feel' — I don't. But I know you are loved, and I am so sorry. 💙",
            "One kind soul left footprints on many hearts. May those footprints guide you gently forward. Sympathies. 🕯️🤗",
            "Wishing you moments of gentle peace, soft memories, and the quiet comfort of love all around. 💙🕊️",
        ],
        "tags_variants": [
            ["sympathy", "condolences", "loss"],
            ["peaceful", "gentle", "comfort"],
            ["love", "support", "grief"],
            ["respectful", "prayers", "memory"],
            ["calm", "healing", "family"],
        ],
    },
    "anniversary": {
        "display_name": "Anniversary",
        "styles": ["romantic", "elegant", "loving", "warm", "classic"],
        "fonts": ["'Dancing Script', cursive", "'Playfair Display', serif", "'Caveat', cursive", "'Inter', sans-serif"],
        "colors": ["#c53030", "#9b2c2c", "#742a2a", "#b83280", "#553c9a"],
        "filters": ["romantic", "soft", "warm", "classic", "dreamy"],
        "titles": [
            "Happy Anniversary Card — Celebrate Your Love",
            "Personalized Anniversary Ecard for Couples",
            "Another Year of Us — Custom Anniversary Card",
            "Romantic Anniversary Card for Wife or Husband",
            "Cheers to Another Year — Anniversary Ecard",
            "Warm Anniversary Wishes — Custom Card Online",
            "Still Falling For You — Anniversary Card",
            "Elegant Anniversary Ecard for Your Love",
            "To Many More — Personalized Anniversary Card",
            "Celebrating Us — Anniversary Greeting Ecard",
            "Forever & Always — Anniversary Card Online",
            "Our Story Continues — Anniversary Ecard",
            "Milestone Anniversary — Custom Card for Couples",
            "One Year Down, Forever to Go — Anniversary",
            "Love of My Life — Personalized Anniversary Ecard",
            "Through Thick & Thin — Anniversary Card",
            "Happy Anniversary to the Best Thing Ever — Card",
            "Best Decision I Ever Made — Anniversary Ecard",
            "Us Against the World — Anniversary Card Online",
            "Memories Made, More to Come — Anniversary",
        ],
        "default_texts": [
            "Happy anniversary to the love of my life. Another year with you, another 100 I can't wait for. 💖🌹",
            "They say the best things in life get better with age. Our love is proof of that. Happy anniversary, darling. 💕✨",
            "Another 365 days of loving you, laughing with you, and building a life together. Happy anniversary, my everything. 💗🎉",
            "I'd marry you all over again, a thousand times, in every lifetime. Happy anniversary, forever person. 💍💕",
            "Thank you for every morning I wake up next to you and every night I fall asleep in your arms. Happy anniversary. 💖🌙",
            "Our anniversary is just a mark on a calendar. My love for you grows every single day. Cheers to us! 🥂💗",
            "Through every high and every low, through calm days and stormy ones — loving you has been my greatest adventure. 🌊💍",
            "Happy anniversary. If loving you is my job, I just got another year's worth of perfect performance reviews. 😉💖",
            "In a world of temporary things, you're my forever. Happy anniversary, my one and only. 💕🌹",
            "The years with you feel like minutes. I wish we could do a thousand more anniversaries. I love you, always. ⏳💗",
            "Remember the day we said 'I do'? My heart feels that exact same joy every single day. Happy anniversary! 💍✨",
            "Some people search their whole lives for what we have. I found it in you. Happy anniversary, darling. 💖🌠",
            "Marriage is a million tiny moments that add up to a beautiful life. Thank you for sharing them all with me. 💗",
            "Happy anniversary to the one who makes ordinary days extraordinary. You're my favorite, always. ✨💖",
            "Our love story is my favorite story. This chapter is just getting good. Happy anniversary, my love. 📖💕",
            "Thank you for choosing me — yesterday, today, and all our tomorrows. I choose you back, anniversary after anniversary. 💍💗",
            "Happy anniversary. They say love is blind, but I see you clearly — and I'd still pick you. Every. Single. Time. 💖😄",
            "Another year of inside jokes, bad dances in the kitchen, sleepy kisses, and perfect us. Happy anniversary. 🍳💕",
            "I love you more than I did last anniversary, but less than I will next one. That's the magic of us. 💗✨",
            "Anniversaries come once a year, but my love for you comes every second of every day. Happy anniversary, forever. 💖",
        ],
        "tags_variants": [
            ["anniversary", "romantic", "love"],
            ["couples", "wedding", "milestone"],
            ["wife", "husband", "forever"],
            ["elegant", "romance", "celebration"],
            ["warm", "loving", "together"],
        ],
    },
    "new-baby": {
        "display_name": "New Baby",
        "styles": ["cheerful", "sweet", "joyful", "warm", "gentle"],
        "fonts": ["'Caveat', cursive", "'Playfair Display', serif", "'Montserrat', sans-serif", "'Inter', sans-serif"],
        "colors": ["#2b6cb0", "#2c5282", "#b83280", "#2d6a4f", "#d53f8c"],
        "filters": ["cheerful", "soft", "bright", "warm", "gentle"],
        "titles": [
            "Welcome Baby Card — Celebrate the New Arrival",
            "Personalized New Baby Ecard for Parents",
            "Hello Little One — Custom New Baby Card",
            "Congratulations on Your New Bundle of Joy",
            "Sweet New Baby Greeting Card Online",
            "Welcome to the World Baby — Custom Ecard",
            "So Much Love for a Tiny New Person — Card",
            "Joyful New Baby Wishes — Personalized Ecard",
            "Oh Baby! — Custom Newborn Congratulations Card",
            "Hooray, Baby is Here! — Personalized Card",
            "Tiny Toes, Big Love — New Baby Ecard",
            "Congratulations New Parents — Baby Card Online",
            "The Best Gift Ever — New Baby Congratulations",
            "Welcome Baby [Boy/Girl] — Custom Greeting",
            "A Whole New World Awaits You — Baby Card",
            "Someone Tiny & Perfect Has Arrived — Ecard",
            "New Baby, New Adventures — Personalized Card",
            "Sleepless Nights, Endless Love — New Baby",
            "The Family Just Got Better — New Baby Card",
            "Welcome to Crazy Beautiful Parenthood — Ecard",
        ],
        "default_texts": [
            "Welcome to the world, little one! May your days be filled with wonder, love, and lots of cuddles. 👶💙💖",
            "Congratulations on your beautiful new arrival! Parenthood is the wildest, most wonderful adventure. 🎉👶",
            "Hello tiny human — the world just got a whole lot cuter. Welcome, and know you are deeply loved. 💗✨",
            "So happy for your growing family! Sending love and snuggles (and coffee — trust me on the coffee). ☕👶",
            "Tiny fingers, tiny toes, giant love. Welcome baby, and congratulations to the most perfect new parents. 💙💕",
            "A new baby is like the beginning of all things — wonder, hope, a dream of possibilities. Enjoy every moment. 🌱✨",
            "This little baby is proof that miracles come true. So blessed and so happy for you all. 👶🎉",
            "Being a parent is wearing your heart outside your body. Good luck — you two are gonna be amazing. 💗❤️",
            "Welcome sweet baby! You've got the best parents a baby could ever ask for. The world's been waiting. 🌍👶",
            "Your house will be noisy, your sleep will be broken, and your hearts will be full. Enjoy every messy, perfect minute. 🏠💙",
            "Baby announcement received. Heart: melted. Sending all the love to your brand-new beautiful family. 💖👶",
            "Oh what joy! What a perfect little blessing. May parenthood be everything you dreamed and more. ✨🎉",
            "New baby smell + tiny baby yawns + parents full of love = the best equation ever. Congratulations! 🥰👶",
            "To the new parents: you've got this. To the baby: welcome, you're gonna have the best time. 💙✨",
            "The days are long but the years are short. Breathe it all in. Sending massive congratulations! 🌅👶💗",
            "Some of God's greatest gifts come in tiny packages. So happy for you both and your precious baby. 🎁✨",
            "Ready or not, here they come! I have no doubt you two will be absolutely wonderful parents. 👶💖",
            "Sleep now, baby — there's a big life waiting for you. Parents… sleep when they sleep. That's rule #1. 😴✨",
            "It takes a village, and I'm volunteering for cuddle duty whenever you need. Welcome, sweet baby. 🤗👶",
            "Welcome to the family tree, little sprout. We're gonna have so much fun watching you grow. 🌳💙💖",
        ],
        "tags_variants": [
            ["new-baby", "newborn", "congratulations"],
            ["baby-boy", "baby-girl", "joyful"],
            ["parents", "family", "sweet"],
            ["cheerful", "welcome", "blessing"],
            ["gentle", "cute", "arrival"],
        ],
    },
    "encouragement": {
        "display_name": "Encouragement",
        "styles": ["uplifting", "cheerful", "hopeful", "strong", "warm"],
        "fonts": ["'Montserrat', sans-serif", "'Caveat', cursive", "'Inter', sans-serif", "'Playfair Display', serif"],
        "colors": ["#d53f8c", "#2b6cb0", "#2d6a4f", "#e53e3e", "#d69e2e"],
        "filters": ["bright", "warm", "vibrant", "cheerful", "soft"],
        "titles": [
            "You've Got This — Encouragement Card Online",
            "Personalized 'Believe in Yourself' Ecard",
            "Rise & Shine — Custom Encouragement Card",
            "Cheer Up — You're Stronger Than You Know",
            "Keep Going — Personalized Motivational Card",
            "I Believe in You — Custom Encouragement Ecard",
            "Tough Times Don't Last, Tough People Do — Card",
            "Bright Days Are Ahead — Encouragement Ecard",
            "Be Kind to Yourself — Personalized Support Card",
            "One Step at a Time — Encouragement Card",
            "You Are Capable — Custom Motivational Ecard",
            "Rooting For You — Personalized Encouragement",
            "Progress Not Perfection — Encouragement Card",
            "Breathe — You're Doing Better Than You Think",
            "Brighter Tomorrows — Encouragement Ecard",
            "Show the World What You're Made Of — Card",
            "Small Moves Add Up — Encouragement Ecard",
            "You're Closer Than You Think — Support Card",
            "Just Start — Personalized Encouragement Ecard",
            "Be Your Own Biggest Fan — Encouragement",
        ],
        "default_texts": [
            "You've got this. You really, truly do. You're stronger than you know, and I believe in you with all my heart. 💪✨",
            "Breathe. You're doing so much better than you think. Take it one step, one moment, one breath at a time. 🌬️💗",
            "This hard moment doesn't define you — your courage to keep going does. I'm so proud of you. Keep going. 💙🚀",
            "Remember how far you've come, not how far you have to go. You've already survived 100% of your worst days. 🌟💪",
            "You don't have to be perfect — you just have to be you, and you're already wonderful. Keep shining. ✨💛",
            "Tough days don't make you weak. They show you how strong you've been all along. I'm cheering you on. 👏💙",
            "Stop for a second and look at everything you've already accomplished. You're amazing. Keep at it. 🎉💗",
            "It's okay to not be okay, but it's not okay to give up on yourself. You deserve all the good things. Keep trying. 💛✨",
            "The world needs what you have. Don't shrink, don't dim, don't quit. Your time is coming — believe it. ⏳🚀",
            "You are braver than you believe, stronger than you seem, smarter than you think, and loved more than you know. 💪💖",
            "If it was easy, everyone would do it. You're doing the hard thing — that makes you incredible. Keep going. 👏🌟",
            "One tiny win today is still a win. Celebrate the small stuff — it's leading to big things. I believe in you. ✨💙",
            "You're doing the best you can with what you have right now, and that's more than enough. Be gentle with yourself. 💗🤗",
            "Doubt kills more dreams than failure ever will. Trust yourself. Take the leap. The net will appear. 🌉✨",
            "Every champion was once a contender who refused to give up. You're next. I'm right here rooting for you. 🏆💪",
            "Go easy on yourself today. You're growing, you're healing, you're learning — and that takes enormous courage. 🌱💙",
            "You've been here before, and you got through it. You'll get through this too. I promise you're stronger. 💗✨",
            "I know it's hard. I know you're tired. But I also know you've got what it takes to see this through. Keep going. 💪",
            "Comparison is the thief of joy. Your journey is yours alone, and it's beautiful. Keep walking your path. 🛤️💙",
            "The only person you need to be better than today is the person you were yesterday. You've got this. ✨💛",
        ],
        "tags_variants": [
            ["encouragement", "motivation", "strong"],
            ["uplifting", "believe", "hope"],
            ["cheerful", "support", "keep-going"],
            ["confidence", "brave", "progress"],
            ["warm", "strength", "kindness"],
        ],
    },
    "wedding": {
        "display_name": "Wedding",
        "styles": ["elegant", "romantic", "joyful", "classic", "loving"],
        "fonts": ["'Playfair Display', serif", "'Dancing Script', cursive", "'Caveat', cursive", "'Inter', sans-serif"],
        "colors": ["#553c9a", "#b83280", "#744210", "#2d6a4f", "#c53030"],
        "filters": ["romantic", "soft", "elegant", "warm", "dreamy"],
        "titles": [
            "Wedding Congratulations Card — Happy Ever After",
            "Personalized Wedding Wishes Ecard for Couples",
            "Cheers to Mr & Mrs — Custom Wedding Card",
            "Happily Ever After Starts Now — Wedding Ecard",
            "Best Wishes on Your Wedding Day — Custom Card",
            "Beautiful Wedding Day — Personalized Ecard",
            "To Love & to Cherish — Wedding Congrats Card",
            "Elegant Wedding Card for the Newlyweds",
            "Two Become One — Personalized Wedding Card",
            "Congratulations Newlyweds — Wedding Ecard",
            "A Lifetime of Love Begins Today — Wedding",
            "To the New Mr & Mrs — Custom Greeting Card",
            "May Your Love Grow Deeper Every Day — Wedding",
            "Wishing You a Lifetime of Happiness — Wedding",
            "Today We Celebrate You — Wedding Card",
            "The Big Day — Personalized Wedding Congratulations",
            "Here's to Your Forever — Wedding Ecard",
            "So Happy Together — Personalized Wedding Card",
            "A Perfect Match — Wedding Congratulations Ecard",
            "Your Story Begins — Wedding Custom Card",
        ],
        "default_texts": [
            "Congratulations on your wedding day! Two beautiful souls making one beautiful life together. Here's to forever. 💒🥂",
            "To the new Mr. & Mrs. — wishing you a love that grows stronger every day, brighter every year. Congratulations! 💕✨",
            "Today you start your forever. May your marriage be filled with laughter, adventure, and endless love. 🥰💒",
            "May the years ahead be filled with lasting joy, warm memories, and love that keeps getting deeper. Happy wedding day! 🌹💖",
            "Cheers to love, laughter, and happily ever after. So happy to witness the beginning of your forever. 🥂💕",
            "Two hearts, one promise, a lifetime of beautiful tomorrows. Wishing you both the absolute best wedding day and beyond. 💍✨",
            "Your wedding day will come and go, but may your love forever grow. Sending all my love to the newlyweds. 🌱💒",
            "To the happy couple: may your home be warm, your days be bright, and your hearts be full always. Congratulations! 🏠💛",
            "From first date to 'I do' — what a beautiful ride. I can't wait to see the next chapter. Happy wedding day! 📖💍",
            "May your marriage be a safe place, a grand adventure, and the greatest love story anyone's ever read. Cheers to you two! 🥂💕",
            "The best marriages aren't the perfect ones — they're the ones where two imperfect people refuse to give up on each other. 💖✨",
            "Wishing you rainbows after storms, laughter on tough days, and a thousand beautiful 'remember when…' moments together. 🌈💍",
            "On your wedding day, I'm not just giving you my congratulations — I'm giving you my promise of friendship and support always. 💗🤗",
            "To have and to hold, from this day forward — you two. So happy for you both. Enjoy every magical moment. 💒✨",
            "Here's to all the late-night chats, the messy mornings, the dancing in kitchens, and forever adventures as husband and wife. 💙💖",
            "You two are proof that soulmates are real. Thank you for letting us be part of your beautiful day. Happy wedding! 🌹💍",
            "One chapter ends, a new one begins. It's called 'happily ever after' and you two are the authors. Write something magical. 📖✨",
            "Marriage is not about finding someone you can live with — it's about finding someone you can't live without. You found each other. 💗",
            "To the couple that laughs together, loves deeply, and makes it all look easy — the best is yet to come. Congratulations! 🥂",
            "My wish for you: a marriage full of warm embraces, inside jokes, shared dreams, and breakfasts in bed. Every single day. 💖🍳✨",
        ],
        "tags_variants": [
            ["wedding", "marriage", "congratulations"],
            ["newlyweds", "romantic", "love"],
            ["mr-and-mrs", "forever", "celebration"],
            ["elegant", "classic", "soulmates"],
            ["joyful", "together", "happy-ever-after"],
        ],
    },
    "valentine": {
        "display_name": "Valentine",
        "styles": ["romantic", "sweet", "loving", "playful", "tender"],
        "fonts": ["'Dancing Script', cursive", "'Caveat', cursive", "'Playfair Display', serif", "'Montserrat', sans-serif"],
        "colors": ["#c53030", "#9b2c2c", "#d53f8c", "#b83280", "#e53e3e"],
        "filters": ["romantic", "soft", "warm", "dreamy", "vibrant"],
        "titles": [
            "Valentine's Day Card — Be Mine Forever",
            "Personalized Valentine Ecard for Your Love",
            "I Love You — Custom Valentine's Day Card",
            "Be My Valentine — Sweet Greeting Ecard Online",
            "Happy Valentine's Day to My Favorite Person",
            "Roses Are Red — Personalized Valentine Card",
            "You + Me = Happy Valentine's Day — Card",
            "My Heart is Yours — Custom Valentine Ecard",
            "From Me to You on Valentine's Day — Card",
            "Love Letter for Valentine's — Personalized Ecard",
            "You're My Person — Valentine's Day Card",
            "All My Love on Valentine's — Custom Card",
            "Be Mine — Personalized Valentine's Ecard",
            "To My Forever Valentine — Greeting Card",
            "Sweet Valentine's Wishes Just For You — Card",
            "My Whole Heart — Custom Valentine Ecard",
            "XO XO — Happy Valentine's Day Personalized",
            "Love You More — Valentine's Day Custom Card",
            "My One and Only Valentine — Ecard Online",
            "Valentine Every Day — Personalized Card",
        ],
        "default_texts": [
            "Happy Valentine's Day to the love of my life. Every day with you feels like Valentine's Day. 💕🌹",
            "Be my Valentine — today, tomorrow, and every February 14th for the rest of our lives. 💖💌",
            "Roses are red, violets are blue, no Valentine's Day poem could say how much I love you. 🌹💗",
            "You're my favorite notification, my happiest morning thought, my safest night. Happy Valentine's, my love. 💘✨",
            "If I had to choose my favorite Valentine, I'd choose you a million times over. Happy Valentine's Day. 💖💕",
            "On Valentine's Day and every day, I choose you. Forever yours, always mine. Happy V-Day, darling. 💗💍",
            "Forget chocolates and flowers — the best Valentine's gift is simply having you. I love you. Happy Valentine's. 🍫🌹",
            "They say Valentine's is one day a year, but my heart celebrates you every single morning when I wake up. 💗🌅",
            "To my Valentine: you make my heart beat a little faster, my smile a little wider, and my life a whole lot brighter. 💘",
            "Valentine, you had me at hello. Still have me, always will. Sending all my love. 💕✨",
            "My heart already knew what my calendar says today: I love you more than yesterday, less than tomorrow. Happy V-Day. 💗📅",
            "You're the candy in my Valentine's box, the love in my letter, the one on my mind. All the hearts, all for you. 💌🍬💖",
            "Roses are romantic, candles are cozy, wine is sweet — but you are better than all of it combined. Happy Valentine's. 🌹🕯️🍷",
            "Every love story is beautiful — but ours? Ours is my favorite. Happy Valentine's Day to my partner in everything. 💗📖",
            "This Valentine's Day I have three words for you: I. Love. You. But you already knew that. 💖✨💕",
            "I'd spend every Valentine's with you for a hundred more years, and it still wouldn't be enough. Happy V-Day, forever. 💍💕",
            "Valentine, you're the good morning text that makes me smile and the goodnight kiss that makes me sleep peacefully. 💗🌙☀️",
            "If love was a language, I'd spend every Valentine's Day telling you in every way I know how. Happy Valentine's. 💘🌹",
            "The best Valentine's memory I'll ever have is the one we're making right now. Love you, always. 💗✨",
            "Cupid's arrow didn't miss — it hit me straight in the heart, and I'm glad. Happy Valentine's Day, beloved. 🏹💖💕",
        ],
        "tags_variants": [
            ["valentine", "romantic", "love"],
            ["be-mine", "sweet", "heart"],
            ["hearts-day", "loving", "cupid"],
            ["romance", "passion", "tender"],
            ["chocolate", "roses", "together"],
        ],
    },
    "christmas": {
        "display_name": "Christmas",
        "styles": ["festive", "cheerful", "warm", "cozy", "joyful"],
        "fonts": ["'Caveat', cursive", "'Playfair Display', serif", "'Montserrat', sans-serif", "'Inter', sans-serif"],
        "colors": ["#9b2c2c", "#276749", "#744210", "#c53030", "#2d3748"],
        "filters": ["warm", "bright", "festive", "cozy", "soft"],
        "titles": [
            "Merry Christmas Card — Warm Holiday Wishes",
            "Personalized Holiday Ecard for Loved Ones",
            "Happy Holidays — Custom Christmas Card Online",
            "Joy to the World — Christmas Greeting Ecard",
            "Warm & Cozy Christmas Wishes — Custom Card",
            "Peace, Love & Joy — Personalized Christmas Ecard",
            "Ho Ho Ho! — Custom Holiday Card to Send",
            "Christmas Blessings — Personalized Greeting",
            "May Your Days Be Merry & Bright — Christmas Card",
            "Jingle All the Way — Christmas Ecard Online",
            "With Love at Christmas — Personalized Card",
            "Holly Jolly Christmas — Custom Holiday Ecard",
            "Tis the Season — Warm Christmas Wishes Card",
            "All I Want for Christmas Is You — Custom Card",
            "Holiday Hugs — Personalized Christmas Ecard",
            "Christmas Magic — Custom Greeting Card",
            "May Your Christmas Be Merry — Personalized Ecard",
            "From Our Home to Yours — Christmas Card",
            "Wishing You a White Christmas — Custom Ecard",
            "Season's Greetings — Personalized Holiday Card",
        ],
        "default_texts": [
            "Merry Christmas and a Happy New Year! May your holidays be filled with love, laughter, and all things magical. 🎄✨🎁",
            "Wishing you a Christmas that's merry and bright, surrounded by people who make your heart feel full. 🎄💛🎅",
            "Ho ho ho! May Santa be good to you, may the cocoa be warm, and may the year ahead be your best one yet. 🎅🎄✨",
            "Peace on earth and mercy mild — may that spirit be in your home and your heart this Christmas season. 🕊️💙❄️",
            "Tis the season to be jolly — and you, my friend, make every season jollier just by being in it. Merry Christmas! 🎉🎄💖",
            "May your holidays sparkle with moments of love, laughter, and goodwill. And may the year ahead be full of contentment and joy. ✨",
            "Baking cookies, trimming the tree, wrapping gifts, singing carols — Christmas is better when you're around. 🎄🍪🎶",
            "At Christmas, all roads lead home. And my heart leads to you, wherever you are. Merry Christmas, beloved. 🏠💗🎄",
            "May the true spirit of Christmas shine in your heart and light your path. Merry Christmas, wonderful human. ✨🌟🎄",
            "Warmest thoughts and best wishes for a wonderful Christmas and a very happy New Year. Cheers to you! 🥂🎄💙",
            "Christmas waves a magic wand over this world, and behold, everything is softer and more beautiful. Enjoy. ✨🪄❄️",
            "May your Christmas be filled with special moments, cherished memories, and all the things that bring you joy. 🎁🎄💛",
            "Happy holidays! Thank you for being one of the best things about my year. You are truly a gift. 🎁💖✨",
            "From my little Christmas corner to yours — sending all the love, the light, the cookies, and the holiday spirit. 🎄🍪💗",
            "The best gift under any tree this year is having you in my life. Merry Christmas, you wonderful human. 🎄💝🎁",
            "Jingle bells, jingle bells, jingle all the way — wishing you a Christmas that's happy in every single way. 🔔🎄🎉",
            "Let's make this Christmas count: more kindness, more gratitude, more time together. Merry Christmas and happy everything. 💛🎄",
            "Twas the night before Christmas, and all through my heart, I was thankful for you — right from the very start. 🎄💗✨",
            "Gingerbread houses, mistletoe kisses, twinkling lights, and you — my favorite Christmas things. Merry love. 🏠💋✨🎄",
            "May this season find you among those you love, sharing in the twin glories of generosity and gratitude. Merry Christmas. 🎁💙",
        ],
        "tags_variants": [
            ["christmas", "holiday", "festive"],
            ["merry", "cheerful", "joy"],
            ["cozy", "warm", "family"],
            ["xmas", "seasonal", "blessings"],
            ["winter", "snow", "celebration"],
        ],
    },
    "new-year": {
        "display_name": "New Year",
        "styles": ["celebratory", "hopeful", "joyful", "bright", "fresh"],
        "fonts": ["'Playfair Display', serif", "'Montserrat', sans-serif", "'Caveat', cursive", "'Inter', sans-serif"],
        "colors": ["#d69e2e", "#1a365d", "#553c9a", "#2b6cb0", "#2d3748"],
        "filters": ["vibrant", "bright", "warm", "festive", "celebratory"],
        "titles": [
            "Happy New Year Card — Cheers to New Beginnings",
            "Personalized New Year Wishes Ecard Online",
            "Hello New Year — Custom Celebration Card",
            "New Year, New Adventures — Custom Ecard",
            "Cheers to a Fresh Start — Happy New Year Card",
            "Best Wishes for the New Year — Personalized",
            "365 New Chances — New Year Custom Greeting",
            "Out With the Old, In With the New — Card",
            "New Year Resolutions & Love — Custom Ecard",
            "Bright New Year Ahead — Personalized Card",
            "Ringing in the New Year — Celebration Ecard",
            "Make This Year Count — Happy New Year Card",
            "New Year Magic — Personalized Greeting Ecard",
            "Here's to 2026 — Custom New Year Card",
            "Midnight Kisses & New Year Wishes — Card",
            "New Year Hope — Personalized Ecard",
            "Cheers to Everything Ahead — New Year Card",
            "Brand New Year — Personalized Custom Ecard",
            "A Year of Possibilities — New Year Card",
            "New Year, Better Us — Custom Ecard",
        ],
        "default_texts": [
            "Happy New Year! May this be the year your biggest dreams come true and your hardest days become your best stories. 🎉🥂🎆",
            "Out with the old, in with the new — here's to 365 fresh starts, beautiful surprises, and love in every month. ✨🌟🎊",
            "Cheers to a new year and another chance to get it right. I know this year's gonna be your best one yet. 🥂✨🚀",
            "Happy New Year! May your coffee be strong, your Mondays be short, and your dreams be within reach this whole year. ☕💪✨",
            "New year, same beautiful me — just with better plans, bigger dreams, and a little more sparkle. Happy 2026! ✨💖🎆",
            "Let's raise a glass to yesterday's memories, today's moments, and tomorrow's dreams. Happy New Year! 🥂🎇",
            "May the new year bring you peace when times are hard, joy when days are bright, and love always. 💛🕊️✨",
            "Wishing you a January full of smiles, a February full of warmth, a year full of blessings. Happy New Year! 🌞❤️🎉",
            "Another year of beautiful chaos, wonderful highs, and lessons disguised as lows. I'm ready. Let's do this, new year. 🚀✨",
            "New Year's resolution: more joy, less worry, more you, less them, more life, less waiting. Let's go! 💪✨",
            "New year. New pages. New chapters. Same beautiful story — and we get to write it together. Happy 2026. 📖✨💙",
            "365 days. 12 months. 52 weeks. 1 year. Infinite possibilities. Can't wait to see what happens. Happy New Year! 🌱🎆",
            "Cheers to new beginnings, second chances, and the beautiful year that waits just beyond midnight. Happy New Year! 🥂✨",
            "May this year treat you kinder than the last, love you louder than before, and surprise you when you least expect it. 💗✨",
            "Last year's words belong to last year's language. Next year's words await another voice. Let's make it beautiful. 🎤✨",
            "No perfect new year — just one where we love each other through it all. Happy 2026 with all my heart. 💖🎉",
            "Here's to the nights we won't remember with the friends we'll never forget. Happy New Year, crew! 🎆🥂😎",
            "The magic in new beginnings is truly the most powerful of them all. Here's to yours — it's gonna be amazing. ✨🚀",
            "New year. Same goals. Better strategy. Let's make this year the one where we stop wishing and start doing. 💪✨",
            "One year closes, another opens. Wishing you and yours a happy, healthy, and hope-filled new year. 🌠🎆💙",
        ],
        "tags_variants": [
            ["new-year", "celebration", "hope"],
            ["2026", "fresh-start", "cheers"],
            ["happy", "joyful", "resolutions"],
            ["fireworks", "party", "new-beginnings"],
            ["bright", "festive", "future"],
        ],
    },
    "mothers-day": {
        "display_name": "Mother's Day",
        "styles": ["warm", "elegant", "soft", "loving", "classic"],
        "fonts": ["'Playfair Display', serif", "'Caveat', cursive", "'Montserrat', sans-serif", "'Inter', sans-serif"],
        "colors": ["#b83280", "#9c27b0", "#744210", "#c05621", "#d69e2e", "#553c9a"],
        "filters": ["warm", "soft", "vintage", "loving", "bright"],
        "titles": [
            "Happy Mother's Day Card — Heartfelt Wishes for Mom",
            "Thank You Mom — Personalized Mother's Day Ecard",
            "To the Best Mom Ever — Custom Mother's Day Card",
            "Mother's Day Love — Beautiful Greeting for Her",
            "For Mom With All My Love — Custom Ecard Online",
            "Happy First Mother's Day — Personalized Card",
            "Best Mom in the World — Mother's Day Greeting",
            "Mothers Day Card — Send Love Instantly Online",
            "From Daughter to Mom — Heartfelt Mother's Day Card",
            "From Son to Mom — Loving Mother's Day Ecard",
            "Happy Mothers Day — For Grandma Too — Custom",
            "You're the Best Mom — Personalized Greeting Card",
            "Mother's Day Thank You — Custom Ecard Online",
            "Love You Mom — Beautiful Custom Card",
            "World's Best Mom — Mother's Day Celebration",
            "Happy Mother's Day — Custom Floral Design Card",
            "For an Amazing Mom — Personalized Ecard",
            "Mother's Day Blessings — Custom Greeting Card",
            "Happy Mother's Day — Classic & Elegant Card",
            "Dear Mom — Your Words Mean the World — Card",
        ],
        "default_texts": [
            "Happy Mother's Day to the woman who gave me everything — her love, her time, her heart. I love you more than words. 💗🌸✨",
            "Mom, thank you for every late night, every hug, every sacrifice. You're the reason I am who I am today. Love you. 💛🌷💙",
            "To the best mom in the world: you deserve every flower, every hug, every 'I love you' today and always. Happy Mother's Day. 🌷💗",
            "Being your kid is still the best thing that ever happened to me. Happy Mother's Day — I love you more each year. 💙✨💗",
            "Thank you for the unconditional love, the warm meals, the even warmer hugs. You're my forever hero, Mom. Happy Mother's Day. 🦸‍♀️💛",
            "Happy Mother's Day to my first friend, my biggest cheerleader, my safe place. Love you always, Mom. 💗🌸✨",
            "No one loves like a mom. No one sacrifices like a mom. No one can replace you. Happy Mother's Day with all my heart. 💙🌷",
            "For every time you said 'it's okay' when it wasn't, every time you said 'I'm proud' when I wasn't sure — thank you, Mom. 💛✨💗",
            "Happy Mother's Day! May your coffee be warm, your day be calm, and your heart feel as loved as you make everyone else feel. ☕🌸💗",
            "Mom, you're not just my mom — you're my safe place, my role model, my best friend. Happy Mother's Day always. 💙💛✨",
            "Thank you for believing in me when I didn't believe in myself. That's mom-superpower right there. Happy Mother's Day. 💗🦸‍♀️",
            "Happy First Mother's Day! You were born for this. Sending all my love and a lifetime of wonderful firsts ahead. 🌸👶💗",
            "To my grandma on Mother's Day: your love spans generations, and I'm so grateful for every memory, every cookie, every hug. 💛🌷",
            "You make motherhood look effortless even when it's not. You make love look infinite because it is. Happy Mother's Day, Mom. 💗✨",
            "Wishing the strongest, kindest, most loving mom I know the happiest Mother's Day ever. You deserve it all. 💙🌸💛",
            "Dear Mom — you taught me how to love, how to give, how to be strong. Everything good in me started with you. 💗✨🌷",
            "Happy Mother's Day to the matriarch, the glue, the heart of our family. We love you more than words. 💙💛🌸",
            "Even when I'm all grown up, I still need my mom. Your hug still fixes everything. Happy Mother's Day. 💗✨",
            "For every 'I love you' you ever said, every 'it'll be okay' that made it so — thank you. Happy Mother's Day, forever. 💙🌷💛",
            "Today and always: you are appreciated, you are adored, you are the best mom in the universe. Happy Mother's Day. 💗✨🌸",
        ],
        "tags_variants": [
            ["mothers-day", "mom", "love"],
            ["from-daughter", "from-son", "heartfelt"],
            ["floral", "elegant", "warm"],
            ["grandma", "first-mothers-day", "blessings"],
            ["thank-you-mom", "best-mom", "grateful"],
        ],
    },
    "fathers-day": {
        "display_name": "Father's Day",
        "styles": ["classic", "strong", "warm", "bold", "rugged"],
        "fonts": ["'Playfair Display', serif", "'Montserrat', sans-serif", "'Inter', sans-serif", "'Caveat', cursive"],
        "colors": ["#1a365d", "#2d3748", "#2b6cb0", "#744210", "#553c9a", "#2d6a4f"],
        "filters": ["classic", "warm", "bold", "strong", "vintage"],
        "titles": [
            "Happy Father's Day Card — For the Best Dad",
            "Thank You Dad — Personalized Father's Day Ecard",
            "World's Best Dad — Custom Father's Day Card",
            "To My Hero Dad — Custom Greeting Online",
            "For Dad With Gratitude — Father's Day Card",
            "Happy First Father's Day — Personalized Card",
            "From Daughter to Dad — Loving Father's Day Ecard",
            "From Son to Dad — Happy Fathers Day Card",
            "You're the Best Dad — Custom Ecard Online",
            "Fathers Day Card — Grandpa Too — Custom",
            "Happy Fathers Day — Bold & Classic Design",
            "Thank You for Everything Dad — Custom Card",
            "To an Amazing Dad — Personalized Ecard",
            "Dad, You're My Hero — Custom Fathers Day Card",
            "Best Dad Ever — Father's Day Celebration",
            "Love You Dad — Heartfelt Custom Card Online",
            "For a Great Dad & Even Better Grandpa — Card",
            "Happy Fathers Day — Warm & Rugged Design",
            "Dad, Thank You for Always Being There — Card",
            "You're a Legend Dad — Happy Father's Day",
        ],
        "default_texts": [
            "Happy Father's Day to the man who taught me how to work hard, how to be kind, how to laugh loud. You're my hero, Dad. 💙👔✨",
            "Dad, thank you for every piece of advice, every hand-me-down tool, every time you said 'I'm proud.' It shaped who I am. 💛✨🔧",
            "To the best dad in the world: you fixed my bikes, my broken hearts, my bad days — now let me fix you a great Father's Day. 👔💙",
            "Being your kid is the biggest blessing. Happy Father's Day — I still want to be just like you when I grow up. 💙✨💛",
            "Thank you for the dad jokes, the bad dancing, the quiet sacrifices. You're the best kind of dad, the real kind. Happy Father's Day. 😂👔",
            "Happy Father's Day to my first hero, my forever example. Everything I know about being strong I learned from you. 💙✨",
            "No one gives advice like a dad. No one gives love like a dad. No one can replace you. Happy Father's Day with all my heart. 💛👔💙",
            "For every 'do as I say not as I do,' every proud smile, every moment you believed in me — thank you, Dad. 💙✨",
            "Happy First Father's Day! You were born for this diaper-changing, baby-snuggling, superhero job. Love you, new dad. 👶👔✨",
            "To my grandpa on Father's Day: your wisdom, your stories, your love — they're the foundation of our family. Thank you, Grandpa. 💛👔",
            "Dad, you're not just my dad — you're my role model, my biggest fan, my go-to for everything heavy. 💙✨",
            "From your daughter: thank you for being the first man I ever loved, for teaching me what a good man looks like. Happy Father's Day, Dad. 💗👔💙",
            "From your son: I hope one day I'm half the man, half the dad, half the legend you are. Happy Father's Day. 💙👔✨",
            "Dad, you make fatherhood look strong and gentle at the same time. That's a superpower. Happy Father's Day. 👔✨💛",
            "Wishing the coolest, handiest, most loving dad I know the happiest Father's Day yet. You deserve all the steaks. 🥩👔💙",
            "Dear Dad — you taught me how to ride a bike, how to throw a ball, how to keep my word. Everything valuable started with you. 💙✨",
            "Happy Father's Day to the patriarch, the problem-solver, the quiet heart of our family. We love you more than you know. 💛👔",
            "Even when I'm all grown up, I still need my dad. Your advice still makes everything clearer. Happy Father's Day. 💙✨",
            "For every fix-it, every life lesson, every 'I'm here' — thank you, Dad. Happy Father's Day, always and forever. 💛👔💙",
            "Today and always: you are respected, you are loved, you are the best dad in the universe. Happy Father's Day. 💙✨👔",
        ],
        "tags_variants": [
            ["fathers-day", "dad", "hero"],
            ["from-daughter", "from-son", "grateful"],
            ["classic", "bold", "rugged"],
            ["grandpa", "first-fathers-day", "legend"],
            ["thank-you-dad", "best-dad", "love"],
        ],
    },
    "retirement": {
        "display_name": "Retirement",
        "styles": ["classic", "celebratory", "elegant", "warm", "joyful"],
        "fonts": ["'Playfair Display', serif", "'Montserrat', sans-serif", "'Inter', sans-serif", "'Caveat', cursive"],
        "colors": ["#2d3748", "#744210", "#2b6cb0", "#2d6a4f", "#553c9a", "#d69e2e"],
        "filters": ["classic", "warm", "celebratory", "bright", "elegant"],
        "titles": [
            "Happy Retirement Card — Next Chapter Begins",
            "Congratulations on Your Retirement — Custom Ecard",
            "Well Deserved Retirement — Celebratory Card",
            "Retirement Celebration — You Earned This — Custom",
            "New Chapter Ahead — Retirement Greeting Card",
            "Cheers to Retirement — Personalized Ecard Online",
            "Happy Retirement — Time to Relax & Enjoy",
            "Retirement Wishes — Classic Custom Card",
            "For Teacher Retirement — Custom Thank You Card",
            "For Nurse Retirement — Celebratory Custom Ecard",
            "Retirement After a Great Career — Elegant Card",
            "From Team to Retiree — Happy Retirement Card",
            "Next Adventure Begins — Retirement Greeting",
            "Happy Retirement — Warm & Grateful Card",
            "Retirement: Job Done, Life Begins — Ecard",
            "Best Wishes on Your Retirement — Custom Card",
            "Retirement Is the New Beginning — Celebrate",
            "Warm Wishes for Your Retirement — Custom",
            "The Best Is Yet to Come — Retirement Card",
            "Cheers to You & Your Well Deserved Retirement",
        ],
        "default_texts": [
            "Happy Retirement! After all the years of hard work, dedication, and getting everyone else's coffee order right — this is your time. ☕🎉✨",
            "Congratulations on your retirement! May your days be long on naps, hobbies, grandkids cuddles, and absolutely zero 6am alarms. 😴🌻🎉",
            "Cheers to the next chapter: no deadlines, no meetings, no performance reviews — just you and a whole lot of life ahead. Happy Retirement. 🥂✨🚀",
            "Well done is an understatement. You didn't just work for 40 years — you shaped lives, mentored young people, built a legacy. Enjoy every minute. 🌟🎉",
            "Happy Retirement! Now that you're officially 'retired and loving it,' please add me to your weekly schedule. Coffee and stories on me. ☕💙✨",
            "You've earned every slow morning, every spontaneous trip, every 'I don't feel like it today' that retirement allows. Enjoy. Happy Retirement. 🌞🎉",
            "From the whole team: thank you for every lesson, every laugh, every tough meeting you made easier. You'll be missed but never forgotten. Happy Retirement. 💙🎉",
            "Retirement isn't the end of the road — it's a new highway with no speed limits and the best soundtrack ever. Let's go! Happy Retirement. 🚗✨🎶",
            "Congratulations on your retirement! May your garden grow, your fishing rods stay busy, and your grandchildren keep you wonderfully exhausted. 🌻🎣🎉",
            "Well deserved doesn't cover it. You worked hard, played fair, and lifted people up wherever you went. Now rest, adventure, enjoy! Happy Retirement. 💛✨🎉",
            "Happy Retirement to the best coworker / mentor / chief problem-solver this office ever had. The watercooler will never be the same. 😢🎉",
            "Retirement tip #1: if anyone asks when you'll be done relaxing, answer 'never.' That's the rule. Welcome to the club! 🛋️💙✨",
            "Here's to 9-to-5 becoming 9-to-whatever-you-want. Travel, hobbies, lazy mornings, big dinners — all of it. Happy Retirement! 🥂🎉",
            "The first rule of retirement: there are no rules. No alarms. No meetings. No deadlines. Just pure, glorious you-time. Enjoy! 😴✨🎉",
            "Wishing you a retirement filled with everything you've been waiting for: grandkids, golf, books, naps, travel, and peace. Happy Retirement. 🌞💛🎣",
            "Happy Retirement! Your work is done here, but your influence, your mentorship, your kindness will keep working in everyone whose life you touched. 🌟",
            "To the office legend: congratulations on closing this chapter and opening the most exciting one yet. We'll miss you. Go live! 🎉✨🚀",
            "Retirement is a career's greatest reward, and no one deserves it more than you. Cheers to you! Live every single day like the gift it is. 🥂🎉",
            "No more spreadsheets, no more email chains, no more quarterly reports. Just: sunshine, hobbies, coffee whenever you want. Welcome, Retirement. ☕🌞✨",
            "May your retirement be as wonderful as you've made every workplace, classroom, hospital, team you've ever been part of. Happy, happy retirement. 💙🎉",
        ],
        "tags_variants": [
            ["retirement", "next-chapter", "celebration"],
            ["well-deserved", "career", "grateful"],
            ["classic", "elegant", "warm"],
            ["from-team", "teacher", "nurse-retirement"],
            ["congrats", "adventure", "new-beginnings"],
        ],
    },
    "sorry": {
        "display_name": "Apology",
        "styles": ["soft", "sincere", "warm", "classic", "gentle"],
        "fonts": ["'Playfair Display', serif", "'Caveat', cursive", "'Inter', sans-serif", "'Montserrat', sans-serif"],
        "colors": ["#744210", "#553c9a", "#2d3748", "#2b6cb0", "#b83280", "#c53030"],
        "filters": ["soft", "warm", "calm", "classic", "gentle"],
        "titles": [
            "I'm Sorry Card — Sincere Apology Online",
            "Forgive Me — Heartfelt Apology Ecard Custom",
            "My Apologies — I Was Wrong — Custom Card",
            "Sorry for What I Said — Sincere Custom Ecard",
            "Please Forgive Me — Heartfelt Apology Card",
            "I Made a Mistake — I'm Sorry — Custom Ecard",
            "I'm Truly Sorry — Sincere Apology Greeting",
            "Apology for Late Reply — Custom Sorry Card",
            "Sorry I Hurt You — Sincere Amends Ecard",
            "Sorry for Missing Your Event — Custom Card",
            "My Bad — I Was Wrong — Heartfelt Sorry Card",
            "Please Accept My Apology — Custom Card",
            "I Owe You an Apology — Sincere Ecard",
            "Sorry From the Bottom of My Heart — Card",
            "I Regret It — I'm Sincerely Sorry — Ecard",
            "Forgive Me — I Didn't Mean It — Apology Card",
            "I'm Sorry — Let Me Make It Right — Custom",
            "Sincere Apology — From Me to You — Card",
            "Sorry — I Messed Up — Custom Amends Ecard",
            "My Fault — I'm So Sorry — Heartfelt Card",
        ],
        "default_texts": [
            "I'm so sorry for what I said / did. I was wrong. You didn't deserve it, and I'll do better. Please forgive me. 💛🤗✨",
            "I messed up, and I hate that I hurt you. That was never my intention. I'm truly sorry, and I hope you can forgive me. 💙💛",
            "I've been thinking about it a lot, and I was wrong. I should have been kinder, more patient, more careful. I'm so sorry. 💛🤗",
            "I'm sorry I was late / missed it / didn't reply. I hate that I let you down. Let me make it up to you — whatever you want, whenever. 💙✨",
            "I know saying sorry doesn't undo it, but I mean it with my whole heart: I was wrong. I'm sorry. I'll do better next time. 💛💙🤗",
            "Please forgive me. I'm sorry for hurting you, for being selfish, for not thinking first. I'll be better, I promise. 💙✨💛",
            "I didn't mean a word I said. I was frustrated and I took it out on you, and that's the opposite of what you deserve. I'm so, so sorry. 💛",
            "I'm really sorry about the mistake. It was my fault entirely, and I take full responsibility. Let me make it right. 💙🤗",
            "I owe you the biggest apology. I was wrong, and you deserve so much better. I'm truly sorry. I love you. 💗💛✨",
            "I'm sorry for being MIA / missing your big day / not being there. That was garbage of me. Let me redeem myself asap. 💙🤗",
            "I shouldn't have done that. I know that now, and I hate that I learned it at your expense. I'm so sorry. 💛💙",
            "You're the last person in the world I ever want to hurt, and I hurt you. That's on me, and I'm really, really sorry. 💙💗✨",
            "I'm sorry. Not the 'I'm sorry you feel that way' kind — the real 'I was wrong, I messed up, I'll change' kind. 💛🤗",
            "Please accept my apology. I was wrong, I'm sorry, and I'll spend the next while proving to you that I mean it. 💙✨",
            "For everything I should've said and didn't, everything I said and shouldn't have — I'm truly sorry. 💛🤗💙",
            "I've replayed it in my head a hundred times, and every time I'm wronger. I'm so sorry, truly and deeply. 💙💛",
            "I'm sorry for not believing you, for not listening, for making it about me. You were right, and I was so wrong. 💛✨🤗",
            "I know I broke your trust. I don't expect you to forgive me instantly, but I promise I'll earn it back. I'm so sorry. 💙💗",
            "Of course I'm sorry. I'm sorry for the mistake, for the stress, for making you deal with any of it. Let me fix it. 💛🤗✨",
            "To you: my most sincere apology. I didn't live up to the kind of friend/partner/person I want to be. I'm working on it. 💙💛",
        ],
        "tags_variants": [
            ["sorry", "apology", "forgive-me"],
            ["my-fault", "i-was-wrong", "amends"],
            ["soft", "sincere", "gentle"],
            ["hurt-feelings", "mistake-at-work", "broken-promise"],
            ["make-amends", "i-love-you", "please-forgive"],
        ],
    },
    "thinking-of-you": {
        "display_name": "Thinking of You",
        "styles": ["soft", "warm", "loving", "classic", "gentle"],
        "fonts": ["'Caveat', cursive", "'Playfair Display', serif", "'Montserrat', sans-serif", "'Inter', sans-serif"],
        "colors": ["#b83280", "#d69e2e", "#2b6cb0", "#553c9a", "#c05621", "#2d6a4f"],
        "filters": ["soft", "warm", "calm", "dreamy", "classic"],
        "titles": [
            "Thinking of You Card — Just Because — Custom",
            "On My Mind Today — Warm Thinking of You Ecard",
            "Just a Little Hello — Thinking of You Card",
            "You're On My Mind — Custom Greeting Online",
            "Warm Thoughts Coming Your Way — Custom Ecard",
            "Just Checking In — Thinking of You Card",
            "Thinking of You — Sending Hugs & Love Online",
            "You Crossed My Mind — Custom Heartfelt Card",
            "Wishing You Were Here — Thinking of You Ecard",
            "For Long Distance Friend — Thinking of You",
            "I Miss Talking to You — Custom Thinking Card",
            "Thinking of You During Tough Times — Card",
            "Sending Warm Thoughts — Custom Greeting Card",
            "Just to Say Hi — Thinking of You Card",
            "Thinking of You Today & Always — Custom",
            "Sending Sunshine Your Way — Thinking of You",
            "Just a Small Note to Say I'm Thinking — Card",
            "For Someone Special — You're On My Mind",
            "Warm Thoughts & Big Hugs — Thinking of You",
            "You're Important to Me — Thinking of You",
        ],
        "default_texts": [
            "Nothing big — just stopped by to say you've been on my mind a lot today, and I wanted you to know. Sending you my love. 💗☀️🤗",
            "You crossed my mind about a hundred times today, and not one of those times didn't make me smile. Thinking of you. 💙✨💗",
            "Just a little hello from me to you. Hope your day's going beautifully, and if it's not — I hope tomorrow is softer. 💛🤗",
            "I heard our song / saw something that made me laugh and instantly thought of you. You're my favorite kind of memory. 💗✨",
            "Sending warm thoughts your way today. If you feel a random hug out of nowhere, that's probably me. 🤗💛💙",
            "Thinking of you right now and hope wherever you are, whatever you're doing, you feel a little bit loved. 💗☀️✨",
            "No reason, no occasion — just thought I'd remind you that you're important, and I think about you more than you know. 💛🤗💙",
            "Just checking in on you. Not because something's up, but because I care about how you're really doing. 💗✨",
            "You've been on my mind and in my heart. Sending all the good vibes your way — may they find you warm and happy. 💛☀️🤗",
            "I was gonna wait for a good reason to reach out, but then I realized you are the good reason. Hi, I miss you, let's talk soon. 💙💗✨",
            "If the day feels too long or too heavy, just remember: someone somewhere (that's me) is thinking of you with all the love. 💛🤗💙",
            "You probably don't think about me as often as I think about you, and that's okay — I got enough thinking for both of us. Love you. 💗✨",
            "Random 'I love you' / 'I miss you' / 'I'm so glad you exist' message. No agenda, just you on my mind. 💙💛🤗",
            "Just thinking about how lucky I am to have you in my life. Thank you for being you. Thinking of you, always. 💗✨",
            "Someone asked me who I go to when things get real, and the first name that popped into my head was yours. Thinking of you today. 💙💛",
            "Small note, huge love — just sending you a moment of 'I hope your day is beautiful, and if it isn't, I hope it becomes so.' ☀️💗🤗",
            "I may not say it enough, but I carry you with me everywhere — in memories, in songs, in little things I see throughout the day. 💛✨💙",
            "Wishing I could sit across from you with coffee and three hours of free time. Until then: I love you, I'm thinking of you. ☕💗🤗",
            "If thoughts were hugs, you'd be wrapped in the warmest, squishiest one right now. That's exactly what I'm sending. 💙💛✨",
            "To the person who's somehow always on my mind — today's not different. I hope you're doing okay. I love you. 💗🤗☀️",
        ],
        "tags_variants": [
            ["thinking-of-you", "just-because", "on-my-mind"],
            ["warm-thoughts", "hugs", "long-distance"],
            ["soft", "dreamy", "gentle"],
            ["check-in", "just-to-say-hi", "love"],
            ["warmth", "missing", "grateful-for-you"],
        ],
    },
    "thanksgiving": {
        "display_name": "Thanksgiving",
        "styles": ["warm", "cozy", "festive", "classic", "rustic"],
        "fonts": ["'Playfair Display', serif", "'Caveat', cursive", "'Montserrat', sans-serif", "'Inter', sans-serif"],
        "colors": ["#c05621", "#744210", "#b7791f", "#2d6a4f", "#9c4221", "#553c9a"],
        "filters": ["warm", "rustic", "cozy", "festive", "soft"],
        "titles": [
            "Happy Thanksgiving Card — Grateful Custom Ecard",
            "Thankful for You — Custom Thanksgiving Greeting",
            "Happy Thanksgiving — Warm Family Card Online",
            "Grateful Heart — Thanksgiving Custom Ecard",
            "Thank You — Thanksgiving Warmth — Custom Card",
            "Thanksgiving Blessings — Custom Family Greeting",
            "Happy Turkey Day — Personalized Thanksgiving Card",
            "Grateful for Our Family — Thanksgiving Card",
            "Thankful for Friends Like You — Thanksgiving Ecard",
            "Thanksgiving Dinner Hostess Thank You — Card",
            "Thankful Today & Always — Custom Thanksgiving",
            "Happy Thanksgiving — Rustic Warm Design",
            "For Long Distance Family — Thanksgiving Card",
            "Give Thanks — Beautiful Custom Ecard Online",
            "Thanksgiving Wishes — Heartfelt Custom Card",
            "Grateful for Every Moment — Thanksgiving Ecard",
            "Happy Thanksgiving 2026 — Personalized Card",
            "Thankful for You — From Our Family to Yours",
            "Thanksgiving Love & Gratitude — Custom Card",
            "Blessings Abound — Happy Thanksgiving Card",
        ],
        "default_texts": [
            "Happy Thanksgiving! This year, I'm especially thankful for you — your love, your friendship, your kindness. Grateful for every memory. 🦃💛🍁",
            "Grateful for big things and small things, but most of all — grateful for you. Hope your Thanksgiving is full of food, family, and joy. 🦃🍗🍂",
            "On this day of thanks, the first person I thanked was the universe for putting you in my life. Happy Thanksgiving, always. 💛🦃✨",
            "Thanksgiving isn't just about turkey — it's about turkey AND people like you who make every day feel like a blessing. Happy Thanksgiving. 🍁🦃💛",
            "May your Thanksgiving table be full, your heart be fuller, and your napping game be stronger than ever this year. Happy Turkey Day! 😴🦃🍗",
            "Thankful for: 1) you, 2) pie, 3) you again, 4) pie again, 5) all of it. Happy Thanksgiving, my favorite person. 🥧💛🦃",
            "Happy Thanksgiving to my chosen family. You're the turkey, the stuffing, the cranberry sauce, and the best of every meal. 💛🍁✨",
            "From our family to yours: may your day be cozy, your plates be loaded, your team win the game, and your heart feel loved. Happy Thanksgiving. 🦃🍂",
            "Wishing the best Thanksgiving to the best friend/family member/hostess in the universe. Thank you for being a blessing in my life. 💛🥧🦃",
            "Long distance this Thanksgiving, but you're closer than ever in my heart. Missing you so much today and always. Grateful for you. 💙🦃🍁",
            "Thank you for the food you'll cook, the guests you'll host, the laughter you'll spread this Thanksgiving. You're the reason it's special. 🍗🦃💛",
            "As we give thanks today, I give thanks for you — for every piece of advice, every hug, every way you've shaped my life. Happy Thanksgiving. 🍁💛✨",
            "Thanksgiving is just one day, but I'm thankful for you 365 days a year. Have a blessed, delicious, cozy one. 🦃🥧🍂",
            "Happy Thanksgiving! May the calories be imaginary, the wine be bottomless, and the company be 10/10. Enjoy! 🦃🍷✨",
            "Grateful for our friendship / partnership / every dinner together. Thank you for being my people. Happy Thanksgiving from my heart to yours. 💛🍁",
            "To the hostess with the mostest: thank you for opening your home, your kitchen, your heart. Happy Thanksgiving — you deserve extra pie. 🥧💛🦃",
            "This Thanksgiving, I'm thankful for laughter that hurts, pies that don't, and people like you who make life taste sweeter. Happy Turkey Day! 🦃🍂✨",
            "Wishing you a Thanksgiving full of warm bread rolls, warmer hugs, and the warmest hearts around the table. Grateful for you. 💛🍞🤗",
            "Thankful for the past, the present, and the future — because you're in all three. Happy Thanksgiving, with love from us. 🍁💗🦃",
            "Happy Thanksgiving! May your day be cozy, your pie be cold, and your love be overflowing. And remember: stretchy pants are always a yes. 🥧😎💛",
        ],
        "tags_variants": [
            ["thanksgiving", "grateful", "family"],
            ["turkey-day", "pie", "hostess"],
            ["warm", "rustic", "cozy"],
            ["blessings", "long-distance-thanksgiving", "friends"],
            ["give-thanks", "autumn", "gratitude"],
        ],
    },
    "easter": {
        "display_name": "Easter",
        "styles": ["cheerful", "soft", "festive", "floral", "joyful"],
        "fonts": ["'Caveat', cursive", "'Playfair Display', serif", "'Montserrat', sans-serif", "'Inter', sans-serif"],
        "colors": ["#2d6a4f", "#9c27b0", "#d69e2e", "#48bb78", "#ebf4ff", "#b83280"],
        "filters": ["soft", "cheerful", "bright", "pastel", "warm"],
        "titles": [
            "Happy Easter Card — Cheerful Custom Ecard Online",
            "Easter Blessings — Custom Family Greeting Card",
            "He is Risen — Religious Easter Custom Card",
            "Easter Egg Hunt — Cheerful Kids Easter Ecard",
            "Happy Easter Bunny — Personalized Kids Card",
            "Easter Joy — Beautiful Custom Greeting Online",
            "For Godchild on Easter — Custom Blessing Card",
            "Happy Easter — Floral Spring Custom Ecard",
            "He Has Risen — Easter Religious Ecard Custom",
            "Easter Brunch Invitation / Wishes — Custom",
            "Happy Easter 2026 — Personalized Family Card",
            "Easter Wishes for Grandkids — Custom Ecard",
            "Spring & Easter Blessings — Custom Card Online",
            "Happy Easter — For Friends & Family — Custom",
            "Bunny Hugs & Easter Love — Custom Ecard",
            "Easter Basket of Wishes — Personalized Card",
            "Easter Sunday Blessings — Custom Greeting",
            "Happy Easter — Soft Pastel Floral Card",
            "Easter Love From Our Family to Yours — Card",
            "Easter Joy, Peace & Blessings — Custom Ecard",
        ],
        "default_texts": [
            "Happy Easter! May your day be bright with eggs, sweet with chocolate, and full of the people who make life wonderful. 🐰🥚🌷",
            "Easter blessings to you and yours. May this season of new life bring you hope, peace, and every good thing. He is Risen! ✝️🌷✨",
            "Wishing you the yummiest chocolate eggs, the cutest Easter bonnets, and the most blessed Easter with your family. Happy Easter! 🐰🍫💛",
            "He is risen, indeed! May your heart be filled with the hope and love of Easter today and always. Blessed Easter to you and your family. ✝️🌷",
            "Happy Easter to the best godchild / grandchild / niece / nephew ever! Hope the Easter Bunny leaves you ALL the best chocolate. Love you. 🐰🍫🥚",
            "Easter is proof that spring, miracles, second chances are real. Wishing you all three today and always. Happy Easter! 🌷✨🐣",
            "Sending you Easter hugs, sweet treats, and a whole basket of happy wishes for the season. Hope your day is perfect. 🐰🌷💛",
            "From our family to yours this Easter: may your eggs be colorful, your dinner be delicious, and your hearts be full of gratitude. 🌷🍫✨",
            "Happy Easter, dear friend! May this season bloom every wonderful thing in your life — health, joy, peace, love, and chocolate, of course. 🐰🌷💙",
            "Easter Sunday = Church + Brunch + Naps + Chocolate + Family = 10/10 day. Wishing you every bit of it. Happy Easter! ✝️🥐🥚",
            "This Easter, may you feel the sun on your face, chocolate on your fingers, and the love of family in your heart. Blessed Easter. 🌷🐣💛",
            "Happy Easter to my favorite people! May your baskets overflow with treats, your plates overflow with lunch, and your lives overflow with love. 🐰🍫",
            "Wishing a very blessed Easter to the kindest, most wonderful hostess of the annual brunch. Thank you for bringing us together again. 🍽️🌷✨",
            "Easter says: it's okay to start over, to bloom again, to believe in miracles after the darkest season. May that truth bless you today. ✝️🌷💙",
            "For my grandkids this Easter: you're the chocolate in my basket, the joy in my spring, the best of every holiday. Love you to the moon. 🐰🍫💛",
            "Happy Easter! Even if it's just a quiet one this year, may it feel warm, hopeful, and perfectly yours. God bless you this Easter. ✝️🌷",
            "To someone who's more family than friend: thank you for every Easter memory and the million more we're gonna make. Happy Easter! 🐣🌷💙",
            "May your Easter be pastel and peaceful, floral and full, sunny and sweet — just like you. Happy Happy Easter, with love. 🌸🌷💗",
            "Easter's not just eggs and bunnies — it's hope, redemption, love's greatest victory. May your heart believe that again today. ✝️💙✨",
            "Big hugs and Easter love from my home to yours. Enjoy every egg hunt, every bite, every minute with your favorite people. 🐰🍫🌷",
        ],
        "tags_variants": [
            ["easter", "easter-bunny", "egg-hunt"],
            ["religious", "he-is-risen", "blessings"],
            ["floral", "pastel", "cheerful"],
            ["godchild", "grandkids", "spring"],
            ["easter-brunch", "joy", "chocolate"],
        ],
    },
    "halloween": {
        "display_name": "Halloween",
        "styles": ["spooky", "playful", "festive", "vintage", "scary"],
        "fonts": ["'Creepster', cursive", "'Caveat', cursive", "'Montserrat', sans-serif", "'Inter', sans-serif"],
        "colors": ["#1a202c", "#d69e2e", "#c53030", "#553c9a", "#2d3748", "#2f855a"],
        "filters": ["spooky", "vintage", "dark", "festive", "dramatic"],
        "titles": [
            "Happy Halloween Card — Spooky Custom Ecard Online",
            "Boo! — Playful Halloween Custom Greeting Card",
            "Trick or Treat — Kids Halloween Custom Ecard",
            "Spooky Scary Halloween — Costume Party Card",
            "Happy Halloween — Vintage Pumpkin Custom Card",
            "Halloween Costume Party Invite / Wishes — Card",
            "Scary Movie Night — Happy Halloween Custom Ecard",
            "Pumpkin Carving Night — Fun Halloween Card",
            "For Neighbors on Halloween — Trick or Treat Card",
            "Funny Halloween — Punny Boo Custom Ecard",
            "Happy Halloween 2026 — Personalized Spooky Card",
            "Witches, Ghosts & Pumpkins — Halloween Custom",
            "For Kids Costume Party — Happy Halloween Ecard",
            "Boo-tiful Halloween — Custom Greeting Card",
            "Spooky Cute — Happy Halloween Custom Ecard",
            "Happy Halloween — From Our Family to Yours",
            "Scary Fun Halloween — Custom Ecard Online",
            "Wishing You a Spooktacular Halloween — Card",
            "Happy Halloween — Best Friends Forever Spooky",
            "Trick or Treat, Smell My Feet — Halloween Fun",
        ],
        "default_texts": [
            "Happy Halloween! May your costumes be iconic, your candy be delicious, and your house be the coolest on the block. Boo! 👻🎃🍬",
            "Boo! Just a spooky little hello from me to you. Hope your Halloween is scary-fun, not scary-scary. Stay safe, eat all the candy. 🎃👻✨",
            "Trick or treat! No tricks from me — only treats in the form of a personalized Halloween wish just for you. Enjoy! 🍬👻🎃",
            "Hope your Halloween is so good it's scary. May your costume win all the contests and your candy bowl never empty. 🎃🏆👻",
            "Happy Halloween to my favorite neighbor! Thank you for the full-size candy bars and the spooky yard every year. We see you, and we love you. 🍬🎃💙",
            "Pumpkin carving + scary movies + all-you-can-eat candy = our perfect Halloween. Counting down until we do it all together. 🎃🔪🍫",
            "Boo! Did I scare you? No? Good. Happy Halloween anyway, you brave soul. Go win that costume contest. 👻✨🎃",
            "Wishing a very happy, spooky, candy-filled Halloween to the cutest witch / ghost / pumpkin / monster in the whole world. 🧙‍♀️👻🎃",
            "Halloween is the best excuse to eat candy for dinner and be whoever you want for one night. Go live your best spooky life. 🎃🍬✨",
            "To the host of the annual Halloween party: thank you for the scares, the snacks, the unforgettable costumes. You're a legend. 🎃🎉👻",
            "This Halloween, may your costume be creative, your pumpkins be perfectly carved, and your night be 10/10 no matter how you celebrate. 🎃✨👻",
            "Happy Halloween from our family to yours — may the ghosts be friendly, the zombies be slow, and the candy be plenty. 🧟‍♂️🍬🎃",
            "Just a reminder that Halloween costumes have no age limit. Never stop dressing up. Never stop eating candy. Happy Halloween, always. 🎃👻🍫",
            "Sending you a whole batch of Halloween vibes: haunted houses, foggy nights, warm cider, and pumpkin everything. Enjoy! 🏚️🎃🍎",
            "Boo-tiful Halloween wishes to the most boo-tiful person I know. Hope your day is full of treats and zero tricks. 💗👻🎃",
            "Halloween = Costume + Candy + Scary Movies 3peat. Hope you get all three this year. Happy Halloween! 🎃🍫🎬",
            "For my bestie this Halloween: let's dress up ridiculous, dance in the street, and eat candy until our teeth regret it. You in? 👯‍♀️👻🍬",
            "May your costume look fire, your jack-o'-lantern not rot too fast, and your Halloween photos be legendary. Happy spooky season! 🎃📸✨",
            "Halloween is proof that being a little weird is not just okay — it's celebrated. Go be weird and have the best night ever. 👻🎃✨",
            "Happy, happy Halloween! Stay safe out there, parents of costumed kiddos and dogs in sweaters — we see you, and we appreciate you. 🎃🐶🍬",
        ],
        "tags_variants": [
            ["halloween", "boo", "trick-or-treat"],
            ["costume-party", "spooky", "pumpkin"],
            ["vintage", "scary", "playful"],
            ["pumpkin-carving", "scary-movies", "neighbor"],
            ["witch", "ghost", "candy"],
        ],
    },
    "friendship": {
        "display_name": "Friendship",
        "styles": ["cheerful", "warm", "playful", "classic", "bright"],
        "fonts": ["'Caveat', cursive", "'Playfair Display', serif", "'Montserrat', sans-serif", "'Inter', sans-serif"],
        "colors": ["#b83280", "#d69e2e", "#2b6cb0", "#2d6a4f", "#553c9a", "#c05621"],
        "filters": ["warm", "bright", "cheerful", "soft", "festive"],
        "titles": [
            "Best Friend Card — Warm Friendship Custom Ecard",
            "Thank You Bestie — Personalized Friendship Card",
            "To My Best Friend Forever — Custom Card Online",
            "Friends Forever — Cheerful Custom Greeting",
            "For My BFF — Heartfelt Friendship Custom Ecard",
            "Bestie Vibes Only — Fun Friendship Card Online",
            "Thank You for Being a Friend — Custom Ecard",
            "To My Best Friend — I Love You — Custom Card",
            "BFF — Best Friends Forever — Custom Ecard",
            "For My Squad — Friendship Love Custom Card",
            "Friends Like You Are Rare — Custom Card",
            "Roommate to BFF — Friendship Custom Ecard",
            "Long Distance Best Friend — Custom Card",
            "Galentine's Day — Best Friends Love — Card",
            "Work Bestie Turned Real Bestie — Card",
            "Best Friend Birthday? No — Just Thank You",
            "Childhood Friend Forever — Custom Ecard",
            "Grateful for Our Friendship — Custom Card",
            "My Person — Friendship Custom Ecard Online",
            "Ride or Die Bestie — Friendship Custom Card",
        ],
        "default_texts": [
            "To my best friend in the whole world: thank you for loving me at my worst, laughing with me at my dumbest, and being my constant. I love you. 💙✨💗",
            "If friendships had award shows, you'd win Best Friend every year. Thanks for being the GOAT of besties. I love you. 🏆💙✨",
            "Best friends don't let friends do stupid things… alone. Thank you for doing all the stupid things with me and never apologizing for it. 😂💙👯‍♀️",
            "Friends like you come once in a lifetime. I'm so lucky I got to keep you forever. Thank you for being my person, my partner in crime, my rock. 💛✨",
            "Long distance may separate us physically, but we're still the same idiots who think the same memes are funny. Miss you, bestie. Can't wait to hug you. 💙🤗",
            "To my work wife / work husband: thank you for surviving Monday meetings, coffee runs, and 'one quick question' with me. I'd quit without you. ☕💙😂",
            "To my squad: thank you for the inside jokes, the ugly selfies, the terrible dance moves, and every memory I wouldn't trade for the world. Love you crew. 📸💗✨",
            "Thank you for the late-night phone calls, the 'I need to vent' texts at 2am, the 'drop everything' coffee runs. Real ones like you are rare. 💙☕💛",
            "Growing up sucks, but it sucks a lot less with a best friend like you. Thank you for being my ride-or-die since kindergarten / college / forever. 🏫✨",
            "Friends who become family are the best family. Thank you for choosing me, for loving my weird, for knowing every version of me and staying. 💗💙🤗",
            "Happy Galentine's Day to my actual favorite valentine — you, babe. Love you more than chocolate and wine combined. 🍷🍫💗",
            "Thank you for every sleepover, every road trip, every 'I can't believe we did that' story. You're my favorite memory machine. Bestie 4ever. 🚗✨💙",
            "Real friendship: when I say 'I'm fine,' you already know I'm not and have brought wine. Thank you for knowing me better than I know myself. 🍷💛✨",
            "To my college roommate turned lifelong bestie: I don't know how I survived dorm life / grad school / my 20s without you. Love you to the moon. 🌙💙🤗",
            "Bestie reminder: you're doing great, you're beautiful, you're funny, you're smart, and if that stupid boy doesn't see it we'll block him together. 💅✨💙",
            "I don't tell you enough, but every time we talk / hang / text for hours, my week gets 1000% better. Thank you for existing. I love you, bestie. 💗🤗✨",
            "To my ride or die: we been through breakups, bad haircuts, questionable fashion, and everything in between. And I'd do it all again with you. 💙💗",
            "Friendship means being weird together, and we are extremely good at that. Here's to many more years of our unhinged, wonderful bond. Love you. 😂✨💙",
            "Thank you for the friendship that doesn't need constant texts or calls to know we still love each other like crazy. That's the real kind. 💛✨",
            "To my absolute favorite person on the planet: thank you for the laughs, the lessons, the love. You're my best friend, and I'll choose you every time. 💙💗🤗",
        ],
        "tags_variants": [
            ["friendship", "best-friend", "bff"],
            ["bestie", "squad", "chosen-family"],
            ["warm", "cheerful", "playful"],
            ["galentines", "long-distance-friend", "work-bestie"],
            ["roommate", "childhood-friend", "grateful"],
        ],
    },
    "good-luck": {
        "display_name": "Good Luck",
        "styles": ["cheerful", "warm", "bold", "classic", "bright"],
        "fonts": ["'Montserrat', sans-serif", "'Playfair Display', serif", "'Inter', sans-serif", "'Caveat', cursive"],
        "colors": ["#2d6a4f", "#d69e2e", "#2b6cb0", "#553c9a", "#b83280", "#c53030"],
        "filters": ["bright", "warm", "cheerful", "classic", "festive"],
        "titles": [
            "Good Luck Card — Fingers Crossed Custom Ecard",
            "Best Wishes — Good Luck Custom Greeting Online",
            "Good Luck on Your Exam — Personalized Ecard",
            "Good Luck Job Interview — Custom Cheer Card",
            "Good Luck New Job — Custom Celebration Ecard",
            "Good Luck Surgery & Recovery — Warm Custom",
            "Good Luck Sports Match — Personalized Ecard",
            "Good Luck Performance / Audition — Custom Card",
            "Good Luck Driving Test — Fun Custom Ecard",
            "Good Luck First Day of School — Custom Card",
            "Good Luck Moving Abroad — Custom Farewell Card",
            "Good Luck New Business Launch — Cheer Card",
            "Fingers Crossed — Big Luck Coming Your Way",
            "Knock Em Dead — Good Luck Custom Ecard",
            "Good Luck on Your Big Day — Personalized",
            "Best of Luck for Your Competition — Card",
            "You Got This — Good Luck Custom Ecard Online",
            "Good Luck & Safe Travels — Custom Wishes Card",
            "Break a Leg — Performance Good Luck Card",
            "Good Luck Pregnancy Test — Warm Custom Card",
        ],
        "default_texts": [
            "Good luck! Not that you need it — you're smart, prepared, and incredible. This is just the cherry on top of your already awesome self. 🍒✨🍀",
            "Best wishes for the exam / interview / surgery / big day. You've prepared, you've practiced, you've got this. I believe in you. 💛✨🚀",
            "Fingers crossed, good vibes only, all the luck in the world heading your way right now. May it find you and stay with you all day long. 🍀✨💙",
            "Knock 'em dead! The room / field / exam hall doesn't stand a chance against you. Go show them exactly what you're made of. 💪✨🏆",
            "Good luck on your new job — they have NO idea how lucky they are to have hired you. Go be brilliant on day one. 🏢✨💙",
            "Break a leg! Not literally, please — I'm not that kind of friend. Go have the best performance / audition ever. I know you will. 🎭✨🎶",
            "Wishing you all the luck before your driving test. Remember: brakes are your friend, mirrors are your sidekicks, and the examiner is just a person. 🚗✨💙",
            "Good luck on your surgery and speedy, smooth recovery. I'll be thinking of you every minute and waiting for you to come back strong. 💛🏥✨",
            "To my favorite athlete before the big game: you've trained your whole life for this moment. Go out there and leave every drop of it on the field. 🏟️💪🏆",
            "First day of school / college? Don't be nervous. You're gonna crush it, meet great people, learn amazing things. I'm so proud of you already. 🎓✨💙",
            "Good luck moving abroad! It's the bravest, most wonderful thing you can do. I'll miss you, but I'll be cheering from my time zone. ✈️🌍✨",
            "New business launch day: you were born for this. Every hustle, every late night, every 'no' you didn't listen to — it all leads to today. Go get it. 💼🚀✨",
            "Good luck, baby! Whatever the big thing is, whatever the result — I'm already so proud of you for trying. That's what matters most. 💗✨💛",
            "You've put in the work, now go get the win. The universe owes you this one, and I'm here to watch you collect. 🍀✨💪",
            "Safe travels & good luck on your trip / move / adventure. May your flights be on time, your luggage arrive, and your journey be full of magic. ✈️🧳✨",
            "Biggest good luck vibes for the pregnancy test / baby news. Whatever the result, I love you and we'll handle it together. 💛🤰✨",
            "Fingers so crossed for you they'll be stuck that way for a week. May everything go exactly how you want it, if not better. 🍀✨💙",
            "Good luck and don't forget: even if it doesn't go 100% perfect, it doesn't mean you failed. Trying is the bravest part. I'm so proud of you. 💛✨💙",
            "Good luck on the competition! You've earned your spot, you deserve your shot, you've got the skills. Win or learn — you've already won. 🏆✨💪",
            "All the good luck, all the good vibes, all the love in the world coming your way. You're gonna do absolutely amazing. Go get 'em. ✨🍀💙💛",
        ],
        "tags_variants": [
            ["good-luck", "best-wishes", "fingers-crossed"],
            ["exam", "job-interview", "new-job"],
            ["surgery", "sports", "performance"],
            ["driving-test", "moving", "new-business"],
            ["you-got-this", "safe-travels", "proud-of-you"],
        ],
    },
    "graduation": {
        "display_name": "Graduation",
        "styles": ["celebratory", "proud", "classic", "elegant", "bright"],
        "fonts": ["'Playfair Display', serif", "'Montserrat', sans-serif", "'Inter', sans-serif", "'Caveat', cursive"],
        "colors": ["#1a365d", "#553c9a", "#d69e2e", "#2d3748", "#2b6cb0", "#2d6a4f"],
        "filters": ["celebratory", "bright", "warm", "classic", "elegant"],
        "titles": [
            "Happy Graduation Card — Proud Custom Ecard Online",
            "Congratulations Graduate — Personalized Custom Card",
            "Class of 2026 Graduation — Custom Celebratory Ecard",
            "High School Graduation — Proud of You — Custom",
            "College Graduation — Congrats Custom Card",
            "Masters / PhD Graduation — Custom Proud Ecard",
            "Nursing / Law / Med School Graduation — Card",
            "Proud of You Graduate — Custom Heartfelt Ecard",
            "For Son on Graduation — Proud Custom Card",
            "For Daughter on Graduation — Personalized Ecard",
            "Kindergarten Graduation — Cute Custom Card",
            "From Teacher to Student — Graduation Proud Card",
            "From Classmate to Graduate — Custom Card Online",
            "You Did It! — Graduation Celebratory Ecard",
            "Diploma Earned — Next Chapter Begins — Card",
            "Proud Graduate — Next Chapter Exciting — Custom",
            "Graduation Day — Well Deserved Celebration",
            "Happy Graduation 2026 — Personalized Card",
            "To Our Graduate — We Are So Proud — Custom",
            "Middle School Graduation — Next Step Card",
        ],
        "default_texts": [
            "Congratulations, Graduate! You did it — the exams, the papers, the all-nighters, the million cups of coffee. It all led to this. We are SO proud. 🎓✨🎉",
            "To the Class of 2026: welcome to the 'we stayed up way too many nights studying' club. Now go out there and change the world. We believe in you. 🎓🚀✨",
            "You earned that diploma. Every single class, every single paper, every single 'I can't do this' moment you survived. I am beyond proud of you. 💛🎓🏆",
            "Happy Graduation, from one exhausted student to an official exhausted graduate! May your next job be easy, your coffee be strong, your student loans somehow vanish. 🎓☕😂",
            "To my daughter on your graduation: the moment I held you as a baby, I knew you'd do great things. Today I got to watch you start them. I love you. 💗🎓✨",
            "To my son on your graduation: I always knew you'd be something special. Watching you graduate just proved I was right. I'm so, so proud of you. 💙🎓🎉",
            "From your teacher: you made me proud every single year. Watching you walk across that stage was the best part of my career. Go change lives. You already changed mine. 🎓💛✨",
            "To my best friend / roommate on graduation day: we survived every paper, every party, every 8am lecture together. Can't wait to survive life together too. 🎓👯‍♀️✨",
            "Happy Graduation to the future nurse / lawyer / doctor / teacher / engineer of my dreams. The world needed someone like you, and now it's getting you. 🎓✨🌟",
            "For the kindergarten graduate on your big day: you survived naptime, snack time, and crayon emergencies all at once. You're basically a superhero. Go get 'em, tiger. 🧒🎓⭐",
            "From the whole class of 2026 to you: thank you for the study sessions, the group projects, the notes you shared, the memes that got us through. Class of legends. 🎓💙✨",
            "Graduation tip: your diploma doesn't come with all the answers. But it does come with all the tools. Trust your journey. It's gonna be great. 🎓🚀✨",
            "Middle school graduation: the first of many, many proud moments for you. I can already picture high school, college, master's, PhD… okay maybe I'm getting ahead. 💙🎓😂",
            "To my PhD graduate: you wrote a thesis longer than most novels AND defended it in front of experts. You can do literally anything. I'm in awe of you. 🎓📚✨",
            "Graduation Day: diploma in one hand, phone for 900 photos in the other. May every picture be perfect, every hug be warm, every memory be gold. 📸🎓💛",
            "May your graduation be the first of many 'I did it' moments in a life full of them. You're ready for the next chapter. I know it, and so should you. 🎓✨🚀",
            "To our graduate: mom and dad cried, grandma cheered, grandpa bragged to everyone. Thank you for giving us all the best reason to be proud. We love you. 🎓💙💗",
            "You didn't just graduate — you grew, you struggled, you persisted, and you became someone even more wonderful than when you started. That's the real win. 🎓✨💛",
            "Happy Graduation! Here's to late-night essays becoming late-night salary paydays, to textbooks being replaced with paychecks, to your most exciting chapter yet. 🎓💰✨",
            "To the graduate who's also a parent / caretaker / first-gen student / full-time worker on the side: your superhuman effort is seen, respected, and so admired. 🎓🏆✨",
        ],
        "tags_variants": [
            ["graduation", "class-of-2026", "congrats-grad"],
            ["high-school", "college", "masters-phd"],
            ["proud", "celebratory", "next-chapter"],
            ["from-teacher", "from-classmate", "for-son-for-daughter"],
            ["nursing-grad", "law-school", "med-school"],
        ],
    },
    "birthday-no-image": {
        "display_name": "Birthday",
        "styles": ["warm"], "fonts": ["'Playfair Display', serif"], "colors": ["#2d6a4f"], "filters": ["warm"],
        "titles": [], "default_texts": [], "tags_variants": [],
    },
}

# ═══════════════════════════════════════════════════════════════════════════
# SEO 语义变体词 — 用于替换原本的 #数字 后缀，让 title / slug 更自然
# ═══════════════════════════════════════════════════════════════════════════
AESTHETIC_ADJECTIVES = [
    "Romantic", "Elegant", "Warm", "Cheerful", "Classic", "Modern",
    "Vintage", "Minimalist", "Watercolor", "Floral", "Rustic", "Chic",
    "Boho", "Playful", "Dreamy", "Whimsical", "Cozy", "Luxury",
    "Pastel", "Bold", "Contemporary", "Traditional", "Delicate", "Joyful"
]

DEFAULT_RECIPIENTS = [
    "for Her", "for Him", "for Mom", "for Dad", "for Grandma", "for Grandpa",
    "for Sister", "for Brother", "for Best Friend", "for Couple",
    "for Coworker", "for Boss", "for Daughter", "for Son", "for Loved One",
    "for Partner", "for Neighbor", "for Aunt", "for Uncle", "for Niece",
    "for Nephew", "for Cousin", "for Teacher", "for Wife", "for Husband",
    "for Girlfriend", "for Boyfriend", "for Fiancée", "for Fiancé", "for Soulmate",
    "for Parents", "for Grandparents", "for Kids", "for Colleague", "for Client"
]

CATEGORY_RECIPIENTS = {
    "birthday": [
        "for 1st Birthday", "for 16th Birthday", "for 18th Birthday",
        "for 21st Birthday", "for 30th Birthday", "for 40th Birthday",
        "for 50th Birthday", "for 60th Birthday", "for 70th Birthday",
        "for 80th Birthday", "for 90th Birthday", "for 100th Birthday",
        "for Her", "for Him", "for Kids", "for Baby", "for Mom",
        "for Dad", "for Best Friend", "for Coworker", "for Girlfriend",
        "for Boyfriend", "for Husband", "for Wife", "for Daughter",
        "for Son", "for Grandma", "for Grandpa", "for Sister",
        "for Brother", "for Teacher", "for Boss", "for Neighbor",
        "for Twins", "for Teenager", "for Toddler",
    ],
    "love": [
        "for Her", "for Him", "for Wife", "for Husband", "for Girlfriend",
        "for Boyfriend", "for Fiancée", "for Fiancé", "for Soulmate",
        "for Partner", "for Long Distance Love", "for New Relationship",
        "for Just Because", "for Anniversary Love", "for Crush",
        "for Newlyweds", "for Parents Love", "for Grandparents Love",
        "for Secret Admirer", "for Best Friend Love", "for Galentine",
        "for Longtime Love", "for Reconnected Love",
    ],
    "valentine": [
        "for Her", "for Him", "for Wife", "for Husband", "for Girlfriend",
        "for Boyfriend", "for Fiancée", "for Fiancé", "for Crush",
        "for Partner", "for Soulmate", "for Galentine",
        "for Secret Admirer", "for New Love", "for Long Distance Love",
        "for Best Friend (Platonic)", "for Singles Awareness",
    ],
    "wedding": [
        "for the Couple", "for Newlyweds", "for Bride", "for Groom",
        "for the Happy Pair", "for Mr & Mrs", "for Bride & Groom",
        "for Their Big Day", "for Best Friend's Wedding",
        "for Sister's Wedding", "for Brother's Wedding",
        "for Daughter's Wedding", "for Son's Wedding",
        "for Coworker's Wedding", "for Bridal Shower",
        "for Rehearsal Dinner", "for Vow Renewal",
    ],
    "anniversary": [
        "for Her", "for Him", "for Wife", "for Husband", "for Couple",
        "for Parents", "for Grandparents", "for Girlfriend", "for Boyfriend",
        "for Fiancée", "for Fiancé", "for Partner", "for Soulmate",
        "for 1st Paper", "for 5th Wood", "for 10th Tin", "for 25th Silver",
        "for 50th Gold", "for Vow Renewal", "for Longtime Married Couple",
    ],
    "sympathy": [
        "for Loss of Father", "for Loss of Mother", "for Loss of Loved One",
        "for Loss of Pet", "for Loss of Husband", "for Loss of Wife",
        "for Loss of Child", "for Grieving Friend", "for Grieving Family",
        "for Memorial Service", "for Remembrance", "for Condolence",
        "for Bereavement", "for Comfort & Support", "for Loss of Grandparent",
        "for Loss of Sibling", "for Funeral Flowers Note",
    ],
    "encouragement": [
        "for Exam Success", "for Job Interview", "for New Job",
        "for Starting College", "for Recovery", "for Weight Loss Journey",
        "for Sports Competition", "for Moving Away", "for Tough Times",
        "for Cancer Support", "for Mental Health", "for Career Change",
        "for First Steps", "for Chasing Dreams", "for Sobriety Milestone",
        "for Gym Workout", "for New Business", "for Pregnancy Support",
    ],
    "get-well": [
        "after Surgery", "for Cancer Treatment", "for Flu & Fever",
        "after Accident", "for Mental Health Recovery", "for Long Illness",
        "for Hospital Stay", "for Speedy Recovery", "from Hospital Staff",
        "for Caregiver", "after Childbirth", "for Back Pain",
        "for Anxiety Support", "for Depression Support", "after Knee Surgery",
        "after Heart Procedure", "for Pneumonia Recovery",
    ],
    "new-baby": [
        "for Baby Shower", "for New Mom & Dad", "for Baby Girl",
        "for Baby Boy", "for Gender Neutral Baby", "for Adoption",
        "for Surrogacy", "for First Time Parents", "for Grandchild",
        "from Aunt", "from Uncle", "from Grandparents", "from Godparent",
        "for Newborn", "for Twins Baby", "for Rainbow Baby",
        "for Baby Naming Ceremony",
    ],
    "graduation": [
        "for High School Graduation", "for College Graduation",
        "for Masters Graduation", "for PhD Graduation",
        "for Kindergarten Graduation", "for Middle School Graduation",
        "for Son", "for Daughter", "for Best Friend",
        "for Sister", "for Brother", "for Coworker",
        "from Teacher", "from Classmate", "for Nursing Graduate",
        "for Law School Graduate", "for Med School Graduate",
    ],
    "retirement": [
        "for Teacher Retirement", "for Nurse Retirement",
        "for Police Retirement", "for Firefighter Retirement",
        "for Military Retirement", "for Office Retirement",
        "for Dad Retirement", "for Mom Retirement",
        "for Best Friend Retirement", "for Boss Retirement",
        "for Coworker Retirement", "for Next Chapter",
        "from Team Members", "for Well-Deserved Rest",
    ],
    "mothers-day": [
        "from Daughter", "from Son", "from Kids", "from Husband",
        "for Grandma", "for Great Grandma", "for New Mom",
        "for Expecting Mom", "from Best Friend",
        "for Adoptive Mom", "for Foster Mom", "for Mom in Heaven",
        "for Step Mom", "for Dog Mom", "for Cat Mom",
        "for Grandma from Grandkids", "for Bonus Mom",
    ],
    "fathers-day": [
        "from Daughter", "from Son", "from Kids", "from Wife",
        "for Grandpa", "for Great Grandpa", "for New Dad",
        "for Expecting Dad", "from Best Friend",
        "for Adoptive Dad", "for Foster Dad", "for Dad in Heaven",
        "for Step Dad", "for Dog Dad", "for Cat Dad",
        "for Grandpa from Grandkids", "for Bonus Dad",
    ],
    "christmas": [
        "for Family", "for Kids", "for Neighbor", "for Teacher",
        "for Secret Santa", "for Office Team", "for Grandkids",
        "for Godchild", "for Hostess", "for Service Worker",
        "for Faraway Family", "for Christmas Party Host",
        "from Santa", "for Charity",
    ],
    "new-year": [
        "for New Year's Eve Party", "for New Year's Resolution",
        "for Family New Year", "for Friends NYE",
        "for Fresh Start", "for Career Goals",
        "for Health Goals", "for Relationship Goals",
        "for Year of the Snake (2025)", "for Travel Goals",
        "for Happy New Year Blessings", "for Office New Year",
    ],
    "halloween": [
        "for Kids Costume Party", "for Adults Costume Party",
        "for Neighbor Trick or Treat", "for Scary Movie Night",
        "for Pumpkin Carving Night", "for Best Friend",
        "for Halloween Party Host", "for Family",
        "for Spooky Cute", "for Horror Fan",
    ],
    "thanksgiving": [
        "for Hostess", "for Family Dinner", "for Friends Thanksgiving",
        "for Neighbor", "for Thankful Card",
        "for Best Friend", "for Grandma & Grandpa",
        "for Coworker Team", "for Teacher", "for Long Distance Family",
    ],
    "easter": [
        "for Kids Egg Hunt", "for Family Easter Brunch",
        "for Church Service", "for Grandkids Basket",
        "for Godchild", "for Hostess of Brunch", "for Family",
        "for Religious Easter", "for Bunny Card",
    ],
    "sorry": [
        "for Her", "for Him", "for Best Friend", "for Boss",
        "for Coworker", "for Sister", "for Brother",
        "for Mom", "for Dad", "for Partner",
        "for Mistake at Work", "for Broken Promise", "for Hurt Feelings",
        "for Missing Event", "for Late Reply",
    ],
    "thank-you": [
        "for Gift", "for Help", "for Support", "for Hospitality",
        "for Teacher", "for Boss", "for Coworker",
        "for Mom", "for Dad", "for Best Friend",
        "for Mentor", "for Neighbor", "for Volunteer Work",
        "for Referral", "for Recommendation", "for Baby Shower Gift",
        "for Wedding Gift", "for Service Worker",
    ],
    "congratulations": [
        "on Promotion", "on New Job", "on Engagement",
        "on Wedding", "on Pregnancy", "on New Baby",
        "on Graduation", "on Retirement", "on Award",
        "on Milestone", "on Moving House", "on New Business",
        "on Engagement Party", "on Anniversary", "on Sports Win",
    ],
    "thinking-of-you": [
        "for Long Distance Friend", "for Missing Someone",
        "for Just Because", "for Going Through a Lot",
        "for Hospital", "for Busy Friend", "for Deployed Military",
        "for Studying Abroad", "for After Breakup",
        "for Sending Sunshine", "for Hugs", "for Old Friend",
    ],
    "missing-you": [
        "for Long Distance Boyfriend", "for Long Distance Girlfriend",
        "for Long Distance Best Friend", "for Family Overseas",
        "for Deployed Spouse", "for College Student Away",
        "for Sister Far Away", "for Brother Far Away",
        "for Expat Missing Home", "for Can't Wait to See You",
        "for Come Back Soon", "for Military Deployment",
    ],
    "good-luck": [
        "for Exam", "for Job Interview", "for New Job",
        "for Surgery", "for Sports Match", "for Performance",
        "for Driving Test", "for First Day of School",
        "for Moving Abroad", "for New Business Launch",
        "for Competition", "for Travel Safe",
        "for Pregnancy Test", "for Lottery",
    ],
    "friendship": [
        "for Best Friend", "for Childhood Friend", "for New Friend",
        "for Long Distance Friend", "for Work Friend",
        "for Galentine's Day", "for Bestie", "for BFF",
        "for Thank You Friend", "for Old Friend Reunion",
        "for Roommate", "for College Roommate", "for Squad",
    ],
}


DEFAULT_FALLBACK = {
    "styles": ["warm", "cheerful", "classic", "elegant", "soft"],
    "fonts": ["'Playfair Display', serif", "'Montserrat', sans-serif", "'Caveat', cursive", "'Inter', sans-serif"],
    "colors": ["#2d6a4f", "#1a365d", "#744210", "#b83280", "#2b6cb0", "#553c9a"],
    "filters": ["warm", "soft", "cheerful", "classic", "bright"],
    "titles": [
        "Beautiful Greeting Card — Personalize & Send Online",
        "Send a Custom Ecard With Your Message",
        "Warm Wishes — Personalized Greeting Card",
        "Your Words, Beautifully Designed — Custom Ecard",
        "Thoughtful Ecard for Any Occasion Online",
        "Elegant Greeting Card to Send Instantly",
        "Heartfelt Wishes — Customize Your Own Ecard",
        "Cheerful Greeting Card — Free Preview Online",
        "Meaningful Ecard With Your Custom Message",
        "From the Heart — Personalized Greeting Ecard",
        "Stylish Custom Card for Any Moment",
        "Sending Warmth — Your Message, Your Way",
        "Modern Greeting Card — Personalize Instantly",
        "Lovely Ecard to Brighten Their Day",
        "Custom Greeting Card for Any Recipient",
        "Bright & Beautiful — Personalized Ecard",
        "Genuine Wrapped in Design — Custom Card",
        "Your Message, Perfectly Presented — Ecard",
        "Sending Smiles With Your Words — Card",
        "Beautiful Design + Your Words = Perfect Card",
    ],
    "default_texts": [
        "Sending you warm wishes and a big smile today. You deserve all the good things. ✨💛",
        "Just because you're on my mind, and I wanted to say hi. Hope your day is lovely. 🌸💗",
        "Thinking of you today and sending love your way. Thank you for being you. 💙🤗",
        "Hope your day is filled with small joys, big smiles, and everything nice. ☀️💖",
        "You're awesome and the world needs to hear it more. Have a beautiful day. ✨💛",
        "Sending a little sunshine to wherever you are today. Keep being amazing. 🌞💙",
        "Life's better when we tell people we care. So here: I care. You're wonderful. 💗",
        "Whatever today brings, I hope it brings you reasons to smile. You deserve them. 😊✨",
        "You matter. Your day matters. Your heart matters. Hope you feel all the love today. 💛💙",
        "Small note, big love. Sending you everything good on this ordinary-beautiful day. 🌸💗",
        "Somewhere in the world today, someone is lucky to cross paths with you. 💙✨",
        "Reminder: you're doing better than you think, and you're loved more than you know. 💛✨",
        "Every day is a good day to tell someone you appreciate them. I appreciate you. 💗🤗",
        "May your day be as wonderful and special as you are. That's very wonderful and very special. ✨",
        "I'm grateful for you. That's the whole message. Grateful, and lucky to know you. 💙😊",
        "Warm hugs from me to you. May your heart be light and your coffee be strong. ☕💗",
        "You bring so much goodness to the world. Just stopping by to say: thank you. 💛✨",
        "Hope something wonderful happens to you today. You deserve wonderful things. ✨🌸",
        "With a heart full of gratitude, I just want to say: I'm so glad you exist. 💙💗",
        "One tiny message, one million warm wishes coming your way. Have a beautiful day. ✨💛",
    ],
    "tags_variants": [
        ["warm", "caring", "just-because"],
        ["cheerful", "kindness", "appreciation"],
        ["sweet", "heartfelt", "any-occasion"],
        ["elegant", "modern", "friendly"],
        ["love", "smile", "joy"],
    ],
}

CATEGORY_KEYWORDS = {
    "birthday": ["birthday card", "happy birthday ecard", "free birthday card online", "personalized birthday card", "send birthday card", "custom birthday greeting", "birthday wishes ecard", "birthday greeting online"],
    "love": ["love card", "romantic ecard", "i love you card online", "personalized love note", "send love card", "love greeting card", "romantic love ecard", "sweet love message"],
    "thank-you": ["thank you card", "thanks ecard", "appreciation card online", "personalized thank you", "send thank you card", "gratitude greeting card", "thank you note ecard", "custom thanks"],
    "get-well": ["get well card", "get well soon ecard", "healing wishes card", "recovery greeting online", "send get well card", "speedy recovery ecard", "feel better card", "comforting get well"],
    "congratulations": ["congratulations card", "congrats ecard", "achievement greeting online", "personalized congrats", "celebration card", "well done ecard", "success greeting card", "proud of you card"],
    "missing-you": ["missing you card", "i miss you ecard", "long distance card online", "thinking of you card", "send miss you card", "wish you were here ecard", "love across miles", "come back soon card"],
    "sympathy": ["sympathy card", "condolences ecard", "loss greeting online", "personalized sympathy", "send condolences card", "comfort in grief ecard", "prayers and sympathy", "bereavement card"],
    "anniversary": ["anniversary card", "wedding anniversary ecard", "couples greeting online", "personalized anniversary", "send anniversary card", "romantic anniversary ecard", "for him for her card", "celebrate us"],
    "new-baby": ["new baby card", "welcome baby ecard", "newborn congratulations online", "personalized baby card", "send new baby card", "baby shower greeting", "new parents ecard", "bundle of joy card"],
    "encouragement": ["encouragement card", "motivational ecard", "you got this card online", "personalized encouragement", "support greeting card", "cheer up ecard", "keep going card", "inspirational greeting"],
    "wedding": ["wedding card", "wedding congratulations ecard", "newlyweds greeting online", "personalized wedding wishes", "send wedding card", "mr and mrs ecard", "marriage congratulations", "happy ever after card"],
    "valentine": ["valentines day card", "valentine ecard", "be mine greeting online", "personalized valentine", "romantic valentines card", "hearts day ecard", "send valentine online", "love on valentines"],
    "christmas": ["christmas card", "holiday greeting ecard", "merry christmas online", "personalized holiday card", "send xmas ecard", "festive greeting card", "christmas wishes card", "happy holidays ecard"],
    "new-year": ["new year card", "happy new year ecard", "fresh start greeting online", "personalized new year wishes", "send new year card", "cheers to new year ecard", "2026 greeting card", "new beginnings card"],
    "mothers-day": ["mothers day card", "happy mothers day ecard", "mom greeting online", "personalized mothers day", "card for mom", "best mom ecard", "love you mom card", "mothers day wishes"],
    "fathers-day": ["fathers day card", "happy fathers day ecard", "dad greeting online", "personalized fathers day", "card for dad", "best dad ecard", "love you dad card", "fathers day wishes"],
    "retirement": ["retirement card", "retirement congratulations ecard", "farewell greeting online", "personalized retirement", "happy retirement card", "next chapter ecard", "well deserved retirement", "career celebration card"],
    "sorry": ["apology card", "im sorry ecard", "forgive me greeting online", "personalized apology", "say sorry card", "my apologies ecard", "forgiveness card", "make amends online"],
    "thinking-of-you": ["thinking of you card", "just because ecard", "on my mind greeting online", "personalized thinking of you", "send warm thoughts card", "hello ecard", "check in greeting card", "just to say hi"],
    "thanksgiving": ["thanksgiving card", "grateful ecard", "thanksgiving greeting online", "personalized thanksgiving", "gratitude family card", "turkey day ecard", "blessings thanksgiving", "thankful card"],
    "easter": ["easter card", "happy easter ecard", "spring greeting online", "personalized easter", "bunny eggs card", "easter blessings ecard", "religious easter card", "joyful easter"],
    "halloween": ["halloween card", "spooky greeting ecard", "trick or treat online", "personalized halloween", "funny halloween card", "boo ecard", "october greeting card", "spooky cute wishes"],
    "friendship": ["friendship card", "best friend ecard", "friends forever online", "personalized friendship", "card for bestie", "bff greeting card", "love my friend ecard", "thank you friend"],
    "good-luck": ["good luck card", "best wishes ecard", "fortune greeting online", "personalized good luck", "fingers crossed card", "exam luck ecard", "new adventure card", "wishing you luck"],
    "graduation": ["graduation card", "congrats grad ecard", "diploma greeting online", "personalized graduation", "proud graduate card", "class of ecard", "next chapter graduation", "achievement degree"],
}


def scan_images():
    """扫描 R2 sendafun-preview 桶中所有已上传 watermarked webp，按分类+pexels_id 分组"""
    images = defaultdict(lambda: defaultdict(dict))

    keys = list_r2_keys(PREVIEW_BUCKET)
    if not keys:
        # Fallback: try local filesystem (for development environments without R2 access)
        print("  [INFO] No R2 keys returned; falling back to local source/images scan.")
        if not IMAGES_DIR.exists():
            return images
        for cat_dir in sorted(IMAGES_DIR.iterdir()):
            if not cat_dir.is_dir() or cat_dir.name == "watermark":
                continue
            category = cat_dir.name
            for f in cat_dir.iterdir():
                if not f.name.endswith(".webp"):
                    continue
                m = re.match(
                    rf"^{re.escape(category)}-(pexels|pixabay)-(\d+)-(square|vertical|horizontal)\.webp$",
                    f.name,
                )
                if m:
                    source = m.group(1)
                    img_id = f"{source}-{m.group(2)}"
                    size = m.group(3)
                    images[category][img_id][size] = f.name
        return images

    # Build inventory from R2 bucket listing
    for key in keys:
        parts = key.split("/", 1)
        if len(parts) != 2:
            continue
        category, filename = parts
        if not filename.endswith(".webp"):
            continue
        m = re.match(
            rf"^{re.escape(category)}-(pexels|pixabay)-(\d+)-(square|vertical|horizontal)\.webp$",
            filename,
        )
        if not m:
            continue
        source = m.group(1)
        img_id = f"{source}-{m.group(2)}"
        size = m.group(3)
        images[category][img_id][size] = filename

    return images


def slugify(s):
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s or "card"


def get_tmpl(category, key):
    t = CATEGORY_TEMPLATES.get(category)
    if t and t.get(key):
        return t[key]
    return DEFAULT_FALLBACK[key]


def render_intro(category, display_name, title, keywords_str):
    display = CATEGORY_TEMPLATES.get(category, {}).get("display_name", display_name)
    kws = html.escape(keywords_str, quote=False)
    t = html.escape(title, quote=False)
    d = display.lower()
    return (
        f"Looking for the perfect {d} card? You've found it. Our {d} ecard lets you add your own heartfelt message, "
        f"choose from gorgeous fonts and colors, and preview your design instantly — no signup needed. Whether you're "
        f"near or far, you can send a personalized {d} greeting that shows exactly how you feel.\n\n"
        f"Each {t} is professionally designed with beautiful visuals that capture the mood of the occasion. "
        f"Type your message, pick a font that matches their style, and send. The card arrives in their inbox in "
        f"seconds — no printing, no postage, no waiting for mail delivery. Perfect for last-minute wishes that "
        f"still feel thoughtful and personal.\n\n"
        f"We offer two simple options: send a single ecard for just $1.99, or go unlimited with all-access to every "
        f"SendAFun design for only $6.99/month. Cancel anytime, no strings attached.\n\n"
        f"FAQ: Can I preview before sending? Yes, preview is always free. How fast does it arrive? Instantly via email. "
        f"Can I customize the message? Absolutely — write anything you want, choose any font and color. What if I want "
        f"to send to multiple people? Our unlimited plan covers every occasion and every recipient."
    )


def build_card(category, img_id, sizes, idx):
    tmpl_titles = get_tmpl(category, "titles")
    tmpl_texts = get_tmpl(category, "default_texts")
    tmpl_styles = get_tmpl(category, "styles")
    tmpl_fonts = get_tmpl(category, "fonts")
    tmpl_colors = get_tmpl(category, "colors")
    tmpl_filters = get_tmpl(category, "filters")
    tmpl_tags = get_tmpl(category, "tags_variants")

    ti = idx % len(tmpl_titles)
    di = (idx * 3) % len(tmpl_texts)
    si = (idx * 5) % len(tmpl_styles)
    fi = (idx * 7) % len(tmpl_fonts)
    ci = (idx * 11) % len(tmpl_colors)
    fli = (idx * 13) % len(tmpl_filters)
    tai = (idx * 17) % len(tmpl_tags)

    recipients = CATEGORY_RECIPIENTS.get(category, DEFAULT_RECIPIENTS)
    style_n = len(tmpl_styles)
    rec_n = len(recipients)
    aes_n = len(AESTHETIC_ADJECTIVES)

    ri = (idx // max(style_n, 1)) % rec_n
    ai = (idx // max(style_n * rec_n, 1)) % aes_n

    style_word = tmpl_styles[si].strip().strip("'\"")
    if style_word and style_word[0].islower():
        style_word = style_word[0].upper() + style_word[1:]

    aesthetic = AESTHETIC_ADJECTIVES[ai]
    recipient = recipients[ri]

    seen = set()
    unique_parts = []
    for w in (style_word, aesthetic, recipient):
        if not w:
            continue
        key = w.lower().replace("'", "").replace('"', "").replace("-", " ")
        if key in seen:
            continue
        seen.add(key)
        unique_parts.append(w)

    variant_suffix = " · ".join(unique_parts)
    title = f"{tmpl_titles[ti]} · {variant_suffix}" if variant_suffix else tmpl_titles[ti]

    slug_suffix_parts = [slugify(tmpl_titles[ti])]
    for p in unique_parts:
        s = slugify(p)
        if s and s not in slug_suffix_parts:
            slug_suffix_parts.append(s)
    slug_core = "-".join(slug_suffix_parts)
    base_slug = f"{category}-{slug_core}-{img_id.split('-')[-1]}"
    base_slug = slugify(base_slug)

    vertical_name = sizes.get("vertical") or sizes.get("square") or next(iter(sizes.values()))
    actual_cat = category
    bg_url = f"{R2_CDN}/{actual_cat}/{vertical_name}"

    r2_paths = {}
    for sz in ("square", "vertical", "horizontal"):
        if sz in sizes:
            r2_paths[sz] = f"{R2_CDN}/{actual_cat}/{sizes[sz]}"

    cat_kw = CATEGORY_KEYWORDS.get(category, [])
    if not cat_kw:
        cat_kw = [f"{category} card", f"{category} ecard", "personalized greeting card", "send ecards online", "custom card"]
    seo_keywords = cat_kw[:6]

    display = CATEGORY_TEMPLATES.get(category, {}).get("display_name", category.replace("-", " ").title())
    seo_title = f"{title} — Personalized Ecard, Send Instantly | SendAFun"
    seo_desc = (
        f"Send a {title.lower()} online in minutes. Personalize with your own message, choose fonts & colors, "
        f"and deliver instantly to their inbox. Free preview, only $1.99 to send."
    )
    seo_h1 = f"Send a {title} Online"
    kw_str = ", ".join(seo_keywords)
    intro = render_intro(category, display, title, kw_str)

    og_name = f"{base_slug}-og.webp"

    return {
        "slug": base_slug,
        "title": title,
        "category": category,
        "tags": tmpl_tags[tai],
        "style": tmpl_styles[si],
        "bgImage": bg_url,
        "bgImageWatermark": bg_url,
        "defaultText": tmpl_texts[di],
        "defaultFont": tmpl_fonts[fi],
        "defaultColor": tmpl_colors[ci],
        "defaultFilter": tmpl_filters[fli],
        "aspectRatio": "3/4",
        "ogImage": f"{R2_CDN}/{og_name}",
        "seo": {
            "title": seo_title,
            "description": seo_desc,
            "h1": seo_h1,
            "keywords": seo_keywords,
            "intro_text": intro,
            "og_image": og_name,
        },
    }, r2_paths


def main():
    images = scan_images()

    total_pexels = sum(len(v) for v in images.values())
    print(f"扫描结果: {len(images)} 个分类, {total_pexels} 个唯一图片 ID (来源: R2 bucket '{PREVIEW_BUCKET}')")
    if not images:
        raise SystemExit("[FATAL] 没有任何素材。请检查 R2 凭证或本地 source/images 目录。")

    cards = []
    mapping = {}

    for category in sorted(images.keys()):
        img_pool = sorted(images[category].keys())
        if PER_CATEGORY is None:
            take = len(img_pool)   # 用满桶里所有素材
        else:
            take = min(PER_CATEGORY, len(img_pool))
        taken = img_pool[:take]
        marker = "✅" if take == len(img_pool) else f"(only {take})"
        print(f"  📂 {category:<22}: {len(img_pool)} 套可用 → 生成 {take} 张卡 {marker}")

        for i, img_id in enumerate(taken):
            card, r2_paths = build_card(category, img_id, images[category][img_id], i)
            slug = card["slug"]
            n_attempts = 0
            while slug in mapping:
                suffix = f"-{i + len(mapping) + n_attempts}"
                slug = slugify(card["slug"] + suffix)
                n_attempts += 1
            card["slug"] = slug
            card["seo"]["og_image"] = f"{slug}-og.webp"
            card["ogImage"] = f"{R2_CDN}/{card['seo']['og_image']}"

            cards.append(card)
            mapping[slug] = {
                "category": category,
                "img_id": img_id,
                "seo_name": slug,
                "r2_paths": r2_paths,
                "alt_text": f"{card['title']} — free personalized ecard, send online at SendAFun",
                "seo": card["seo"],
                "version": 3,
                "updated_at": "2026-06-30",
            }

    config = {"cards": cards}

    CONFIG_PATH.write_text(
        json.dumps(config, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\n✅ cards-config.json 已生成 ({len(cards)} 张卡片，来源 R2 CDN)")

    MAPPING_PATH.write_text(
        json.dumps(mapping, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"✅ card-image-mapping.json 已生成 ({len(mapping)} 条映射)")

    per_cat = defaultdict(int)
    for c in cards:
        per_cat[c["category"]] += 1
    print("\n📊 每分类卡片数:")
    for cat, n in sorted(per_cat.items()):
        print(f"   - {cat}: {n}")


if __name__ == "__main__":
    main()
