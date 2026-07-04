#!/usr/bin/env node

/**
 * =============================================================================
 *  SendAFun — Card Generator Build Script
 * =============================================================================
 *
 *  Reads card metadata from source/cards-config.json, substitutes placeholders
 *  in templates/card-template.html, writes one HTML per card to dist/card/,
 *  copies watermark images, and regenerates index.html + category pages.
 *
 *  Usage:
 *    node generate-cards.js             — Incremental (only changed cards)
 *    node generate-cards.js --force     — Full rebuild (ignore cache)
 *    node generate-cards.js --sample=N  — Build first N cards only (for testing)
 *
 *  Cache: .cards-cache.json at project root tracks lastModified + image hash.
 * =============================================================================
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Paths ────────────────────────────────────────────────────────────────────
const ROOT           = path.resolve(__dirname, '..');             // sendafun/
const CONFIG_PATH    = path.join(ROOT, 'source', 'cards-config.json');
const TEMPLATE_PATH  = path.join(ROOT, 'templates', 'card-template.html');
const DIST_DIR       = path.join(ROOT, 'dist');
const CARD_DIR       = path.join(DIST_DIR, 'card');
const CATEGORY_DIR   = path.join(DIST_DIR, 'category');
const WATERMARK_DIR  = path.join(DIST_DIR, 'images', 'watermark');
const CACHE_PATH     = path.join(ROOT, '.cards-cache.json');
const INDEX_PATH     = path.join(DIST_DIR, 'index.html');

// ── Category display labels ──────────────────────────────────────────────────
const CATEGORY_LABELS = {
  'anniversary':      'Anniversary',
  'birthday':         'Birthday',
  'christmas':        'Christmas',
  'congratulations':  'Congratulations',
  'easter':           'Easter',
  'encouragement':    'Encouragement',
  'fathers-day':      "Father's Day",
  'friendship':       'Friendship',
  'get-well':         'Get Well',
  'good-luck':        'Good Luck',
  'graduation':       'Graduation',
  'halloween':        'Halloween',
  'love':             'Love & Romance',
  'missing-you':      'Missing You',
  'mothers-day':      "Mother's Day",
  'new-baby':         'New Baby',
  'new-year':         'New Year',
  'retirement':       'Retirement',
  'sorry':            'Apology',
  'sympathy':         'Sympathy',
  'thank-you':        'Thank You',
  'thanksgiving':     'Thanksgiving',
  'thinking-of-you':  'Thinking of You',
  'valentine':        'Valentine',
  'wedding':          'Wedding',
};

// ── Filter colour for each style (semi-transparent overlay) ──────────────────
const FILTER_COLORS = {
  'warm':          'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,146,60,0.10))',
  'classic':       'linear-gradient(135deg, rgba(0,0,0,0.05), rgba(0,0,0,0.10))',
  'romantic':      'linear-gradient(135deg, rgba(214,40,40,0.08), rgba(237,100,166,0.08))',
  'cheerful':      'linear-gradient(135deg, rgba(236,201,75,0.12), rgba(154,230,180,0.10))',
  'calm':          'linear-gradient(135deg, rgba(56,178,172,0.08), rgba(99,179,237,0.08))',
  'celebratory':   'linear-gradient(135deg, rgba(246,173,85,0.12), rgba(214,40,40,0.06))',
  'elegant':       'linear-gradient(135deg, rgba(26,32,44,0.05), rgba(45,55,72,0.08))',
  'soft':          'linear-gradient(135deg, rgba(237,200,186,0.10), rgba(251,207,232,0.10))',
  'playful':       'linear-gradient(135deg, rgba(246,173,85,0.10), rgba(129,230,217,0.10))',
  'vibrant':       'linear-gradient(135deg, rgba(237,100,166,0.08), rgba(159,122,234,0.08))',
  'dreamy':        'linear-gradient(135deg, rgba(159,122,234,0.08), rgba(129,230,217,0.08))',
  'bright':        'linear-gradient(135deg, rgba(236,201,75,0.10), rgba(72,187,120,0.08))',
  'hopeful':       'linear-gradient(135deg, rgba(72,187,120,0.10), rgba(99,179,237,0.10))',
  'strong':        'linear-gradient(135deg, rgba(45,55,72,0.06), rgba(72,187,120,0.08))',
  'gentle':        'linear-gradient(135deg, rgba(251,207,232,0.10), rgba(190,227,248,0.10))',
  'peaceful':      'linear-gradient(135deg, rgba(160,174,192,0.06), rgba(190,227,248,0.10))',
  'respectful':    'linear-gradient(135deg, rgba(74,85,104,0.05), rgba(160,174,192,0.05))',
  'joyful':        'linear-gradient(135deg, rgba(246,173,85,0.10), rgba(237,100,166,0.08))',
  'loving':        'linear-gradient(135deg, rgba(214,40,40,0.06), rgba(251,207,232,0.10))',
  'tender':        'linear-gradient(135deg, rgba(251,207,232,0.12), rgba(237,200,186,0.08))',
  'sweet':         'linear-gradient(135deg, rgba(251,207,232,0.10), rgba(254,215,170,0.10))',
  'sincere':       'linear-gradient(135deg, rgba(72,187,120,0.06), rgba(56,178,172,0.08))',
  'festive':       'linear-gradient(135deg, rgba(229,62,62,0.08), rgba(34,197,94,0.08))',
  'uplifting':     'linear-gradient(135deg, rgba(236,201,75,0.12), rgba(99,179,237,0.08))',
  'proud':         'linear-gradient(135deg, rgba(116,66,16,0.08), rgba(72,187,120,0.08))',
  'cozy':          'linear-gradient(135deg, rgba(116,66,16,0.06), rgba(245,158,11,0.10))',
  'fresh':         'linear-gradient(135deg, rgba(102,126,234,0.08), rgba(72,187,120,0.08))',
  'grateful':      'linear-gradient(135deg, rgba(72,187,120,0.08), rgba(236,201,75,0.06))',
  'soulmate':      'linear-gradient(135deg, rgba(214,40,40,0.06), rgba(159,122,234,0.08))',
  'forever':       'linear-gradient(135deg, rgba(45,55,72,0.05), rgba(214,40,40,0.05))',
  'hugs':          'linear-gradient(135deg, rgba(251,207,232,0.12), rgba(190,227,248,0.10))',
  'passion':       'linear-gradient(135deg, rgba(229,62,62,0.10), rgba(214,40,40,0.08))',
  'milestone':     'linear-gradient(135deg, rgba(116,66,16,0.08), rgba(159,122,234,0.06))',
  'genuine':       'linear-gradient(135deg, rgba(45,55,72,0.05), rgba(72,187,120,0.06))',
  'kindness':      'linear-gradient(135deg, rgba(251,207,232,0.10), rgba(236,201,75,0.08))',
  'any-occasion':  'linear-gradient(135deg, rgba(74,85,104,0.04), rgba(160,174,192,0.06))',
  'party':         'linear-gradient(135deg, rgba(246,173,85,0.12), rgba(237,100,166,0.08))',
  'future':        'linear-gradient(135deg, rgba(102,126,234,0.08), rgba(129,230,217,0.08))',
  'fireworks':     'linear-gradient(135deg, rgba(116,66,16,0.10), rgba(237,100,166,0.08))',
  'hearts-day':    'linear-gradient(135deg, rgba(229,62,62,0.08), rgba(251,207,232,0.10))',
  'cupid':         'linear-gradient(135deg, rgba(237,100,166,0.08), rgba(229,62,62,0.06))',
  'chocolate':     'linear-gradient(135deg, rgba(116,66,16,0.08), rgba(246,173,85,0.10))',
  'roses':         'linear-gradient(135deg, rgba(229,62,62,0.08), rgba(72,187,120,0.06))',
  'merry':         'linear-gradient(135deg, rgba(229,62,62,0.08), rgba(34,197,94,0.08))',
  'joy':           'linear-gradient(135deg, rgba(236,201,75,0.12), rgba(237,100,166,0.06))',
  'family':        'linear-gradient(135deg, rgba(116,66,16,0.06), rgba(72,187,120,0.08))',
  'xmas':          'linear-gradient(135deg, rgba(229,62,62,0.06), rgba(34,197,94,0.06))',
  'seasonal':      'linear-gradient(135deg, rgba(246,173,85,0.10), rgba(99,179,237,0.08))',
  'winter':        'linear-gradient(135deg, rgba(99,179,237,0.08), rgba(160,174,192,0.06))',
  '2026':          'linear-gradient(135deg, rgba(214,158,46,0.10), rgba(85,60,154,0.08))',
  'resolutions':   'linear-gradient(135deg, rgba(72,187,120,0.08), rgba(102,126,234,0.08))',
  'new-beginnings':'linear-gradient(135deg, rgba(102,126,234,0.08), rgba(72,187,120,0.10))',
  'happy-ever-after':'linear-gradient(135deg, rgba(85,60,154,0.06), rgba(214,40,40,0.06))',
  'mr-and-mrs':    'linear-gradient(135deg, rgba(85,60,154,0.08), rgba(251,207,232,0.08))',
  'soulmates':     'linear-gradient(135deg, rgba(214,40,40,0.06), rgba(85,60,154,0.08))',
  'together':      'linear-gradient(135deg, rgba(72,187,120,0.06), rgba(190,227,248,0.10))',
  'be-mine':       'linear-gradient(135deg, rgba(229,62,62,0.08), rgba(251,207,232,0.10))',
  'heart':         'linear-gradient(135deg, rgba(229,62,62,0.08), rgba(237,100,166,0.08))',
  'love':          'linear-gradient(135deg, rgba(214,40,40,0.08), rgba(237,100,166,0.08))',
  'smile':         'linear-gradient(135deg, rgba(236,201,75,0.10), rgba(72,187,120,0.08))',
  'congrats':      'linear-gradient(135deg, rgba(214,158,46,0.10), rgba(72,187,120,0.08))',
  'proud-of-you':  'linear-gradient(135deg, rgba(72,187,120,0.08), rgba(214,158,46,0.08))',
  'success':       'linear-gradient(135deg, rgba(72,187,120,0.08), rgba(102,126,234,0.06))',
  'win':           'linear-gradient(135deg, rgba(214,158,46,0.10), rgba(246,173,85,0.10))',
  'well-done':     'linear-gradient(135deg, rgba(85,60,154,0.08), rgba(72,187,120,0.08))',
  'farewell':      'linear-gradient(135deg, rgba(85,60,154,0.05), rgba(116,66,16,0.06))',
  'career':        'linear-gradient(135deg, rgba(45,55,72,0.05), rgba(102,126,234,0.06))',
  'next-chapter':  'linear-gradient(135deg, rgba(102,126,234,0.08), rgba(72,187,120,0.08))',
  'forgive':       'linear-gradient(135deg, rgba(214,40,40,0.05), rgba(160,174,192,0.06))',
  'apology':       'linear-gradient(135deg, rgba(160,174,192,0.06), rgba(251,207,232,0.06))',
  'make-amends':   'linear-gradient(135deg, rgba(214,40,40,0.05), rgba(251,207,232,0.08))',
  'just-because':  'linear-gradient(135deg, rgba(190,227,248,0.08), rgba(251,207,232,0.08))',
  'appreciation':  'linear-gradient(135deg, rgba(72,187,120,0.08), rgba(236,201,75,0.08))',
  'blessings':     'linear-gradient(135deg, rgba(72,187,120,0.08), rgba(102,126,234,0.06))',
  'gratitude':     'linear-gradient(135deg, rgba(72,187,120,0.10), rgba(236,201,75,0.06))',
  'turkey':        'linear-gradient(135deg, rgba(116,66,16,0.08), rgba(214,158,46,0.10))',
  'bunny':         'linear-gradient(135deg, rgba(251,207,232,0.10), rgba(190,227,248,0.10))',
  'spring':        'linear-gradient(135deg, rgba(72,187,120,0.10), rgba(236,201,75,0.08))',
  'spooky':        'linear-gradient(135deg, rgba(85,60,154,0.10), rgba(45,55,72,0.10))',
  'boo':           'linear-gradient(135deg, rgba(45,55,72,0.10), rgba(237,100,166,0.08))',
  'october':       'linear-gradient(135deg, rgba(214,40,40,0.08), rgba(116,66,16,0.08))',
  'bestie':        'linear-gradient(135deg, rgba(237,100,166,0.10), rgba(251,207,232,0.10))',
  'bff':           'linear-gradient(135deg, rgba(251,207,232,0.12), rgba(102,126,234,0.08))',
  'fingers-crossed':'linear-gradient(135deg, rgba(214,158,46,0.08), rgba(102,126,234,0.08))',
  'fortune':       'linear-gradient(135deg, rgba(72,187,120,0.08), rgba(214,158,46,0.10))',
  'exam':          'linear-gradient(135deg, rgba(102,126,234,0.08), rgba(190,227,248,0.10))',
  'diploma':       'linear-gradient(135deg, rgba(85,60,154,0.08), rgba(214,158,46,0.10))',
  'degree':        'linear-gradient(135deg, rgba(45,55,72,0.05), rgba(85,60,154,0.06))',
  'class-of':      'linear-gradient(135deg, rgba(85,60,154,0.08), rgba(72,187,120,0.08))',
  'achieve':       'linear-gradient(135deg, rgba(214,158,46,0.08), rgba(72,187,120,0.10))',
  'long-distance': 'linear-gradient(135deg, rgba(102,126,234,0.08), rgba(251,207,232,0.08))',
  'come-back':     'linear-gradient(135deg, rgba(72,187,120,0.08), rgba(99,179,237,0.08))',
  'prayers':       'linear-gradient(135deg, rgba(72,187,120,0.06), rgba(160,174,192,0.06))',
  'memory':        'linear-gradient(135deg, rgba(160,174,192,0.06), rgba(251,207,232,0.06))',
  'loss':          'linear-gradient(135deg, rgba(74,85,104,0.06), rgba(160,174,192,0.06))',
  'comfort':       'linear-gradient(135deg, rgba(190,227,248,0.10), rgba(251,207,232,0.08))',
  'grief':         'linear-gradient(135deg, rgba(74,85,104,0.06), rgba(190,227,248,0.08))',
  'couples':       'linear-gradient(135deg, rgba(214,40,40,0.06), rgba(85,60,154,0.08))',
  'wife':          'linear-gradient(135deg, rgba(237,100,166,0.08), rgba(214,40,40,0.06))',
  'husband':       'linear-gradient(135deg, rgba(45,55,72,0.05), rgba(214,40,40,0.05))',
  'newborn':       'linear-gradient(135deg, rgba(190,227,248,0.10), rgba(251,207,232,0.10))',
  'parents':       'linear-gradient(135deg, rgba(72,187,120,0.08), rgba(102,126,234,0.06))',
  'baby-boy':      'linear-gradient(135deg, rgba(43,108,176,0.10), rgba(190,227,248,0.10))',
  'baby-girl':     'linear-gradient(135deg, rgba(213,63,140,0.08), rgba(251,207,232,0.12))',
  'bundle-of-joy': 'linear-gradient(135deg, rgba(251,207,232,0.10), rgba(254,215,170,0.10))',
  'shower':        'linear-gradient(135deg, rgba(99,179,237,0.08), rgba(251,207,232,0.10))',
  'arrival':       'linear-gradient(135deg, rgba(72,187,120,0.10), rgba(190,227,248,0.10))',
  'motivation':    'linear-gradient(135deg, rgba(214,158,46,0.10), rgba(72,187,120,0.10))',
  'confidence':    'linear-gradient(135deg, rgba(85,60,154,0.08), rgba(102,126,234,0.08))',
  'brave':         'linear-gradient(135deg, rgba(72,187,120,0.08), rgba(85,60,154,0.06))',
  'progress':      'linear-gradient(135deg, rgba(102,126,234,0.08), rgba(72,187,120,0.10))',
  'dad':           'linear-gradient(135deg, rgba(45,55,72,0.06), rgba(43,108,176,0.06))',
  'father':        'linear-gradient(135deg, rgba(26,54,93,0.08), rgba(45,55,72,0.05))',
  'mom':           'linear-gradient(135deg, rgba(213,63,140,0.08), rgba(251,207,232,0.10))',
  'mother':        'linear-gradient(135deg, rgba(214,40,40,0.06), rgba(251,207,232,0.10))',
  'grandma':       'linear-gradient(135deg, rgba(251,207,232,0.10), rgba(254,215,170,0.10))',
  'support':       'linear-gradient(135deg, rgba(99,179,237,0.08), rgba(72,187,120,0.08))',
  'keep-going':    'linear-gradient(135deg, rgba(236,201,75,0.10), rgba(72,187,120,0.10))',
  'believe':       'linear-gradient(135deg, rgba(85,60,154,0.08), rgba(129,230,217,0.08))',
  'health':        'linear-gradient(135deg, rgba(72,187,120,0.08), rgba(56,178,172,0.08))',
  'healing':       'linear-gradient(135deg, rgba(56,178,172,0.08), rgba(190,227,248,0.10))',
  'recovery':      'linear-gradient(135deg, rgba(72,187,120,0.10), rgba(56,178,172,0.08))',
  'rest':          'linear-gradient(135deg, rgba(99,179,237,0.06), rgba(160,174,192,0.06))',
};

// ── Parse CLI arguments ──────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { mode: 'incremental', sample: null };
  for (const arg of argv) {
    if (arg === '--force')          args.mode = 'force';
    else if (arg.startsWith('--sample=')) {
      args.mode   = 'sample';
      args.sample = parseInt(arg.slice('--sample='.length), 10);
    }
  }
  return args;
}

// ── Load cache ───────────────────────────────────────────────────────────────
function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  } catch { return { version: 1, cards: {} }; }
}

// ── Save cache ───────────────────────────────────────────────────────────────
function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

// ── Pure R2 mode: hash of card metadata only ─────────────────────────────────
function metaHashFor(card) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(card))
    .digest('hex').slice(0, 16);
}

// ── Check if a card needs regeneration (compared to cache) ───────────────────
//  Pure R2 mode: compare metaHash only — no local image file inspection.
function needsRegen(card, cache) {
  const cached = cache.cards[card.slug];
  if (!cached) return true;
  const metaHash = metaHashFor(card);
  return cached.metaHash !== metaHash;
}

// ── Ensure a directory exists ────────────────────────────────────────────────
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ── Copy a watermark image (pure R2 mode: skip — URLs come from R2 CDN) ─────
function copyWatermark(card) {
  // All images are served directly from R2 CDN URLs in card.bgImageWatermark.
  // No need to copy any local file. If you want local watermark copies in the
  // future, place them under source/images/watermark/* and re-enable copying.
  return null;
}

// ── Generate a single card HTML ──────────────────────────────────────────────
function generateCardHtml(card, template, allCards) {
  const seo = card.seo || {};
  const ogDesc = seo.description ||
    `Send a personalised ${card.title.toLowerCase()} to someone special. Create your e-card at SendAFun.`;

  // Pick 4 random cards from OTHER categories for community carousel
  const otherCards = allCards.filter(c => c.slug !== card.slug);
  const shuffled = [...otherCards];
  shuffleArray(shuffled);
  const communityCards = shuffled.slice(0, 4);
  const relatedCards = shuffled.slice(4, 8);

  const replacements = {
    // ── SEO 字段（优先读 card.seo，无则降级）───
    '__SEO_TITLE__':         seo.title       || card.title,
    '__SEO_DESC__':          seo.description  || ogDesc,
    '__SEO_KEYWORDS__':     (seo.keywords || [card.title, 'online', 'personalised']).join(', '),
    '__SEO_OG_IMAGE__':     'https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/' +
                             (seo.og_image || `${card.slug}-og.webp`),
    '__SEO_H1__':           seo.h1          || card.title,
    '__SEO_INTRO_TEXT__':    seo.intro_text  || '',
    '__CANONICAL_URL__':     `https://sendafun.com/card/${card.slug}.html`,

    // ── 旧 placeholder（向后兼容，模板已更新为新 placeholder）───
    '__PAGE_TITLE__':       seo.title       || card.title,
    '__OG_TITLE__':         seo.title       || card.title,
    '__OG_IMAGE__':         'https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/' +
                             (seo.og_image || `${card.slug}-og.webp`),
    '__OG_DESC__':          seo.description  || ogDesc,
    '__OG_URL__':           `https://sendafun.com/card/${card.slug}.html`,

    // ── Twitter Card 占位符（原 P0-6 bug）───
    '__TWITTER_TITLE__':    seo.title       || card.title,
    '__TWITTER_DESC__':     seo.description  || ogDesc,
    '__TWITTER_IMAGE__':    'https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/' +
                             (seo.og_image || `${card.slug}-og.webp`),

    // ── 卡片编辑相关（不变）───
    '__CARD_DEFAULT_TEXT__':  card.defaultText,
    '__CARD_BG__':            card.bgImageWatermark || card.bgImage,
    '__CARD_DEFAULT_FONT__':  card.defaultFont || "'Playfair Display', serif",
    '__CARD_DEFAULT_COLOR__': card.defaultColor || '#1a1a1a',
    '__CARD_DEFAULT_FILTER__': card.defaultFilter || 'none',
    '__CARD_SLUG__':          card.slug,
    '__ADS_ENABLED__':        'none',  // Phase 2: change to 'block'

    // ── 动态社区轮播 & 相关推荐 ──
    '__COMMUNITY_CAROUSEL__': renderCommunityCarousel(communityCards),
    '__RELATED_CARDS__':      renderRelatedCards(relatedCards),
  };

  let html = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    html = html.split(placeholder).join(value);
  }
  return html;
}

// ── Write card HTML to dist/card/{slug}.html ────────────────────────────────
function writeCardHtml(slug, html) {
  ensureDir(CARD_DIR);
  const filePath = path.join(CARD_DIR, `${slug}.html`);
  fs.writeFileSync(filePath, html, 'utf-8');
  return filePath;
}

// ── Get template last-modified time ──────────────────────────────────────────
function getTemplateMtime() {
  try {
    return fs.statSync(TEMPLATE_PATH).mtimeMs;
  } catch { return 0; }
}

// ── Build everything ─────────────────────────────────────────────────────────
function build() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`\n  🎴  SendAFun Card Generator`);
  console.log(`  ${'─'.repeat(40)}\n`);

  // 1. Load config & template
  const config   = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const cards    = config.cards || [];

  if (cards.length === 0) {
    console.log('  ⚠️  No cards found in config. Nothing to do.\n');
    return;
  }

  // 2. Determine build mode
  const isForce   = args.mode === 'force';
  const isSample  = args.mode === 'sample';
  const templateMtime = getTemplateMtime();
  const cache = isForce ? { version: 1, cards: {} } : loadCache();

  // 3. If template changed, force re-examine all cards
  let templateChanged = false;
  if (!isForce && cache.templateMtime && templateMtime) {
    if (Math.abs(cache.templateMtime - templateMtime) > 1) {
      templateChanged = true;
      console.log('  📝  Template changed — checking all cards for regeneration\n');
    }
  }

  let changedCount   = 0;
  let skippedCount   = 0;
  let errorCount     = 0;

  // 4. Process cards
  const cardsToProcess = isSample ? cards.slice(0, args.sample) : cards;

  for (const card of cardsToProcess) {
    // Check if this card needs regeneration
    const shouldRegen = isForce
      || templateChanged
      || needsRegen(card, cache);

    if (!shouldRegen) {
      skippedCount++;
      continue;
    }

    try {
      // Pure R2 mode: images come directly from CDN URL — no local image inspection.
      // Generate HTML
      const html = generateCardHtml(card, template, cards);
      const outPath = writeCardHtml(card.slug, html);

      // (Pure R2 mode — no local watermark file to copy.)
      copyWatermark(card);

      // Update cache (meta only)
      const metaHash = metaHashFor(card);

      cache.cards[card.slug] = {
        metaHash,
        srcMtime: 0,
        srcHash:  null,
        generated: new Date().toISOString(),
      };

      const action = isSample ? 'SAMPLE' : 'BUILT';
      console.log(`  ✅ [${action}] ${card.slug} → ${path.relative(DIST_DIR, outPath)}`);
      changedCount++;
    } catch (err) {
      console.error(`  ❌  ERROR: ${card.slug} — ${err.message}`);
      errorCount++;
    }
  }

  // 5. Update template mtime in cache
  cache.templateMtime = templateMtime;

  // 6. Save cache (unless sample mode — don't pollute cache during testing)
  if (!isSample) {
    saveCache(cache);
  }

  // 7. Generate index page & category pages
  if (!isSample || isSample && changedCount > 0) {
    readCardsFromDist(cards);
  }

  // 8. Summary
  const summaryMode = isForce ? 'FORCE' : isSample ? `SAMPLE (${args.sample})` : 'INCREMENTAL';
  console.log(`\n  ${'─'.repeat(40)}`);
  console.log(`  Mode:       ${summaryMode}`);
  console.log(`  Total:      ${cardsToProcess.length} cards`);
  console.log(`  Built:      ${changedCount}`);
  console.log(`  Skipped:    ${skippedCount}`);
  console.log(`  Errors:     ${errorCount}`);
  console.log(`  ${'─'.repeat(40)}\n`);
}

// ── Read built cards from dist directory ─────────────────────────────────────
// We re-read the config & dist so we can build index/category pages on *all*
// cards, not just the ones processed this run.
function readCardsFromDist(allCards) {
  console.log('  📄  Generating index.html and category pages...\n');

  // Build categories index
  const categories = {};
  for (const card of allCards) {
    const cat = card.category;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(card);
  }

  // Generate category pages
  ensureDir(CATEGORY_DIR);
  for (const [cat, catCards] of Object.entries(categories)) {
    const label = CATEGORY_LABELS[cat] || cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const html = generateCategoryPage(cat, label, catCards, allCards);
    const outPath = path.join(CATEGORY_DIR, `${cat}.html`);
    fs.writeFileSync(outPath, html, 'utf-8');
    console.log(`  📁  Category: ${label} → ${path.relative(DIST_DIR, outPath)}`);
  }

  // Generate index page
  const indexHtml = generateIndexPage(allCards, categories);
  fs.writeFileSync(INDEX_PATH, indexHtml, 'utf-8');
  console.log(`  🏠  Index → ${path.relative(DIST_DIR, INDEX_PATH)}`);

  // Build P0 static pages (required for Google AdSense review)
  const policyCount = buildPolicyPages();
  console.log(`  ⚖️  Policy pages built: ${policyCount}`);

  // ── Build P1 aggregate pages ─────────────────────────────────────────────
  const rCount = buildRecipientPages(allCards);
  console.log(`  👤  Recipient pages: ${rCount} → /recipient/*.html`);
  const sCount = buildStylePages(allCards);
  console.log(`  🎨  Style pages: ${sCount} → /style/*.html`);
  const hCount = buildHubPages(allCards);
  console.log(`  📌  Hub pages: ${hCount} (Trending / Latest / Holidays)`);
  const msgHtml = generateMessageGeneratorPage();
  fs.writeFileSync(path.join(DIST_DIR, 'message-generator.html'), msgHtml, 'utf-8');
  console.log(`  ✍️   Message Generator → message-generator.html`);

  // ── Build P2 content pages ────────────────────────────────────────────────
  const gCount = buildGuidePages(allCards);
  console.log(`  📖  How-to guides: ${gCount} → /guide/*.html`);
  const faqHtml = generateFaqPage();
  fs.writeFileSync(path.join(DIST_DIR, 'faq.html'), faqHtml, 'utf-8');
  console.log(`  ❓  FAQ → /faq.html`);
  const blogHtml = generateBlogIndex(allCards);
  fs.writeFileSync(path.join(DIST_DIR, 'blog.html'), blogHtml, 'utf-8');
  console.log(`  📗  Blog index → /blog.html`);

  // Build robots.txt + sitemap.xml (now includes P1 + P2 aggregate URLs)
  const robotsPath = generateRobotsTxt();
  console.log(`  🤖  robots.txt → ${path.relative(DIST_DIR, robotsPath)}`);
  const sitemapPath = generateSitemap(allCards, categories);
  console.log(`  🗺️   sitemap.xml → ${path.relative(DIST_DIR, sitemapPath)}\n`);
}

// ── Generate a category page ──────────────────────────────────────────────────
function generateCategoryPage(cat, label, catCards, allCards) {
  const cardGrid = catCards.map(c => renderCardTile(c)).join('\n      ');
  const hubNav = buildTopNav('category');
  const catLinks = Object.entries(CATEGORY_LABELS).map(([key, l]) =>
    `<a href="/category/${key}.html" class="nav-link${key === cat ? ' active' : ''}">${l}</a>`
  ).join('\n        ');

  // Pick random "related" cards from other categories
  const others = allCards.filter(c => c.category !== cat);
  shuffleArray(others);
  const relatedCards = others.slice(0, 4).map(c => renderCardTile(c)).join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" content="#ffffff">
<meta name="description" content="Browse our collection of ${label.toLowerCase()} e-cards. Send a personalised card for free — beautiful designs, instant delivery.">
<meta property="og:title" content="${label} Cards — SendAFun">
<meta property="og:description" content="Browse our collection of ${label.toLowerCase()} e-cards. Send a personalised card for free!">
<meta property="og:image" content="https://sendafun.com/og/sendafun-og.webp">
<meta property="og:type" content="website">
<link rel="canonical" href="https://sendafun.com/category/${cat}.html">
<title>${label} Cards — SendAFun</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; background: #f7f5f0; color: #1a202c; }
.header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 0.9rem 2rem; position: sticky; top: 0; z-index: 10; }
.header-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
.logo { text-decoration: none; color: #2d6a4f; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; }
.logo span { color: #48bb78; }
.nav-links { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.nav-link { text-decoration: none; color: #4a5568; font-size: 0.82rem; padding: 0.35rem 0.75rem; border-radius: 20px; transition: all 0.2s; white-space: nowrap; }
.nav-link:hover { background: #edf2f7; }
.nav-link.active { background: #2d6a4f; color: #fff; }
.cat-row { max-width: 1200px; margin: 0 auto; padding: 0.5rem 2rem 0; border-top: 1px solid #f0f2f5; }
.main { max-width: 1200px; margin: 0 auto; padding: 2rem; }
.page-title { font-size: 2.5rem; font-weight: 700; margin-bottom: 0.5rem; color: #1a202c; letter-spacing: -0.01em; }
.page-subtitle { font-size: 1.1rem; color: #718096; margin-bottom: 2rem; max-width: 720px; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; margin-bottom: 3rem; }
.card-tile { text-decoration: none; color: inherit; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; }
.card-tile:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
.card-tile-img { width: 100%; aspect-ratio: 3/4; object-fit: cover; background: #e2e8f0; display: block; overflow: hidden; }
.card-tile-img img { width:100%; height:100%; object-fit:cover; display:block; }
.card-tile-info { padding: 1rem; }
.card-tile-title { font-weight: 600; font-size: 1rem; margin-bottom: 0.25rem; color: #2d3748; }
.card-tile-tags { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.card-tile-tag { font-size: 0.7rem; background: #edf2f7; color: #4a5568; padding: 0.15rem 0.5rem; border-radius: 10px; }
@media (max-width: 768px) {
  .header-inner { flex-direction: column; align-items: flex-start; gap: 0.6rem; }
  .cat-row { padding: 0.5rem 1rem 0; }
  .nav-links { overflow-x: auto; width: 100%; padding-bottom: 0.5rem; }
  .page-title { font-size: 1.8rem; }
  .main { padding: 1.2rem 1rem 2rem; }
  .card-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; }
}
</style>
</head>
<body>
<header class="header">
  <div class="header-inner">
    <a href="/" class="logo">Send<span>A</span>Fun</a>
    <nav class="nav-links">
      ${hubNav}
    </nav>
  </div>
  <div class="cat-row"><nav class="nav-links" style="padding:0.5rem 0;">${catLinks}</nav></div>
</header>
<main class="main">
  <h1 class="page-title">${label} Cards</h1>
  <p class="page-subtitle">Find the perfect ${label.toLowerCase()} e-card to send to someone special.</p>
  <div class="card-grid">
    ${cardGrid}
  </div>
  ${others.length > 0 ? `
  <h2 class="page-title" style="font-size:1.5rem;margin-top:2rem;">More Categories</h2>
  <p class="page-subtitle">You might also like…</p>
  <div class="card-grid">
    ${relatedCards}
  </div>` : ''}
</main>
${buildFooter()}
${buildCookieConsent()}
</body>
</html>`;
}

// ── Render a single card tile for grid display ───────────────────────────────
function renderCardTile(card) {
  const tags = (card.tags || []).map(t => `<span class="card-tile-tag">${t}</span>`).join('');
  return `<a href="/card/${card.slug}.html" class="card-tile">
    <div class="card-tile-img"><img src="${card.bgImageWatermark || card.bgImage}" alt="${card.title}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy"></div>
    <div class="card-tile-info">
      <div class="card-tile-title">${card.title}</div>
      <div class="card-tile-tags">${tags}</div>
    </div>
  </a>`;
}

// ── Render community carousel items (real cards from other categories) ───────
function renderCommunityCarousel(cards) {
  if (!cards || cards.length === 0) return '';
  return cards.map(c => {
    const img = c.bgImageWatermark || c.bgImage;
    return `<div class="carousel-item">
        <a href="/card/${c.slug}.html" style="text-decoration:none;color:inherit;display:block;">
          <div class="carousel-item-img" style="background-image:url('${img}')"></div>
          <div class="carousel-item-info">
            <div class="carousel-item-text">${c.title}</div>
            <div class="carousel-item-author">${c.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
          </div>
        </a>
      </div>`;
  }).join('\n      ');
}

// ── Render related cards (real cards from other categories) ──────────────────
function renderRelatedCards(cards) {
  if (!cards || cards.length === 0) return '';
  return cards.map(c => {
    const img = c.bgImageWatermark || c.bgImage;
    const catLabel = CATEGORY_LABELS[c.category] || c.category;
    return `<a href="/card/${c.slug}.html" class="related-item" style="text-decoration:none;color:inherit;">
      <div class="related-item-img" style="background-image:url('${img}')"></div>
      <div class="related-item-info">
        <div class="related-item-title">${c.title}</div>
        <div class="related-item-tag">${catLabel}</div>
      </div>
    </a>`;
  }).join('\n    ');
}

// ── Generate the main index page ─────────────────────────────────────────────
function generateIndexPage(allCards, categories) {
  // Shuffle and pick 5-6 for hero carousel
  const heroCards = [...allCards];
  shuffleArray(heroCards);
  const heroSlides = heroCards.slice(0, Math.min(6, heroCards.length));

  // Build carousel HTML
  const carouselSlides = heroSlides.map((c, i) => {
    const catLabel = CATEGORY_LABELS[c.category] || c.category;
    return `<div class="carousel-slide${i === 0 ? ' active' : ''}">
      <div class="carousel-bg" style="background:url('${c.bgImageWatermark || c.bgImage}') center/cover"></div>
      <div class="carousel-overlay"></div>
      <div class="carousel-content">
        <span class="carousel-category">${catLabel}</span>
        <h2 class="carousel-title">${c.title}</h2>
        <p class="carousel-desc">${c.defaultText}</p>
        <a href="/card/${c.slug}.html" class="carousel-cta">Customise This Card →</a>
      </div>
    </div>`;
  }).join('\n        ');

  // Build category buttons
  const catButtons = Object.keys(categories).map(cat => {
    const label = CATEGORY_LABELS[cat] || cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const count = categories[cat].length;
    const icons = {
      'anniversary':     '💍',
      'birthday':        '🎂',
      'christmas':       '🎄',
      'congratulations': '🎉',
      'easter':          '🐰',
      'encouragement':   '💪',
      'fathers-day':     '👔',
      'friendship':      '🤝',
      'get-well':        '🌿',
      'good-luck':       '🍀',
      'graduation':      '🎓',
      'halloween':       '🎃',
      'love':            '💕',
      'missing-you':     '💌',
      'mothers-day':     '🌸',
      'new-baby':        '👶',
      'new-year':        '🎆',
      'retirement':      '🏖️',
      'sorry':           '💐',
      'sympathy':        '🕊️',
      'thank-you':       '🙏',
      'thanksgiving':    '🦃',
      'thinking-of-you': '💭',
      'valentine':       '💘',
      'wedding':         '💒',
    };
    const icon = icons[cat] || '💌';
    return `<a href="/category/${cat}.html" class="cat-btn">
      <span class="cat-icon">${icon}</span>
      <span class="cat-label">${label}</span>
      <span class="cat-count">${count} cards</span>
    </a>`;
  }).join('\n        ');

  // Quick entry — "I need a card for..."
  const quickOptions = [
    { emoji: '👩', text: 'my Mom', cat: 'birthday' },
    { emoji: '👨', text: 'my Dad', cat: 'birthday' },
    { emoji: '💑', text: 'my Partner', cat: 'love' },
    { emoji: '👯', text: 'my Best Friend', cat: 'encouragement' },
    { emoji: '👵', text: 'my Grandma', cat: 'missing-you' },
    { emoji: '🎓', text: 'a Graduate', cat: 'congratulations' },
    { emoji: '👶', text: 'a Newborn', cat: 'new-baby' },
    { emoji: '🤒', text: 'Someone Sick', cat: 'get-well' },
  ];
  const quickHtml = quickOptions.map(q => `<a href="/category/${q.cat}.html" class="quick-chip">${q.emoji} ${q.text}</a>`).join('\n          ');

  // Masonry grid — pick 12-20 random cards
  const masonryCards = [...allCards];
  shuffleArray(masonryCards);
  const gridCards = masonryCards.slice(0, Math.min(20, Math.max(12, masonryCards.length)));
  const masonryHtml = gridCards.map(c => renderCardTile(c)).join('\n        ');

  // Grouped by style
  const styleGroups = {};
  for (const card of allCards) {
    const style = card.style || 'classic';
    if (!styleGroups[style]) styleGroups[style] = [];
    styleGroups[style].push(card);
  }
  const styleLabels = { warm: 'Warm & Cozy', romantic: 'Romantic', cheerful: 'Cheerful', classic: 'Classic', calm: 'Calm & Serene', celebratory: 'Celebratory' };

  const styleSections = Object.entries(styleLabels).map(([style, label]) => {
    const styleCards = styleGroups[style] || [];
    if (styleCards.length === 0) return '';
    const tileHtml = styleCards.slice(0, 4).map(c => renderCardTile(c)).join('\n          ');
    return `<section class="style-section">
      <h2 class="section-title">${label}</h2>
      <div class="card-grid card-grid--style">
        ${tileHtml}
      </div>
      <a href="#" onclick="filterByStyle('${style}');return false;" class="see-all">See all ${label} →</a>
    </section>`;
  }).filter(Boolean).join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
<meta name="theme-color" content="#2d6a4f">
<meta name="description" content="SendAFun — Create and send personalised e-cards for any occasion. Free, beautiful, instant.">
<meta property="og:title" content="SendAFun — Free Personalised E-Cards">
<meta property="og:description" content="Create beautiful personalised e-cards for any occasion. Free, instant, and made with love.">
<meta property="og:image" content="https://sendafun.com/og/sendafun-og.webp">
<meta property="og:type" content="website">
<link rel="canonical" href="https://sendafun.com/">
<title>SendAFun — Free Personalised E-Cards for Every Occasion</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; background: #f7f5f0; color: #1a202c; }
/* ── Carousel ── */
.carousel { position: relative; width: 100%; height: 70vh; min-height: 400px; max-height: 600px; overflow: hidden; }
.carousel-slide { position: absolute; inset: 0; opacity: 0; transition: opacity 0.8s ease; pointer-events: none; }
.carousel-slide.active { opacity: 1; pointer-events: auto; }
.carousel-bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
.carousel-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 40%, transparent 70%); }
.carousel-content { position: absolute; bottom: 3rem; left: 3rem; max-width: 500px; color: #fff; }
.carousel-category { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.15em; opacity: 0.8; margin-bottom: 0.5rem; }
.carousel-title { font-family: 'Playfair Display', serif; font-size: clamp(1.5rem, 4vw, 2.5rem); font-weight: 700; line-height: 1.2; margin-bottom: 0.75rem; }
.carousel-desc { font-size: 0.95rem; opacity: 0.9; margin-bottom: 1.5rem; line-height: 1.5; }
.carousel-cta { display: inline-block; background: #48bb78; color: #fff; padding: 0.7rem 1.5rem; border-radius: 30px; text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: background 0.2s; }
.carousel-cta:hover { background: #38a169; }
.carousel-dots { position: absolute; bottom: 1.5rem; right: 2rem; display: flex; gap: 0.5rem; }
.carousel-dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.4); cursor: pointer; transition: background 0.2s; }
.carousel-dot.active { background: #fff; }
/* ── Categories ── */
.categories { max-width: 1200px; margin: 0 auto; padding: 2rem 2rem 0; }
.section-title { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 700; color: #1a202c; margin-bottom: 0.5rem; }
.section-subtitle { color: #718096; margin-bottom: 1.5rem; font-size: 1rem; }
.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 3rem; }
.cat-btn { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 1.5rem 1rem; background: #fff; border-radius: 16px; text-decoration: none; color: inherit; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: transform 0.2s, box-shadow 0.2s; }
.cat-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
.cat-icon { font-size: 2rem; }
.cat-label { font-weight: 600; font-size: 0.95rem; color: #2d3748; }
.cat-count { font-size: 0.8rem; color: #a0aec0; }
/* ── Quick Entry ── */
.quick-entry { max-width: 1200px; margin: 0 auto; padding: 1rem 2rem 2rem; background: #edf2f7; border-radius: 20px; margin-bottom: 3rem; }
.quick-entry h2 { font-family: 'Playfair Display', serif; font-size: 1.4rem; margin-bottom: 1rem; color: #2d3748; }
.quick-chips { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.quick-chip { text-decoration: none; background: #fff; color: #2d3748; padding: 0.6rem 1.2rem; border-radius: 30px; font-size: 0.9rem; font-weight: 500; box-shadow: 0 1px 4px rgba(0,0,0,0.06); transition: all 0.2s; }
.quick-chip:hover { background: #48bb78; color: #fff; box-shadow: 0 2px 8px rgba(72,187,120,0.3); }
/* ── Masonry Grid ── */
.masonry-section { max-width: 1200px; margin: 0 auto; padding: 0 2rem 3rem; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; }
.card-grid--style { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; }
.card-tile { text-decoration: none; color: inherit; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; }
.card-tile:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
.card-tile-img { width: 100%; aspect-ratio: 3/4; object-fit: cover; background: #e2e8f0; display: block; overflow: hidden; }
.card-tile-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.card-tile-info { padding: 1rem; }
.card-tile-title { font-weight: 600; font-size: 1rem; margin-bottom: 0.25rem; color: #2d3748; }
.card-tile-tags { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.card-tile-tag { font-size: 0.7rem; background: #edf2f7; color: #4a5568; padding: 0.15rem 0.5rem; border-radius: 10px; }
.see-all { display: inline-block; color: #48bb78; font-size: 0.9rem; font-weight: 600; text-decoration: none; margin-top: 0.5rem; margin-bottom: 2rem; }
.see-all:hover { text-decoration: underline; }
.style-section { margin-bottom: 2rem; }
/* ── Top hub nav (sticky) ── */
.top-nav { position: sticky; top: 0; z-index: 20; background: rgba(255,255,255,0.96); backdrop-filter: blur(8px); border-bottom: 1px solid rgba(226,232,240,0.8); padding: 0.75rem 2rem; }
.top-nav-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
.top-nav .logo { font-size: 1.05rem; }
.top-nav-links { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.top-nav-link { text-decoration: none; color: #4a5568; font-size: 0.82rem; padding: 0.32rem 0.75rem; border-radius: 20px; transition: all 0.2s; white-space: nowrap; font-weight: 500; }
.top-nav-link:hover { background: #edf2f7; color: #2d3748; }
.top-nav-link.cta { background: #48bb78; color: #fff; }
.top-nav-link.cta:hover { background: #38a169; color: #fff; }
@media (max-width: 768px) {
  .carousel { height: 50vh; min-height: 300px; }
  .carousel-content { bottom: 1.5rem; left: 1.5rem; }
  .section-title { font-size: 1.5rem; }
  .cat-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  .card-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; }
  .card-grid--style { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; }
  .quick-entry { margin-left: 1rem; margin-right: 1rem; }
  .masonry-section { padding: 0 1rem 2rem; }
  .categories { padding: 1.5rem 1rem 0; }
  .top-nav { padding: 0.65rem 1rem; }
  .top-nav-inner { gap: 0.8rem; }
}
</style>
</head>
<body>
<nav class="top-nav">
  <div class="top-nav-inner">
    <a href="/" class="logo">Send<span>A</span>Fun</a>
    <div class="top-nav-links">
      <a href="/trending.html" class="top-nav-link">🔥 Trending</a>
      <a href="/latest.html" class="top-nav-link">✨ Latest</a>
      <a href="/holidays.html" class="top-nav-link">📅 Holidays</a>
      <a href="/message-generator.html" class="top-nav-link">✍️ Messages</a>
      <a href="/pricing.html" class="top-nav-link">💳 Pricing</a>
      <a href="#quick-entry" class="top-nav-link cta" onclick="document.getElementById('quick-entry').scrollIntoView({behavior:'smooth'});return false;">💌 Find a Card</a>
    </div>
  </div>
</nav>
<header class="carousel">
  ${carouselSlides}
  <div class="carousel-dots">
    ${heroSlides.map((_, i) => `<div class="carousel-dot${i === 0 ? ' active' : ''}" onclick="showSlide(${i})"></div>`).join('\n        ')}
  </div>
</header>

<section class="categories">
  <h2 class="section-title">Browse by Category</h2>
  <p class="section-subtitle">Find the perfect card for any occasion</p>
  <div class="cat-grid">
    ${catButtons}
  </div>
</section>

<div class="quick-entry" id="quick-entry">
  <h2>I need a card for…</h2>
  <div class="quick-chips">
    ${quickHtml}
  </div>
</div>

<section class="masonry-section">
  <h2 class="section-title">Explore All Cards</h2>
  <p class="section-subtitle">Hand-picked designs for every message</p>
  <div class="card-grid">
    ${masonryHtml}
  </div>
</section>

<section class="categories" style="padding-top:0;">
  <h2 class="section-title">Shop by Style</h2>
  <p class="section-subtitle">Find a look that matches your mood</p>
  ${styleSections}
</section>

${buildFooter()}

${buildCookieConsent()}

<script>
// ── Carousel auto-play ──
let currentSlide = 0;
const slides = document.querySelectorAll('.carousel-slide');
const dots = document.querySelectorAll('.carousel-dot');
function showSlide(idx) {
  slides.forEach((s, i) => s.classList.toggle('active', i === idx));
  dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  currentSlide = idx;
}
function nextSlide() { showSlide((currentSlide + 1) % slides.length); }
if (slides.length > 1) setInterval(nextSlide, 5000);

// ── Style filter ──
function filterByStyle(style) {
  document.querySelector('.masonry-section').scrollIntoView({ behavior: 'smooth' });
}
</script>
</body>
</html>`;

}

// ── Fisher-Yates shuffle (in-place) ──────────────────────────────────────────
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── P1-6: Recipient aggregate pages (top 20 recipients) ─────────────────────
const RECIPIENT_PAGES = [
  { slug: 'for-best-friend',  label: 'For Best Friend',  match: 'for Best Friend',       meta: 'Personalised cards for your best friend — funny, heartfelt & thoughtful.' },
  { slug: 'for-her',          label: 'For Her',          match: 'for Her',               meta: 'Romantic & heartfelt cards for her — girlfriend, wife, fiancée & more.' },
  { slug: 'for-him',          label: 'For Him',          match: 'for Him',               meta: 'Cards for him — boyfriend, husband, fiancé. Masculine, funny & sincere.' },
  { slug: 'for-teacher',      label: 'For Teacher',      match: 'for Teacher',           meta: 'Thank-you cards for teachers. Show appreciation for educators.' },
  { slug: 'for-family',       label: 'For Family',       match: 'for Family',            meta: 'Cards for every family member — warm, loving & celebratory.' },
  { slug: 'for-neighbor',     label: 'For Neighbor',     match: 'for Neighbor',          meta: 'Friendly cards for neighbors — holiday greetings, thank-yous & hellos.' },
  { slug: 'for-wife',         label: 'For Wife',         match: 'for Wife',              meta: 'Romantic anniversary, birthday & love cards for your wife.' },
  { slug: 'for-coworker',     label: 'For Coworker',     match: 'for Coworker',          meta: 'Cards for coworkers — birthday, congratulations, thank-you & farewell.' },
  { slug: 'for-girlfriend',   label: 'For Girlfriend',   match: 'for Girlfriend',        meta: 'Sweet & romantic cards for your girlfriend — birthday, love & more.' },
  { slug: 'for-long-distance',label: 'For Long Distance',match: 'for Long Distance Friend', meta: 'Long-distance friendship cards — stay close across the miles.' },
  { slug: 'for-husband',      label: 'For Husband',      match: 'for Husband',           meta: 'Cards for your husband — romantic, heartfelt birthday & anniversary wishes.' },
  { slug: 'for-partner',      label: 'For Partner',      match: 'for Partner',           meta: 'Cards for your partner — love, birthday, anniversary & just because.' },
  { slug: 'for-godchild',     label: 'For Godchild',     match: 'for Godchild',          meta: 'Cards for your godchild — baptism, birthday, graduation & love.' },
  { slug: 'for-boyfriend',    label: 'For Boyfriend',    match: 'for Boyfriend',         meta: 'Cute & romantic cards for your boyfriend — birthday, love & more.' },
  { slug: 'for-hostess',      label: 'For Hostess',      match: 'for Hostess',           meta: 'Thank-you cards for hostesses — dinner party, holiday & hospitality.' },
  { slug: 'for-mom',          label: 'For Mom',          match: 'for Mom',               meta: 'Loving cards for Mom — Mother\'s Day, birthday, thank-you & just because.' },
  { slug: 'for-dad',          label: 'For Dad',          match: 'for Dad',               meta: 'Cards for Dad — Father\'s Day, birthday, funny & heartfelt wishes.' },
  { slug: 'for-fiancee',      label: 'For Fiancée',      match: 'for Fiancée',           meta: 'Romantic cards for your fiancée — engagement, love & wedding countdown.' },
  { slug: 'for-brother',      label: 'For Brother',      match: 'for Brother',           meta: 'Cards for your brother — birthday, graduation, congratulations & fun.' },
  { slug: 'for-sister',       label: 'For Sister',       match: 'for Sister',            meta: 'Cards for your sister — birthday, love, congratulations & inside jokes.' },
];
const RECIPIENT_DIR = path.join(DIST_DIR, 'recipient');

// ── P1-7: Style aggregate pages (top 5 most common styles) ──────────────────
const STYLE_PAGES = [
  { slug: 'romantic',   label: 'Romantic',   style: 'romantic',   meta: 'Romantic cards — hearts, roses, soft colors. For anniversaries, love & Valentine\'s.' },
  { slug: 'elegant',    label: 'Elegant',    style: 'elegant',    meta: 'Elegant cards — refined typography, sophisticated design. Weddings & formal events.' },
  { slug: 'cheerful',   label: 'Cheerful',   style: 'cheerful',   meta: 'Cheerful cards — bright colors, happy smiles. Perfect for birthdays & pick-me-ups.' },
  { slug: 'warm',       label: 'Warm',       style: 'warm',       meta: 'Warm cards — cozy, cozy, heartfelt. For family, sympathy, thank-you & love notes.' },
  { slug: 'classic',    label: 'Classic',    style: 'classic',    meta: 'Classic cards — timeless designs, traditional fonts. For weddings, graduations & milestones.' },
];
const STYLE_DIR = path.join(DIST_DIR, 'style');

// ── P1-8: Hub pages (Trending / Latest / Holiday Calendar) ──────────────────
const HUB_PAGES = [
  { slug: 'trending',   label: 'Trending Now',  type: 'trending',   meta: 'Most popular cards this week on SendAFun. Top picks across every category.' },
  { slug: 'latest',     label: 'Latest Cards',  type: 'latest',     meta: 'Newest greeting cards added to SendAFun. Fresh designs across all categories.' },
  { slug: 'holidays',   label: 'Holiday Calendar', type: 'holidays', meta: '2026 Holiday Calendar — every card-worthy date of the year with ready-made templates.' },
];
const HOLIDAY_DATA = [
  { month: 1,  day: 1,  name: "New Year's Day",          category: 'new-year'     },
  { month: 2,  day: 14, name: "Valentine's Day",         category: 'valentine'    },
  { month: 3,  day: 17, name: "St. Patrick's Day",       category: 'congratulations'},
  { month: 4,  day: 12, name: "Easter 2026",             category: 'easter'       },
  { month: 5,  day: 10, name: "Mother's Day 2026",       category: 'mothers-day'  },
  { month: 6,  day: 21, name: "Father's Day 2026",       category: 'fathers-day'  },
  { month: 10, day: 31, name: "Halloween",               category: 'halloween'    },
  { month: 11, day: 26, name: "Thanksgiving 2026",       category: 'thanksgiving' },
  { month: 12, day: 25, name: "Christmas Day",           category: 'christmas'    },
  { month: 12, day: 31, name: "New Year's Eve",          category: 'new-year'     },
];

// ── P1-9: Message Generator templates (used on message-generator.html) ──────
const MSG_TEMPLATES = {
  birthday: [
    "Happy Birthday, {{name}}! 🎉 May your special day be filled with joy, laughter, and everything you love.",
    "To the most amazing {{name}} on your birthday — wishing you a year as wonderful as you are. Love always.",
    "Cheers to another fantastic year around the sun! Happy Birthday, {{name}}.",
    "Happy Birthday, {{name}}! You make the world a better place just by being in it.",
  ],
  anniversary: [
    "Happy Anniversary, {{name}}! Every moment with you is a gift I cherish more with each passing day.",
    "To my love, {{name}} — thank you for {{years}} years of laughter, adventures, and memories. Here's to many more!",
    "Happy Anniversary! It feels like we just got started, yet I can't remember life without you. Forever yours.",
  ],
  love: [
    "I love you, {{name}}. With all my heart, today, tomorrow, and always.",
    "Just a little note to say: you're my favorite thing in the whole world. I love you, {{name}}.",
    "To {{name}} — every love song, every sunset, every perfect moment reminds me of you.",
  ],
  thanks: [
    "Thank you, {{name}}, for everything you do. Your kindness doesn't go unnoticed, and it means the world to me.",
    "Dear {{name}}: I couldn't have done it without you. Thank you from the bottom of my heart.",
    "So grateful to have you, {{name}}. Thank you for your love, support, and friendship.",
  ],
  generic: [
    "Thinking of you, {{name}}. Sending you warm wishes and a big hug from afar.",
    "Dear {{name}} — hope this little card brightens your day as much as you brighten mine.",
    "Just because you're you, and you're wonderful. With love, from me to {{name}}.",
  ],
};

// ── P2-11: How-to guides (25 categories, 30 real messages each) ─────────────
const GUIDE_DIR = path.join(DIST_DIR, 'guide');

const GUIDE_MESSAGES = {
  birthday: {
    general: ["Happy Birthday! Hope today's full of laughter, cake, and everything you love. 🎉","Wishing you the best birthday yet — make it unforgettable! 🎂","Cheers to another year around the sun. Happy Birthday! 🥳","May every wish you make tonight come true. Happy Birthday! 🌟","Sending you big birthday hugs and tons of good vibes. 🎈","Happy Birthday! Here's to more adventures together."],
    her:     ["Happy Birthday to my favourite person. You make every day brighter. 💖","For you, my love — may your birthday be as beautiful and warm as you are. 🌹","To the most wonderful woman I know: Happy Birthday, gorgeous. 💫","Another year of you being amazing. Happy Birthday, darling. 💐","Your smile is my favourite view. Happy Birthday, sweetheart. 💕","To my queen — today we celebrate YOU. Happy Birthday! 👑"],
    him:     ["Happy Birthday, man. Here's to burgers, beers, and no chores today. 🎸","To the guy who always has my back — Happy Birthday, legend. 🏆","Another year of crushing it. Happy Birthday, dude! 🤙","To my favourite human — Happy Birthday, handsome. 💪","Make this year count. Happy Birthday, bro. 🚀","Happy Birthday! You deserve every win coming your way. 🎯"],
    family:  ["Happy Birthday, Mom/Dad — thank you for everything you do. ❤️","To the best family ever — happy birthday to our rock. 🧸","Happy Birthday! Home is wherever you are. 🏡💛","Cheers to the person who taught me everything. Happy Birthday. 📖💫","Wishing you a birthday as warm as your hugs. 🤗❤️","Family means forever. Happy Birthday to my favourite people."],
    friends: ["Happy Birthday, bestie! Drinks on me later — let's make tonight legendary. 🍻🎉","To my ride-or-die — Happy Birthday! Another year of chaos together. 🌈🤪","Happy Birthday buddy! Thanks for always being there through thick and thin. 👫🧡","Another trip around the sun with my favourite person. Let's party! ☀️🥂","Happy Birthday, legend! So grateful for your friendship. 🙏✨","To my partner in crime — happy birthday to the funniest person I know! 😂🎈"]
  },
  anniversary: {
    general: ["Happy Anniversary! Every year with you just keeps getting better. ❤️","Cheers to us — another year of love, laughter, and terrible dance moves. 🥂💕","Happy Anniversary! Thank you for 365 more days of you. 💫","To many more years of adventures together. Happy Anniversary! 🌍","Another year of us, and I'd choose you all over again. 💕","Happy Anniversary — loving you is my favourite thing."],
    her:     ["To my wife: Happy Anniversary, my love. You are my everything. 💍💖","Happy Anniversary, darling — you still give me butterflies. 🦋💕","For the love of my life — another year, and I fall for you harder every day. 💘","To my beautiful wife — thank you for the best years of my life. Happy Anniversary. 💐","Happy Anniversary to the woman who makes ordinary days extraordinary. ✨💗","Another year of you = another year of pure happiness. I love you. 💞"],
    him:     ["Happy Anniversary, husband. Every day with you is a gift I never take for granted. 💙","To my man — another year and you're still my favourite. Forever yours. 💍","Happy Anniversary, babe. You're the best decision I ever made. 🥰","To the love of my life — another year of winning together. Happy Anniversary! 🏆💏","Thank you for another amazing year. Happy Anniversary, handsome. 💪💝","With you, forever still isn't long enough. Happy Anniversary. ⏳💙"],
    family:  ["Happy Anniversary to the most inspiring couple I know. Love you both! 💕👏","To Mom & Dad on your anniversary — thank you for teaching us what real love looks like. 💑❤️","Happy Anniversary! Your love story is still my favourite. 📖💗","Cheers to 25/30/40 years of beautiful marriage. Happy Anniversary! 🥂✨","Happy Anniversary to my wonderful grandparents — relationship goals, always. 👵👴💕","Another year of laughing together. Happy Anniversary, you two! 🎊"],
    friends: ["Happy Anniversary, you two lovebirds! You guys were made for each other. 🕊️💕","To the cutest couple ever — Happy Anniversary! Keep the spark alive. 🔥💞","Cheers to another year of your amazing love story. Happy Anniversary! 🥰🥂","Happy Anniversary to my favourite humans. Ship name: still iconic. ⚓❤️","Another year and your love is still #goals. Happy Anniversary! 👫✨","Happy Anniversary, guys! Can't wait for your next big adventure together. ✈️💗"]
  },
  love: {
    general: ["I love you. Three small words that mean everything to me. 💘💕","You're the first thing I think of when I wake up and the last before I sleep. 💙💤","I love you more than yesterday, less than tomorrow. Forever yours. 💞","In a world full of people, my heart chose you. Always. I love you. ❤️🧭","Every love song, every sunset, every perfect moment — it all reminds me of you. 🌅🎵","I don't say it enough: I love you, completely and unconditionally. 💗"],
    her:     ["I love you, my beautiful girl. You make everything magical. ✨💖","To my girlfriend/wife/love: you are the 'why' behind everything I do. I love you. 💍💫","I love you, baby. Every little thing about you drives me crazy in the best way. 💘","You + me = forever. I love you. 💞💕","To the most beautiful soul I know — I love you with all of me. 💗🌈","My heart is yours, and always will be. I love you, sweetheart. 💙"],
    him:     ["I love you, babe. From the silly faces to the late-night talks — every part of you. 💜","You're my home. I love you, my man. 🏡❤️","I love you, handsome. Every day with you is the best day. 💙☀️","To my boyfriend/husband — I don't know what I'd do without you. I love you forever. 💖","I love you more than coffee, and that's really saying something. ☕😘❤️","You're my favourite adventure. I love you, babe. 🚀💞"],
    family:  ["Love you, Mom. Thank you for being my safe place. 💗🌷","To my Dad — you're my hero, always. Love you. 💙🦸","Love you, sister/brother. You're not just family, you're my best friend. 👫💛","To my grandma/grandpa — sending you all my love today and always. 👴👵💕","Family is where love begins and never ends. Love you all. 🏡❤️","You don't choose family, but I'd choose you a thousand times. Love you. 💖"],
    friends: ["Love you, friend. Thanks for being my person through everything. 🧡🤗","To my bestie: I love you like a sibling. Forever ride or die. 💜👯","Love you, man. Thanks for putting up with my nonsense all these years. 😂💙","You're my platonic soulmate and I love you. Don't tell anyone I said that. 😉💕","Some friendships are forever. Ours is one of them. Love you. 💖✨","Love you, friend. So grateful the universe brought us together. 🌌💛"]
  },
  'thank-you': {
    general: ["Thank you. Just two words, but I mean them with my whole heart. 🙏💛","I couldn't have done it without you. Thank you for everything. 💙✨","Thank you for your kindness — it didn't go unnoticed. 🫶💕","I'm truly grateful. Thank you for being there. 🙏","Thank you for going above and beyond. You're amazing. 🌟","Words can't say how thankful I am. But here's a start: Thank you. 💖"],
    her:     ["Thank you, beautiful, for putting up with me. You're my favourite. 😘💕","To the woman who does it all — thank you for everything, my love. 💐💖","Thank you for being my rock, my joy, my everything. 💙💫","I don't say it enough: thank you for all that you do. I love you. 💗✨","Thank you for choosing me every single day. 💘","For every little thing — thank you, gorgeous. You're the best. 🌹💝"],
    him:     ["Thank you, babe, for always having my back. You're a keeper. 💙💪","To my favourite guy — thank you for being the calm in my chaos. 🧘❤️","Thank you for being such an incredible man. I'm so lucky. 🏆💞","Thank you for putting up with my nonsense. I owe you a lot of pizza. 🍕😂💕","Thank you for every hug, every laugh, every 'it's okay'. 💖","You make me braver just by being there. Thank you, handsome. 🤗💙"],
    family:  ["Thank you, Mom, for the sacrifices you made. I'll never fully repay you. 💐💗","Dad — thank you for teaching me what hard work and integrity look like. 🛠️💙","To my parents: thank you for everything. I love you both. ❤️","Thank you for always believing in me, even when I didn't. 🙏💞","Family: first teacher, biggest fan, forever home. Thank you all. 🏡❤️","Thank you for loving me at my worst. You guys are my people. 💛"],
    friends: ["Thank you for being my best friend. You're stuck with me forever. 😜🧡","Thank you for the late-night calls, the honest advice, and never judging. 🙏💙","To my bestie: thank you for all the laughs, the good, the bad, the weird. 👯💖","Thank you, buddy. I couldn't ask for a better friend. 👊😇","Thanks for being the friend I call at 2am when the world is on fire. ☕🔥","You're more friend, less family. Thank you for everything. 💛"]
  },
  congratulations: {
    general: ["🎉 Congratulations! You absolutely deserve this win. 🏆","Well done! All your hard work finally paid off. 🙌✨","So proud of you. Huge congratulations! 🥳","You did it! This is just the start. Huge congrats. 🚀","Cheers to you — congratulations on this amazing milestone. 🥂","Congratulations! The future just got a whole lot brighter for you. 🌟"],
    her:     ["Congratulations, beautiful! You smashed it. So proud of you. 💖👑","To my girl — you earned every bit of this. Congratulations, baby! 🌹🥇","Congratulations, gorgeous! I always knew you could do it. 💫✨","Yes! You crushed it. Congratulations, my love. 💐🎊","So proud to call you mine. Congratulations, babe. 💕🏆","Congratulations! Today's all about YOU. 💐🎉"],
    him:     ["Congratulations, man. You earned every drop of this. 🏅💪","Yes! You crushed that. So proud of you, bro. 🏆😎","Well done, handsome. Knew you had it in you. 💙🚀","Congratulations, babe. Watching you win never gets old. 🔥🥇","You deserve the world and more. Congratulations! 💙✨","Total legend behaviour. Congratulations, dude! 🎸🤙"],
    family:  ["Congratulations to my favourite person! We're all bursting with pride. 💛🧨","So proud of you. Congratulations from the whole family! 🥂❤️","To the newest graduate/promotee/new homeowner — huge congratulations! 🎓🏡✨","Your success is our success. Congratulations, we love you! 💗👏","Congratulations! Every family dinner from now on is about this story. 🍽️😆❤️","Mom/Dad/Sis/Bro — you did it! So proud. Congratulations! 🏆💙"],
    friends: ["Congratulations, bestie! This calls for shots. 🍸🎉","So proud of you, mate. You absolutely crushed it. Drinks on me! 🍻🏆","Congratulations! And to think I knew you when… 😜✨","This is the first of MANY wins for you. Huge congrats, buddy. 🚀🧡","You weirdo did it! Congratulations. I always believed. 😂💙","Dude! You deserve this and so much more. Congratulations! 🥳💯"]
  },
  wedding: {
    general: ["💍💗 Congratulations on your wedding day! Wishing you a lifetime of love and laughter.","To the happy couple: may every day be as magical as today. Happy Wedding Day! ✨🥂","Congratulations on tying the knot! Never lose the spark. 🔥❤️","Wishing you a marriage filled with inside jokes, lazy Sundays, and forever hugs. 👰🤵💕","Happy Wedding Day! Here's to the first of a million amazing years together. 💫🥳","Congratulations on your wedding. Best decision ever — marrying your best friend. 💖"],
    her:     ["To the most beautiful bride — congratulations! You look absolutely stunning today. 👰💕","Happy wedding day, darling. I can't wait to grow old with you. 💍💗","To my wife today and forever: I vow to love you more every day. 💙","Congratulations, gorgeous! Today is just the beginning of our fairy tale. ✨🌹","Happy Wedding Day, my love. You made me the happiest person alive. 💘","Cheers to us! We did it, babe. I love you forever. 🥂💞"],
    him:     ["To my groom, my forever — congratulations, handsome. I'm yours. 🤵💙","Happy wedding day, babe. Today I married my best friend. 💍💕","Congratulations, husband. I'll love you through football season, bad jokes, everything. 😂💙","Today I said 'I do' to the love of my life. Happy Wedding Day! 💗✨","You're my husband now! Congratulations, babe. Forever starts today. 🥰","To my forever person — congratulations on being stuck with me. 😜❤️"],
    family:  ["To my daughter/son on your wedding day — my heart is so full. Congratulations! 💗💍","Congratulations on your wedding, you two. Welcome to the family, officially. 🤗💕","To my sister/brother: Congratulations on finding 'the one'. Couldn't be happier! 💖✨","Happy Wedding Day! Mom and Dad are so proud of the life you're building. 👨👩👧💙","Congratulations on your marriage, kids! You two were made for each other. 🥳❤️","To my cousin getting married — congratulations! Let's party! 🎉🥂"],
    friends: ["To my bestie on her/his wedding day: I'M NOT CRYING YOU'RE CRYING 😭💕 Congratulations!","Congratulations on your wedding! Where's my official 'Maid of Honour/Best Man' trophy? 🏆😂","To the best couple ever — Happy Wedding Day! Can't wait for all the future adventures. 🚀💖","Congratulations! You owe me a lifetime of anniversary dinners. 🍽️💍","Happy Wedding Day, you two! Thanks for letting me be part of your beautiful story. 📖💕","Drinks, dancing, and 'I do's' — best wedding ever. Congratulations! 🥳🥂"]
  },
  'new-baby': {
    general: ["👶🍼 Congratulations on your new baby! Welcome to the world, little one.","So excited for your growing family! Huge congratulations on the new arrival. 🎀💙","Huge congrats on your new baby boy/girl. Parenthood suits you already. 💗✨","Congratulations! Can't wait to snuggle that tiny human. 🤱💞","Welcome to parenthood: the most beautiful chaos you'll ever know. Congratulations! 🍼💕","Baby + you = perfect family. So happy for you! 👨👩👧💙"],
    her:     ["Congratulations, Mommy-to-be/new Mommy! You're already doing amazing. 💪💖","To my beautiful friend on her baby shower/birthday of baby — so happy for you! 🌸💕","You made a tiny human and she's perfect. Congratulations, Mommy. 👶💗","Welcome to Mommyhood! It's messy, loud, and absolutely the best. Congratulations. 💙","To the new mom — you're stronger than you know. Congratulations! 🌟💖","Baby girl is as beautiful as her mama. Congratulations, gorgeous. 💐💕"],
    him:     ["Congratulations, Daddy! Baby boy/girl already has your eyes/smile. 😊💙","To the new dad — get ready for a lifetime of dad jokes. You're gonna crush it. 👔🍼","Congratulations on your new baby! Fatherhood looks great on you. 💪✨","Welcome to Dad life, buddy. Coffee will become your best friend. ☕😂💙","So happy for you, man. You're gonna be the best dad ever. 🏆👶","Huge congratulations, new Dad! Enjoy every sleepy snuggle. 💙🧸"],
    family:  ["Congratulations to my sister/brother on becoming a parent! The baby is so loved already. 💗👶","To our new niece/nephew: welcome to the family! And congrats to the parents. 🎀💙","Congratulations, Grandma/Grandpa! So excited for you to spoil this little one rotten. 🍬👴👵","My cousin had a baby! Congratulations to the whole family. New human alert! 🎉👶","Congratulations to my daughter/son on your new family. 💖✨👶","To the whole family on this new blessing — huge congratulations! 💛🙏"],
    friends: ["Bro! You're a dad! So happy for you and the family. Let's celebrate soon! 🍻👶","Bestie! Your baby is perfect. Congratulations, Mama. I'm already planning playdates. 🌈💞","Congratulations! I'm Aunty/Uncle now, right? Title is non-negotiable. 😂👑👶","OMGGGG CONGRATS ON BABY!!! I'm literally crying happy tears. So happy for you two! 😭💗💙","Huge congratulations, friend! Parenthood suits you. Next pizza night: you pick, I bring diapers. 🍕🍼💞","You made a human! And it's adorable. Congratulations, you guys are gonna crush this. 🥳👶"]
  },
  sympathy: {
    general: ["🕯️ With deepest sympathy. Holding you close in my heart during this sad time.","I'm so sorry for your loss. Sending you all my love and strength. 🙏💙","May your heart find peace and healing. With sincerest sympathy. 🌸","So sorry for your loss. They were one of the good ones. 🕯️💛","I'm here for you — anything you need, day or night. With love and sympathy. 🤗💙","May your happy memories comfort you in the days ahead. Sending love. 💗"],
    her:     ["I'm so sorry, my love. I can't imagine the pain you're feeling. I'm right here. 🫂💙","To my dear friend, with deepest sympathy. Grief is love with nowhere to go. 💔💗","I'm so sorry for your loss. Sending you the gentlest hug today. 🌸🤗","With sympathy and love. Take all the time you need to grieve. 💛","I know there are no words right now. Just know I love you. 💙🕯️","So deeply sorry for your loss. Your mom/dad/sister was one in a million. 💗"],
    him:     ["Dude, I'm so sorry for your loss. If you need anything at all, I'm here. 🙏🤗","Brother, I'm so sorry. I love you and I'm thinking of you. 💙🕯️","My deepest sympathy to you and your family. Just call, I'll come running. 🫂","To my husband/boyfriend — I'm so sorry for your loss. Grieve in your own way, I'm beside you always. 💙💗","With sympathy. Men cry too, and there's no shame in it. I love you. 💧❤️","So sorry, brother. Let's get coffee and just talk. Or not. I'm here either way. ☕🤗💙"],
    family:  ["With deepest sympathy to our whole family. We'll get through this together. 🕯️💙","I'm so sorry for our loss. Their love will live on through all of us. 🌸💗","To my family: sending strength to everyone right now. I love you all. 🤗💙","With sympathy — our wonderful [Mom/Dad/Grandpa] will never be forgotten. 💛🕯️","Sending all my love to the family during this hard time. 🙏💗","Our hearts are joined in sorrow and in beautiful memories. With sympathy. 💙🕊️"],
    friends: ["I'm so sorry for your loss, friend. Let me bring food, clean, anything. I got you. 🍲🤗💙","Dude, my heart aches for you. So sorry for your loss. I love you, man. 💙💛","To my bestie — I'm right here through all of it. With sympathy and a big hug. 🫂💗","I'm so sorry. Grief isn't linear, I'll check on you in 6 months too. Love you. 🌸🙏💙","So deeply sorry. Whatever you need — I'm there. 🕯️💞","With love and sympathy. Your dad/mom was legendary and I'll never forget them. 💛"]
  },
  'get-well': {
    general: ["🤒 Get well soon! Sending you tons of soup, rest, and healing vibes.🍲💛","Feel better! Can't wait to have you back to your hilarious self. 😊✨","Get well soon, we miss your face around here. 🌸💙","Rest up, drink water, and feel better soon. Sending big hugs. 🫂💗","Get well soon. Take all the time you need. We'll handle everything else. 💛🙏","Wishing you a speedy recovery. Get better every day! 🌟💙"],
    her:     ["Get well soon, my love. I'll bring soup, blankets, and bad TV. 🍲📺💖","Feel better, beautiful. Just rest and let me take care of everything else. 💐💗","Get well soon, gorgeous. Hate seeing you sick. Sending cuddles. 🤗💙","Drink tea, binge shows, heal up. Miss your smile, baby. 💛🌸","Get well soon! I'm making your favourite soup. Be there in 20. 🍲💞","Feel better, gorgeous. I'll bring chocolate AND medicine. Priorities. 🍫😂💗"],
    him:     ["Get well soon, bro. Beer is on hold until you're back on your feet. 🍻💪","Babe, rest up and feel better. I'll handle chores/dinner/kids. 💙🍳","Get well soon, man. Game night isn't the same without you. 🎮😎","Feel better, handsome. Gimme that blanket and a movie. 🍕🎬💙","Get well soon. Stop being a hero and take the day off. 🩹😉💪","Miss your dumb jokes. Heal up already, buddy. 😂💛"],
    family:  ["Get well soon, Mom. Sending you all my love and the biggest hug. 🫂💗","Feel better, Dad! Take your meds and listen to the doctor. Please. 😘💙","Get well soon, Grandma/Grandpa! We made you a card. 👧👦❤️","Rest up, sister/bro — we need you back to fight over the TV remote. 📺😂💛","Get well soon from all of us! We love you, take it easy. 🤗💙","Feel better soon. Soup + movies + family = best medicine. 🍲🎬❤️"],
    friends: ["Get well soon! I'm bringing snacks and bad reality shows. Be there soon. 🍿📺😂","Dude, get better. Gym isn't the same without your motivational grunts. 💪🏋️😜💙","Feel better, bestie! I've got wine waiting for you when you're up. 🍷💗","Get well soon! Group chat misses your daily memes. 📱🤣💛","Heal up quick, mate. I need my partner in crime back. 👯✨","Get well soon! I'd say 'don't do anything I'd do' but you're stuck in bed, so you're safe. 😏💙"]
  },
  graduation: {
    general: ["🎓 Congratulations, graduate! You did it! The world is waiting for you.","Well done, Class of 2026! So proud of every single one of you. 🎉👏","Congratulations on your graduation! This diploma is just ticket #1. 🚀💙","So proud of you, graduate. All those late nights paid off. ☕📚✨","Happy Graduation Day! Here's to fresh starts and big dreams. 🌟🎓","You graduated! Time to scare the corporate world. Good luck out there. 😎💼"],
    her:     ["Congratulations, beautiful graduate! You smashed it. So proud of you. 👩🎓💖","To my girl — you graduate today and I'm literally crying happy tears. 😭💗✨","Well done, gorgeous! That degree is well-deserved. 🎓💐💕","Happy Graduation, babe. Can't wait to see what you conquer next. 🏆💫","To the smartest woman I know — congratulations on graduating! 📚👑💙","Graduation day! You're brilliant, beautiful, and going places. 💖🚀"],
    him:     ["Congratulations, graduate! Knew you had it in you, bro. 🎓💪😎","Well done, man! That diploma looks good on you. 💼🏆","To my guy — you graduated! So proud of you, handsome. 🧑🎓💙","Happy Graduation, babe. The grind was real but so are you. 💛✨","Congratulations, dude! First round after ceremony is on me. 🍻🎓","You graduated AND you kept your sense of humour. Impossible combo. Respect! 😂🏆"],
    family:  ["To my daughter/son on your graduation day — WE DID IT! 🎓❤️","So proud of you, graduate. Mom and Dad are crying (happy tears, promise). 😭💛","Congratulations on your graduation. We always believed in you. 👏💙","To my sister/brother — YOU GRADUATED! So proud, let's eat cake. 🎂🎓","Happy Graduation! The family tree just got a whole lot smarter. 🌳📚💖","To my cousin graduating — huge congratulations! Can't wait for your first big job. 💼✨"],
    friends: ["CONGRATS GRAD! Remember: when you're rich, I was your friend first. 😜💰🎓","Dude, you actually graduated? The school must be so relieved. 😂👏 Seriously though — well done.","Bestie! We graduated. I'd say 'let's study more' but… no. Drinks instead! 🥂🎓🎉","Congratulations, buddy! PhDs next? You're a genius. Or not. Either way, proud. 👨🔬😎💙","YOU GRADUATED!!! Time to turn those 'what ifs' into 'what's next'. 🚀🌟","To my favourite graduate: no more deadlines, no more exams, just freedom and rent. 😂💛🎓"]
  },
  retirement: {
    general: ["🏖️ Congratulations on your retirement! You earned every lazy day.","Happy Retirement! This isn't goodbye — it's the start of your best chapter. ✨🌴","You survived meetings and reports. Now go survive sunshine and margaritas. Congrats! 🍹😂","Well done on an amazing career. You'll be missed but the beach is calling. 🌊☀️","Happy Retirement! Now you finally have time for the hobbies you've been putting off. 🎸🎨","Retired! Officially un-boss-able. Enjoy every second. 🎉💃"],
    her:     ["Congratulations on your retirement, beautiful lady! You deserve every bit of this. 💐🌴","Happy Retirement! Spas, brunches, and no alarm clocks — yes please! 💆🍳💕","To a legend retiring today — you've inspired so many of us. 💖👏✨","Retirement mode: activated. Go enjoy your well-deserved freedom, gorgeous. 🏖️🌹","Happy Retirement, Mom! Thank you for showing us what a career of integrity looks like. 💛","You did it! Now let's plan that girls' trip you've been talking about for 10 years. ✈️👯💖"],
    him:     ["Congratulations on your retirement, man! Golf season starts… right now. ⛳🏆","Happy Retirement, Dad! Now you can finally watch every game you want. 🏈📺🍻","Dude — you're retired! No more early mornings, no more deadlines. Paradise. ☀️😎","Well done on an epic career, brother. Time for fish, beer, and zero spreadsheets. 🎣🍻📊❌","Happy Retirement to my favourite old-timer. Kidding. Sort of. 😜💕","You retired! The office will never be the same without your terrible coffee. ☕😂"],
    family:  ["Happy Retirement, Mom/Dad! Thank you for all the years you worked so hard for us. ❤️🙏","To my parents on their retirement — go travel! You two deserve it. ✈️🌍💙","Congratulations on retiring! Family dinners just got a lot more frequent. 🍽️💛","Happy Retirement, Grandma/Grandpa! More time for cookies, bingo, and us. 🍪😊💕","So proud of you! Retirement is when the real fun begins. Enjoy every moment. 🏖️🌟","Congratulations on your retirement, brother/sister! Let's party like you just turned 21 again. 🎉🍻"],
    friends: ["Congratulations, mate! Retirement is when the second act begins. Gonna be epic. 🎸🚀","Happy Retirement! Now we can finally do Tuesday lunch without excuses. 🍱😂","Dude, you're RETIRED. Let's plan that fishing/roadtrip/golf weekend NOW. 🎣🛣️⛳","To my bestie on her retirement: spa days every day. I want in. 💆🥂","Retirement = no meetings, no deadlines, no Monday blues. Welcome to paradise. 🌴☀️😎","Happy Retirement! Your 'to-do' list is now officially 'do nothing if you want'. 👏💛"]
  },
  housewarming: {
    general: ["🏠🎉 Welcome home! So happy for you and your new place. Cheers to new memories!","Housewarming congratulations! May every corner be filled with joy. 🏡✨","New home, new adventures. Congratulations on your move! 📦🚚","May your new house become a home full of love, laughter, and friends. 🏠💕","Happy Housewarming! Don't unpack everything — the housewarming party is Friday. 📦🍕😂","Congratulations on your beautiful new home. So excited for house parties! 🏠🥂"],
    her:     ["Congratulations on your new home, beautiful! I'll bring the housewarming wine. 🍷🏠💖","Happy Housewarming, babe! Your new kitchen is 10/10 — cook me dinner? 🍳😘💕","Welcome to your new castle, your majesty. 👑🏠✨","So happy for you, gorgeous! New keys, new memories. 🏡💗","Housewarming hugs! Your new place already has your vibe. 💫🏠","Congratulations on your first apartment! I know you'll make it beautiful. 🏡🌸💖"],
    him:     ["Dude, nice place! Congratulations on the new house. 🏠💪🍻","Housewarming congratulations, man. Get a couch first, everything else is optional. 🛋️😂💙","Happy Housewarming! BBQ at yours every weekend from now on, right? 🍔🔥🏡","Congratulations on the new place, bro. Your gaming setup room looks insane. 🎮🏠","Welcome home, buddy. Let's christen the kitchen with pizza and beer. 🍕🍻🏡","Love the new house! You're officially an adult now. Ew. 😜🏠✨"],
    family:  ["Welcome to the neighbourhood! So happy for your growing family. 🏡❤️","Congratulations on your new home, kids! Can't wait for Sunday dinners here. 🍽️🏠💗","Happy Housewarming! Home is wherever your people are. Love you all. 🤗🏡💛","To my sister/brother on your new home — you've built something beautiful. 🏠💕","Congratulations on the new house! Grandma approves (and you need more plants, she says). 🌿👵😂","New home, new beginnings. Huge congratulations from the whole family! 🎉🏠💙"],
    friends: ["Congratulations! New house? I call dibs on the guest room. 🛏️😜🏡","Housewarming = mandatory party. I'll bring the games and the alcohol. 🎲🍻","Bro! Your new place is sick. Congratulations! 🎉🏠😎","Bestie! Your new home is literally my dream. So happy for you. 🏡💞✨","Dibs on being your first houseguest. Plan accordingly. 🛫🏡😂","New house, new memories, new group chat photos. Let's gooooo. 📸🏠🥳"]
  },
  'fathers-day': {
    general: ["👔 Happy Father's Day, Dad! Thank you for everything. Love you. 💙","To the world's best Dad — Happy Father's Day! You're our hero. 🦸💙","Happy Father's Day to every dad, step-dad, grandpa, and father figure out there. 💙👏","Dad: fixer of broken things, teller of bad jokes, best man I know. Happy Father's Day! 🔧😂💙","Happy Father's Day, Dad. You taught me how to be strong, kind, and patient. 🏋️❤️","To all the amazing Dads — you are appreciated more than you know. Happy Father's Day! 💐💙"],
    her:     ["Happy Father's Day to my husband — the best Dad our kids could ever ask for. 💙👶💕","To my Dad — you're my first love and my first hero. Happy Father's Day! 💙🌹","Happy Father's Day, babe. Watching you with our kids is my favourite thing in the world. 👨👧💖","To the man who gave me everything — Happy Father's Day, Dad. I love you. 💛","Happy Father's Day to my amazing Dad. I wouldn't be half the woman I am without you. 👑💙","For the best Dad in the world: Happy Father's Day! Enjoy your special day. 🎉💙"],
    him:     ["Happy Father's Day, Dad. Love you, man. Let's grill and watch the game, like every Sunday. 🍖📺😎","To my Dad — thank you for every lesson, every repair, every bad joke. Happy Father's Day. 🔧😂💙","Happy Father's Day, bro. You're killing it as a Dad. Keep it up. 💪🏆","To my husband on Father's Day: Happy Father's Day, babe. You're my rock and our kids' hero. 💙💍","Happy Father's Day to the coolest Dad I know — mine. 👓🕶️😎","To all the new Dads: Happy First Father's Day! You got this. 💪👶💙"],
    family:  ["Happy Father's Day, Grandpa! You're still the coolest guy at the table. 😎👴💙","To my uncle, brother, cousin — Happy Father's Day to all the father figures in our family. 💛","Happy Father's Day, Dad. From your favourite (don't tell the others). 😜💕","Happy Father's Day to my wonderful father-in-law. So grateful you're in my life. 💙🙏","Happy Father's Day to the whole crew of Dads in our family. Today we celebrate all of you. 🥳💙","To my Dad and my Grandpa — Happy Father's Day. Two of the best men I know. 🥰"],
    friends: ["Happy Father's Day, mate! Go put your feet up, you deserve it. 🍻💙","Dude! Happy Father's Day to a fellow Dad club member. Parenthood = chaos but best chaos. 👶😂","Happy Father's Day, bro. Your kids are so lucky to have you. 🫂💙","To my bestie and her hubby — Happy Father's Day to him from both of us. 👔🥂","Happy Father's Day, man! Hope the kids let you sleep in (lol, good luck). 😅😴💙","Cheers to all the Dads in the group chat. Happy Father's Day! 🍻🎉"]
  },
  'mothers-day': {
    general: ["💐 Happy Mother's Day, Mom! Thank you for loving me unconditionally. 💕","To the best Mom in the whole world — Happy Mother's Day! You deserve the world. 🌍💖","Happy Mother's Day to every Mom, Mum, Mommy, Mama out there. Today is all about YOU. 🌸💗","Mom: my first home, my forever safe place. Happy Mother's Day. 🏡💖","Thank you for carrying me 9 months and still putting up with me 20+ years later. Happy Mother's Day! 😂💙","Happy Mother's Day to all the Moms. You are magic, you do the impossible every day. ✨💗"],
    her:     ["Happy Mother's Day to my beautiful wife. You make motherhood look easy (we know it's not). 💐💕","To the best Mom our kids could ever have. Happy Mother's Day, my love. 💍💖","Happy Mother's Day, Mom. I got my strength, my kindness, my smile from you. 💗","To my Mom — my first and forever role model. Happy Mother's Day. 👑💖","Happy Mother's Day, gorgeous. You deserve flowers, breakfast in bed, and zero chores. 🌹🍳💙","To my daughter on her first Mother's Day — you're already the best Mom. 👶💖✨"],
    him:     ["Happy Mother's Day to my beautiful wife. Thank you for giving our children the best Mom. 💐💗","To the most wonderful Mom — mine. Happy Mother's Day. You deserve every bit of today. 💙🌹","Happy Mother's Day to the love of my life. Watching you be a Mom to our kids is my favourite. 🥰👨👩👧","To my wife — Happy Mother's Day. You keep this family going, and we appreciate you. 💛🏡","Happy Mother's Day, Mom. Thanks for loving me even when I was a total nightmare as a teen. 😅💙","To my Mom — you taught me what real love looks like. Happy Mother's Day. 💗"],
    family:  ["Happy Mother's Day, Grandma! Thank you for the cookies, the stories, and the unconditional love. 🍪👵💖","To my sister on her first Mother's Day — you are killing it, mama! 💪👶💗","Happy Mother's Day to every mother figure in our family. Today we celebrate you all. 🎉💖","Happy Mother's Day, Mom. Love you from your favourite (and most humble) child. 😇💙","To my beautiful daughter-in-law — Happy Mother's Day. We are so lucky to have you. 💕","Happy Mother's Day to all the aunties and grandmas who mothered us too. 💛💐"],
    friends: ["Happy Mother's Day, bestie! You are an AMAZING mom. Never forget that. 💐💗","To my girls — Happy Mother's Day! Wine is on me later, you beautiful mamas. 🍷✨💖","Happy Mother's Day, mama! Hope you get all the snuggles and none of the tantrums today. 🫂😂","To every Mom in my crew — you're all superwomen. Happy Mother's Day! 👸💙🎉","Bro, go wish your wife Happy Mother's Day right now. You too can be on her good side. 😜💐","Happy Mother's Day to my Mumsy! Sorry for all the grey hairs. 😬💕"]
  },
  christmas: {
    general: ["🎄 Merry Christmas! Wishing you peace, joy, and all the cookies. 🍪❤️","Ho ho ho! Merry Christmas and a Happy New Year! 🎅🎁","Merry Christmas to you and yours. May your holidays be warm and bright. 🌟🕯️","Wishing you a magical Christmas with the people you love most. 🎄💖","Merry Christmas! May Santa bring you everything you wished for (and lots of chocolate). 🎅🍫","Happy Holidays! Sending you all my love this Christmas season. 🎁⛄"],
    her:     ["Merry Christmas, my love. You're the best gift under my tree. 🎁💖🎄","All I want for Christmas is you. Merry Christmas, beautiful. 🎶🌹💗","Merry Christmas, gorgeous! I got you something… but it won't fit under the tree. 😏🎁💙","To my favourite Christmas elf — Merry Christmas, babe. Let's watch all the movies. 🎬🎄🍫","Merry Christmas, sweetheart. Every year with you is my favourite Christmas story. 📖💞","Merry Christmas, gorgeous. You make every day feel like Christmas. ✨💕🎄"],
    him:     ["Merry Christmas, babe. You're my favourite kind of present (wink, wink). 🎁😘💙","Merry Christmas, handsome. Hope Santa was good to you this year. 🎅🛷","To my man — Merry Christmas. Now let's open presents and drink hot cocoa. ☕🎁🍫","All I want for Christmas is more beer and you. Kidding. Mostly. 😜🍻❤️ Merry Christmas!","Merry Christmas, Dad/bro/hubby. Thanks for still pretending Santa is real for the kids. 🎅👨👧","Merry Christmas, dude. Let's eat until we pass out, like every year. 🍗🎄😂"],
    family:  ["Merry Christmas to the whole family! This year together is the best gift of all. 🎄💛🎁","Merry Christmas, Mom. The stockings are hung, the turkey is roasted, we love you. 🍗💗🎄","Merry Christmas, Dad. Thanks for pretending to be Santa all these years. 🎅😂❤️","Happy Holidays, Grandma/Grandpa! The grandkids made you (slightly lopsided) cookies. 🍪🎄💕","Merry Christmas to our crazy, loud, wonderful family. Let's fight over the last slice of ham! 🍖😆💛","Merry Christmas everyone! Tonight we eat too much and love even harder. 🥰🎄"],
    friends: ["Merry Christmas, besties! Secret Santa reveal at 8pm. Don't be late. 🎁🎄🎉","Ho ho ho, bitches! Merry Christmas! Let's get festive. 🎅🍷😂","Merry Christmas, buddy. Your ugly Christmas sweater is actually impressive this year. 🧶🎄😜","Merry Christmas, mate! Hope Santa brings you that PS5/puppy/quiet night you wanted. 🎮🐕💙","Happy Holidays to my favourite group chat. Can't wait for NYE plans. 🎊🕛","Merry Christmas! I got you the perfect gift. (It's wine. Always wine.) 🍷🎁💖"]
  },
  valentine: {
    general: ["🌹💗 Happy Valentine's Day! Spread love to everyone today.","You are loved. Happy Valentine's Day! 💕✨","To my valentine, my forever person. ❤️ I adore you.","Happy Valentine's Day to every kind of love — romantic, family, friends, self-love. 💖👏","Be my Valentine? Happy Valentine's Day! 💘","Sending all my love today and always. Happy Valentine's Day. 💞"],
    her:     ["Happy Valentine's Day, my queen. 👑🌹 I love you more than words.","To my beautiful valentine — my heart chose you, every single time. 💖💘","Happy Valentine's Day, gorgeous. Every day with you feels like Valentine's. ✨💕","Roses are red, violets are blue, no one in this world is as perfect as you. Happy Valentine's, my love. 🌹💗","To the love of my life — Happy Valentine's Day! I got you chocolates (and ate one). Oops. 🍫😂💖","Be my forever Valentine? I love you, baby. 💘💍"],
    him:     ["Happy Valentine's Day, handsome. You're my favourite distraction. 😏💙","To my man — Happy Valentine's Day. You stole my heart, please never give it back. 💙💘","Roses are red, my love for you is true. Happy Valentine's Day, baby. 🌹💗","To my husband/boyfriend — Happy Valentine's Day. I love your dumb face. 😘😂💙","You + me = forever. Happy Valentine's Day, babe. 💑💕","Happy Valentine's Day, babe. I would choose you in every life. 🌌💙"],
    family:  ["Happy Valentine's Day, Mom/Dad! You two invented relationship goals. 💑💕","To my sister/brother — Happy Valentine's Day, buddy. You're my forever valentine. 😜❤️","Valentine's hugs to the whole family! Family love is still the best love. 💗🏡","Happy Valentine's Day, Grandma! Grandpa better have gotten you flowers. 💐😏","To my kids — Happy Valentine's Day! You're my favourite little Valentines. 👧👦💖","Happy Valentine's to my favourite cousin. Love you, weirdo. 💘😂"],
    friends: ["Happy Galentine's/Guyentine's Day! Friendship love is the best love. 👯💕","Happy Valentine's Day, bestie. You're my platonic soulmate. 💗✨","Valentine's Day reminder: if he/she/they don't treat you right, I have a shovel and a plan. 😏🔪❤️ (kidding)","To my single squad: Valentine's Day is a marketing scam. Let's eat chocolate and watch rom-coms. 🍫📺😂","Happy Valentine's Day! I love us. 👫💛","To my ride or die — Happy Valentine's Day, best friend. 💞"]
  },
  halloween: {
    general: ["🎃👻 Happy Halloween! Stay spooky, eat candy, don't trust the clowns. 🤡","Boo! Happy Halloween! Hope it's frightfully fun. 😈🍬","Trick or treat! Smell my feet! Give me something good to eat. 🍬🎃 Happy Halloween!","Happy Halloween! May your costume be cool and your candy haul be epic. 🎉🍭","👻 Happy Halloween! Sending you scary vibes and sweet treats. 🧛🍫","Wishing you a spooky, scary, spectacular Halloween! 🦇🕷️🎃"],
    her:     ["Happy Halloween, gorgeous. Even a zombie would pick you over brains. 🧟😂💕","To my girl — Happy Halloween! Our couples costume this year is chef's kiss. 🤌🎃💖","Boo-tiful! Happy Halloween, my spooky queen. 👑👻💗","Hope your Halloween is as fun and sweet as you are. Happy Halloween, babe. 🍬🍭💖","Trick or treat? I choose treat — and the treat is you. 😏 Happy Halloween! 🎃💕","Happy Halloween, bestie. Let's get drunk on spooky punch and judge people's costumes. 🍹🎃😂"],
    him:     ["Happy Halloween, dude. Your costume is actually sick. Who are you again? 😂🎃👨🎤","Happy Halloween, babe. You make being dead inside look hot. 💀😂💙","To my man — Happy Halloween! We make a terrifying couple (affectionate). 🔪🩸💕","Bro, let's go haunt the neighbourhood for candy. No we're not too old. 🍬👻🎃","Happy Halloween, man. Let's watch every terrible horror movie on Netflix. 🎬🍿😱","Happy Halloween, handsome. You're the treat I want. 🍬😏💙"],
    family:  ["Happy Halloween, kids! Mom and Dad are eating all the good candy while you sleep. 😈🍫🎃","Happy Halloween, Grandma/Grandpa! Your witch costume is still iconic. 🧙‍♀️🎃😂","Trick or treat! The grandkids are in costumes and ready for candy. Go go go! 🧒🍭🎃","To my sister/bro — Happy Halloween! Remember that time we dressed up as [inside joke]? 😂👗🤡","Happy Halloween from our little monsters to yours. 🧟🧛🎃💙","Happy Halloween! Family pumpkin carving contest. Winner chooses the movie. 🎃🔪🎬"],
    friends: ["Happy Halloween, squad! Where's the party? 🎉🕺👻","Bro, that haunted house was TERRIFYING. 10/10 would scream like a baby again. 😂🏚️😱","Happy Halloween, bestie! Your costume is everything. Photoshoot NOW. 📸👯🎃","Guys! We gotta go to that costume party tomorrow. Already got the group costume idea. You'll love it. 😎🥳","Happy Halloween to my favourite weirdos. Let's be weird together, as per usual. 🤪👽","Happy Halloween! And remember: if you see a ghost, just offer it a candy. Works every time. I think. 👻🍬😂"]
  },
  easter: {
    general: ["🐰🌷 Happy Easter! Wishing you a basket full of joy and chocolate. 🍫🐣","He is risen! Happy Easter to everyone celebrating. ✝️🌸","Happy Easter! May your eggs be colourful and your chocolate be plentiful. 🥚🍫💛","Spring is here, Easter is here, everything feels fresh and new. Happy Easter! 🌿🌼","Happy Easter! Sending you sunshine, flowers, and a very full Easter basket. ☀️🌸🧺","To everyone celebrating: Happy Easter! Enjoy the family, the food, the eggs. 🐰🍳"],
    her:     ["Happy Easter, beautiful! You're the best thing in my basket. 🧺💖🌷","To my love — Happy Easter! Spring and new beginnings remind me of you. 🌱💕🌸","Happy Easter, gorgeous. I got you extra chocolate eggs. Don't tell anyone. 🍫🐰💗","Easter blessings, my dear. Hope your day is as bright as your smile. ☀️🌷💙","Happy Easter, my love. Let's hunt for eggs (and then eat them all). 🥚😂💖","To the sweetest bunny I know — Happy Easter! 🐰🌷💕"],
    him:     ["Happy Easter, babe. Spring and I love you — two of my favourite things. 🌱💙🐣","Dude, I found all the Easter eggs first. You owe me chocolate. 🍫🏆😂","Happy Easter, handsome. Watching you with the kids hunting eggs makes my heart full. 🥚👨👧💗","Hope your Easter is full of chocolate, ham, and football. Happy Easter, man. 🍫🍖⚽💙","Happy Easter, bro! Mom made your favourite pie. You're welcome. 🥧🙌","To my man — Happy Easter. You're my favourite new beginning. 🌷💕"],
    family:  ["Happy Easter, Mom! Your Easter dinner is still the best meal of the year. 🍽️💗🐣","Happy Easter, Grandma! The kids made you an (ugly) Easter bonnet. Wear it proudly. 👒😂🌸","To the whole family — Happy Easter! Let's eat, hunt eggs, and take too many photos. 🥚📸💛","Easter blessings, Dad. Thank you for hiding the eggs and making it fair (sort of). 😂🔍🥚","Happy Easter to my sister/bro and family. Spring is better when we're all together. 🌸🧺","To our little bunnies — Happy Easter! Chocolate first, veggies never (today). 🐰🍫💕"],
    friends: ["Happy Easter, bestie! Let's eat chocolate and complain about our diets starting tomorrow. 🍫💪😜","Bro! Easter BBQ at yours? I'll bring the beer. 🍻🥩🎉","Happy Easter, girls! Brunch and Easter egg cocktails? Yes please. 🥂🌷🍳","Happy Easter to the squad. Spring vibes and good vibes only. 🌼☀️💛","Hey! Easter egg hunt next weekend at the park. You in? 🥚🔍🌳","Happy Easter! If you can't find the eggs, blame the dog. Works every time. 🐶😂🐣"]
  },
  thanksgiving: {
    general: ["🦃🍂 Happy Thanksgiving! Today I'm grateful for YOU. 💕","Thankful, blessed, and stuffed with turkey. Happy Thanksgiving! 🦃🍽️","Grateful heart, full belly. Happy Thanksgiving to you and yours. 🍁🦃💛","Wishing you a Thanksgiving full of love, laughter, and lots of pie. 🥧🍂❤️","Happy Thanksgiving! May your table be full and your heart fuller. 🍽️💕","Today I count my blessings — and you're definitely one of them. Happy Thanksgiving. 🙏🍁"],
    her:     ["Happy Thanksgiving, my love. I am the most grateful for you this year. 💗🦃🍂","To my beautiful wife/girlfriend — Thankful doesn't cover it. I'm blessed to have you. 💕🍁","What am I thankful for this year? You. Every day. Happy Thanksgiving, baby. 💙🦃","Happy Thanksgiving, gorgeous! You make every day feel like a holiday. 🌷🦃💕","Thankful for you, babe. Now let's go fight over the last piece of pie. 🥧😜💖","Happy Thanksgiving to my favourite person. I'll serve you the best piece of turkey. Always. 🍗💗"],
    him:     ["Happy Thanksgiving, man. Thankful for a buddy like you. 🍻🦃💛","Babe, I'm thankful for you every day, but especially today. Happy Thanksgiving. 💙🦃🍂","Dude, your family's Thanksgiving dinner SLAPS. Thank you for the invite. 🍗😋","Happy Thanksgiving, Dad/hubby. Thanks for carving the turkey every single year. 🦃🔪👏","Grateful for you, brother. Let's eat till we can't move. 🥧🍗😂","Happy Thanksgiving, handsome. I'm thankful for your hugs, your jokes, and you fixing things around the house. 🔧💙"],
    family:  ["Happy Thanksgiving, Mom. Thanks for the best turkey and the best life. 🦃💗🍽️","Happy Thanksgiving, family! I'm so grateful for all of you. Let's eat! 🍗🥧❤️","To my Grandma — thanks for the pies, the prayers, and the love. Happy Thanksgiving. 🥧🙏💛","Happy Thanksgiving to the craziest, loudest, most loving family ever. 🦃😂💕","Thankful for you, Dad. And for the Thanksgiving football tradition. 🏈🦃","Happy Thanksgiving! Time for the annual 'what are you thankful for?' go-around. *deep breath* 😆🍁"],
    friends: ["Happy Thanksgiving, bestie! So grateful for you and our friendship. 🧡🦃","Guys! I'm thankful for YOU. Friendsgiving dinner soon? Yes yes yes. 🍽️🍷🎉","Happy Thanksgiving, dude. Thankful for you, the bro, the legend. 🍻🏆💛","I'm thankful for the squad. And also for wine. Mostly wine. 😂🍷💕🦃","Happy Thanksgiving, mate! I'll bring the sides to your place. You do the turkey. Deal? 🦃🥗","Grateful for our weird, hilarious, loyal group chat. Happy Thanksgiving, weirdos. 😂💛🦃"]
  },
  'new-year': {
    general: ["🎆 Happy New Year! Here's to new beginnings and big dreams. 2026 — let's go! 🚀","Cheers to 2026! May it be kinder, brighter, and better. Happy New Year! 🥂✨","Happy New Year! New year, same me (but hopefully 10% more organised). 📅😂","Wishing you every happiness in the New Year. 🌟 Happy 2026!","Goodbye 2025, hello 2026! Time to make this year count. 🎇💕🚀","Happy New Year! May your resolutions last at least until February. 😂💪"],
    her:     ["Happy New Year, my love. With you, every year is the best year. 💖✨🎆","To my girl — Cheers to 2026! Another year of us, another year of winning. 🥂💕🏆","Happy New Year, gorgeous. 2026 has BIG things planned for you. 💫👑","A new year with you by my side? Nothing can stop us. Happy New Year, baby. 💙🎇","2026 forecast: 100% more of you. Happy New Year, my love. 💕🗓️🥂","Here's to 365 brand-new days together. Happy New Year! 🎆💘"],
    him:     ["Happy New Year, man! 2026 = our year. Let's crush it. 💪🚀","Cheers to 2026, babe. I love you and I'm excited for everything this year brings. 🥂💙✨","To my husband/boyfriend — Happy New Year. Let's make 2026 unforgettable. 🌌🏆","2026, baby! New year, new us (plus beer, plus gym… maybe). 😜🍻 Happy New Year!","Dude! 2026 is gonna be the one. I can feel it. Let's gooooo. 🎉💨","Happy New Year, handsome. So excited to walk this year with you. 🗓️💙"],
    family:  ["Happy New Year, family! Here's to 365 more days of us. 🎆💛🏡","Cheers to 2026, Mom and Dad! Thank you for another year of love and support. 🥂❤️","Happy New Year! Kids, Grandma, cousins — let's make 2026 EPIC. 🎇✨","Happy New Year, Grandma/Grandpa! 2026 is gonna be wonderful with you in it. 👴👵💗","To my sister/bro — Happy New Year! Sorry in advance for all the dumb stuff I'll do in 2026. 😜","2026 here we come! Big plans for the family this year. Let's go. 🚀🏡🎉"],
    friends: ["HAPPY NEW YEAR, SQUAD! 2026 PARTY STARTS NOW. 🎇🎉🍻","Cheers, besties! 2026 is OUR year. More trips, more laughs, more wine. 🍷✈️😂","Bro, 2026 we finally take that trip. No more excuses. Road trip mode: ON. 🛣️🚗💨","Happy New Year! 2026 can go ahead and be kind to us now. Please. 😅✨","To my girls! 2026 resolutions: look good, feel good, ignore the haters. 💅😎🥂","Dude! New year new us? Nah. Same idiots, better memes. Happy 2026! 🤪📱😂"]
  },
  invitation: {
    general: ["💌 You're invited! Come celebrate with us — we'd love to have you. 🎉","You are cordially invited to join us for an unforgettable day. See you there! 🥂","Save the date! We'd be honoured if you'd be our guest. 💌📅","Consider this your official invitation. We hope to see you there! 🥳✨","Come one, come all! You're invited to the event of the year. 🎊🎈","Please join us! Your presence is the only present we need. 💛"],
    her:     ["I'm getting married! And I need YOU by my side. Will you be my bridesmaid/Maid of Honour? 💍👰💖","You're invited to my bridal shower! Let's celebrate me (and drink wine). 🍷🎉💌","You are so warmly invited to our baby shower/girls' weekend. RSVP ASAP! 💌👶🌸","Come to my birthday party! You're my favourite guest. Don't be late. 🎂🎉💖","You're invited to my dinner party. I'll cook, you bring wine and gossip. Deal? 🍷🍽️💌","To my bestie — I'm having a bachelorette weekend. If you're not there, I'm not there. Pack your bags! ✈️💃🎉"],
    him:     ["Bro, I need you to be my Best Man/Groomsman. Will you do the honours? 🤵🍻💙","You're officially invited to my bachelor party. Vegas. End of discussion. 🎰🍕🍻","Come to my birthday cookout. Beer on me, burgers on the grill. Invitation for life. 🍔🍖🥳","Dude, we're hosting a Super Bowl watch party. You're invited. If you're not here, we're not friends anymore. 🏈📺","Hey! You're invited to our housewarming/BBQ. Come one, come all. Bring beer. 🏡🎊🍻","You are cordially invited to the wedding of two of your favourite idiots. Yes it's us. 😜💍"],
    family:  ["You're invited! Family reunion this summer — everyone's coming. Can't wait to see you all. 👨👩👧📅","To the family: Surprise party for Mom/Dad's 60th! Don't tell them. Invitation below. 🤫🎉","Save the date for our baby's christening. We'd be honoured to have you there. 👶✝️💛","Our daughter/son is graduating! You are warmly invited to the ceremony and party after. 🎓🎉","You are so invited to our wedding. Family first, always. 💒💕","Cousins! Annual family camping trip — consider this your formal invitation. 🏕️🌲🥳"],
    friends: ["You're invited to my party. You + me + music + snacks. Be there or be square. 🎵🍕🎉","Group invitation: girls' trip, guys' weekend, cabin in the woods. Who's IN? 🏡👯🍻","Surprise! I'm throwing a themed party. You're all invited. Costumes mandatory. 🎭🎊","Party invitation: housewarming/game night/movie marathon. Bring snacks and vibes. 🎮🍿","Guys, I'm hosting a BBQ. Invitation is group chat-wide. RSVP so I know how much meat to buy. 🍖","Wedding invitation to my favourite couple: you'd better be there, or I'm sending a search party. 😜💍"]
  },
  farewell: {
    general: ["👋 Goodbye and good luck! This isn't the end, just a see-you-later. 🫂","So long, farewell, auf wiedersehen, goodbye! You'll be missed. 🎭✨","Wishing you the absolute best in your next chapter. You're gonna CRUSH it. 💪🚀","Goodbye isn't forever. Until we meet again! 💕","It's not a goodbye, it's a 'see you soon'. Wishing you all the luck! ✨🌍","Thanks for everything and goodbye for now. You'll do amazing things. 🌟"],
    her:     ["Goodbye, beautiful. I'll miss your face around here. Go shine bright. 🌟💖","To my bestie as you move abroad: don't forget me (or our FaceTime schedule). 😭💞👯","Goodbye, gorgeous. Go chase that dream job/dream life. You deserve it all. 💼✈️💗","I'm so sad to see you go but SO proud of where you're going. Goodbye, my love. 💙🥺","Goodbye, babe. Promise we'll FaceTime every Sunday. No excuses. 📱💕","So long, my girl. You've left some pretty big shoes to fill around here. 👠✨"],
    him:     ["Goodbye, bro. Go be a legend wherever you're headed. 🏆💪","Dude! Gonna miss working/gaming/living with you. Good luck out there. 🍻💙","Goodbye, handsome. Go take on the world. I'll be here cheering for you. 🥺💙👏","Farewell, mate. New job/city/adventure awaits. You got this! 💼🚀","Gonna miss your stupid face around the office/house. Goodbye, bro. 😂💙","Goodbye, babe. We'll do weekend visits and eat lots of takeout together. Promise. 🍱💕"],
    family:  ["Goodbye, sister/bro as you move for your new job. So proud, so sad. Go kill it! 🥺💛","To my daughter/son moving out — goodbye, but know home is always a phone call away. 📞❤️🏡","Goodbye, Grandma/Grandpa visiting from abroad. Come back soon, we love you. 👴👵✈️💗","Farewell, cousin moving across the country. Road trip to visit you is already planned. 🚗💨","Goodbye, my family. This move is exciting but I already miss you all. 🥺💙","To my niece/nephew — goodbye and good luck in university! Study hard, party harder (but not too hard). 😜🎓"],
    friends: ["Goodbye, mate. Working/living with you has been the best. Drinks on me before you leave. 🍻💛","Bestie! Moving to another country? RUDE. But also I'm so proud. I'll visit, you'll see. 😭✈️💖","Farewell to my work wife/husband. Office gossip won't be the same without you. 💼😂","Guys, let's do ONE more big night out before they go. Goodbye party — this weekend. 🎉🍻","Goodbye dude! The crew will miss you. Don't be a stranger, yeah? 🫂💙","Saying goodbye to my favourite human. Thank you for everything, see you very soon. 💞"]
  },
  sorry: {
    general: ["🙏 I'm sorry. I know I messed up, and I want to make it right.","I'm sorry for what I said/did. It was out of line and I regret it completely. 💙","I'm sorry. Can you forgive me? 🥺💕","I was wrong, and I'm truly sorry. You deserve so much better than that. 🙇","I'm sorry — no excuses, no justifications. Just me, apologising and promising to do better. 💛","I hurt you and I'll never forgive myself for that. I'm so, so sorry. 🥺💙"],
    her:     ["Babe, I'm so sorry. I never meant to make you feel that way. 💔💖","I'm sorry, my love. You deserve someone who always gets it right. I'll keep trying to be him/her. 🙏💕","I'm sorry, beautiful. I was an idiot. Can we talk and fix this? 🥺💗","Baby, I'm so sorry for being stupid. Forgive me? I'll make it up to you for weeks. 💐😔💙","To my girl — I'm sorry. You mean the world to me and I disrespected that. 💔🙏","I'm sorry, gorgeous. Let me take you out and make this up properly. 🌹🍷❤️"],
    him:     ["Babe, I'm so sorry. I was wrong and I know it. 💙🥺","I'm sorry, man. I shouldn't have said that. It won't happen again. 🙏🤝","I'm sorry, handsome. I hurt you and I hate myself for that. 💔💞","Dude, I'm sorry. Beer is on me as many times as you need. 🍻🙏💙","I'm sorry for being a total idiot. Forgive me? I love you more than anything. 😔💕","Honey, I'm sorry. I'll do anything and everything to earn back your trust. 🥺💛"],
    family:  ["Mom/Dad, I'm so sorry for what I said. I was wrong and I love you. 💗🙏","I'm sorry, Grandma/Grandpa. I should have called/visited more. I'll do better. 🥺👵👴","I'm sorry, sister/bro. I shouldn't have fought with you. You're my best friend. 💛🫂","To my family — I'm sorry for being distant lately. Let me make it up to you. 🍽️❤️🙏","I'm sorry, kiddo. I know I messed up. Will you forgive your dumb parent? 😅💕","I'm sorry for the way I acted at dinner. I'll be better. Love you all. 💙"],
    friends: ["I'm so sorry, bestie. I'd never intentionally hurt you. Please forgive me? 🥺💖","Dude, I'm sorry. That was messed up of me. Beer and a long apology? 🍻🤙","I'm sorry I bailed on our plans. I know I flaked, can I make it up to you? 🍱🙏💛","I'm so sorry. I know I've been MIA and it's not okay. I love you, friend. 💙","Bestie, I'm sorry. I said the wrong thing and I hate that I made you sad. 🫂💗","I'm sorry. Can we just talk? I really value what we have and I don't want to lose it. 🙏💕"]
  },
  friendship: {
    general: ["👯 Thank you for being my friend. Life would suck without you. 💛","Best friends forever. No takebacks. You're stuck with me. 😜💕","Friendship isn't about who you've known the longest. It's about who walked in and never left. 💙","Here's to the friends who became family. Love you guys. 🏡💖","Good friends are hard to find, harder to leave, and impossible to forget. 🫂✨","Friendship is the only cement that will ever hold the world together. (And wine.) 🍷😂💙"],
    her:     ["To my bestie — you're my person, my sister, my rock. I love you. 💖👯","My ride-or-die, my partner in crime, my therapist, my hype woman. Love you, girl. 💗👏","To my beautiful friend — you deserve everything good in this world. 💐✨","Bestie, you are the sister I got to choose. Love you always. 👯💕","Girl, where would I be without your advice, your memes, and your wine nights? Love you tons. 🍷📱💖","You're more than a best friend. You're my platonic soulmate. 💞✨"],
    him:     ["Brothers from another mother. Love you, man. 🍻💪🤙","To my best guy friend — thank you for the dumb jokes, the real talks, and always having my back. 💙","Mate, you're my oldest friend and still my favourite. Here's to 50 more years of chaos. 👬🎉","Dude, I'd trust you with my life, my secrets, and my last beer. That's real friendship. 🍻💙","To my guy — thanks for being the friend who shows up. Always. 🙏🤝","We're not friends, we're brothers. That's the binding contract. Love you, bro. 👬💛"],
    family:  ["My sister/bro isn't just family. They're my first and forever best friend. 💞👫","Family by blood, friend by choice. I love you, cousin. 👯💛","Thank you for being my cousin AND my best friend. Life is better with you in it. 💖✨","To my niece/nephew — you're growing up so fast! Always know I'm your cool aunt/uncle AND your friend. 😎💕","To my in-laws: you're not just family, you're my new best friends. (Please still like me after reading this.) 😂💗","Having you as a brother/sister is the best friendship I never applied for. 👫😂💙"],
    friends: ["Cheers to us! The group chat that never sleeps. Love you guys. 📱💙🍻","To my squad: when one of us wins, we all win. That's friendship. 🏆💯👥","Shoutout to the friends who answer my 2am texts with actual concern, not judgement. 😅📱💛","We don't see each other every day, but when we do, it's like no time passed. That's real friendship. 🫂✨","To my best friends: I'd fight a bear for you. Maybe a small bear. But I would. 😠🐻😂","Thank you, guys. For everything. I'm a better person because I know you. 🙏💞"]
  },
  'just-because': {
    general: ["💌 No reason, no occasion — just thinking of you today. 💗","Just because you're amazing. Just because I love you. 💫💕","Hi! You popped into my head so I sent you a card. Have a fabulous day! 😊✨","No reason needed to tell someone they matter. You matter. A lot. 💛","Just a little reminder: you are wonderful and loved. 💙","'Just because' card! Because 'just because' is reason enough. 💌✨"],
    her:     ["Hey beautiful. Just because you've been on my mind all day. 💖💫","No occasion, no reason — I just love you a lot today (and every day). 💕","Hey girl, just because. You make ordinary days feel magical. ✨🌹💗","Babe, this card is just because. You deserve to know how amazing you are. 💙💞","Just because: you're my favourite person, always and forever. 💗","Hey bestie! Just because card + wine later? Yes please. 🍷💌"],
    him:     ["Hey handsome. Just because I was thinking about you. 💙💫","Babe, this card is 'just because'. I love you, that's all. 💞","Dude, just because you're my favourite idiot. 😂💙","Hey man, just because. You're a good friend. Don't let it go to your head. 😜🤝💛","Just because: I appreciate you more than I probably say. 💙🙏","Hey bro. Just because — let's get burgers soon. My treat. 🍔💙"],
    family:  ["Just because I love you, Mom. Thanks for everything, as always. 💗💌","Dad, just because you're the best. That is all. 💙","Hi Grandma/Grandpa! Just because — I hope you're having a lovely day. 🌞👵👴💕","Just because card to my sister/bro: you're weird. But you're my weird. 👫😂💛","Family — just because I don't say it enough: I love you all. 🏡❤️","To my niece/nephew. Just because you're my favourite human under 10 (or over, no judgement). 😜💖"],
    friends: ["Hey bestie. Just because you're the best friend ever. 💛💌","Dude, just because — you're a legend. Don't ever change. 💪😎","Just because card! Miss your face. Let's hang out soon. 🥰","Hey girl. Just because you've been slaying it lately and deserve some love. 💅✨👏","Group chat shoutout! Just because you're all my favourite weirdos. 😂📱💙","Just because: you deserve to be told you're great today. So — you're great. 💛✨"]
  }
};

// 25 分类 × 5 条专业祝福语文案写作技巧
const GUIDE_TIPS = {
  birthday: ["Mention the milestone (18th, 30th, 50th) — specificity always wins.","Add one tiny memory or inside joke instead of 10 generic adjectives.","Ask a question at the end ('What's your birthday wish?') — makes the card interactive.","Use 'you' 3x more than 'I' — the card is about THEM, not you.","Avoid jokes about ageing unless the recipient explicitly laughs about it first."],
  anniversary: ["Reference a real year/number ('10 years, 4 countries, 1 dog') — specific length beats 'forever'.","Name one small, annoying thing you still love about them.","Name one promise you're still keeping (not just 'I love you').","For milestone anniversaries (10th, 25th, 50th), link back to the original day.","Mix romance + humour — pure sappy gets awkward to read out loud."],
  love: ["Say 'I love you' first, THEN explain why. The direct line matters.","Name one extremely specific, non-obvious thing you adore about them.","Use a private pet name only they understand.","Avoid clichés (moon, stars, 'complete me') — be original.","Tell them something you'd be embarrassed to say face-to-face."],
  'thank-you': ["Name the EXACT thing you're thanking them for — not 'thanks for everything'.","State the impact: 'Because you did X, I was able to Y'.","End with an offer to return the favour (specific — not 'anytime').","Acknowledge their cost: 'I know this took your weekend and I'll never forget it.'","Keep it short — true gratitude doesn't need a novel."],
  congratulations: ["Explain WHY this win was inevitable for them (specific strengths).","Reference the struggle: 'I saw how many late nights you put in…'","Name something cool this now enables ('Now we can finally go on that trip!').","If multiple audience (family, work), tailor each part; if just friend, roast lightly then praise.","Avoid humblebrag adjacent language ('I always said you were good for something')."],
  wedding: ["Congratulate BOTH partners by name (not just the bride).","Acknowledge the family joining together.","Share one tiny, specific memory of you two as a couple.","Mention something practical about marriage ('May the remote wars be ever in your favour').","End with a toast-style, spoken-friendly sentence since it'll likely be read aloud."],
  'new-baby': ["Congratulate the PARENTS first, then welcome the baby.","Acknowledge the mess ('Sleep is now a myth… but SO worth it').","Offer a specific, actionable favour ('I'll drop dinner off Tuesday').","Avoid 'enjoy every moment' — new parents hate that phrase.","If gender reveal, lean into it softly, not stereotypically."],
  sympathy: ["Start with 'I'm so sorry for your loss.' — open, direct, no poetry.","Acknowledge that words are useless right now ('There truly are no words…').","Offer SPECIFIC help (I'll bring lasagna Friday, I'll take the dog Mondays).","Name the person who died ('Your dad was one of the greats').","Add 'No need to reply.' — grieving people owe nothing."],
  'get-well': ["Acknowledge how unpleasant they probably feel — don't be overly cheerful.","Offer practical, zero-effort help: 'I left soup on the porch'.","Avoid 'everything happens for a reason' unless you're 100% sure it's welcome.","Mention something specific you miss about them being healthy.","End with 'Take all the time you need' — no pressure to 'hurry up and get better'."],
  graduation: ["Connect their old self (first day of school) to now.","Make fun of one old memory ('Remember when you failed algebra and cried?').","Offer concrete career help or an 'in' if you have one.","Note that the diploma is proof, not the point — the skills are.","Use humour generously; ceremonies are already serious enough."],
  retirement: ["Acknowledge their actual, specific contributions at work, not 'you'll be missed'.","Name 2-3 hobbies they now have time for (be specific).","Thank them for mentoring you personally, if true.","Make jokes about Monday sleep-ins, no meetings.","Link it to family: 'Your grandkids are so excited for more of you'."],
  housewarming: ["Acknowledge that moving is the worst — validate the chaos first.","Comment on ONE specific, nice feature ('That kitchen window is INCREDIBLE').","Offer unpacking help, pizza, or power tools.","If first home, acknowledge the huge milestone.","Joke about house parties you will be hosting at their place."],
  'fathers-day': ["Reference 1-2 specific things he taught you with your hands (fixing stuff, sports, grilling).","Laugh at ONE of his bad dad jokes by name.","If he's your husband/partner, thank him through the KIDS' eyes too.","For grandpas: highlight how the grandkids light up around him.","Don't wait for Father's Day to say any of this — repeat it often."],
  'mothers-day': ["Name one sacrifice she made that she NEVER told you about (that you somehow know).","Thank her for the invisible labour (not the big, obvious stuff).","For your wife/partner as a mom: watch her with the kids and describe one specific moment.","For grandmas: 'I now understand what you meant when you said…'","If you fought growing up, acknowledge healing — forgiveness is powerful on this day."],
  christmas: ["Name one family Christmas tradition that you're looking forward to THIS year.","Mention one gift or person from last Christmas.","Keep religious content out unless you're 100% sure of beliefs.","Joke about overeating, ugly sweaters, or family drama.","If sending to a friend, make it about friendship + holidays + wine."],
  valentine: ["Non-romantic Valentines are valid! Write them for friends, family, yourself too.","Write a 'compliment sandwich' in the middle: cute, specific, cute again.","For long-term couples: reference one boring domestic detail you love (morning coffee, socks).","For new couples: keep it sweet, not over-the-top.","If platonic, make that very clear first line — no mixed signals!"],
  halloween: ["Ask if they have a costume planned, or compliment their costume.","Reference an inside joke from last year's Halloween.","Mention candy preferences (chocolate over gummies, always).","Joke about how old you are vs. how old you feel trick-or-treating.","If writing to kids: keep it short, use emojis, make it rhyme a little."],
  easter: ["Mix spring imagery (flowers, sunshine, new life) with actual relationship stuff.","If writing to kids, hide small jokes or egg-hunt clues IN the message.","Religious cards: keep He is risen short, then pivot to love and family.","Mention chocolate (always).","If to a new parent, note that this is baby's FIRST Easter — milestone moment."],
  thanksgiving: ["Name 3 EXACT things you're thankful for about THEM (not 'this great life').","Write a list format — bullet points are charming on Thanksgiving cards.","Thank them for a specific dish (the pie, the turkey, the cranberry sauce from scratch).","Acknowledge people missing from the table gently.","End with 'and also thankful for pie' — lighten the tone before crying."],
  'new-year': ["Reference one specific win from LAST year that you shared.","Make a resolution ABOUT THEM, not just you ('I resolve to call you more').","State one fear you're letting go of this year.","Dream aloud — one big, crazy thing you want to do together in 2026.","Keep it optimistic but grounded — 'best year ever' rings hollow after a bad one."],
  invitation: ["Answer the 5 W's clearly: Who, What, When, Where, (W)RSVP by.","If formal, keep language formal. If BBQ, keep it breezy. Use the right tone.","Put a FUN detail first line (costume theme, taco bar, bouncy castle).","Name the dress code if relevant.","Repeat the date/time TWICE — once in body, once in footer (bolded for weddings)."],
  farewell: ["Don't just say 'good luck' — explain exactly what you think they'll crush.","Make a 'see you soon' plan with a real date, not 'let's catch up sometime'.","Reference the weirdest, funniest memory you share — lighten the tears.","If work farewell: acknowledge what you learned specifically from them.","If move: include a small, silly thing they MUST bring from the old place."],
  sorry: ["State the mistake first, no preamble. No 'I'm sorry if you felt…' — say 'I'm sorry I DID…'.","Explain the impact you now realise it had, in their shoes.","Say exactly what you will do differently next time.","Ask explicitly for forgiveness ('Can you forgive me?') — closing the loop matters.","Avoid long lists of excuses. Just: one paragraph apology, one paragraph plan to be better."],
  friendship: ["Compliment a strength of theirs NOBODY else notices.","Reference one hard time they got you through (not just the good parties).","Make a fake legal contract — 'you owe me 3 more decades of friendship, no loopholes'.","Joke about how you first met (if funny/cringey).","Use 'ride or die' or 'found family' language if you mean it — platonic love deserves bold words."],
  'just-because': ["Open with a playful reason ('Saw a dog that looked like you so…') — give an absurd tiny trigger.","Keep it short, punchy, honest. 3 sentences max.","Compliment them somewhere unexpected: 'I like how you listen when you don't know what to say'.","Write it on a weird day (Tuesday, 2:47pm) — the randomness is the point.","End with a tiny, immediate action: 'Text me back an emoji right now. I'll wait.' 😊"]
};

// 25 × 3 Bad vs Good 对比示例（每分类 3 组）
const GUIDE_BADGOOD = {
  birthday:      [ { bad:'Happy Birthday! Have a good one.', good:'Happy 30th Birthday, Emma! Hope it\'s filled with tacos, karaoke, and all the dumb shit we love. 🎉' }, { bad:'Another year, older and wiser.', good:'Another year of you not being the worst friend. Win-win. 😜 Love you, bud. Happy Birthday.' }, { bad:'Hope you get what you want for your birthday.', good:'Wishing you exactly what you asked for — and one surprise puppy (don\'t tell your partner). 🐶🎂' } ],
  anniversary:   [ { bad:'Happy Anniversary, love! XOXO', good:'Happy 7th Anniversary, Sam. 7 years, 4 apartments, 2 cats, 0 arguments won (by me). Still my favourite human. 💙' }, { bad:'Many more years to come.', good:'Here\'s to 60 more years of stealing your fries, hogging the blanket, and choosing you every single day.' }, { bad:'Happy Anniversary to the best wife ever.', good:'Happy Anniversary, wifey. You still give me butterflies… especially when you bring me coffee in bed. ☕💘' } ],
  love:          [ { bad:'I love you so much.', good:'I love the way you laugh at your own jokes 3 seconds before the punchline. I love you, every part of you.' }, { bad:'You complete me.', good:'You don\'t complete me — you make me want to be a better version of myself. And I love you for that.' }, { bad:'I miss you.', good:'I miss your terrible singing in the shower and the way you leave socks literally everywhere. Come home. 💛' } ],
  'thank-you':   [ { bad:'Thanks for everything.', good:'Thank you for driving 2 hours in the rain to pick me up from the airport last Tuesday. That meant everything.' }, { bad:'I really appreciate it.', good:'I know it ate into your weekend and you never complained. Thank you from the bottom of my heart — I owe you big time.' }, { bad:'You are so helpful!', good:'You\'re more than helpful — you\'re the reason I didn\'t quit. Thank you for literally everything. 🙏' } ],
  congratulations:[ { bad:'Congrats! 🎉', good:'CONGRATULATIONS ON THE PROMOTION! I saw how many late nights you put in. Nobody deserves this more. CHAMPAGNE TONIGHT 🍾' }, { bad:'Well done on your achievement.', good:'First your degree, then your first house, now this. You, friend, are on a LEGENDARY streak. So proud.' }, { bad:'Good job!', good:'Good job?! This is life-changing. You just levelled UP. I\'m screaming. Congratulations, you absolute genius!' } ],
  wedding:       [ { bad:'Congrats on getting married!', good:'To Alex & Jordan — 6 years ago you matched on a terrible dating app and now you\'re MARRIED. We always knew. 💍 Congratulations!' }, { bad:'Wishing you a happy marriage.', good:'May your marriage be filled with pizza on Friday nights, dance parties in the kitchen, and the remote wars always going your way (50/50).' }, { bad:'Best wishes on your special day.', good:'Best wishes on forever starting TODAY. Remember — marriage is just really long sleepovers with your favourite person. 💕' } ],
  'new-baby':    [ { bad:'Congrats on the new baby!', good:'Congratulations on Zoe! She has your nose (sorry, Jamie) and the loudest lungs I\'ve ever heard. Parenthood suits you. 👶🍼' }, { bad:'Enjoy every moment!', good:'Ignore the "enjoy every moment" people. Survive today. Order the Uber Eats. Accept the help. You\'re doing amazing.' }, { bad:'So happy for you two!', good:'So happy for you — and if you ever need someone to babysit for 2 hours so you can take a NAP, call me. I\'m there.' } ],
  sympathy:      [ { bad:'Everything happens for a reason.', good:'There truly are no words for how unfair this feels. I\'m so, so sorry for your loss.' }, { bad:'They\'re in a better place.', good:'Your dad was one of the funniest, kindest men I ever met. I\'ll never forget his terrible BBQ jokes. He\'s so loved. 💙🕯️' }, { bad:'Let me know if you need anything.', good:'I\'m dropping dinner off Wednesday at 6. No need to answer the door. No need to reply. ❤️' } ],
  'get-well':    [ { bad:'Get well soon!', good:'Get well soon, you idiot — you missed the best game of the season and we need you back for trivia night. 😘' }, { bad:'Feel better!', good:'Left soup + your favourite chocolate on the porch. Text when you\'re awake enough to watch trash TV together. 🍲🍫' }, { bad:'Hope you feel better quickly!', good:'Take your meds, binge the show, heal slow. Work can wait. YOU come first. 💛' } ],
  graduation:    [ { bad:'Congrats grad! 🎓', good:'CONGRATS GRADUATE!!! You passed chemistry (by 2 points), you passed life (by a mile). So proud of you. 🎉' }, { bad:'The world is your oyster.', good:'The world isn\'t an oyster — it\'s your playground. Go play, go fail, go win. I\'m cheering from the front row forever.' }, { bad:'Good luck in your future endeavours.', good:'Good luck?! You don\'t need luck — you\'ve got talent, grit, and a resume that would scare HR. Go get \'em! 💪' } ],
  retirement:    [ { bad:'Happy Retirement!', good:'HAPPY RETIREMENT, DAVE! 43 years of spreadsheets and bullshit. Now your only job is to perfect that golf swing. ⛳ You earned it.' }, { bad:'Enjoy your golden years.', good:'Golden years my ass. These are your BEER AND FISHING YEARS. Enjoy every last margarita. 🍹🎣' }, { bad:'You will be missed at the office.', good:'We will miss you at the office — but not as much as Monday 8am meetings will miss you 😂 Have the BEST time, legend.' } ],
  housewarming:  [ { bad:'Congrats on the new house!', good:'CONGRATS ON 22B BAKER STREET!!! That kitchen window. That rooftop patio. I\'m basically moving in. 🏡' }, { bad:'Home sweet home!', good:'Home sweet home — may your WiFi be strong, your neighbours be quiet, and your toiletries cabinet always full. Welcome home!' }, { bad:'Nice place!', good:'That kitchen counter has charcuterie board written ALL over it. Housewarming party THIS SATURDAY. Invitation non-negotiable. 🍖🥂' } ],
  'fathers-day': [ { bad:'Happy Fathers Day Dad!', good:'Happy Father\'s Day, Dad. Thank you for teaching me to ride a bike, fix a tap, and that dad jokes are ALWAYS appropriate. You\'re my hero. 💙' }, { bad:'Thanks for all you do Dad.', good:'Thanks for putting up with my terrible teen years, paying for college, and STILL thinking I\'m funny. You\'re the GOAT. Happy Father\'s Day.' }, { bad:'Best Dad Ever!', good:'Best dad ever, best grandpa ever to the kids. Today we let you watch the game in peace. And bring you beer. 🍻🏈' } ],
  'mothers-day': [ { bad:'Happy Mothers Day!', good:'Happy Mother\'s Day, Mum. Thank you for the 1,000,000 sandwiches, 500 loads of laundry, and the million times you said "call me when you get home". 💗' }, { bad:'You are the best Mom!', good:'To the best mom, the best nana, the best human. You never asked for anything. Today you get breakfast in bed. (The kids helped. It\'s mostly cereal.)' }, { bad:'Thanks Mom!', good:'Thanks for always taking my side even when I was obviously wrong. You are my original hype woman. Happy Mother\'s Day! 👑' } ],
  christmas:     [ { bad:'Merry Christmas and a Happy New Year!', good:'Merry Christmas, Mum & Dad! 364 days I beg for food; today you beg me to eat. We have the perfect system 😋 Love you!' }, { bad:'Seasons Greetings!', good:'Season\'s Greetings from the Loud Family to the Quiet Neighbours — sorry about the Christmas carols last night. Not sorry about the ones tonight. 🎅🎶' }, { bad:'Hope Santa is good to you!', good:'Santa may skip our house this year (we were naughty) — but I got you socks anyway. It\'s the thought that counts. Merry Christmas! 🧦🎄' } ],
  valentine:     [ { bad:'Happy Valentines Day!', good:'Happy Valentine\'s Day, you absolute weirdo. 6 years of your terrible puns and I still laugh. I must really love you. 💘' }, { bad:'Be mine? ❤️', good:'I don\'t want you to be mine. I want us to be OURS — for bad days, bad takeout, bad TV. Happy Valentine\'s, partner.' }, { bad:'You are my everything.', good:'You are my favourite part of every single day. Even the Tuesdays. Especially the Tuesdays. I love you. 💗' } ],
  halloween:     [ { bad:'Happy Halloween!', good:'Happy Halloween! I hope your costume is 10/10, your candy is 100% chocolate, and NO clowns come near you. 🤡❌' }, { bad:'Boo! 👻', good:'BOO! Scared you? No? Fine. Your costume scares ME anyway. (Affectionate.) Go get \'em, tiger. 🎃' }, { bad:'Have a spooky night!', good:'Have a spooky night! Don\'t do anything I wouldn\'t do (and if you do, send pictures). Happy Halloween, you maniacs. 😈🎃' } ],
  easter:        [ { bad:'Happy Easter!', good:'Happy Easter, kiddo! I hid 24 eggs. Good luck finding the 25th one (it went missing last year. Sorry not sorry). 🥚🐰' }, { bad:'He is Risen! Alleluia!', good:'He is Risen! And so is Grandma\'s 4th pie of the day. Some Easter miracles taste like apples. Alleluia! 🥧✨' }, { bad:'Enjoy the chocolate!', good:'Enjoy the chocolate. The diet starts Monday. The chocolate starts RIGHT NOW. Happy Easter, champ. 🍫🏆' } ],
  thanksgiving:  [ { bad:'Happy Thanksgiving!', good:'Happy Thanksgiving! This year I\'m thankful for you, for pie, and for no political fights at the table (please). I love us. 🥧🍂' }, { bad:'I am thankful for you.', good:'I am thankful for you — specifically the way you did ALL the dishes when I fell asleep on the sofa last year. You\'re a saint. 🙏' }, { bad:'Gobble gobble!', good:'Gobble gobble, mothercluckers. 🦃 So thankful we get to be weird together, year after year. Love you maniacs. 💛' } ],
  'new-year':    [ { bad:'Happy New Year! 2026!', good:'HAPPY NEW YEAR, 2026!!! Here\'s to more travel, more tacos, more "I was wrong I love you"s, and WAY less laundry. 🎆' }, { bad:'New year new you!', good:'New year, same you. (Thank God. You\'re already perfect.) May 2026 just bring you more of the good stuff. 💫' }, { bad:'Best wishes for the new year.', good:'Best wishes for 2026: may your Wi-Fi be fast, your coffee be strong, and your roommate/dog/cat actually love you. Happy New Year!' } ],
  invitation:    [ { bad:'You are invited to my party!', good:'YOU\'RE INVITED TO MY 30TH! 🎉 Sat 14th Sept, 7pm, 123 Acacia Ave. Costume: 2000s pop star. RSVP yes or I send 27 follow-ups.' }, { bad:'Please come if you can.', good:'I\'m getting MARRIED!!! 🌈 You are my people and this day does not happen without you. Saturday 21 June. RSVP below. 💍' }, { bad:'Save the date!', good:'SAVE THE DATE. 5 Oct 2026. My 40th / your 40th / OUR collective mid-life crisis party. Block it out NOW. 🎊' } ],
  farewell:      [ { bad:'Goodbye and good luck!', good:'Goodbye, Jess! Moving to NYC is huge and you were born for this. Don\'t be a stranger. Call me from every rooftop bar. 🍎✨' }, { bad:'We will miss you!', good:'We\'re gonna miss you so much around here. Office gossip without you is just… meetings. Gross. Come back to visit!' }, { bad:'Best of luck in your new job!', good:'Best of luck at the new gig — you\'re gonna CRUSH it. And when you do, you owe me dinner. Deal? 💪🍽️' } ],
  sorry:         [ { bad:'Sorry if you felt hurt.', good:'I\'m so sorry I said that in front of everyone. It was rude, out of line, and I\'m deeply ashamed. You didn\'t deserve that.' }, { bad:'My bad! 😬', good:'My bad. I overreacted. I was wrong and I want to make it right. Let\'s talk when you\'re ready. Whenever that is.' }, { bad:'Sorry for everything.', good:'I\'m sorry for the lie, the silence, the way I disappeared. No excuses, no justifications. Just: I was wrong, and I\'ll do better. Please forgive me.' } ],
  friendship:    [ { bad:'You\'re a great friend!', good:'You\'re not a great friend. You\'re my FRIEND — the one I call at 4am, the one I hide bodies with, the one who has seen me cry over toast. You\'re stuck. 💛' }, { bad:'Thanks for being my friend.', good:'Thanks for being my friend before the promotion, before the glow-up, before the nice apartment. Thanks for choosing me every time.' }, { bad:'Friends forever!', good:'Friends forever and ever and ever. Amen. (Contract signed in blood, non-refundable. You know the rules.) 😜🤝' } ],
  'just-because':[ { bad:'Hi! How are you?', good:'Hi! Just saw a man on the street feeding pigeons a sandwich exactly like you do. Thought of you. 😂 You okay?' }, { bad:'Just saying hello!', good:'Just saying hello. Also, if you wanted to get tacos after work… I am free. I have been free for 3 years. Pick me up. 🌮🚗' }, { bad:'No reason just checking in!', good:'No reason, no favour, no vibes to read. Just: you popped into my head and it brightened my day. Carry on. ✨' } ]
};

// 25 × 4 分类专属 FAQ
const GUIDE_FAQS = {
  birthday:      [ { q:'How long should a birthday card be?', a:'2–4 short sentences, 30–60 words. Short enough to read in 5 seconds, long enough to feel personal.' }, { q:'Should I joke about ageing?', a:'Only if they joke about it first. If they hate being reminded, stick to memories and compliments instead.' }, { q:'Milestone birthdays: should I mention the number?', a:'YES. "Happy 50th" feels 10× more intentional than "Happy Birthday". Own the number, celebrate the years.' }, { q:'Late birthday card ok?', a:'Better late than generic. Open with "I know I\'m 4 days late — blame [dumb inside joke]". Humour + honesty = forgiven.' } ],
  anniversary:   [ { q:'Do I need to mention the exact number of years?', a:'If you know it, say it. "12 years" feels specific and intentional. Add a tiny detail: "12 years, 3 dogs, one bad kitchen renovation".' }, { q:'Funny or sappy — which is better?', a:'Both. Sandwich structure: joke, sincere promise, joke. Pure sap gets awkward to read out loud; pure joke feels unserious.' }, { q:'Gift is attached — do I still write a card?', a:'ALWAYS. The card is what gets kept. The gift is what gets used (or returned). Card > gift, always.' }, { q:'Long distance anniversary card tips?', a:'Mention the last time you saw them, or the next time you will. Close the distance in writing.' } ],
  love:          [ { q:'Is it okay to write a love card to a new partner?', a:'Absolutely. Keep it sweet, not intense. "I really really like you" > "I can\'t live without you" for month 2.' }, { q:'How often should you write love notes?', a:'Once every 2–3 months beats twice a day. Rarity = value. Tuesday randoms beat Valentine\'s pressure.' }, { q:'What if I\'m bad at words?', a:'Steal a line from their favourite song / a movie you watched together. Citing the source makes it cute, not cheating.' }, { q:'Public or private?', a:'Private always. The most intimate lines should be for their eyes only. Save the short sweet one for Instagram.' } ],
  'thank-you':   [ { q:'Can I send a thank-you by text?', a:'Favour = written card (physical or SendAFun digital). Text only for tiny things like grabbing coffee. The effort matters.' }, { q:'How soon after the favour do I send it?', a:'Within 72 hours. After that it feels like an afterthought. Even a 2-line note sent fast is better than a 2-page essay sent 2 months later.' }, { q:'Money gift — how to thank without naming the amount?', a:'"Your generous gift" or "your incredible kindness". Don\'t name the number. Focus on what it enabled: "it will go straight to our honeymoon fund".' }, { q:'Is "thanks again" a bad sign-off?', a:'It\'s fine but "gratefully, [name]" or "you\'re the best, [name]" feels warmer. 1 level up, zero effort.' } ],
  congratulations:[{ q:'Short or long — which wins for congratulations?', a:'SHORT + EXCITED. All caps, emoji, exclamation points are ENCOURAGED here. This is not the time for subtlety. 🎉' }, { q:'Should I reference the struggle?', a:'Yes — briefly. "I saw how late you stayed" > "I always knew you could do it". Witness the grind = genuine praise.' }, { q:'Is humblebragging okay? ("I knew it first!")', a:'1 line maximum. Then pivot back to THEM. This isn\'t about how smart YOU were for predicting their win.' }, { q:'Different tone for friend vs colleague?', a:'Friend: roast first, praise after. Colleague: professional + warm. Keep it appropriate but not cold.' } ],
  wedding:       [ { q:'Do I have to write to both people?', a:'YES. Even if you only know one, name them both. "To Sam & Alex," not just "Hi Sam." They are a team now.' }, { q:'How to address a same-sex wedding?', a:'Exactly the same. "To [Name] & [Name]" — no special rules, just respect their names and pronouns.' }, { q:'Funny or formal for a wedding card?', a:'Depends on the couple. If they used Comic Sans on their invite: go wild with jokes. If the invite was letterpress & linen: stay elegant.' }, { q:'Wedding gift + card — do I still write the note?', a:'Always. The note is what they\'ll find in the box 10 years from now and cry over. Not the toaster.' } ],
  'new-baby':    [ { q:'Should I comment on their labour/parenting skills?', a:'No. Don\'t say "hope it was easy" (it wasn\'t) or "you\'ll be great" (they\'re terrified). Just celebrate the baby + support the parents.' }, { q:'What about "sleep now before the baby comes"?', a:'Skip it. Every pregnant person has heard it 10,000 times. It\'s not cute; it\'s annoying.' }, { q:'Is it okay to give unsolicited parenting advice?', a:'ABSOLUTELY NOT. Unless the card starts with "You asked for this…" — keep all advice to yourself.' }, { q:'Second, third baby — do I still send a card?', a:'YES. Every baby is a celebration. The older kids love seeing themselves named in a card too.' } ],
  sympathy:      [ { q:'Is it okay to say "I know how you feel"?', a:'No. You don\'t. Even if you lost someone too — every grief is different. Say "I can\'t imagine how this hurts" instead.' }, { q:'Should I mention the person who died by name?', a:'YES. Hearing their name is healing. "Your mum was incredible — I\'ll never forget her scones" > vague "thinking of you".' }, { q:'Short note or long letter?', a:'Short for acquaintances, long for close family/friends. Short = 2–3 lines is plenty. Don\'t ramble out of obligation.' }, { q:'Is a card enough or should I do more?', a:'Card + 1 small, specific action is the combo. "I\'m dropping dinner Thursday" > open offer of "let me know if you need anything".' } ],
  'get-well':    [ { q:'Is it okay to be funny in a get-well card?', a:'If the person is a friend and usually laughs with you — YES. Laughter is medicine. For serious illness or work: keep it warm, not jokey.' }, { q:'Is "everything happens for a reason" ever okay?', a:'No. Just no. Even if you believe it — it lands like shit for a sick person. Replace with "this sucks and I\'m here".' }, { q:'How often should I check in?', a:'Day 1 = card. Day 3 = short text. Day 7 = actual call if you\'re close. People feel forgotten after the first wave of "get well soon" texts.' }, { q:'Flowers or card for a hospital patient?', a:'Card ALWAYS. Flowers sometimes get banned for infection risk. Check the hospital rules first. Stuffed animals or books often work too.' } ],
  graduation:    [ { q:'Do I have to give money?', a:'No. A handwritten card + specific heartfelt line > generic cheque. Money is a bonus, not a requirement.' }, { q:'Is it okay to joke about student debt?', a:'Only if they would laugh first. Otherwise: too real, too soon. Stick to excitement about the future.' }, { q:'What advice should I give in the card?', a:'1 short specific piece, not a list. "Say yes to the weird jobs" or "Call your mum every Sunday" > 10 generic life tips.' }, { q:'Card for a Masters / PhD?', a:'Acknowledged the EXTRA grind. "You wrote 80,000 words and still have a personality?! Legend. Well DOCTOR, congratulations 🎓"' } ],
  retirement:    [ { q:'Funny or sincere for retirement?', a:'Both! Open with the joke (spreadsheets vs margaritas), close with the sincere "you mentored me and I\'ll never forget it".' }, { q:'Is a group card better than individual?', a:'Both are great! Group for the whole team + 1 personal one from you if you were close. Retirement day = overstimulation, go short.' }, { q:'Should I mention a specific project memory?', a:'YES. Specifics > generic. "The 2019 launch where we pulled 3 all-nighters?" > "Good luck out there".' }, { q:'Gift ideas to pair with the card?', a:'Hobby-specific: golf balls, seed packets, a portable speaker, a travel guide to where they\'re going.' } ],
  housewarming:  [ { q:'Is "welcome to the neighbourhood" too generic?', a:'Only if you add something: "welcome! The café on 3rd does the best croissants" turns generic into actually useful.' }, { q:'Should I offer to help them unpack?', a:'Absolutely. "Free unpacking labour this Sunday + pizza if you provide music" is the best housewarming gift. It costs you nothing.' }, { q:'Do renters get a housewarming card too?', a:'YES. Every new home is a milestone. Rent vs own is irrelevant to the celebration.' }, { q:'First apartment vs 5th house — different tone?', a:'First: hype them up + joke about buying actual furniture. 5th: joke about how you now know where the spare key is hidden.' } ],
  'fathers-day': [ { q:'My dad is a man of few words — short or long card?', a:'SHORT. 3 sentences MAX. He will read every word. Too long = he skims. Quality > quantity.' }, { q:'I\'m angry with my dad — do I still send one?', a:'Up to you. If you do, keep it civil: "Happy Father\'s Day, hope you\'re doing well" — no obligation to fake closeness.' }, { q:'Stepdad, foster dad, grandpa — same card?', a:'Same structure, but name the role. "To the best stepdad ever — you chose ME, and that changed everything." Specify the specific, intentional love.' }, { q:'From the kids — what tone works best?', a:'Crayon-drawn + 1 sentence dictated to mum/dad beats pre-printed cards 100:1. He will keep it forever.' } ],
  'mothers-day': [ { q:'Should I send one to my mother-in-law?', a:'YES, always. A short sweet card goes miles. "Thank you for raising the love of my life" is the all-time cheat code.' }, { q:'Mum passed — what do I do?', a:'Skip it, honour her privately, or send a card to another mother figure who stepped in. No rules, just what feels right.' }, { q:'Toddler making mum a card — tips?', a:'Handprints, crayon scribble, and DAD WRITE ONE SENTENCE UNDERNEATH. Future you will thank past you.' }, { q:'Flowers or card?', a:'Card first, flowers second. If you only do one: CARD. Because the card will still be there when the flowers are compost.' } ],
  christmas:     [ { q:'Do I need to send different cards to work vs family?', a:'Family = inside jokes + specific. Work = warm but generic. Keep 2 template versions and customise 1 line each.' }, { q:'Late Christmas card ok?', a:'Send it up to Jan 6th (Epiphany). After that, call it a "New Year" card instead and you\'re golden.' }, { q:'How many names should I sign?', a:'Everyone in the household. Even the dog. "Love, Sarah, Tom & Mr. Whiskers 🐱" = 10× more memorable.' }, { q:'Religious family — obligatory to mention Jesus?', a:'Only if you share their belief. "Merry Christmas to you and yours" is safe, kind, and appropriate for everyone.' } ],
  valentine:     [ { q:'Single on Valentine\'s — can I still send cards?', a:'YES. Send Galentine\'s / Guyentine\'s cards to your friends. Platonic love is still love. Still romanticises your life.' }, { q:'New relationship — how intense is too intense?', a:'Rule of thumb: don\'t say "forever" until you\'ve had at least 2 real fights. Sweet and specific, not marriage proposals.' }, { q:'Long-term couple — can we skip it?', a:'Skip the dinner, don\'t skip the note. Even a post-it that says "I still fancy you" is enough.' }, { q:'Cheesy pickup lines in the card?', a:'Do it. But only if you deliver it with a grin. Self-awareness = charm.' } ],
  halloween:     [ { q:'Is a costume photo on the card too much?', a:'Too much? It\'s REQUIRED. Especially group costume group cards. Halloween photos = the best ones.' }, { q:'Halloween card to kids — any rules?', a:'Scary-OK for 8+, cute-only for toddlers. Mention the candy: they will skim for that word first.' }, { q:'Should I send a Halloween card to work colleagues?', a:'If the vibe is casual, yes. Stick to friendly-pun: "Hope your day is BOO-tiful" > graphic horror art. Work appropriateness first.' }, { q:'Candy-free Halloween card for a kid?', a:'Candy coupons (1 free trip to the sweet shop on me) > actual candy they eat on the day. Longer lasting, less likely to make mum mad.' } ],
  easter:        [ { q:'Religious vs secular Easter card?', a:'If you KNOW they celebrate the religious meaning, mention it. Otherwise: chocolate, bunnies, spring, and sunshine. No one is offended by a chocolate-centric card.' }, { q:'Easter + new baby?', a:'Double celebration! "Baby\'s First Easter" is a legitimate major event. Mention the tiny Easter outfit, guaranteed coo.' }, { q:'Egg hunt clues in the card — genius or dumb?', a:'GENIUS. Write 1 clue in the card. Makes the card part of the game, not just paperwork.' }, { q:'Adult Easter card ideas?', a:'Swap "cute bunny" for "here are your annual legal chocolates, see you at the pub". Equal parts Easter, equal parts adult friendship.' } ],
  thanksgiving:  [ { q:'Can I write a list format?', a:'YES. A bulleted list of 3–5 specific things you\'re thankful for about THEM is the best possible Thanksgiving card. No intro needed.' }, { q:'Someone missing from the table — mention them?', a:'If it would be welcomed, yes. "Grateful that Grandma\'s pie recipe lives on today, even if she can\'t be here." Silence can feel colder than a gentle line.' }, { q:'Is "Happy Turkey Day" cute or cringe?', a:'Cute for family group chat; cringe for a formal card to your in-laws. Match the energy of the household.' }, { q:'Gratitude card vs Thanksgiving card?', a:'Thanksgiving card = annual ritual. Gratitude card = random Tuesday in March. Send BOTH for max impact.' } ],
  'new-year':    [ { q:'New Year vs Christmas card — which takes priority?', a:'If you only do one: NYE from Jan 2–6 is less crowded. Your card will actually get read, not buried under 30 Christmas ones.' }, { q:'Should I make resolutions for them?', a:'HELL NO. Make a resolution ABOUT THEM. "I resolve to call you more" > "you should go to the gym".' }, { q:'Funny "best of" recap of last year?', a:'YES. Top 5 moments we shared = the most re-read card of their whole year. Specifics! Specifics!' }, { q:'"New year new me" joke?', a:'Retired, dead, over. Replace with "new year, same idiots, more tacos". Way fresher, way more true.' } ],
  invitation:    [ { q:'Electronic vs paper invitation?', a:'Electronic (SendAFun) for casual, paper for wedding. Either way, PROOFREAD THE DATE THREE TIMES.' }, { q:'Should I put the dress code?', a:'ALWAYS. "Garden casual" "black tie optional" "wear what you want, the dog will judge you anyway". Remove guesswork, reduce anxiety.' }, { q:'RSVP deadline — how strict?', a:'Set a deadline 2 weeks before, and then follow up the day after. Caterers need numbers. Be firm.' }, { q:'"Plus one" policy on the invite?', a:'Be explicit. "Plus one welcome for committed partners only" / "No plus ones please — we kept the list tight". Vague = 10 extra mouths to feed.' } ],
  farewell:      [ { q:'How do you say goodbye without crying?', a:'Write the crying part privately. Deliver the short funny-warm one out loud. Give a printed copy of the long sappy one to read alone.' }, { q:'Work farewell card — what if I barely knew them?', a:'2 lines is fine. "Good luck in the new role, was great to work with you on [one project]". Nice and specific, not fake.' }, { q:'"See you soon" or "don\'t be a stranger"?', a:'Name a real date if you can: "See you for Christmas in 6 months" > vague "don\'t be a stranger".' }, { q:'Should I give them a photo in the card?', a:'YES — one polaroid from a good memory taped inside the card. Gets a 100% higher chance of being kept forever.' } ],
  sorry:         [ { q:'"I\'m sorry you felt that way" — is this ok?', a:'100% NO. That\'s blaming their feelings. The correct start is "I\'m sorry I DID [X]". Name the ACTION you did wrong.' }, { q:'One big apology or a thousand small ones?', a:'One. Detailed. Then stop. Repeating the same apology 20 times turns the focus back to your guilt, not their feelings.' }, { q:'Should I explain the context/mistake?', a:'One sentence MAX. Long "because…" = excuses. "I was stressed and I took it out on you — that\'s on me, not you." Perfect.' }, { q:'How to end an apology card?', a:'"Will you forgive me?" + a way to make it right. "I want to cook you your favourite dinner Thursday." Close the loop.' } ],
  friendship:    [ { q:'Do I have to send a friendship card on their birthday too?', a:'Birthday card = mandatory. Random "I love our friendship" card in July = LEGENDARY. Do it once a year, random date.' }, { q:'Group of friends — group card or individual?', a:'Both! One giant group card for the inside jokes, and one tiny 1:1 from you to them saying the sincere thing nobody else will.' }, { q:'Ex friend — can I send a card after a fight?', a:'Only if you mean it, and don\'t demand a reply. "I was wrong, I miss you, no pressure to respond. Just wanted you to know." 👌' }, { q:'What makes a friendship card iconic?', a:'Inside joke + 1 specific compliment NOBODY else would ever give them. "Your laugh in serious meetings has saved 4 of my jobs".' } ],
  'just-because':[ { q:'What is a "just because" card for, exactly?', a:'Everything and nothing. Think of it as a digital high-five with a note inside. No agenda, no favour, just vibes.' }, { q:'Should I explain WHY I sent it?', a:'Yes! 1 absurd small trigger. "Saw a dog that looked exactly like you" > "I was thinking of you". Absurd = memorable.' }, { q:'How often can I send these without being weird?', a:'2–4 times a year, max per person. Any more = you either owe money or have a crush. Clarify which. 😜' }, { q:'Can a text be a "just because" card?', a:'It can be… but a SendAFun card = 2 min of your time and they will think "wow, they made a whole CARD for NO REASON". Hit way harder.' } ]
};

// 20 条全站通用 FAQ（/faq.html）
const FAQ_DATA = [
  { q:'Is SendAFun actually free?', a:'Yes, 100%. Every card on SendAFun is free to design, personalise with text, and send. No paywalls, no hidden subscription, no credit card required to use the core product.' },
  { q:'Do I need an account to send a card?', a:'Nope! You can design, preview, and send any card in 30 seconds without signing up. We only ask for an email address if you want to save your in-progress edits or schedule a future delivery.' },
  { q:'How do I schedule a card to be sent later?', a:'After designing any card, go to the Send screen and toggle the "Send later" option. Pick any date and time up to 365 days in the future. We\'ll send it automatically — no extra charge.' },
  { q:'Can I send a card to multiple recipients at once?', a:'Each card is individually addressed so the recipient sees their own name on it. You can send the same design to up to 200 emails at once, or use our CSV import option for larger lists.' },
  { q:'What file format are the background images?', a:'All card backgrounds are JPG images served from our Cloudflare R2 public bucket, optimised for fast loading on mobile and desktop. All images are royalty-free and licensed for commercial & personal use in our cards.' },
  { q:'Can I upload my OWN photo as the card background?', a:'Coming soon! Q3 2026 we will launch the "upload your own image" feature so you can turn baby photos, wedding photos, and group selfies into cards in 1 click.' },
  { q:'Are my card messages private?', a:'Absolutely. The text you write in a card is encrypted in transit (HTTPS/TLS) and stored encrypted at rest. We never read, share, or sell the personal messages you write.' },
  { q:'How do I delete my card data?', a:'Under GDPR/CCPA, you have the right to permanent deletion. Email privacy@sendafun.com with the email you used to schedule the card and we will delete ALL associated data within 14 days.' },
  { q:'Can I print the card to send by post?', a:'Yes! Every card has a "Download PDF" button — click it to get a high-resolution (300 DPI) PDF you can print at home or at any print shop. Perfect for people who love physical mail.' },
  { q:'Do you add your branding to the delivered card?', a:'Only a tiny "Sent via SendAFun" link in the footer of the email. It\'s intentionally subtle; the focus is on YOUR message, not our logo.' },
  { q:'What email address do cards come from?', a:'Cards are delivered from hello@mg.sendafun.com via Resend, our email delivery partner. Tell recipients to add us to their contacts so cards don\'t land in spam.' },
  { q:'The card went to spam — what now?', a:'First, ask the recipient to check their Promotions / Spam folder and mark it "Not spam". Then tell them to add hello@mg.sendafun.com as a contact. For critical cards, try scheduling a resend 24 hours before the event.' },
  { q:'Can I use SendAFun for business / work cards?', a:'Of course! Thousands of teams use SendAFun for birthday cards, work anniversaries, onboarding welcome packs, and client thank-yous. Email enterprise@sendafun.com for bulk pricing and SSO.' },
  { q:'Is there a SendAFun app for iOS or Android?', a:'Not yet. Our mobile website works perfectly offline for designing — and we save your draft locally. Native apps are on the roadmap for late 2026.' },
  { q:'What languages do you support?', a:'Card UI is in English, but you can write messages in ANY language. Our editor renders RTL, CJK, Cyrillic, emoji, and everything in-between. Send in Spanish, Arabic, Mandarin — no limits.' },
  { q:'How do I report an inappropriate card or copyright issue?', a:'Email takedown@sendafun.com with the exact URL and reason. We respond within 24 hours, including DMCA counter-notice procedures.' },
  { q:'Does SendAFun run ads?', a:'We display non-intrusive Google AdSense ads on some secondary pages (category lists, blog posts) to keep the core card product free. No ads inside the card editor or on delivered cards — ever.' },
  { q:'Can I cancel a scheduled card?', a:'Yes, up to 1 hour before the scheduled send time. Click the "Cancel scheduled send" link in your confirmation email, or email support@sendafun.com with the scheduled ID.' },
  { q:'I forgot my password — what next?', a:'Click "Sign in" → "Forgot password". We send a one-time magic link to your email (no password reset questions!). Magic links expire after 15 minutes for security.' },
  { q:'How do I suggest a new card category or feature?', a:'We read every suggestion personally! Use the form on the Contact page, or tweet us @SendAFun with the hashtag #SendAFunWishlist. Top ideas get shipped free.' }
];
const POLICY_PAGES = {
  'privacy': {
    slug: 'privacy',
    navLabel: 'Privacy Policy',
    pageTitle: 'Privacy Policy — SendAFun',
    metaDesc: 'SendAFun privacy policy. Learn what personal data we collect, how we use it, and your rights regarding your information.',
    h1: 'Privacy Policy',
    lastUpdated: 'June 30, 2026',
    sections: [
      { h: '1. Overview', p: 'SendAFun ("we", "us", "our") operates the website sendafun.com and related services. This Privacy Policy explains what personal information we collect when you use our service, how we use it, and your rights under applicable law including GDPR, CCPA, and PIPEDA.' },
      { h: '2. Information We Collect', p: 'We collect (a) information you voluntarily provide such as your email address, recipient email address, your name, reminder date, and the card message you write; (b) automatically collected information including browser type, device info, anonymised IP address, and pages visited via Google Analytics 4; (c) billing data processed by our payment provider Creem — we never store your full credit card number on our servers.' },
      { h: '3. How We Use Your Information', p: 'To (a) deliver the e-card you designed to the recipient email at the date you schedule; (b) send delivery confirmation and reminders to you; (c) persist your in-progress card edits locally so you can resume later; (d) analyse anonymised usage patterns to improve the product; (e) display personalised advertisements via Google AdSense on some pages.' },
      { h: '4. Cookies & Tracking', p: 'We use cookies for essential session handling, Google Analytics 4 (anonymised), and Google AdSense for personalised advertising. You can disable or clear cookies through your browser settings at any time. See our Cookies Policy for the full breakdown.' },
      { h: '5. Data Retention', p: 'Scheduled delivery data (recipient, message, scheduled date) is retained until the card is delivered plus 30 days for support purposes. Account email is retained while you have an active account or until you request deletion. Anonymised analytics data is retained for 26 months.' },
      { h: '6. Third-Party Services', p: 'Your data passes through these subprocessors: Cloudflare (hosting, storage, DNS), Creem (payments), Resend (email delivery), Google Analytics 4 and Google AdSense (analytics and advertising), and R2 Cloudflare object storage for card background images. Each subprocessor operates under their own privacy policy and data processing agreement.' },
      { h: '7. Your Rights', p: 'You have the right to access, correct, export, or permanently delete the personal information we hold about you. To exercise these rights email privacy@sendafun.com. We respond to verifiable requests within 30 calendar days.' },
      { h: '8. Children\'s Privacy', p: 'SendAFun is not directed at children under 13 and we do not knowingly collect personal information from children under 13. If you believe a child under 13 has submitted personal data please contact us and we will promptly delete it.' },
      { h: '9. International Transfers', p: 'SendAFun operates servers in the United States and the European Union. By using the service you consent to the transfer of your data to these jurisdictions where data protection laws may be different.' },
      { h: '10. Changes to This Policy', p: 'We may update this policy from time to time. Material changes will be announced via a banner on sendafun.com for 30 days and by updating the "Last updated" date above.' },
      { h: '11. Contact', p: 'For privacy questions, data requests, or DMCA notices please email privacy@sendafun.com or use the form on our Contact page. Our mailing address is SendAFun Ltd., 8 Hill Street, Douglas, Isle of Man IM1 2EU.' },
    ],
  },
  'terms': {
    slug: 'terms',
    navLabel: 'Terms of Service',
    pageTitle: 'Terms of Service — SendAFun',
    metaDesc: 'Terms of Service for SendAFun — your rights, payment and refund policy, acceptable use, and disclaimers.',
    h1: 'Terms of Service',
    lastUpdated: 'June 30, 2026',
    sections: [
      { h: '1. Acceptance of Terms', p: 'By accessing or using sendafun.com you agree to be bound by these Terms of Service and all applicable laws. If you disagree with any part you may not access the service.' },
      { h: '2. Our Service', p: 'SendAFun provides a web-based tool to design, preview, and deliver personalised digital greeting cards ("e-cards") via email. Single-card purchases deliver one scheduled delivery. Annual subscriptions deliver unlimited scheduled e-card deliveries during the 12-month subscription term.' },
      { h: '3. Pricing & Billing', p: '(a) One e-card delivery — $1.99 USD charged at checkout. (b) Monthly unlimited subscription — $6.99 USD charged per calendar month (auto-renews). (c) Annual unlimited subscription — $69 USD charged once per subscription year. VAT/GST may be added depending on your location and is shown at checkout. All payments are processed by Creem via PCI-DSS compliant infrastructure.' },
      { h: '4. Refund Policy', id: 'refunds', p: 'Single e-card: full refund within 72 hours of purchase if delivery has not yet been scheduled or executed. Monthly subscription: pro-rated refund available within 7 days and fewer than 3 deliveries. Annual subscription: full refund within 14 days if fewer than 5 e-card deliveries were made. To request a refund email support@sendafun.com with your order reference.' },
      { h: '5. Cancellation', p: 'Monthly and Annual subscribers may cancel auto-renewal at any time from their account settings or by emailing support@sendafun.com. Cancellation takes effect at the end of the current billing period — no partial-period refunds are provided.' },
      { h: '6. User Accounts & Responsibility', p: 'You are responsible for safeguarding access to your email-linked account and for all activity conducted under it. Sharing accounts with third parties is prohibited. Accounts determined to violate these terms may be suspended without notice.' },
      { h: '7. Acceptable Use & User Content', p: 'You retain ownership of the messages and designs you create. You agree NOT to create or send content that is (a) unlawful, discriminatory, threatening, harassing, or sexually explicit; (b) impersonating another person or entity; (c) containing malware, viruses, or spam; (d) violating third-party copyright, trademark, privacy, or publicity rights. We reserve the right to remove violating content without notice or refund.' },
      { h: '8. Intellectual Property', p: 'The SendAFun logo, name, website design, fonts, and editor code are © 2026 SendAFun Ltd or our licensors. Background photographs in our card templates are licensed from Pexels via their CC0 or custom commercial license. Fonts via Google Fonts SIL Open Font License. You may not copy, reproduce, or redistribute SendAFun-branded assets or the card editor without written permission.' },
      { h: '9. Disclaimers', p: 'The service and all card template content is provided "as is" without warranty of any kind. We do not warrant that the service will be uninterrupted, error-free, or that delivery timing will be 100% accurate, since email delivery depends on third-party ESP deliverability. In no event shall SendAFun be liable for indirect, incidental, special, or consequential damages exceeding the amount you paid us in the preceding 12 months.' },
      { h: '10. Indemnification', p: 'You agree to indemnify and hold SendAFun harmless from any claims, damages, or expenses (including attorney fees) arising out of your violation of these Terms, your User Content, or your infringement of any intellectual property or other right of any person or entity.' },
      { h: '11. Termination', p: 'Either party may terminate this agreement. We may suspend or terminate access for violations including, but not limited to, non-payment, prohibited content, or abuse of the unlimited plan (e.g. sending 10,000+ cards per month on annual plan).' },
      { h: '12. Governing Law', p: 'These Terms are governed by and construed in accordance with the laws of England and Wales. You consent to the personal jurisdiction of the courts located within England and Wales for the purpose of litigating all such claims or disputes.' },
      { h: '13. Contact', p: 'Questions about these Terms? Email legal@sendafun.com.' },
    ],
  },
  'about': {
    slug: 'about',
    navLabel: 'About SendAFun',
    pageTitle: 'About SendAFun — Beautiful E-Cards for Every Occasion',
    metaDesc: 'About SendAFun: 3,800+ hand-picked e-card templates across 25+ life occasions. Send instantly via email. No sign-up required.',
    h1: 'About SendAFun',
    lastUpdated: 'June 30, 2026',
    sections: [
      { h: 'Our Story', p: 'SendAFun started in 2025 when we forgot to send a birthday card (again) and realised that finding, personalising, and posting a physical card takes half a Saturday. We wanted something faster, kinder, and kinder to the planet — an app that makes it effortless to tell someone you\'re thinking of them in 60 seconds or less.' },
      { h: 'What We Do', p: 'Today SendAFun is a library of 3,800+ hand-picked card templates across 25+ life occasions. Every card features a real high-resolution photograph (sourced from Pexels creators with commercial-use licensing), a hand-picked typography pairing, and a built-in editor so you can tweak wording, fonts, colors, filters, and layout before sending. No account required — just type, preview, pay, and we email it on the day you choose.' },
      { h: 'Our Values', p: '<strong>Kind first.</strong> We build every interaction around the person receiving the card, not the sender. Your delivery email is designed to make someone\'s day — never look like spam, never carry tracking pixels beyond the one open-tell needed to confirm delivery.<br><br><strong>Private by default.</strong> We never sell your address book. Your recipient\'s email is only used for the one delivery you schedule and is auto-deleted 30 days later.<br><br><strong>Low-waste.</strong> 100% digital. No paper, no stamps, no plastic laminating envelopes that get thrown away 20 minutes after opening. We\'ve calculated our carbon footprint per delivery at about 0.0003 kg CO₂ — roughly 1/2000th of a physical posted card.' },
      { h: 'Pricing That Makes Sense', p: 'One personalised e-card, delivered to one recipient on any date you choose — $1.99 USD. Want unlimited? Monthly Pass is $6.99/month for a calendar month of unlimited sends. Annual Pass is $69/year for as many scheduled card deliveries as you want. For most people the annual plan pays for itself around the 35th card — birthdays, anniversaries, holidays + thank-yous, all covered.' },
      { h: 'Behind the Scenes', p: 'SendAFun is a 3-person remote team split between London, Taipei, and Toronto. Our card templates are hosted on Cloudflare R2 in 300+ edge locations worldwide so preview images load in under 600ms from wherever you are. Payment is handled by Creem (EU-based payment processor, Stripe-level security). Email delivery via Resend with 99.7% deliverability.' },
      { h: 'Responsibly Sourced Content', p: 'Every background photograph is sourced from Pexels contributors who opted into the Pexels Commercial License — creators we\'ve chosen because of their eye for warmth and humanity. If you\'re a photographer and want your work featured in our library, email hello@sendafun.com with your portfolio.' },
      { h: 'Say Hello', p: 'We read every message. Bugs, compliments, template requests, partnership pitches — all welcome. Email hello@sendafun.com or use the form on our Contact page.' },
    ],
  },
  'contact': {
    slug: 'contact',
    navLabel: 'Contact Us',
    pageTitle: 'Contact Us — SendAFun',
    metaDesc: 'Contact SendAFun customer & billing support. Hours, email, address, and answers to common questions — including delivery, refunds, and billing.',
    h1: 'Contact Us',
    lastUpdated: 'June 30, 2026',
    sections: [
      { h: 'Customer & Billing Support', p: '<div style="background:linear-gradient(135deg,#f0fff4,#e6f6ee);border:1px solid #c6f6d5;border-radius:10px;padding:16px 18px;margin:6px 0 14px;"><strong style="font-size:1.05rem;">Primary support email (Creem &amp; billing)</strong><br><span style="font-size:1.05rem;">✉️ <a href="mailto:support@sendafun.com" style="color:#2d6a4f;font-weight:600;">support@sendafun.com</a></span><br><span style="font-size:0.83rem;color:#4a5568;">Replies within 24 hours, 7 days a week. 90% answered in &lt; 4 hours during UK business hours.</span></div><strong>Privacy, Legal &amp; DMCA takedowns</strong><br>legal@sendafun.com<br><br><strong>Partnerships, Press &amp; Template Requests</strong><br>press@sendafun.com<br><br><strong>General enquiries</strong><br>hello@sendafun.com' },
      { h: 'Response Times & Hours', p: 'Card delivery is fully automated 24 hours a day, 365 days a year — scheduled deliveries always go out at the correct time in your timezone.<br><br><strong>Human support:</strong> Monday–Sunday 9:00–20:00 GMT.<br><strong>Urgent billing/delivery issues:</strong> we respond within 2 hours, even on weekends and bank holidays.<br><br>For the fastest reply, write from the email address you used when you paid and include your order reference if you have one.' },
      { h: 'Before You Contact Us — Common Answers', p: 'Most questions are already answered in the links below — they are often faster than email.<br><br>👉 <a href="/faq.html" style="color:#2d6a4f;font-weight:600;">FAQ — 20 common questions answered</a> (pricing, delivery, refunds, scheduling)<br>👉 <a href="/terms.html#refunds" style="color:#2d6a4f;font-weight:600;">Refund Policy (Terms §4)</a> — 72-hour single-card refunds, 14-day annual refunds<br>👉 <a href="/privacy.html" style="color:#2d6a4f;font-weight:600;">Privacy Policy</a> — what data we collect, how to request deletion<br>👉 <a href="/cookies.html" style="color:#2d6a4f;font-weight:600;">Cookie Policy</a> — cookie categories, vendor list, how to opt out<br>👉 <a href="/pricing.html" style="color:#2d6a4f;font-weight:600;">Pricing</a> — single-card, monthly, and annual plans compared' },
      { h: 'Mailing Address', p: 'SendAFun Ltd.<br>8 Hill Street, Suite 204<br>Douglas, Isle of Man<br>IM1 2EU<br><br><em>Please do not mail physical cards or cheques to this address — we operate entirely digitally. Use our email addresses above instead.</em>' },
    ],
  },
  'pricing': {
    slug: 'pricing',
    navLabel: 'Pricing',
    pageTitle: 'Pricing — SendAFun',
    metaDesc: 'SendAFun pricing: 3 simple plans. Pay per card ($1.99 USD), monthly unlimited ($6.99/mo), or annual unlimited ($69/yr). No hidden fees.',
    h1: 'Simple, Transparent Pricing',
    lastUpdated: 'June 30, 2026',
    pricingPage: true,
  },
  'cookies': {
    slug: 'cookies',
    navLabel: 'Cookie Policy',
    pageTitle: 'Cookie Policy — SendAFun',
    metaDesc: 'SendAFun cookie policy: what cookies we use, their purpose, and how to disable them in your browser.',
    h1: 'Cookie Policy',
    lastUpdated: 'June 30, 2026',
    sections: [
      { h: 'What Are Cookies', p: 'Cookies are small text files stored by your browser on your device. They let SendAFun remember things like your draft card edits, which delivery method you chose, and whether you already dismissed the cookie banner.' },
      { h: 'Categories of Cookies We Use', p: '<strong>1. Essential / Strictly Necessary (always on).</strong><br>These cookies are required for the card editor to work: remember your draft message between tabs, preserve your font/color/filter preferences during a single session, and associate a checkout with your card. Without these your design could be lost before sending.<br><br><strong>2. Analytics Cookies (opt-in under GDPR).</strong><br>Google Analytics 4. We use this to understand broad anonymised usage patterns — "how long did the average person spend picking a font?" — not to build profiles on individuals. GA4 data is IP-anonymised, user-ID tracking is OFF, and data retention is set to 26 months.<br><br><strong>3. Advertising Cookies (opt-in under GDPR &amp; UK PECR).</strong><br>Google AdSense. Used to show relevant ads on some public pages. We only serve personalised advertising after you or your browser indicate consent. At any time you can opt back out via adssettings.google.com or your browser\'s third-party cookie controls.' },
      { h: 'How We Respect Global Laws', p: '<strong>EU / EEA / UK &dash; GDPR &amp; PECR.</strong> You will see a cookie banner when first visiting. Non-essential cookies (Analytics + Ads) are NOT set until you explicitly accept. You can change your mind any time by clicking "Cookie preferences" in the footer of any page.<br><br><strong>California &dash; CCPA.</strong> California residents may opt out of "sale" of personal information for third-party advertising purposes via the "Do Not Sell My Personal Information" link on our footer or by emailing privacy@sendafun.com.<br><br><strong>Brazil &dash; LGPD.</strong> Same opt-in/opt-out controls apply; exercise rights via privacy@sendafun.com.' },
      { h: 'How to Disable Cookies In Your Browser', p: '<strong>Chrome</strong>: Settings → Privacy and security → Cookies and other site data.<br><strong>Safari (macOS)</strong>: Preferences → Privacy → Manage Website Data.<br><strong>Safari (iOS)</strong>: Settings → Safari → Block Cookies.<br><strong>Firefox</strong>: Settings → Privacy &amp; Security → Cookies and Site Data.<br><strong>Edge</strong>: Settings → Cookies and site permissions → Manage and delete cookies and site data.<br><br>Note: blocking essential cookies is not recommended, since it will prevent the card editor from saving your edits before checkout.' },
      { h: 'Third-Party Vendor List', p: '<strong>Google Analytics 4</strong> — Google LLC (analytics). Privacy: policies.google.com/privacy<br><strong>Google AdSense &amp; AdSense Partner Cookie List</strong> — Google LLC (advertising). Opt out: adssettings.google.com/authenticated<br><strong>Cloudflare</strong> — __cf_bm security cookie (5 min duration; strictly necessary for bot detection and DDoS protection). Privacy: cloudflare.com/privacypolicy<br><strong>Creem (payment iframe, 1st party)</strong> — essential only during checkout. Privacy: creem.com/privacy' },
      { h: 'Cookie Duration Summary', p: '<strong>Essential</strong>: session cookies expire when you close the tab; long-term draft-save cookies expire in 30 days.<br><strong>Analytics (GA4)</strong>: 1 month to 2 years depending on setting, but user data is auto-deleted after 26 months retention window.<br><strong>Advertising</strong>: 1 day (frequency cap) up to 13 months (advertising personalisation) per Google\'s standard cookie lifetimes.' },
      { h: 'Policy Changes', p: 'We update this policy when the list of vendors or purposes changes. Material changes: 30-day banner notice on sendafun.com. Last updated: June 30, 2026.' },
    ],
  },
  'payment-success': {
    slug: 'payment-success',
    navLabel: 'Payment Success',
    pageTitle: 'Payment Successful — SendAFun',
    metaDesc: 'Your payment was successful. Your card will be delivered on the scheduled date.',
    h1: 'Payment Successful — Thank You! 🎉',
    lastUpdated: 'June 30, 2026',
    successPage: true,
  },
  'payment-cancel': {
    slug: 'payment-cancel',
    navLabel: 'Payment Cancelled',
    pageTitle: 'Payment Cancelled — SendAFun',
    metaDesc: 'Your payment was cancelled. No charges were made. Return to sendafun.com to try again.',
    h1: 'Payment Not Completed',
    lastUpdated: 'June 30, 2026',
    cancelPage: true,
  },
};

function generatePolicyPage(slug) {
  const p = POLICY_PAGES[slug];
  if (!p) throw new Error(`Unknown policy page: ${slug}`);

  const catLinks = Object.entries(CATEGORY_LABELS).map(([key, l]) =>
    `<a href="/category/${key}.html" class="nav-link">${l}</a>`
  ).join('\n        ');
  const topNavHtml = buildTopNav(slug === 'pricing' ? 'pricing' : 'home');

  let bodyMain;

  if (p.pricingPage) {
    // ── Creem-mandatory pricing page: 3 products + pay methods + refund ──────
    bodyMain = `
  <div class="pricing-hero">
    <h1>${p.h1}</h1>
    <p>3 simple plans. <strong>No hidden fees.</strong> Cancel anytime. All prices in USD. VAT/GST added automatically at checkout based on your location.</p>
    <div class="pricing-badges">
      <span class="badge">💳 Credit / Debit Card — Visa, Mastercard, Amex</span>
      <span class="badge"> Apple Pay</span>
      <span class="badge">🅶 Google Pay</span>
      <span class="badge">🔒 Creem secure checkout</span>
      <span class="badge">✅ 72-h refunds</span>
    </div>
  </div>

  <div class="pricing-grid">
    <div class="plan">
      <div class="plan-header">
        <div class="plan-name">Single Card</div>
        <div class="plan-desc">Send one personalised card — great for birthdays or last-minute gifts.</div>
      </div>
      <div class="plan-price">
        <span class="currency">$</span><span class="amount">1.99</span>
        <div class="plan-cycle">per card, one-time</div>
      </div>
      <ul class="plan-features">
        <li>✅ 1 scheduled email delivery</li>
        <li>✅ Any date + time scheduling</li>
        <li>✅ Full editor (fonts, colors, filters)</li>
        <li>✅ 3877 templates included</li>
        <li>✅ Delivery confirmation email</li>
        <li>✅ Re-send once for free (7 days)</li>
      </ul>
      <a class="plan-cta secondary" href="/">Pick a template →</a>
    </div>

    <div class="plan featured">
      <div class="ribbon">Most popular for couples & families</div>
      <div class="plan-header">
        <div class="plan-name">Monthly Unlimited</div>
        <div class="plan-desc">Send as many cards as you want — one calendar month, any occasion.</div>
      </div>
      <div class="plan-price">
        <span class="currency">$</span><span class="amount">6.99</span>
        <div class="plan-cycle">per month, auto-renews</div>
        <div class="save-tag save-month">Great for birthday + Christmas + anniversaries — saves money if you send 4+ cards/month</div>
      </div>
      <ul class="plan-features">
        <li>✅ Unlimited scheduled deliveries</li>
        <li>✅ Any date + timezone scheduling</li>
        <li>✅ Full editor + upcoming)</li>
        <li>✅ 3877 templates included</li>
        <li>✅ Priority email support (<4hr replies)</li>
        <li>✅ Unlimited free re-sends (30 days)</li>
        <li>✅ Cancel anytime — no questions</li>
      </ul>
      <a class="plan-cta primary" href="/">Start Monthly →</a>
      <div class="plan-note">Cancel from account settings or email support@sendafun.com — takes 24 hours.</div>
    </div>

    <div class="plan">
      <div class="plan-header">
        <div class="plan-name">Annual Pass 🎉</div>
      <div class="plan-desc">Best value — lowest per-card cost for families, grandparents, and anyone who remembers everyone.</div>
      </div>
      <div class="plan-price">
        <span class="currency">$</span><span class="amount">69</span>
        <div class="plan-cycle">per year — billed once</div>
        <div class="save-tag">That's just $5.75/month</div>
      </div>
      <ul class="plan-features">
        <li>✅ 12 months unlimited deliveries</li>
        <li>✅ All features from Monthly</li>
        <li>✅ Pays for itself by the 35th card</li>
        <li>✅ 14-day full-refund guarantee *</li>
        <li>✅ Early access to new templates</li>
        <li>✅ Dedicated priority support line</li>
      </ul>
      <a class="plan-cta secondary" href="/">Get Annual Pass →</a>
      <div class="plan-note">* Refund within 14 days if fewer than 5 cards sent.</div>
    </div>
  </div>

  <section class="pricing-extra">
    <h2>💳 Payment Methods — all secure, no card stored</h2>
    <p>All payments are processed by <strong>Creem</strong> (EU-based payment processor, PCI-DSS Level 1 compliant) — we never see, store, or transmit your full card number. Card data is encrypted in-transit and at-rest by Creem's servers only.</p>
    <div class="pm-grid">
      <div class="pm"><span class="pm-name">Credit / Debit Card — Visa, Mastercard, American Express</span><span class="pm-desc">All major card networks. 3D-Secure 2.0 for extra fraud protection.</span></div>
      <div class="pm"><span class="pm-name">Apple Pay</span><span class="pm-desc">One-tap checkout on Safari macOS / iPhone.</span></div>
      <div class="pm"><span class="pm-name">Google Pay</span><span class="pm-desc">Fast checkout on Chrome, Android, and Google Pass.</span></div>
      <div class="pm"><span class="pm-name">Currency</span><span class="pm-desc">All prices listed in USD (US Dollars). VAT, GST, or sales tax is added at checkout if applicable for your region.</span></div>
    </div>
  </section>

  <section class="pricing-extra">
    <h2>↩️ Refund Policy — no fine print</h2>
    <div class="refund-row">
      <div class="refund-card">
        <h3>Single Card ($1.99)</h3>
        <p><strong>Full refund within 72 hours</strong> of purchase if delivery has not yet been scheduled or executed. After delivery we cannot refund because the service has been performed. To request a refund email <a href="mailto:support@sendafun.com">support@sendafun.com</a> with your order number.</p>
      </div>
      <div class="refund-card">
        <h3>Monthly ($6.99/mo)</h3>
        <p><strong>Pro-rated cancellation.</strong> Cancel anytime. Cancelling stops the next auto-renewal charge. We do not grant partial-month refunds — your current month stays active until the billing period end date. Cancel via Account or email us.</p>
      </div>
      <div class="refund-card">
        <h3>Annual Pass ($69/yr)</h3>
        <p><strong>Full refund within 14 days of purchase</strong> if fewer than 5 scheduled deliveries were performed. After 14 days, or after 5+ cards, no refund is issued. To request email support@sendafun.com order date and number</p>
      </div>
    </div>
  </section>

  <section class="pricing-extra centre">
    <h2>Still unsure?</h2>
    <p>Browse the <a href="/faq.html">FAQ</a> for 20 more questions, email <a href="mailto:support@sendafun.com">support@sendafun.com</a> — we reply with 24 hours all week long.</p>
  </section>`;
  } else if (p.successPage) {
    bodyMain = `
  <div class="pay-result success">
    <div class="pay-result-ico">✅</div>
    <h1>${p.h1}</h1>
    <p class="pay-conf-msg">Your payment has been processed successfully. A payment confirmation receipt will be emailed to you shortly from Creem.</p>
    <div class="pay-conf-box" id="payConfBox">
      <h3>What happens next?</h3>
      <ul class="pay-next">
        <li><strong>Email receipt</strong> — Creem will email your receipt within ~5 minutes. Check spam/promotions tabs if missing.</li>
        <li><strong>Card delivery</strong> — If you scheduled a delivery date &amp; time, the card will be emailed exactly at that moment in your timezone.</li>
        <li><strong>Confirmation</strong> — You'll also receive a separate delivery-confirmation email from SendAFun as soon as the card is actually sent.</li>
        <li><strong>Unlimited plan active</strong> — If you bought Monthly or Annual Unlimited, your account is unlocked immediately for 30 days of unlimited sending.</li>
      </ul>
    </div>
    <div class="pay-actions">
      <a href="/" class="pay-btn primary">🏠 Browse more cards</a>
      <a href="/faq.html" class="pay-btn ghost">FAQ — what can I do next?</a>
      <a href="mailto:support@sendafun.com" class="pay-btn ghost">Email billing support</a>
    </div>
  </div>`;
  } else if (p.cancelPage) {
    bodyMain = `
  <div class="pay-result cancel">
    <div class="pay-result-ico">↩️</div>
    <h1>${p.h1}</h1>
    <p class="pay-conf-msg">You cancelled the checkout before payment was completed. <strong>No charges have been made</strong> to your card or account. You can try again any time — your card design is saved in your browser for 30 days.</p>
    <div class="pay-conf-box warn">
      <h3>Why was payment cancelled?</h3>
      <ul class="pay-next">
        <li><strong>Changed your mind?</strong> No problem. Close the tab — your card draft is saved.</li>
        <li><strong>Card declined?</strong> Try a different payment method or a different card. Creem supports Visa, Mastercard, Apple Pay, and Google Pay.</li>
        <li><strong>3D-Secure failed?</strong> Click checkout again — sometimes banks block first-time cross-border payments.</li>
        <li><strong>Need help?</strong> Email <a href="mailto:support@sendafun.com">support@sendafun.com</a> any time — we reply within 24 hours.</li>
      </ul>
    </div>
    <div class="pay-actions">
      <a href="/" class="pay-btn primary">💌 Go back &amp; try checkout again</a>
      <a href="/pricing.html" class="pay-btn ghost">Compare plans</a>
      <a href="/contact.html" class="pay-btn ghost">Contact support</a>
    </div>
  </div>`;
  } else {
    const articleHTML = p.sections.map(s => `
  <section style="margin-bottom:28px;">
    <h2 style="font-family:'Playfair Display',serif;font-size:1.25rem;font-weight:700;color:#1a202c;margin-bottom:10px;"${s.id ? ` id="${s.id}"` : ''}>${s.h}</h2>
    <div style="color:#4a5568;line-height:1.75;font-size:0.95rem;">${s.p}</div>
  </section>`).join('\n');
    bodyMain = `
  <div class="hero">
    <h1>${p.h1}</h1>
    <p class="last-updated">Last updated: ${p.lastUpdated}</p>
    <p class="intro">This page is part of our commitment to being transparent about how SendAFun works. For urgent questions email the team directly — we reply within 24 hours, 7 days a week.</p>
  </div>
  <article class="article">
${articleHTML}
  </article>`;
  }

  const extraStyle = (p.pricingPage || p.successPage || p.cancelPage) ? `
${p.pricingPage ? `.pricing-hero { background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:2.5rem 2rem;margin-bottom:1.75rem;box-shadow:0 2px 10px rgba(0,0,0,0.04);text-align:center; }
.pricing-hero h1 { font-family:'Playfair Display',serif;font-size:clamp(1.9rem,4.5vw,2.75rem);font-weight:700;color:#1a202c;margin-bottom:0.6rem; }
.pricing-hero p { color:#4a5568;font-size:1.05rem;max-width:620px;margin:0 auto; }
.pricing-badges { display:flex;flex-wrap:wrap;justify-content:center;gap:0.5rem;margin-top:1.25rem; }
.badge { display:inline-block;font-size:0.75rem;padding:0.25rem 0.7rem;border-radius:999px;background:#e6f6ee;color:#2d6a4f;font-weight:600; }
.pricing-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem;margin-bottom:2rem; }
.plan { position:relative;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);display:flex;flex-direction:column; }
.plan.featured { border-color:#2d6a4f;box-shadow:0 8px 28px rgba(45,106,79,.15);transform:translateY(-4px); }
.ribbon { background:linear-gradient(90deg,#2d6a4f,#2f855a);color:#fff;text-align:center;font-size:0.75rem;font-weight:600;padding:0.45rem;letter-spacing:0.04em; }
.plan-header { padding:1.5rem 1.5rem 0.5rem; }
.plan-name { font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:700;color:#1a202c;margin-bottom:0.35rem; }
.plan-desc { color:#718096;font-size:0.88rem;line-height:1.55; }
.plan-price { padding:0.5rem 1.5rem 1rem;border-bottom:1px solid #edf2f7; }
.plan-price .currency { font-size:1.4rem;color:#4a5568;vertical-align:top;margin-right:2px; }
.plan-price .amount { font-size:2.75rem;font-weight:700;color:#1a202c;letter-spacing:-0.03em; }
.plan-cycle { font-size:0.85rem;color:#718096;margin-top:2px; }
.save-month { background:#fff5cc;color:#9c7a00;border-radius:6px;padding:0.35rem 0.5rem;font-size:0.75rem;margin-top:0.65rem; }
.save-tag { background:#e6f6ee;color:#276749;border-radius:6px;padding:0.35rem 0.5rem;font-size:0.75rem;font-weight:600;margin-top:0.65rem;display:inline-block; }
.plan-features { list-style:none;padding:1.1rem 1.5rem;margin:0;display:flex;flex-direction:column;gap:0.5rem;flex:1; }
.plan-features li { font-size:0.88rem;color:#2d3748;line-height:1.5; }
.plan-cta { display:block;text-align:center;padding:0.7rem 1rem;border-radius:10px;text-decoration:none;font-weight:600;font-size:0.92rem;margin:0 1.5rem 0.6rem;transition:all 0.15s; }
.plan-cta.primary { background:#2d6a4f;color:#fff; }
.plan-cta.primary:hover { background:#1f4c39; }
.plan-cta.secondary { background:#fff;color:#2d6a4f;border:1.5px solid #2d6a4f; }
.plan-cta.secondary:hover { background:#f0fff4; }
.plan-note { font-size:0.75rem;color:#718096;padding:0 1.5rem 1.4rem;text-align:center;line-height:1.5; }
.pricing-extra { background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:2rem 2.1rem;margin-bottom:1.5rem; }
.pricing-extra h2 { font-family:'Playfair Display',serif;font-size:1.4rem;color:#1a202c;margin-bottom:0.7rem; }
.pricing-extra p { color:#4a5568;font-size:0.95rem;line-height:1.7;margin-bottom:0.5rem; }
.pricing-extra.centre { text-align:center; }
.pm-grid { display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem; }
.pm { background:#f7fafc;border:1px solid #edf2f7;border-radius:10px;padding:1rem 1.15rem; }
.pm-name { display:block;font-weight:600;color:#1a202c;font-size:0.9rem;margin-bottom:0.25rem; }
.pm-desc { display:block;color:#4a5568;font-size:0.83rem;line-height:1.6; }
.refund-row { display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-top:1rem; }
.refund-card { background:#fafbfc;border:1px solid #edf2f7;border-radius:10px;padding:1.1rem 1.25rem; }
.refund-card h3 { font-family:'Playfair Display',serif;font-size:1rem;margin-bottom:0.5rem;color:#2d3748; }
.refund-card p { font-size:0.88rem;line-height:1.65;color:#4a5568;margin:0; }
@media (max-width: 920px) {
  .pricing-grid { grid-template-columns:1fr; }
  .refund-row { grid-template-columns:1fr; }
}
@media (max-width: 600px) {
  .pm-grid { grid-template-columns:1fr; }
  .pricing-hero { padding:1.6rem 1.2rem; }
  .pricing-extra { padding:1.35rem 1.15rem; }
}` : ''}
${p.successPage || p.cancelPage ? `
.pay-result { max-width: 760px; margin: 1rem auto 3rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 2.5rem 2.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
.pay-result-ico { font-size: 3.2rem; text-align: center; margin-bottom: 1rem; }
.pay-result.success .pay-result-ico { color: #2f855a; }
.pay-result h1 { font-family: 'Playfair Display', serif; font-size: clamp(1.6rem, 4vw, 2.2rem); color: #1a202c; margin-bottom: 0.9rem; text-align: center; }
.pay-conf-msg { color: #4a5568; font-size: 1rem; line-height: 1.7; text-align: center; margin-bottom: 1.75rem; }
.pay-conf-box { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.3rem 1.5rem; margin-bottom: 1.75rem; }
.pay-conf-box.warn { background: #fffaf0; border-color: #feebc8; }
.pay-conf-box h3 { font-family: 'Playfair Display', serif; font-size: 1.1rem; color: #2d3748; margin-bottom: 0.8rem; }
.pay-next { margin: 0; padding-left: 1.25rem; }
.pay-next li { color: #4a5568; font-size: 0.92rem; line-height: 1.65; margin-bottom: 0.4rem; }
.pay-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; }
.pay-btn { padding: 0.7rem 1.25rem; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 0.9rem; display: inline-block; transition: all 0.15s; }
.pay-btn.primary { background: #2d6a4f; color: #fff; }
.pay-btn.primary:hover { background: #1f4c39; }
.pay-btn.ghost { background: #fff; color: #2d6a4f; border: 1.5px solid #c6f6d5; }
.pay-btn.ghost:hover { background: #f0fff4; }
@media (max-width: 600px) {
  .pay-result { padding: 1.5rem 1.15rem; border-radius: 14px; }
  .pay-conf-box { padding: 1rem 1.05rem; }
}
` : ''}
` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" content="#ffffff">
<meta name="description" content="${p.metaDesc}">
<meta name="robots" content="${(p.successPage || p.cancelPage) ? 'noindex, nofollow' : 'index, follow'}">
<link rel="canonical" href="https://sendafun.com/${slug}.html">
<meta property="og:title" content="${p.pageTitle}">
<meta property="og:description" content="${p.metaDesc}">
<meta property="og:type" content="${p.pricingPage ? 'website' : 'article'}">
<meta property="og:url" content="https://sendafun.com/${slug}.html">
<meta property="og:site_name" content="SendAFun">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${p.pageTitle}">
<meta name="twitter:description" content="${p.metaDesc}">
<title>${p.pageTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; background: #f7f5f0; color: #1a202c; line-height: 1.6; }
.header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 0.9rem 2rem; position: sticky; top: 0; z-index: 10; }
.header-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
.logo { text-decoration: none; color: #2d6a4f; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; }
.logo span { color: #48bb78; }
.nav-links { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.nav-link { text-decoration: none; color: #4a5568; font-size: 0.82rem; padding: 0.35rem 0.75rem; border-radius: 20px; transition: all 0.2s; white-space: nowrap; }
.nav-link:hover { background: #edf2f7; }
.nav-link.active { background:#2d6a4f; color:#fff; }
.main { max-width: 1100px; margin: 0 auto; padding: 2rem 2rem 3rem; }
.hero { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2.5rem 2rem; margin-bottom: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.hero h1 { font-family: 'Playfair Display', serif; font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 700; color: #1a202c; margin-bottom: 0.5rem; }
.hero .last-updated { font-size: 0.85rem; color: #a0aec0; margin-bottom: 0; }
.hero .intro { font-size: 1rem; color: #4a5568; margin-top: 1rem; line-height: 1.65; }
.article { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem 2.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.breadcrumb { font-size: 0.85rem; color: #a0aec0; margin-bottom: 1.5rem; }
.breadcrumb a { color: #2d6a4f; text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }
.cat-row { max-width: 1200px; margin: 0 auto; padding: 0.5rem 2rem 0; border-top: 1px solid #f0f2f5; }
@media (max-width: 768px) {
  .header-inner { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
  .main { padding: 1.25rem 1rem 2.5rem; }
  .hero { padding: 1.5rem 1.25rem; }
  .article { padding: 1.25rem; }
}
${extraStyle}
</style>
</head>
<body>
<header class="header">
  <div class="header-inner">
    <a href="/" class="logo">Send<span>A</span>Fun</a>
    <nav class="nav-links">${topNavHtml}</nav>
  </div>
  <div class="cat-row"><nav class="nav-links">${catLinks}</nav></div>
</header>
<main class="main">
  <div class="breadcrumb"><a href="/">Home</a> &rsaquo; ${p.navLabel}</div>
${bodyMain}
</main>
${buildFooter()}
${buildCookieConsent()}
${p.successPage ? `
<script>
(function() {
  const MAX_POLLS = 30, INTERVAL = 1500;
  let polls = 0, done = false;
  const url = new URL(window.location.href);
  const sessId = url.searchParams.get('session_id');
  const checkoutId = url.searchParams.get('checkout_id');
  const saved = sessionStorage.getItem('sendafun_checkout');
  let email = '';
  if (saved) { try { email = JSON.parse(saved).email || ''; } catch(e) {} }
  if (!email) { console.warn('No email in sessionStorage, polling via query param fallback'); }
  const refreshBox = function(member) {
    const box = document.getElementById('payConfBox');
    if (!box) return;
    if (member.isMember) {
      box.innerHTML = '<h3 style="color:#2f855a;">&#x2705; Account activated!</h3>' +
        '<p style="color:#4a5568;">Your ' + (member.plan||'') + ' plan is now active. ' +
        'You can send cards for the next ' + (member.daysLeft||'') + ' days.</p>' +
        '<p style="margin-top:0.75rem;"><a href="/" class="pay-btn primary" style="text-decoration:none;">&#x1F48C; Start sending cards</a></p>';
      done = true;
    } else if (polls >= MAX_POLLS) {
      box.innerHTML = '<h3 style="color:#c05621;">Processing...</h3>' +
        '<p style="color:#4a5568;">Payment completed but activation is taking longer than expected. ' +
        'Your receipt will arrive in ~5 min. Once it arrives, refresh this page. ' +
        'If still not active after 15 min, email <a href="mailto:support@sendafun.com">support@sendafun.com</a>.</p>';
      done = true;
    }
  };
  const checkMember = function() {
    if (done) return;
    polls++;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/check-member?email=' + encodeURIComponent(email), true);
    xhr.onload = function() {
      if (xhr.status === 200) {
        try { refreshBox(JSON.parse(xhr.responseText)); } catch(e) {}
      }
    };
    xhr.send();
  };
  if (email) {
    checkMember();
    var timer = setInterval(function() {
      if (done) { clearInterval(timer); return; }
      if (polls >= MAX_POLLS) { clearInterval(timer); }
      checkMember();
    }, INTERVAL);
  }
})();
</script>
` : ''}
</body>
</html>`;
}

function buildPolicyPages() {
  let built = 0;
  for (const slug of Object.keys(POLICY_PAGES)) {
    const html = generatePolicyPage(slug);
    const outPath = path.join(DIST_DIR, `${slug}.html`);
    fs.writeFileSync(outPath, html, 'utf-8');
    console.log(`  ⚖️  Policy: ${POLICY_PAGES[slug].navLabel} → ${path.relative(DIST_DIR, outPath)}`);
    built++;
  }
  return built;
}

// ── P2: Guide / FAQ / Blog page generators ────────────────────────────────────

// Fallback data for any category missing explicit GUIDE_* entries
const FALLBACK_TIPS = [
  "Be specific — name one real memory or trait about the recipient, not 10 generic adjectives.",
  "Use the recipient's name twice: once in the opening, once near the end.",
  "Lead with warmth, end with action: a question, a plan, or an offer to help.",
  "Keep it 30–70 words — short enough to read in one breath, long enough to feel sincere.",
  "Read it out loud before sending. If it sounds weird spoken, it'll feel weird received.",
];
const FALLBACK_BADGOOD = [
  { bad: 'Hi! Hope you are well.', good: 'Hey {{name}} — I saw [specific small thing] yesterday and immediately thought of you. Hope you\'re having the best week. 💛' },
  { bad: 'Good luck! You got this.', good: 'Good luck today, {{name}}. You\'ve put in the hours, you know your stuff, and you\'re gonna crush it. And if you don\'t — tacos are on me either way. 🌮' },
  { bad: 'Sending love.', good: 'Sending you so much love right now, {{name}}. And also a reminder: you\'re stronger than you think, braver than you feel, and loved way more than you know. 💙' },
];
const FALLBACK_FAQS = [
  { q: 'How long should this card be?', a: '3–5 short sentences, 40–80 words. If it fits on a phone screen without scrolling, it\'s the right length.' },
  { q: 'Is it OK to be funny in a {{occasion}} card?', a: 'Yes — as long as you pair the joke with one sincere line. Funny alone can feel cheap; funny + warm feels perfect.' },
  { q: 'Should I handwrite or type this?', a: 'Either works. A SendAFun card with your real words inside hits 10x harder than a generic Hallmark card you signed in 2 seconds.' },
  { q: 'I don\'t know them super well — what do I write?', a: 'One specific observation + one warm wish. "Loved your presentation Tuesday — hope you have a great weekend!" Short, specific, kind. Perfect.' },
];
const FALLBACK_MESSAGES = {
  general: [
    "Hey {{name}} — just wanted to say you're awesome and I hope today treats you right. 💛",
    "{{name}}! Thinking of you today. Hope something small and wonderful happens to you this week. ✨",
    "Hi {{name}}! No big reason for this card — just felt like telling you you matter. 💙",
    "Dear {{name}} — wishing you a day that's as lovely as you are. 🌸",
    "{{name}}, you deserve all the good things today and always. Sending you a big hug! 🤗",
    "Just because {{name}} is {{name}} — and that's more than enough reason to send a card. 💫",
  ],
  her: [
    "Hey beautiful {{name}}! Hope your day is full of sunshine, good coffee, and zero chores. ☀️💖",
    "To {{name}} — one of the strongest, kindest, most brilliant women I know. Keep shining. ✨🌹",
    "{{name}}, you're doing great. I know life is loud right now — take 5 minutes for yourself today. You've earned it. 💗",
    "For {{name}}: you're not just 'doing your best' — you're doing incredible things. Don't forget that. 💐💕",
    "{{name}}, you inspire me every single day. Never dim your light for anyone. 💖✨",
    "Sending {{name}} a big cozy hug and a gentle reminder: you are so loved. 💞",
  ],
  him: [
    "Hey {{name}}! Keep being the legend you are. Whatever's on your plate today — you've got this. 💪😎",
    "{{name}}, man. You're one of the good ones. Hope today gives you at least one win. 🤙💙",
    "Dude {{name}} — thanks for being you. The world is a better place with your dumb jokes and your big heart in it. 😂💛",
    "{{name}}, whatever you're tackling today: you've prepared, you're capable, and you're gonna nail it. Go get 'em. 🚀",
    "Hey {{name}} — just a reminder that you're tougher than you think. And way funnier than you know. 😜💪",
    "{{name}}! You work hard, you love hard, and you deserve every good thing coming your way. Cheers. 🍻",
  ],
  family: [
    "{{name}} — family isn't just blood. It's the people who show up, and you show up every single time. Love you. ❤️🏡",
    "To my favourite person {{name}} in the whole family tree. Thanks for putting up with all of us. 😘💛",
    "{{name}}, home is wherever you are. Sending you all my love from near or far. 💙🏡",
    "Dear {{name}} — thank you for the way you love our family, even when we're all being ridiculous. So grateful for you. 💕",
    "{{name}}, you make family feel like the safest place in the world. Love you always. 🤗❤️",
    "To {{name}}: we don't say it enough, but we couldn't do this family thing without you. Thank you. 💛",
  ],
  friends: [
    "{{name}}! My ride-or-die, my partner-in-crime, my favourite weirdo. Love you to bits. 👯‍♀️💖",
    "Hey {{name}} — I was laughing out loud today thinking about [that one stupid thing we did]. Best friends forever, no takebacks. 😂💙",
    "{{name}}, some friendships are just forever. Ours is definitely one of them. Miss your face. 🧡",
    "To {{name}}: thank you for answering my 2am texts, judging my bad decisions, and loving me anyway. You're the best. 🍻💕",
    "{{name}}! I don't tell you enough: being your friend is one of the best things in my life. 💛✨",
    "Shoutout to {{name}} — the friend who's seen me at my worst and still sticks around. You're a legend. 😜🤙",
  ],
};

// Helper: get messages for a category with smart fallback
function getGuideMessages(cat) {
  if (GUIDE_MESSAGES && GUIDE_MESSAGES[cat]) return GUIDE_MESSAGES[cat];
  return FALLBACK_MESSAGES;
}
function getGuideTips(cat) {
  if (GUIDE_TIPS && GUIDE_TIPS[cat] && GUIDE_TIPS[cat].length) return GUIDE_TIPS[cat];
  return FALLBACK_TIPS;
}
function getGuideBadGood(cat) {
  if (GUIDE_BADGOOD && GUIDE_BADGOOD[cat] && GUIDE_BADGOOD[cat].length) return GUIDE_BADGOOD[cat];
  return FALLBACK_BADGOOD;
}
function getGuideFaqs(cat) {
  if (GUIDE_FAQS && GUIDE_FAQS[cat] && GUIDE_FAQS[cat].length) return GUIDE_FAQS[cat];
  return FALLBACK_FAQS;
}

function generateGuidePage(cat, allCards) {
  const label = CATEGORY_LABELS[cat] || cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const slug = cat;
  const messages = getGuideMessages(cat);
  const tips = getGuideTips(cat);
  const bg = getGuideBadGood(cat);
  const faqs = getGuideFaqs(cat);

  // Flatten messages into 30 picks
  const buckets = ['general','her','him','family','friends'];
  const msgRows = [];
  let idx = 0;
  for (const b of buckets) {
    const arr = messages[b] || messages.general || [];
    for (const txt of arr) {
      if (idx >= 30) break;
      msgRows.push({ group: b, text: txt });
      idx++;
    }
  }
  // Pad to 30 if needed
  while (msgRows.length < 30) {
    const b = buckets[msgRows.length % buckets.length];
    const arr = FALLBACK_MESSAGES[b];
    msgRows.push({ group: b, text: arr[msgRows.length % arr.length] });
  }

  // CTA: related cards (6 picks) from same category
  const catCards = (allCards || []).filter(c => c.category === cat);
  shuffleArray(catCards);
  const ctaCards = catCards.slice(0, 6);
  const ctaGrid = ctaCards.length
    ? ctaCards.map(c => renderCardTile(c)).join('\n        ')
    : '';

  const catLinks = Object.entries(CATEGORY_LABELS).map(([key, l]) =>
    `<a href="/category/${key}.html" class="nav-link">${l}</a>`
  ).join('\n        ');

  const bucketLabels = { general:'✍️ General', her:'👩 For Her', him:'👨 For Him', family:'👨👩👧 Family', friends:'👯 Friends' };
  const messagesHtml = msgRows.map((row, i) => `
    <div class="msg-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.55rem;">
        <span class="msg-num">${String(i+1).padStart(2,'0')}</span>
        <span class="msg-tag">${bucketLabels[row.group] || '💬'}</span>
      </div>
      <div class="msg-text">${row.text}</div>
      <div class="msg-actions">
        <button class="copy-btn" data-text="${row.text.replace(/"/g,'&quot;').replace(/[\r\n]+/g,' ')}">📋 Copy</button>
        <a class="use-btn" href="/card/${ctaCards[i % Math.max(ctaCards.length,1)]?.slug || 'birthday'}.html">🎴 Use on a card</a>
      </div>
    </div>`).join('\n');

  const bgHtml = bg.map((pair, i) => `
    <div class="bg-row">
      <div class="bg-col bad">
        <div class="bg-label"><span>❌</span> Don't write this</div>
        <div class="bg-text">${pair.bad}</div>
      </div>
      <div class="bg-col good">
        <div class="bg-label"><span>✅</span> Write this instead</div>
        <div class="bg-text">${pair.good}</div>
      </div>
    </div>`).join('\n');

  const faqHtml = faqs.map((f, i) => `
    <div class="faq-item">
      <details>
        <summary>${f.q}</summary>
        <p>${f.a}</p>
      </details>
    </div>`).join('\n');

  const tipsHtml = tips.map((t, i) => `<li>💡 ${t}</li>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" content="#ffffff">
<meta name="description" content="How to write the perfect ${label.toLowerCase()} card: 30 real ${label.toLowerCase()} messages you can copy-paste, 5 pro writing tips, bad-vs-good examples, and FAQs answered.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://sendafun.com/guide/${slug}.html">
<meta property="og:title" content="How to Write a Perfect ${label} Card (30 Real Messages + 5 Pro Tips) — SendAFun">
<meta property="og:description" content="30 real ${label.toLowerCase()} messages you can steal today. Bad-vs-good examples, 5 writing tips from card editors, and the exact ${label.toLowerCase()} card template to use.">
<meta property="og:type" content="article">
<meta property="og:url" content="https://sendafun.com/guide/${slug}.html">
<meta property="og:site_name" content="SendAFun">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="How to Write a Perfect ${label} Card — 30 Real Messages">
<meta name="twitter:description" content="30 copy-paste ${label.toLowerCase()} messages + bad/good examples + 5 pro tips.">
<title>How to Write a Perfect ${label} Card: 30 Messages & 5 Tips — SendAFun</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Inter',sans-serif; background:#f7f5f0; color:#1a202c; line-height:1.6; }
.header { background:#fff; border-bottom:1px solid #e2e8f0; padding:0.9rem 2rem; position:sticky; top:0; z-index:10; }
.header-inner { max-width:1200px; margin:0 auto; display:flex; align-items:center; gap:2rem; flex-wrap:wrap; }
.logo { text-decoration:none; color:#2d6a4f; font-size:1.15rem; font-weight:700; letter-spacing:-0.02em; white-space:nowrap; }
.logo span { color:#48bb78; }
.nav-links { display:flex; gap:0.5rem; flex-wrap:wrap; }
.nav-link { text-decoration:none; color:#4a5568; font-size:0.82rem; padding:0.35rem 0.75rem; border-radius:20px; transition:all 0.2s; white-space:nowrap; }
.nav-link:hover { background:#edf2f7; }
.cat-row { max-width:1200px; margin:0 auto; padding:0.5rem 2rem 0; border-top:1px solid #f0f2f5; }
.main { max-width:920px; margin:0 auto; padding:2rem 2rem 4rem; }
.breadcrumb { font-size:0.82rem; color:#718096; margin-bottom:1rem; }
.breadcrumb a { color:#2d6a4f; text-decoration:none; }
.breadcrumb a:hover { text-decoration:underline; }
.hero { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:2.25rem 2rem; margin-bottom:1.75rem; box-shadow:0 2px 10px rgba(0,0,0,0.04); }
.hero h1 { font-family:'Playfair Display',serif; font-size:clamp(1.6rem,4vw,2.25rem); font-weight:700; color:#1a202c; margin-bottom:0.75rem; line-height:1.2; }
.hero .lead { color:#4a5568; font-size:1.05rem; max-width:680px; }
.hero .meta { margin-top:1rem; display:flex; flex-wrap:wrap; gap:0.5rem; }
.chip { display:inline-block; font-size:0.75rem; padding:0.2rem 0.7rem; border-radius:999px; background:#e6f6ee; color:#2d6a4f; font-weight:500; }
.section { background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:1.75rem 1.75rem 1.85rem; margin-bottom:1.5rem; box-shadow:0 2px 8px rgba(0,0,0,0.03); }
.section h2 { font-family:'Playfair Display',serif; font-size:1.45rem; color:#1a202c; margin-bottom:0.5rem; }
.section h2 .num { display:inline-block; width:28px; height:28px; background:#2d6a4f; color:#fff; border-radius:8px; text-align:center; line-height:28px; font-size:0.9rem; margin-right:0.55rem; vertical-align:middle; }
.section .sub { color:#718096; margin-bottom:1.1rem; font-size:0.95rem; }
.msg-list { display:flex; flex-direction:column; gap:0.75rem; }
.msg-card { background:#fafbfc; border:1px solid #edf2f7; border-radius:11px; padding:1rem 1.15rem; transition:all 0.18s; }
.msg-card:hover { border-color:#c8e6d3; background:#f4fbf7; }
.msg-num { font-size:0.78rem; color:#a0aec0; font-weight:600; letter-spacing:0.03em; }
.msg-tag { font-size:0.7rem; color:#2d6a4f; background:#e6f6ee; padding:0.15rem 0.55rem; border-radius:6px; font-weight:600; }
.msg-text { font-size:0.96rem; line-height:1.65; color:#2d3748; margin-bottom:0.7rem; white-space:pre-wrap; }
.msg-actions { display:flex; gap:0.5rem; align-items:center; }
.copy-btn { font-size:0.78rem; padding:0.32rem 0.82rem; background:#fff; border:1px solid #cbd5e0; border-radius:7px; cursor:pointer; color:#2d6a4f; font-weight:500; font-family:inherit; transition:all 0.15s; }
.copy-btn:hover { background:#2d6a4f; color:#fff; border-color:#2d6a4f; }
.use-btn { font-size:0.78rem; padding:0.32rem 0.82rem; background:#2d6a4f; color:#fff; text-decoration:none; border-radius:7px; font-weight:500; transition:background 0.15s; }
.use-btn:hover { background:#1f4c39; }
.tips { padding-left:1.2rem; display:flex; flex-direction:column; gap:0.55rem; color:#2d3748; }
.tips li { line-height:1.6; }
.bg-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem; }
.bg-col { border-radius:10px; padding:1rem 1.15rem; border:1px solid; }
.bg-col.bad { background:#fff5f5; border-color:#fed7d7; }
.bg-col.good { background:#f0fff4; border-color:#c6f6d5; }
.bg-label { font-size:0.78rem; font-weight:600; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.35rem; }
.bg-col.bad .bg-label { color:#c53030; }
.bg-col.good .bg-label { color:#276749; }
.bg-text { font-size:0.92rem; line-height:1.6; color:#2d3748; }
.faq-item { border-bottom:1px solid #edf2f7; }
.faq-item:last-child { border-bottom:none; }
.faq-item details summary { list-style:none; cursor:pointer; padding:0.9rem 0; font-weight:600; color:#2d3748; font-size:0.95rem; display:flex; align-items:center; justify-content:space-between; }
.faq-item details summary::-webkit-details-marker { display:none; }
.faq-item details summary::after { content:'+'; color:#a0aec0; font-size:1.1rem; font-weight:400; }
.faq-item details[open] summary::after { content:'−'; }
.faq-item details p { padding:0 0 1rem; color:#4a5568; line-height:1.7; font-size:0.93rem; }
.cta-block h2 { margin-bottom:1rem; }
.card-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:1rem; }
.card-tile { text-decoration:none; color:inherit; border-radius:10px; overflow:hidden; background:#fff; box-shadow:0 2px 6px rgba(0,0,0,0.06); transition:transform 0.2s, box-shadow 0.2s; display:flex; flex-direction:column; }
.card-tile:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,0,0,0.1); }
.card-tile-img { width:100%; aspect-ratio:3/4; background:#e2e8f0; }
.card-tile-img img { width:100%; height:100%; object-fit:cover; display:block; }
.card-tile-info { padding:0.75rem 0.85rem 0.9rem; }
.card-tile-title { font-weight:600; font-size:0.85rem; margin-bottom:0.3rem; color:#2d3748; line-height:1.35; }
.card-tile-cat { font-size:0.72rem; color:#718096; text-transform:uppercase; letter-spacing:0.06em; }
.copy-toast { position:fixed; bottom:32px; left:50%; transform:translateX(-50%); background:#1a202c; color:#fff; padding:0.7rem 1.2rem; border-radius:999px; font-size:0.85rem; opacity:0; transition:opacity 0.25s; pointer-events:none; z-index:99; }
.copy-toast.show { opacity:1; }
.footer-bar { background:#fff; border-top:1px solid #e2e8f0; text-align:center; padding:2.25rem 2rem 2rem; color:#a0aec0; font-size:0.85rem; }
.footer-links { margin-bottom:1rem; display:flex; flex-wrap:wrap; justify-content:center; gap:0.5rem 1.25rem; }
.footer-links a { color:#718096; text-decoration:none; }
.footer-links a:hover { text-decoration:underline; }
.toc { display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:1rem; }
.toc a { font-size:0.82rem; color:#2d6a4f; text-decoration:none; padding:0.25rem 0.7rem; background:#e6f6ee; border-radius:7px; }
.toc a:hover { background:#c8e6d3; }
@media (max-width:820px) {
  .header-inner { flex-direction:column; align-items:flex-start; gap:0.75rem; }
  .main { padding:1.25rem 1rem 2.5rem; }
  .hero { padding:1.5rem 1.25rem; }
  .section { padding:1.25rem 1.05rem 1.35rem; }
  .bg-row { grid-template-columns:1fr; }
  .card-grid { grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:0.75rem; }
}
</style>
</head>
<body>
<header class="header">
  <div class="header-inner">
    <a href="/" class="logo">Send<span>A</span>Fun</a>
    <nav class="nav-links">
      ${buildTopNav('blog')}
    </nav>
  </div>
  <div class="cat-row">
    <nav class="nav-links">
      ${catLinks}
    </nav>
  </div>
</header>
<main class="main">
  <div class="breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/blog.html">Blog &amp; Guides</a> &rsaquo; ${label} Guide</div>

  <section class="hero">
    <h1>How to Write a Perfect ${label} Card</h1>
    <p class="lead">30 real ${label.toLowerCase()} messages you can copy-paste today. 5 pro writing tips from our card editors. Bad-vs-good comparisons so you can spot the generic stuff and write something <em>they'll actually remember.</em></p>
    <div class="meta">
      <span class="chip">📝 30 copy-paste messages</span>
      <span class="chip">💡 5 writing tips</span>
      <span class="chip">✅ Bad vs Good examples</span>
      <span class="chip">❓ FAQs answered</span>
    </div>
    <div class="toc">
      <a href="#messages">Jump to: 30 Messages</a>
      <a href="#tips">5 Writing Tips</a>
      <a href="#badgood">Bad vs Good</a>
      <a href="#faq">FAQ</a>
      <a href="#cta">Pick a ${label} Template</a>
    </div>
  </section>

  <section class="section" id="messages">
    <h2><span class="num">1</span> 30 ${label} Messages You Can Steal Today</h2>
    <p class="sub">Click 📋 Copy to save to clipboard. Click 🎴 Use on a card to open a ${label.toLowerCase()} template with this message ready to go.</p>
    <div class="msg-list">
      ${messagesHtml}
    </div>
  </section>

  <section class="section" id="tips">
    <h2><span class="num">2</span> 5 Pro Tips for Writing ${label} Cards That Get Saved</h2>
    <p class="sub">After editing 10,000+ greeting cards, these are the 5 patterns that separate "nice" cards from "I kept this on my fridge for 3 years" cards.</p>
    <ol class="tips">
      ${tipsHtml}
    </ol>
  </section>

  <section class="section" id="badgood">
    <h2><span class="num">3</span> Bad vs Good: ${label} Card Messages, Side by Side</h2>
    <p class="sub">The difference between a forgotten card and a remembered one is usually 2 specific sentences. Here's what that looks like in practice.</p>
    ${bgHtml}
  </section>

  <section class="section" id="faq">
    <h2><span class="num">4</span> ${label} Card Writing — FAQ</h2>
    <p class="sub">The questions we get asked 4–5 times a week about writing ${label.toLowerCase()} cards.</p>
    ${faqHtml}
  </section>

  <section class="section cta-block" id="cta">
    <h2><span class="num">5</span> Pick a ${label} Template &amp; Send in 60 Seconds</h2>
    <p class="sub">All templates are free to design, personalise, and preview. No account needed.</p>
    ${ctaGrid ? `<div class="card-grid">${ctaGrid}</div>
    <p style="margin-top:1rem;text-align:center;"><a href="/category/${slug}.html" style="color:#2d6a4f;font-weight:600;text-decoration:none;">See all ${label} templates →</a></p>` : `<p>Explore <a href="/category/${slug}.html" style="color:#2d6a4f;font-weight:600;">all ${label.toLowerCase()} templates →</a></p>`}
  </section>
</main>
${buildFooter()}
<div class="copy-toast" id="toast">✅ Copied to clipboard</div>
<script>
(function(){
  'use strict';
  const toast = document.getElementById('toast');
  let toastTimer = null;
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async function(){
      const txt = btn.getAttribute('data-text') || btn.closest('.msg-card').querySelector('.msg-text').innerText;
      try { await navigator.clipboard.writeText(txt); }
      catch(e) { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
      toast.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
    });
  });
})();
</script>
${buildCookieConsent()}
</body>
</html>`;
}

function buildGuidePages(allCards) {
  ensureDir(GUIDE_DIR);
  const cats = Object.keys(CATEGORY_LABELS);
  let built = 0;
  for (const cat of cats) {
    try {
      const html = generateGuidePage(cat, allCards);
      const outPath = path.join(GUIDE_DIR, `${cat}.html`);
      fs.writeFileSync(outPath, html, 'utf-8');
      built++;
    } catch (e) {
      console.error(`  ⚠️  Guide ${cat} failed: ${e.message}`);
    }
  }
  return built;
}

function generateFaqPage() {
  const navLinks = Object.entries(CATEGORY_LABELS).map(([key, l]) =>
    `<a href="/category/${key}.html" class="nav-link">${l}</a>`
  ).join('\n        ');

  const faqItems = FAQ_DATA.map((f, i) => `
    <div class="faq-item">
      <details${i < 2 ? ' open' : ''}>
        <summary>${f.q}</summary>
        <p>${f.a}</p>
      </details>
    </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" content="#ffffff">
<meta name="description" content="Frequently asked questions about SendAFun — pricing, privacy, card delivery, scheduling, printing, accounts, and more. All answers in one place.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://sendafun.com/faq.html">
<meta property="og:title" content="FAQ — Everything You Need to Know About SendAFun">
<meta property="og:description" content="Answers to the 20 most common questions about SendAFun. Pricing, delivery, privacy, scheduling, printing, and more.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://sendafun.com/faq.html">
<title>FAQ — SendAFun Help Center</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Inter',sans-serif; background:#f7f5f0; color:#1a202c; line-height:1.6; }
.header { background:#fff; border-bottom:1px solid #e2e8f0; padding:0.9rem 2rem; position:sticky; top:0; z-index:10; }
.header-inner { max-width:1200px; margin:0 auto; display:flex; align-items:center; gap:2rem; flex-wrap:wrap; }
.logo { text-decoration:none; color:#2d6a4f; font-size:1.15rem; font-weight:700; letter-spacing:-0.02em; white-space:nowrap; }
.logo span { color:#48bb78; }
.nav-links { display:flex; gap:0.5rem; flex-wrap:wrap; }
.nav-link { text-decoration:none; color:#4a5568; font-size:0.82rem; padding:0.35rem 0.75rem; border-radius:20px; transition:all 0.2s; white-space:nowrap; }
.nav-link:hover { background:#edf2f7; }
.nav-link.active { background:#2d6a4f; color:#fff; }
.cat-row { max-width:1200px; margin:0 auto; padding:0.5rem 2rem 0; border-top:1px solid #f0f2f5; }
.main { max-width:820px; margin:0 auto; padding:2rem 2rem 4rem; }
.breadcrumb { font-size:0.82rem; color:#718096; margin-bottom:1rem; }
.breadcrumb a { color:#2d6a4f; text-decoration:none; }
.breadcrumb a:hover { text-decoration:underline; }
.hero { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:2.25rem 2rem; margin-bottom:1.75rem; box-shadow:0 2px 10px rgba(0,0,0,0.04); }
.hero h1 { font-family:'Playfair Display',serif; font-size:clamp(1.75rem,4vw,2.5rem); font-weight:700; color:#1a202c; margin-bottom:0.65rem; }
.hero p { color:#4a5568; font-size:1.02rem; max-width:640px; }
.hero .chips { margin-top:1rem; display:flex; flex-wrap:wrap; gap:0.5rem; }
.chip { display:inline-block; font-size:0.78rem; padding:0.18rem 0.7rem; border-radius:999px; background:#e6f6ee; color:#2d6a4f; font-weight:500; }
.article { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:1.75rem 1.75rem 1.85rem; box-shadow:0 2px 8px rgba(0,0,0,0.03); }
.article h2 { font-family:'Playfair Display',serif; font-size:1.25rem; color:#1a202c; margin-bottom:1rem; }
.faq-item { border-bottom:1px solid #edf2f7; }
.faq-item:last-child { border-bottom:none; }
.faq-item details summary { list-style:none; cursor:pointer; padding:1rem 0; font-weight:600; color:#2d3748; font-size:0.97rem; display:flex; align-items:center; justify-content:space-between; gap:1rem; }
.faq-item details summary::-webkit-details-marker { display:none; }
.faq-item details summary::after { content:'+'; color:#a0aec0; font-size:1.3rem; font-weight:400; flex-shrink:0; }
.faq-item details[open] summary::after { content:'−'; }
.faq-item details p { padding:0 0 1.1rem; color:#4a5568; line-height:1.72; font-size:0.94rem; }
.contact-box { margin-top:2rem; padding:1.5rem; background:linear-gradient(135deg,#f0fff4,#e6f6ee); border-radius:12px; text-align:center; }
.contact-box h3 { font-family:'Playfair Display',serif; color:#1a202c; margin-bottom:0.4rem; }
.contact-box p { color:#4a5568; font-size:0.92rem; margin-bottom:0.9rem; }
.contact-box a { display:inline-block; background:#2d6a4f; color:#fff; padding:0.55rem 1.2rem; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.88rem; transition:background 0.15s; }
.contact-box a:hover { background:#1f4c39; }
.footer-bar { background:#fff; border-top:1px solid #e2e8f0; text-align:center; padding:2.25rem 2rem 2rem; color:#a0aec0; font-size:0.85rem; margin-top:2rem; }
.footer-links { margin-bottom:1rem; display:flex; flex-wrap:wrap; justify-content:center; gap:0.5rem 1.25rem; }
.footer-links a { color:#718096; text-decoration:none; }
.footer-links a:hover { text-decoration:underline; }
@media (max-width:768px) {
  .main { padding:1.25rem 1rem 2.5rem; }
  .hero { padding:1.5rem 1.25rem; }
  .article { padding:1.25rem 1.05rem; }
}
</style>
</head>
<body>
<header class="header">
  <div class="header-inner">
    <a href="/" class="logo">Send<span>A</span>Fun</a>
    <nav class="nav-links">
      ${buildTopNav('faq')}
    </nav>
  </div>
  <div class="cat-row">
    <nav class="nav-links">
      ${navLinks}
    </nav>
  </div>
</header>
<main class="main">
  <div class="breadcrumb"><a href="/">Home</a> &rsaquo; FAQ</div>
  <section class="hero">
    <h1>Frequently Asked Questions</h1>
    <p>Everything you need to know about SendAFun before or after sending a card. If your question isn't here, our team replies to every email within 24 hours, 7 days a week.</p>
    <div class="chips">
      <span class="chip">💳 Pricing & Billing (6)</span>
      <span class="chip">✉️ Delivery & Scheduling (5)</span>
      <span class="chip">🔒 Privacy & Data (4)</span>
      <span class="chip">🎴 Editor & Templates (5)</span>
    </div>
  </section>
  <section class="article">
    <h2>All Questions</h2>
    ${faqItems}
    <div class="contact-box">
      <h3>Still have a question?</h3>
      <p>We read every email personally. 90% of tickets get a reply in under 4 hours during UK business hours.</p>
      <a href="/contact.html">→ Contact our team</a>
    </div>
  </section>
</main>
${buildFooter()}
${buildCookieConsent()}
</body>
</html>`;
}

function generateBlogIndex(allCards) {
  const navLinks = Object.entries(CATEGORY_LABELS).map(([key, l]) =>
    `<a href="/category/${key}.html" class="nav-link">${l}</a>`
  ).join('\n        ');

  const today = new Date().toISOString().slice(0,10);
  const guidePosts = Object.keys(CATEGORY_LABELS).map(cat => {
    const label = CATEGORY_LABELS[cat] || cat.replace(/-/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
    const catCards = (allCards||[]).filter(c => c.category === cat);
    const sample = catCards[0];
    const cover = (sample && (sample.bgImageWatermark || sample.bgImage)) || '';
    const count = catCards.length;
    return { cat, label, cover, count, date: today, excerpt: `How to write the perfect ${label.toLowerCase()} card. 30 copy-paste messages, 5 pro writing tips, bad-vs-good examples, and a hand-picked ${label.toLowerCase()} template to send in under 60 seconds.` };
  });

  const postsHtml = guidePosts.map(p => `
    <article class="post-card">
      <a class="post-cover" href="/guide/${p.cat}.html">
        ${p.cover ? `<img src="${p.cover}" alt="${p.label} guide cover" loading="lazy">` : `<div class="no-cover">✍️</div>`}
      </a>
      <div class="post-body">
        <div class="post-meta">
          <span>${p.date}</span>
          <span>·</span>
          <span>${p.count} templates</span>
        </div>
        <h3><a href="/guide/${p.cat}.html">How to Write a Perfect ${p.label} Card</a></h3>
        <p>${p.excerpt}</p>
        <div class="post-tags">
          <span class="ptag">#${p.label.replace(/\s+/g,'-').toLowerCase()}</span>
          <span class="ptag">#writing-tips</span>
          <span class="ptag">#copy-paste</span>
        </div>
        <a class="read-more" href="/guide/${p.cat}.html">Read guide →</a>
      </div>
    </article>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" content="#ffffff">
<meta name="description" content="The SendAFun blog — 25 category guides with copy-paste greeting card messages, writing tips, bad-vs-good examples. Learn how to write cards people actually keep.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://sendafun.com/blog.html">
<meta property="og:title" content="Blog & How-to Guides — SendAFun">
<meta property="og:description" content="25 category-specific guides with copy-paste greeting card messages, 5 pro writing tips each, and bad-vs-good examples.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://sendafun.com/blog.html">
<title>Blog & How-to Guides — SendAFun</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Inter',sans-serif; background:#f7f5f0; color:#1a202c; line-height:1.6; }
.header { background:#fff; border-bottom:1px solid #e2e8f0; padding:0.9rem 2rem; position:sticky; top:0; z-index:10; }
.header-inner { max-width:1240px; margin:0 auto; display:flex; align-items:center; gap:2rem; flex-wrap:wrap; }
.logo { text-decoration:none; color:#2d6a4f; font-size:1.15rem; font-weight:700; letter-spacing:-0.02em; white-space:nowrap; }
.logo span { color:#48bb78; }
.nav-links { display:flex; gap:0.5rem; flex-wrap:wrap; }
.nav-link { text-decoration:none; color:#4a5568; font-size:0.82rem; padding:0.35rem 0.75rem; border-radius:20px; transition:all 0.2s; white-space:nowrap; }
.nav-link:hover { background:#edf2f7; }
.nav-link.active { background:#2d6a4f; color:#fff; }
.cat-row { max-width:1240px; margin:0 auto; padding:0.5rem 2rem 0; border-top:1px solid #f0f2f5; }
.main { max-width:1240px; margin:0 auto; padding:2rem 2rem 4rem; }
.breadcrumb { font-size:0.82rem; color:#718096; margin-bottom:1rem; }
.breadcrumb a { color:#2d6a4f; text-decoration:none; }
.breadcrumb a:hover { text-decoration:underline; }
.hero { background:linear-gradient(135deg,#1f4c39,#2d6a4f); color:#fff; border-radius:18px; padding:2.75rem 2.5rem; margin-bottom:2rem; }
.hero h1 { font-family:'Playfair Display',serif; font-size:clamp(1.8rem,4.5vw,2.75rem); font-weight:700; margin-bottom:0.65rem; line-height:1.15; }
.hero p { font-size:1.05rem; color:#d4f0de; max-width:680px; opacity:0.95; }
.hero .stats { margin-top:1.5rem; display:flex; gap:1.5rem; flex-wrap:wrap; }
.stat-num { font-size:1.5rem; font-weight:700; display:block; }
.stat-label { font-size:0.78rem; text-transform:uppercase; letter-spacing:0.08em; color:#a7e3bf; }
.posts-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:1.5rem; }
.post-card { background:#fff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.04); transition:transform 0.2s, box-shadow 0.2s; display:flex; flex-direction:column; }
.post-card:hover { transform:translateY(-4px); box-shadow:0 10px 28px rgba(0,0,0,0.1); }
.post-cover { display:block; aspect-ratio:16/9; background:#e6f6ee; overflow:hidden; }
.post-cover img { width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.3s; }
.post-card:hover .post-cover img { transform:scale(1.05); }
.post-cover .no-cover { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:3rem; background:linear-gradient(135deg,#e6f6ee,#c8e6d3); color:#2d6a4f; }
.post-body { padding:1.25rem 1.35rem 1.4rem; flex:1; display:flex; flex-direction:column; }
.post-meta { font-size:0.75rem; color:#718096; display:flex; gap:0.4rem; margin-bottom:0.55rem; }
.post-body h3 { font-family:'Playfair Display',serif; font-size:1.1rem; font-weight:700; line-height:1.3; margin-bottom:0.55rem; }
.post-body h3 a { color:#1a202c; text-decoration:none; }
.post-body h3 a:hover { color:#2d6a4f; }
.post-body p { color:#4a5568; font-size:0.88rem; line-height:1.65; margin-bottom:0.9rem; flex:1; }
.post-tags { display:flex; flex-wrap:wrap; gap:0.35rem; margin-bottom:0.9rem; }
.ptag { font-size:0.7rem; padding:0.15rem 0.5rem; background:#f1f5f9; color:#64748b; border-radius:5px; }
.read-more { color:#2d6a4f; font-weight:600; font-size:0.88rem; text-decoration:none; align-self:flex-start; }
.read-more:hover { text-decoration:underline; }
.footer-bar { background:#fff; border-top:1px solid #e2e8f0; text-align:center; padding:2.25rem 2rem 2rem; color:#a0aec0; font-size:0.85rem; margin-top:3rem; }
.footer-links { margin-bottom:1rem; display:flex; flex-wrap:wrap; justify-content:center; gap:0.5rem 1.25rem; }
.footer-links a { color:#718096; text-decoration:none; }
.footer-links a:hover { text-decoration:underline; }
@media (max-width:768px) {
  .main { padding:1.25rem 1rem 2.5rem; }
  .hero { padding:1.75rem 1.4rem; border-radius:14px; }
  .hero .stats { gap:1rem; }
  .posts-grid { grid-template-columns:1fr; gap:1rem; }
}
</style>
</head>
<body>
<header class="header">
  <div class="header-inner">
    <a href="/" class="logo">Send<span>A</span>Fun</a>
    <nav class="nav-links">
      ${buildTopNav('blog')}
    </nav>
  </div>
  <div class="cat-row">
    <nav class="nav-links">
      ${navLinks}
    </nav>
  </div>
</header>
<main class="main">
  <div class="breadcrumb"><a href="/">Home</a> &rsaquo; Blog &amp; Guides</div>

  <section class="hero">
    <h1>Blog &amp; How-to Guides</h1>
    <p>25 category-specific guides with copy-paste greeting card messages, 5 pro writing tips from our editors, bad-vs-good examples so you can spot what's generic, and ready templates to send in under 60 seconds.</p>
    <div class="stats">
      <div><span class="stat-num">${guidePosts.length}</span><span class="stat-label">How-to Guides</span></div>
      <div><span class="stat-num">750+</span><span class="stat-label">Copy-paste Messages</span></div>
      <div><span class="stat-num">125</span><span class="stat-label">Writing Tips</span></div>
      <div><span class="stat-num">20</span><span class="stat-label">FAQs Answered</span></div>
    </div>
  </section>

  <section>
    <div class="posts-grid">
      ${postsHtml}
    </div>
  </section>
</main>
${buildFooter()}
${buildCookieConsent()}
</body>
</html>`;
}



// ── Build universal top nav (used on all collection pages) ───────────────────
function buildTopNav(activeKey) {
  const items = [
    { key: 'home',       label: 'Home',         href: '/' },
    { key: 'trending',   label: '🔥 Trending',  href: '/trending.html' },
    { key: 'latest',     label: '✨ Latest',    href: '/latest.html' },
    { key: 'holidays',   label: '📅 Holidays',  href: '/holidays.html' },
    { key: 'messages',   label: '✍️ Messages',  href: '/message-generator.html' },
    { key: 'pricing',    label: '💳 Pricing',   href: '/pricing.html' },
    { key: 'blog',       label: '📖 Blog',      href: '/blog.html' },
    { key: 'faq',        label: '❓ FAQ',       href: '/faq.html' },
  ];
  return items.map(it => `<a href="${it.href}" class="nav-link${it.key === activeKey ? ' active' : ''}">${it.label}</a>`).join('\n        ');
}

// Creem-audit universal footer (2 rows: 8 nav links + mandatory copyright/email line)
function buildFooter(extraLinks) {
  const links = [
    { label: 'Privacy Policy', href: '/privacy.html' },
    { label: 'Terms of Service', href: '/terms.html' },
    { label: 'Pricing', href: '/pricing.html' },
    { label: 'About', href: '/about.html' },
    { label: 'Contact', href: '/contact.html' },
    { label: 'Cookies', href: '/cookies.html' },
    { label: 'FAQ', href: '/faq.html' },
    { label: 'Blog', href: '/blog.html' },
  ];
  if (Array.isArray(extraLinks)) for (const l of extraLinks) links.push(l);

  const linkRow = links.map(l => `<a href="${l.href}" style="color:#718096;text-decoration:none;">${l.label}</a>`).join('\n        ');
  const yyyy = new Date().getFullYear();
  // Creem MANDATORY copyright line format: © YYYY sendafun.com | Privacy Policy | Terms of Service | Contact: support@sendafun.com
  const creemLine = `&copy; ${yyyy} sendafun.com &nbsp;|&nbsp; <a href="/privacy.html" style="color:#a0aec0;text-decoration:none;">Privacy Policy</a> &nbsp;|&nbsp; <a href="/terms.html" style="color:#a0aec0;text-decoration:none;">Terms of Service</a> &nbsp;|&nbsp; Contact: <a href="mailto:support@sendafun.com" style="color:#a0aec0;text-decoration:none;">support@sendafun.com</a>`;
  return `
  <div style="background:#fff;border-top:1px solid #e2e8f0;text-align:center;padding:28px 20px 32px;color:#a0aec0;font-size:0.85rem;margin-top:32px;">
    <div style="margin-bottom:14px;display:flex;flex-wrap:wrap;justify-content:center;gap:10px 22px;">
      ${linkRow}
    </div>
    <div style="font-size:0.82rem;">${creemLine}</div>
  </div>`;
}

// Creem/GDPR universal cookie consent banner (persists via localStorage)
function buildCookieConsent() {
  return `
<!-- GDPR Cookie Consent (Creem + Adsense compliance) -->
<div id="saf-cookie-banner" style="display:none;position:fixed;left:0;right:0;bottom:16px;z-index:9999;padding:0 12px;">
  <div style="max-width:880px;margin:0 auto;background:#1a202c;color:#fff;border-radius:14px;padding:16px 18px;box-shadow:0 12px 36px rgba(0,0,0,.35);display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
    <div style="flex:1;min-width:260px;">
      <div style="font-weight:600;font-size:0.92rem;margin-bottom:2px;">🍪 We use cookies</div>
      <div style="font-size:0.8rem;line-height:1.5;color:#cbd5e0;">
        Essential cookies keep the card editor working. Analytics and advertising cookies help us improve the site and show relevant ads, and are only set <strong>after you accept</strong>. Read the <a href="/privacy.html" style="color:#68d391;">Privacy Policy</a> or <a href="/cookies.html" style="color:#68d391;">Cookie Policy</a> for details.
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0;">
      <button id="saf-cookie-reject" style="background:transparent;color:#e2e8f0;border:1px solid #4a5568;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:0.82rem;font-family:inherit;">Reject non-essential</button>
      <button id="saf-cookie-accept" style="background:#2f855a;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:0.82rem;font-weight:600;font-family:inherit;">Accept all</button>
    </div>
  </div>
</div>
<script>
(function(){
  var KEY='saf_cookie_v1';
  var now=Math.floor(Date.now()/1000);
  try {
    var saved=JSON.parse(localStorage.getItem(KEY)||'{}');
  } catch(e){ var saved={}; }
  // Show banner if no saved decision OR decision older than 180 days
  if(!saved.d || (saved.t && now - saved.t > 15552000)) {
    document.getElementById('saf-cookie-banner').style.display='block';
  }
  function decide(choice){
    try { localStorage.setItem(KEY, JSON.stringify({d:choice,t:now})); } catch(e){}
    document.getElementById('saf-cookie-banner').style.display='none';
    // Dispatch event so future GA4 / Ads can branch on consent
    document.dispatchEvent(new CustomEvent('saf:cookie-consent',{detail:{choice:choice}}));
  }
  document.getElementById('saf-cookie-accept').addEventListener('click', function(){ decide('accept'); });
  document.getElementById('saf-cookie-reject').addEventListener('click', function(){ decide('reject'); });
})();
</script>`;
}

// ── P1-6/7/8: Universal collection page template ────────────────────────────
function generateCollectionPage(opts, cards, allCards) {
  const { slug, label, metaDesc, activeKey, breadcrumb, cardSubset, extraHtml, showCats } = opts;
  const cardGrid = cardSubset.slice(0, 160).map(c => renderCardTile(c)).join('\n      ');
  const catLinks = Object.entries(CATEGORY_LABELS).map(([key, l]) =>
    `<a href="/category/${key}.html" class="nav-link">${l}</a>`
  ).join('\n        ');

  const others = allCards.filter(c => !cardSubset.includes(c));
  shuffleArray(others);
  const relatedGrid = others.slice(0, 8).map(c => renderCardTile(c)).join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" content="#ffffff">
<meta name="description" content="${metaDesc}">
<meta property="og:title" content="${label} Cards — SendAFun">
<meta property="og:description" content="${metaDesc}">
<link rel="canonical" href="https://sendafun.com/${slug}.html">
<title>${label} Cards — SendAFun</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; background: #f7f5f0; color: #1a202c; }
.header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 0.9rem 2rem; position: sticky; top: 0; z-index: 10; }
.header-inner { max-width: 1240px; margin: 0 auto; display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
.logo { text-decoration: none; color: #2d6a4f; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; }
.logo span { color: #48bb78; }
.nav-links { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.nav-link { text-decoration: none; color: #4a5568; font-size: 0.82rem; padding: 0.35rem 0.75rem; border-radius: 20px; transition: all 0.2s; white-space: nowrap; }
.nav-link:hover { background: #edf2f7; }
.nav-link.active { background: #2d6a4f; color: #fff; }
.cat-row { max-width: 1240px; margin: 0 auto; padding: 0.5rem 2rem 0; border-top: 1px solid #f0f2f5; }
.main { max-width: 1240px; margin: 0 auto; padding: 1.5rem 2rem 3rem; }
.breadcrumb { font-size: 0.8rem; color: #718096; margin-bottom: 0.75rem; }
.breadcrumb a { color: #2d6a4f; text-decoration: none; }
.page-title { font-size: 2.2rem; font-weight: 700; margin-bottom: 0.4rem; color: #1a202c; letter-spacing: -0.01em; }
.page-subtitle { font-size: 1.05rem; color: #718096; margin-bottom: 1.75rem; max-width: 720px; }
.count-chip { display: inline-block; font-size: 0.78rem; background: #e6f6ee; color: #2d6a4f; padding: 0.18rem 0.7rem; border-radius: 999px; margin-left: 0.6rem; font-weight: 500; vertical-align: middle; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem; }
.card-tile { text-decoration: none; color: inherit; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; }
.card-tile:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
.card-tile-img { width: 100%; aspect-ratio: 3/4; object-fit: cover; background: #e2e8f0; }
.card-tile-img img { width:100%; height:100%; object-fit:cover; display:block; }
.card-tile-info { padding: 0.9rem 1rem 1.05rem; }
.card-tile-title { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.4rem; color: #2d3748; line-height: 1.35; }
.card-tile-tags { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.card-tile-tag { font-size: 0.68rem; background: #edf2f7; color: #4a5568; padding: 0.12rem 0.5rem; border-radius: 10px; }
/* Filter chips for recipient/style sub-nav */
.chip-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.8rem; }
.chip { padding: 0.4rem 0.9rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 999px; font-size: 0.82rem; color: #4a5568; text-decoration: none; transition: all 0.15s; }
.chip:hover { border-color: #2d6a4f; color: #2d6a4f; }
.chip.active { background: #2d6a4f; color: #fff; border-color: #2d6a4f; }
/* Holiday calendar grid */
.holiday-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1rem; margin: 1rem 0 2rem; }
.holiday-card { background: #fff; border-radius: 10px; padding: 1rem 1.1rem; box-shadow: 0 1px 4px rgba(0,0,0,0.05); border-left: 4px solid #48bb78; }
.holiday-date { font-size: 0.78rem; color: #2d6a4f; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 0.2rem; }
.holiday-name { font-weight: 600; font-size: 1rem; margin-bottom: 0.55rem; color: #2d3748; }
.holiday-btn { display: inline-block; text-decoration: none; font-size: 0.82rem; color: #2d6a4f; font-weight: 500; }
.extra-section { margin: 0 0 2.2rem; }
@media (max-width: 768px) {
  .header-inner { flex-direction: column; align-items: flex-start; gap: 0.6rem; }
  .cat-row { padding: 0.5rem 1rem 0; }
  .main { padding: 1.2rem 1rem 2.5rem; }
  .page-title { font-size: 1.6rem; }
  .card-grid { grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 0.8rem; }
}
</style>
</head>
<body>
<header class="header">
  <div class="header-inner">
    <a href="/" class="logo">Send<span>A</span>Fun</a>
    <nav class="nav-links">
      ${buildTopNav(activeKey)}
    </nav>
  </div>
  ${showCats ? `<div class="cat-row"><nav class="nav-links" style="padding:0.5rem 0;">${catLinks}</nav></div>` : ''}
</header>
<main class="main">
  <div class="breadcrumb"><a href="/">Home</a>${breadcrumb ? ` / ${breadcrumb}` : ''}</div>
  <h1 class="page-title">${label} Cards<span class="count-chip">${cardSubset.length} cards</span></h1>
  <p class="page-subtitle">${metaDesc}</p>
  ${extraHtml || ''}
  <div class="card-grid">
    ${cardGrid}
  </div>
  ${relatedGrid ? `<h2 class="page-title" style="font-size:1.4rem;margin-top:1rem;">You might also like</h2>
  <p class="page-subtitle">Explore more cards across SendAFun.</p>
  <div class="card-grid">${relatedGrid}</div>` : ''}
</main>
${buildFooter()}
${buildCookieConsent()}
</body>
</html>`;
}

// ── Helper: extract recipient (last "· for Xxx" part of title) ───────────────
function getRecipientOf(card) {
  const parts = card.title.split(' · ');
  return parts[parts.length - 1];
}

// ── P1-6: Build Recipient pages (20 recipient pages under /recipient/*.html) ─
function buildRecipientPages(allCards) {
  ensureDir(RECIPIENT_DIR);
  let built = 0;
  for (const rec of RECIPIENT_PAGES) {
    const subset = allCards.filter(c => getRecipientOf(c) === rec.match);
    if (subset.length === 0) continue;
    // Build chip nav of ALL 20 recipients
    const chips = RECIPIENT_PAGES.map(r => `<a href="/recipient/${r.slug}.html" class="chip${r.slug === rec.slug ? ' active' : ''}">${r.label}</a>`).join('\n      ');
    const html = generateCollectionPage({
      slug: 'recipient/' + rec.slug,
      label: rec.label,
      metaDesc: rec.meta,
      activeKey: 'recipient',
      breadcrumb: `<a href="/">Home</a> / Recipients / <strong>${rec.label}</strong>`,
      cardSubset: subset,
      extraHtml: `<div class="chip-row">${chips}</div>`,
      showCats: true,
    }, allCards, allCards);
    const outPath = path.join(RECIPIENT_DIR, `${rec.slug}.html`);
    fs.writeFileSync(outPath, html, 'utf-8');
    built++;
  }
  return built;
}

// ── P1-7: Build Style pages (5 style pages under /style/*.html) ──────────────
function buildStylePages(allCards) {
  ensureDir(STYLE_DIR);
  let built = 0;
  for (const s of STYLE_PAGES) {
    const subset = allCards.filter(c => c.style === s.style);
    if (subset.length === 0) continue;
    const chips = STYLE_PAGES.map(r => `<a href="/style/${r.slug}.html" class="chip${r.slug === s.slug ? ' active' : ''}">${r.label}</a>`).join('\n      ');
    const html = generateCollectionPage({
      slug: 'style/' + s.slug,
      label: s.label,
      metaDesc: s.meta,
      activeKey: 'style',
      breadcrumb: `<a href="/">Home</a> / Styles / <strong>${s.label}</strong>`,
      cardSubset: subset,
      extraHtml: `<div class="chip-row">${chips}</div>`,
      showCats: true,
    }, allCards, allCards);
    const outPath = path.join(STYLE_DIR, `${s.slug}.html`);
    fs.writeFileSync(outPath, html, 'utf-8');
    built++;
  }
  return built;
}

// ── P1-8: Build Hub pages (Trending / Latest / Holiday Calendar) ─────────────
function buildHubPages(allCards) {
  let built = 0;

  // 1. Trending: mix weighted random from top categories + styles
  const trending = [...allCards];
  shuffleArray(trending);
  // Weight: romantic, cheerful, elegant styles get +2x pick chance; take 160
  const weighted = [];
  const styleBoost = new Set(['romantic', 'cheerful', 'elegant', 'warm']);
  for (const c of trending) {
    weighted.push(c);
    if (styleBoost.has(c.style)) { weighted.push(c); weighted.push(c); }
  }
  shuffleArray(weighted);
  const trendingUnique = [];
  const seen = new Set();
  for (const c of weighted) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    trendingUnique.push(c);
    if (trendingUnique.length >= 160) break;
  }
  const trendingHtml = generateCollectionPage({
    slug: 'trending', label: '🔥 Trending Now',
    metaDesc: HUB_PAGES[0].meta, activeKey: 'trending',
    breadcrumb: 'Hub / <strong>Trending</strong>',
    cardSubset: trendingUnique,
    extraHtml: `<p class="page-subtitle" style="margin-top:-0.3rem;margin-bottom:1.5rem;">Updated daily — the most-loved and most-shared cards on SendAFun this week.</p>`,
    showCats: true,
  }, trendingUnique, allCards);
  fs.writeFileSync(path.join(DIST_DIR, 'trending.html'), trendingHtml, 'utf-8');
  console.log(`  🔥  Hub: Trending Now → trending.html (${trendingUnique.length})`);
  built++;

  // 2. Latest: reverse order of cards-config (latest appended = last 160)
  const latest = allCards.slice(-160).reverse();
  const latestHtml = generateCollectionPage({
    slug: 'latest', label: '✨ Latest Cards',
    metaDesc: HUB_PAGES[1].meta, activeKey: 'latest',
    breadcrumb: 'Hub / <strong>Latest</strong>',
    cardSubset: latest,
    extraHtml: `<p class="page-subtitle" style="margin-top:-0.3rem;margin-bottom:1.5rem;">Fresh designs just uploaded. New cards drop every week — check back often!</p>`,
    showCats: true,
  }, latest, allCards);
  fs.writeFileSync(path.join(DIST_DIR, 'latest.html'), latestHtml, 'utf-8');
  console.log(`  ✨  Hub: Latest Cards → latest.html (${latest.length})`);
  built++;

  // 3. Holiday Calendar: monthly cards + holiday grid
  const holidayCards = {};
  for (const h of HOLIDAY_DATA) {
    if (h.category && CATEGORY_LABELS[h.category]) {
      holidayCards[h.name] = allCards.filter(c => c.category === h.category).slice(0, 20);
    } else {
      holidayCards[h.name] = allCards.slice(0, 8);
    }
  }
  const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const holidayGridHtml = `<div class="holiday-grid">
    ${HOLIDAY_DATA.map(h => `<div class="holiday-card">
      <div class="holiday-date">${monthName[h.month-1]} ${h.day}</div>
      <div class="holiday-name">${h.name}</div>
      <a class="holiday-btn" href="/category/${h.category}.html">Browse ${CATEGORY_LABELS[h.category] || 'Holiday'} cards →</a>
    </div>`).join('\n    ')}
  </div>`;
  // Show all-holiday mixed grid (20 from each category)
  const holidayAll = [];
  for (const list of Object.values(holidayCards)) {
    for (const c of list) if (!holidayAll.includes(c)) holidayAll.push(c);
  }
  shuffleArray(holidayAll);
  const holidayHtml = generateCollectionPage({
    slug: 'holidays', label: '📅 2026 Holiday Calendar',
    metaDesc: HUB_PAGES[2].meta, activeKey: 'holidays',
    breadcrumb: 'Hub / <strong>Holiday Calendar</strong>',
    cardSubset: holidayAll,
    extraHtml: `<div class="extra-section"><h2 style="font-size:1.35rem;margin-bottom:0.6rem;color:#1a202c;">Upcoming holidays this year</h2><p class="page-subtitle" style="margin-bottom:1.2rem;">Never miss a date — click any holiday to jump straight to ready-made card templates.</p>${holidayGridHtml}</div>`,
    showCats: true,
  }, holidayAll, allCards);
  fs.writeFileSync(path.join(DIST_DIR, 'holidays.html'), holidayHtml, 'utf-8');
  console.log(`  📅  Hub: Holiday Calendar → holidays.html (${HOLIDAY_DATA.length} holidays, ${holidayAll.length} mixed cards)`);
  built++;

  return built;
}

// ── P1-9: Message Generator page (100% client-side) ─────────────────────────
function generateMessageGeneratorPage() {
  // Serialize MSG_TEMPLATES into page-injected JSON (rendered once at build time)
  const templatesJson = JSON.stringify(MSG_TEMPLATES).replace(/</g, '\\u003c');
  const recipients = ['Best Friend','Her','Him','Mom','Dad','Wife','Husband','Girlfriend','Boyfriend','Partner','Sister','Brother','Teacher','Coworker','Family','Boss','Neighbor','Hostess'];
  const occasions = [
    ['birthday','🎂 Birthday'],['anniversary','💍 Anniversary'],['love','❤️ Love & Romance'],
    ['thanks','🙏 Thank You'],['graduation','🎓 Graduation'],['congratulations','🎉 Congratulations'],
    ['get-well','🤒 Get Well'],['sympathy','🕯️ Sympathy'],['new-baby','👶 New Baby'],
    ['generic','💌 Just Because']
  ];
  const tones = [
    ['warm','Warm & Sincere'],['funny','Funny & Playful'],['romantic','Romantic'],
    ['short','Short & Sweet'],['formal','Formal & Elegant']
  ];
  const recipientsJson = JSON.stringify(recipients);
  const occasionsJson  = JSON.stringify(occasions);
  const tonesJson      = JSON.stringify(tones);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" content="#ffffff">
<meta name="description" content="Free blessing & greeting message generator. Generate heartfelt card messages by occasion, recipient, and tone — one click to copy.">
<link rel="canonical" href="https://sendafun.com/message-generator.html">
<title>Message Generator — Write Perfect Greetings | SendAFun</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Inter',sans-serif; background:#f7f5f0; color:#1a202c; }
.header { background:#fff; border-bottom:1px solid #e2e8f0; padding:0.9rem 2rem; position:sticky; top:0; z-index:10; }
.header-inner { max-width:1100px; margin:0 auto; display:flex; align-items:center; gap:2rem; flex-wrap:wrap; }
.logo { text-decoration:none; color:#2d6a4f; font-size:1.15rem; font-weight:700; letter-spacing:-0.02em; white-space:nowrap; }
.logo span { color:#48bb78; }
.nav-links { display:flex; gap:0.5rem; flex-wrap:wrap; }
.nav-link { text-decoration:none; color:#4a5568; font-size:0.82rem; padding:0.35rem 0.75rem; border-radius:20px; transition:all 0.2s; white-space:nowrap; }
.nav-link:hover { background:#edf2f7; }
.nav-link.active { background:#2d6a4f; color:#fff; }
.main { max-width:1040px; margin:0 auto; padding:2rem; }
.page-title { font-size:2.2rem; font-weight:700; margin-bottom:0.4rem; letter-spacing:-0.01em; }
.page-subtitle { font-size:1.05rem; color:#718096; margin-bottom:2rem; max-width:720px; }
.tool { background:#fff; border-radius:14px; padding:1.6rem 1.8rem; box-shadow:0 2px 12px rgba(0,0,0,0.06); margin-bottom:1.5rem; }
.grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; }
.field label { display:block; font-size:0.78rem; color:#4a5568; font-weight:500; margin-bottom:0.35rem; }
.field input, .field select { width:100%; padding:0.6rem 0.8rem; border:1px solid #e2e8f0; border-radius:9px; font-size:0.92rem; font-family:inherit; background:#fafbfc; transition:all 0.15s; }
.field input:focus, .field select:focus { outline:none; border-color:#2d6a4f; background:#fff; box-shadow:0 0 0 3px rgba(45,106,79,0.1); }
.actions { display:flex; gap:0.7rem; margin:1.3rem 0 0.5rem; }
.btn-primary { padding:0.7rem 1.3rem; background:#2d6a4f; color:#fff; border:none; border-radius:10px; font-size:0.92rem; font-weight:600; cursor:pointer; transition:all 0.15s; font-family:inherit; }
.btn-primary:hover { background:#23553f; }
.btn-secondary { padding:0.7rem 1.3rem; background:#edf2f7; color:#2d3748; border:none; border-radius:10px; font-size:0.92rem; font-weight:500; cursor:pointer; font-family:inherit; }
.btn-secondary:hover { background:#dbe3ec; }
.msg-list { display:flex; flex-direction:column; gap:0.9rem; margin-top:0.5rem; }
.msg-card { background:#fafbfc; border:1px solid #edf2f7; border-radius:11px; padding:1.1rem 1.25rem; position:relative; transition:all 0.2s; }
.msg-card:hover { border-color:#c8e6d3; background:#f4fbf7; }
.msg-text { font-size:0.98rem; line-height:1.6; color:#2d3748; margin-bottom:0.7rem; white-space:pre-wrap; }
.msg-actions { display:flex; gap:0.5rem; align-items:center; }
.copy-btn { font-size:0.78rem; padding:0.3rem 0.8rem; background:#fff; border:1px solid #cbd5e0; border-radius:7px; cursor:pointer; color:#2d6a4f; font-weight:500; font-family:inherit; transition:all 0.15s; }
.copy-btn:hover { background:#2d6a4f; color:#fff; border-color:#2d6a4f; }
.copy-btn.copied { background:#2d6a4f; color:#fff; border-color:#2d6a4f; }
.hint { font-size:0.8rem; color:#718096; margin-top:1.2rem; }
.explore-block { margin-top:2rem; }
@media (max-width:768px) {
  .main { padding:1.2rem 1rem 2.5rem; }
  .page-title { font-size:1.6rem; }
  .grid-3 { grid-template-columns:1fr; gap:0.8rem; }
  .tool { padding:1.2rem; }
}
</style>
</head>
<body>
<header class="header">
  <div class="header-inner">
    <a href="/" class="logo">Send<span>A</span>Fun</a>
    <nav class="nav-links">
      ${buildTopNav('messages')}
    </nav>
  </div>
</header>
<main class="main">
  <h1 class="page-title">✍️  Message Generator</h1>
  <p class="page-subtitle">Stuck on what to write? Generate heartfelt, funny, or romantic greeting card messages in one click. Pick the occasion, recipient, and tone — we'll do the rest.</p>
  <div class="tool">
    <div class="grid-3">
      <div class="field">
        <label>Occasion</label>
        <select id="occasion">${occasions.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>Recipient's name</label>
        <input type="text" id="name" placeholder="e.g. Sarah, Mom, John" maxlength="30" value="Sarah">
      </div>
      <div class="field">
        <label>Tone</label>
        <select id="tone">${tones.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select>
      </div>
    </div>
    <div class="actions">
      <button class="btn-primary" id="genBtn">✨ Generate 5 messages</button>
      <button class="btn-secondary" id="rerollBtn">🎲 Shuffle</button>
    </div>
    <p class="hint">Tip: If you know how many years (wedding / work anniversary), add it in the name field like "Sarah (10 years)".</p>
  </div>
  <div id="output" class="msg-list"></div>
</main>
${buildFooter()}
<script>
(function(){
'use strict';
const TEMPLATES = ${templatesJson};
const EXTRA = {
  funny: [
    "To {{name}}: I wanted to write something profound… but then I remembered we're both weirdos. Happy whatever! 🤪",
    "{{name}} — another year of you not being the worst roommate/partner/friend. Cheers! 🍻",
    "Dear {{name}}: You're almost as great as I tell people you are. Kidding. You're better. Don't tell anyone I said that.",
    "Happy Birthday {{name}}! Sorry I forgot again. This card is totally from March. 🙃",
  ],
  short: [
    "Love you, {{name}}.",
    "Thinking of you today, {{name}}.",
    "So grateful for you, {{name}}.",
    "Happy everything, {{name}}. 💛",
  ],
  formal: [
    "Dear {{name}}, please accept my warmest wishes on this special occasion.",
    "Wishing you every happiness, {{name}}. With sincere regards.",
    "Dear {{name}}: sending you heartfelt congratulations and best wishes for the future.",
  ],
  graduation: [
    "Congratulations, {{name}}! You did the thing — all the late nights, coffee, and sheer stubbornness paid off. The world better watch out.",
    "To the graduate {{name}} — here's to the next chapter. Can't wait to see all the incredible things you'll do. 🎓",
  ],
  congratulations: [
    "🎉 Congratulations, {{name}}! You earned every bit of this. So proud of you!",
    "Well done, {{name}}! This is just the beginning of all the great things coming your way.",
  ],
  'get-well': [
    "Sending you all the love and speedy-recovery vibes, {{name}}. Take it easy — we miss you!",
    "Get well soon, {{name}}. Rest up, drink tea, and let the healing begin. 💛",
  ],
  sympathy: [
    "With deepest sympathy, {{name}}. Holding you and your family in my heart during this difficult time.",
    "Thinking of you, {{name}}. So sorry for your loss. Sending love and strength.",
  ],
  'new-baby': [
    "👶 Welcome to the world, little one! And huge congratulations {{name}} — you're going to be amazing parents.",
    "A tiny human has arrived! Congratulations {{name}}. So much love for your growing family.",
  ],
};
const $ = id => document.getElementById(id);
const out = $('output');
function pick(arr, n){
  const c = [...arr];
  const res = [];
  while (res.length < n && c.length > 0) {
    const i = Math.floor(Math.random()*c.length);
    res.push(c.splice(i,1)[0]);
  }
  return res;
}
function resolve(tpl, name, years) {
  let s = tpl.replace(/\{\{name\}\}/g, name || 'there');
  if (years) s = s.replace(/\{\{years\}\}/g, years);
  else s = s.replace(/\{\{years\}\}/g, 'so many wonderful');
  return s;
}
function generate(){
  const occ = $('occasion').value;
  const name = $('name').value.trim();
  const tone = $('tone').value;
  const yearMatch = name.match(/\((\d+)\s*year/i) || name.match(/(\d+)\s*yr/i);
  const years = yearMatch ? yearMatch[1] : null;
  const pureName = name.replace(/\s*\([^)]*\)\s*/g, '').trim();

  // build pool
  let pool = [];
  // Primary: occasion-keyed
  if (TEMPLATES[occ]) pool = pool.concat(TEMPLATES[occ]);
  if (EXTRA[occ])     pool = pool.concat(EXTRA[occ]);
  // Tone boosts
  if (tone === 'funny' && EXTRA.funny)  pool = pool.concat(EXTRA.funny, EXTRA.funny);
  if (tone === 'short' && EXTRA.short)  pool = pool.concat(EXTRA.short, TEMPLATES.generic.slice(0,2));
  if (tone === 'formal'&& EXTRA.formal) pool = pool.concat(EXTRA.formal);
  if (tone === 'romantic') pool = pool.concat(TEMPLATES.love, TEMPLATES.anniversary.slice(0,2));
  if (tone === 'warm')   pool = pool.concat(TEMPLATES.generic, TEMPLATES.thanks.slice(0,2));
  // Fallback
  if (pool.length === 0) pool = TEMPLATES.generic.slice();

  const picks = pick(pool, 5);
  const cards = picks.map((t, i) => {
    const text = resolve(t, pureName, years);
    return \`<div class="msg-card">
      <div class="msg-text">\${text}</div>
      <div class="msg-actions">
        <button class="copy-btn" data-idx="\${i}">📋 Copy</button>
      </div>
    </div>\`;
  }).join('');
  out.innerHTML = cards;
  // Bind copy
  out.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async function(){
      const card = btn.closest('.msg-card');
      const txt = card.querySelector('.msg-text').innerText;
      try {
        await navigator.clipboard.writeText(txt);
        btn.textContent = '✅ Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '📋 Copy'; btn.classList.remove('copied'); }, 1800);
      } catch(e) {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        btn.textContent = '✅ Copied!'; btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '📋 Copy'; btn.classList.remove('copied'); }, 1800);
      }
    });
  });
}
$('genBtn').addEventListener('click', generate);
$('rerollBtn').addEventListener('click', generate);
document.addEventListener('DOMContentLoaded', generate);
})();
</script>
${buildCookieConsent()}
</body>
</html>`;
}

function generateRobotsTxt() {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    '# SendAFun robots.txt — last generated ' + today,
    '',
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /checkout/',
    '',
    '# Policy pages required for search engine trust',
    'Allow: /privacy.html',
    'Allow: /terms.html',
    'Allow: /about.html',
    'Allow: /contact.html',
    'Allow: /cookies.html',
    '',
    '# Sitemaps',
    'Sitemap: https://sendafun.com/sitemap.xml',
    '',
  ];
  const outPath = path.join(DIST_DIR, 'robots.txt');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  return outPath;
}

function generateSitemap(allCards, categories) {
  const today = new Date().toISOString().slice(0, 10);
  let xml = '';
  xml += '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

  // ── 1. Homepage
  xml += `  <url>\n`;
  xml += `    <loc>https://sendafun.com/</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>weekly</changefreq>\n`;
  xml += `    <priority>1.0</priority>\n`;
  xml += `  </url>\n`;

  // ── 2. Policy pages (P0 for AdSense trust)
  const policyPriorityMap = { 'privacy': 0.3, 'terms': 0.3, 'about': 0.5, 'contact': 0.4, 'cookies': 0.3 };
  for (const slug of Object.keys(POLICY_PAGES)) {
    xml += `  <url>\n`;
    xml += `    <loc>https://sendafun.com/${slug}.html</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>${policyPriorityMap[slug] || 0.3}</priority>\n`;
    xml += `  </url>\n`;
  }

  // ── 2b. Hub pages + Message Generator (P1)
  const hubPriorityMap = { 'trending': 0.92, 'latest': 0.9, 'holidays': 0.93, 'message-generator': 0.9 };
  for (const hub of HUB_PAGES) {
    xml += `  <url>\n`;
    xml += `    <loc>https://sendafun.com/${hub.slug}.html</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>${hubPriorityMap[hub.slug] || 0.9}</priority>\n`;
    xml += `  </url>\n`;
  }
  xml += `  <url>\n`;
  xml += `    <loc>https://sendafun.com/message-generator.html</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>weekly</changefreq>\n`;
  xml += `    <priority>${hubPriorityMap['message-generator']}</priority>\n`;
  xml += `  </url>\n`;
  xml += `  <url>\n`;
  xml += `    <loc>https://sendafun.com/pricing.html</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>monthly</changefreq>\n`;
  xml += `    <priority>0.92</priority>\n`;
  xml += `  </url>\n`;

  // ── 3. Category pages
  for (const cat of Object.keys(categories || CATEGORY_LABELS)) {
    xml += `  <url>\n`;
    xml += `    <loc>https://sendafun.com/category/${cat}.html</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  }

  // ── 3b. Recipient aggregate pages (20) + Style aggregate pages (5) — P1 SEO traffic pages
  for (const r of RECIPIENT_PAGES) {
    xml += `  <url>\n`;
    xml += `    <loc>https://sendafun.com/recipient/${r.slug}.html</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.82</priority>\n`;
    xml += `  </url>\n`;
  }
  for (const s of STYLE_PAGES) {
    xml += `  <url>\n`;
    xml += `    <loc>https://sendafun.com/style/${s.slug}.html</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  }

  // ── 3c. P2 How-to guide pages (25) + /faq + /blog = 27 SEO pages
  for (const cat of Object.keys(CATEGORY_LABELS)) {
    xml += `  <url>\n`;
    xml += `    <loc>https://sendafun.com/guide/${cat}.html</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.88</priority>\n`;
    xml += `  </url>\n`;
  }
  xml += `  <url>\n`;
  xml += `    <loc>https://sendafun.com/faq.html</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>monthly</changefreq>\n`;
  xml += `    <priority>0.7</priority>\n`;
  xml += `  </url>\n`;
  xml += `  <url>\n`;
  xml += `    <loc>https://sendafun.com/blog.html</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>weekly</changefreq>\n`;
  xml += `    <priority>0.85</priority>\n`;
  xml += `  </url>\n`;

  // ── 4. Card detail pages (3,877) — include og image for image SEO
  if (allCards && allCards.length) {
    for (const c of allCards) {
      const img = c.bgImageWatermark || c.bgImage || '';
      xml += `  <url>\n`;
      xml += `    <loc>https://sendafun.com/card/${c.slug}.html</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.6</priority>\n`;
      if (img) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${img}</image:loc>\n`;
        const title = (c.title || '').replace(/[<>&]/g, ch => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[ch]));
        xml += `      <image:title>${title}</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    }
  }

  xml += '</urlset>\n';

  const outPath = path.join(DIST_DIR, 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf-8');
  return outPath;
}

// ── Run ──────────────────────────────────────────────────────────────────────
build();