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
  'birthday':       'Birthday',
  'love':           'Love & Romance',
  'thanks':         'Thank You',
  'wellness':       'Get Well',
  'congratulations':'Congratulations',
  'miss-you':       'Miss You',
  'sympathy':       'Sympathy',
  'anniversary':    'Anniversary',
  'new-baby':       'New Baby',
  'encouragement':  'Encouragement',
};

// ── Filter colour for each style (semi-transparent overlay) ──────────────────
const FILTER_COLORS = {
  'warm':          'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,146,60,0.10))',
  'classic':       'linear-gradient(135deg, rgba(0,0,0,0.05), rgba(0,0,0,0.10))',
  'romantic':      'linear-gradient(135deg, rgba(214,40,40,0.08), rgba(237,100,166,0.08))',
  'cheerful':      'linear-gradient(135deg, rgba(236,201,75,0.12), rgba(154,230,180,0.10))',
  'calm':          'linear-gradient(135deg, rgba(56,178,172,0.08), rgba(99,179,237,0.08))',
  'celebratory':   'linear-gradient(135deg, rgba(246,173,85,0.12), rgba(214,40,40,0.06))',
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

// ── Compute file hash (fast SHA-256 of first 64 KB) ─────────────────────────
function fileHash(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    // Read up to 64 KB for a quick but reliable hash
    const fd      = fs.openSync(filePath, 'r');
    const bufSize = Math.min(stat.size, 65536);
    const buffer  = Buffer.alloc(bufSize);
    fs.readSync(fd, buffer, 0, bufSize, 0);
    fs.closeSync(fd);
    return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  } catch { return null; }
}

// ── Check if a card needs regeneration (compared to cache) ───────────────────
function needsRegen(card, cache) {
  const cached = cache.cards[card.slug];
  if (!cached) return true; // new card

  const srcPath = path.join(ROOT, 'source', card.bgImage);
  const srcStat = fs.statSync(srcPath, { throwIfNoEntry: false });
  const srcMtime = srcStat ? srcStat.mtimeMs : 0;

  // Card metadata changed (add/remove a field? JSON re-stringify to check)
  const metaHash = crypto.createHash('sha256')
    .update(JSON.stringify(card))
    .digest('hex').slice(0, 16);

  return (
    cached.metaHash !== metaHash ||
    Math.abs(cached.srcMtime - srcMtime) > 1  // allow 1 ms rounding
  );
}

// ── Ensure a directory exists ────────────────────────────────────────────────
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ── Copy a watermark image (if it exists) ────────────────────────────────────
function copyWatermark(card) {
  const srcRel = card.bgImageWatermark;        // e.g. "images/watermark/foo.webp"
  if (!srcRel) return null;
  const srcPath = path.join(ROOT, 'source', srcRel);
  const dstPath = path.join(WATERMARK_DIR, path.basename(srcRel));
  if (fs.existsSync(srcPath)) {
    ensureDir(path.dirname(dstPath));
    fs.copyFileSync(srcPath, dstPath);
    return dstPath;
  }
  // Source watermark doesn't exist — that's okay, we'll log a warning later
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
    '__CANONICAL_URL__':     `https://sendafun.com/card/${card.slug}`,

    // ── 旧 placeholder（向后兼容，模板已更新为新 placeholder）───
    '__PAGE_TITLE__':       seo.title       || card.title,
    '__OG_TITLE__':         seo.title       || card.title,
    '__OG_IMAGE__':         'https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/' +
                             (seo.og_image || `${card.slug}-og.webp`),
    '__OG_DESC__':          seo.description  || ogDesc,
    '__OG_URL__':           `https://sendafun.com/card/${card.slug}`,

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
      // Compute source image hash
      const srcPath = path.join(ROOT, 'source', card.bgImage);
      const srcStat = fs.statSync(srcPath, { throwIfNoEntry: false });
      const srcMtime = srcStat ? srcStat.mtimeMs : 0;
      const srcHash  = fileHash(srcPath);

      // Generate HTML
      const html = generateCardHtml(card, template, cards);
      const outPath = writeCardHtml(card.slug, html);

      // Copy watermark
      copyWatermark(card);

      // Update cache
      const metaHash = crypto.createHash('sha256')
        .update(JSON.stringify(card))
        .digest('hex').slice(0, 16);

      cache.cards[card.slug] = {
        metaHash,
        srcMtime,
        srcHash,
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
  console.log(`  🏠  Index → ${path.relative(DIST_DIR, INDEX_PATH)}\n`);
}

// ── Generate a category page ──────────────────────────────────────────────────
function generateCategoryPage(cat, label, catCards, allCards) {
  const cardGrid = catCards.map(c => renderCardTile(c)).join('\n      ');
  const navLinks = Object.entries(CATEGORY_LABELS).map(([key, l]) =>
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
<meta property="og:title" content="${label} Cards — SendAFun">
<meta property="og:description" content="Browse our collection of ${label.toLowerCase()} e-cards. Send a personalised card for free!">
<title>${label} Cards — SendAFun</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; background: #f7f5f0; color: #1a202c; }
.header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 1rem 2rem; position: sticky; top: 0; z-index: 10; }
.header-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 2rem; }
.logo { text-decoration: none; color: #2d6a4f; font-size: 1.2rem; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; }
.logo span { color: #48bb78; }
.nav-links { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.nav-link { text-decoration: none; color: #4a5568; font-size: 0.85rem; padding: 0.35rem 0.75rem; border-radius: 20px; transition: all 0.2s; white-space: nowrap; }
.nav-link:hover { background: #edf2f7; }
.nav-link.active { background: #2d6a4f; color: #fff; }
.main { max-width: 1200px; margin: 0 auto; padding: 2rem; }
.page-title { font-size: 2.5rem; font-weight: 700; margin-bottom: 0.5rem; color: #1a202c; }
.page-subtitle { font-size: 1.1rem; color: #718096; margin-bottom: 2rem; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; margin-bottom: 3rem; }
.card-tile { text-decoration: none; color: inherit; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; }
.card-tile:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
.card-tile-img { width: 100%; aspect-ratio: 3/4; object-fit: cover; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; color: #a0aec0; }
.card-tile-info { padding: 1rem; }
.card-tile-title { font-weight: 600; font-size: 1rem; margin-bottom: 0.25rem; color: #2d3748; }
.card-tile-tags { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.card-tile-tag { font-size: 0.7rem; background: #edf2f7; color: #4a5568; padding: 0.15rem 0.5rem; border-radius: 10px; }
@media (max-width: 768px) {
  .header-inner { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
  .nav-links { overflow-x: auto; width: 100%; padding-bottom: 0.5rem; }
  .page-title { font-size: 1.8rem; }
  .card-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; }
}
</style>
</head>
<body>
<header class="header">
  <div class="header-inner">
    <a href="/" class="logo">Send<span>A</span>Fun</a>
    <nav class="nav-links">
      ${navLinks}
    </nav>
  </div>
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
<footer style="text-align:center;padding:2rem;color:#a0aec0;font-size:0.85rem;">
  <p>© ${new Date().getFullYear()} SendAFun — Free personalised e-cards</p>
</footer>
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
    // Pick an icon/emoji per category
    const icons = { birthday:'🎂', love:'💕', thanks:'🙏', wellness:'🌿', congratulations:'🎉', 'miss-you':'💌', sympathy:'🕊️', anniversary:'💍', 'new-baby':'👶', encouragement:'💪' };
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
    { emoji: '👵', text: 'my Grandma', cat: 'miss-you' },
    { emoji: '🎓', text: 'a Graduate', cat: 'congratulations' },
    { emoji: '👶', text: 'a Newborn', cat: 'new-baby' },
    { emoji: '🤒', text: 'Someone Sick', cat: 'wellness' },
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
<meta property="og:image" content="https://sendafun.com/og/sendafun-og.jpg">
<meta property="og:type" content="website">
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
}
</style>
</head>
<body>
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

<footer style="background:#fff;border-top:1px solid #e2e8f0;text-align:center;padding:3rem 2rem;color:#718096;font-size:0.85rem;">
  <p style="font-size:1.5rem;font-weight:700;color:#2d6a4f;margin-bottom:0.5rem;">Send<span style="color:#48bb78;">A</span>Fun</p>
  <p>Free personalised e-cards for every occasion</p>
  <p style="margin-top:1rem;">© ${new Date().getFullYear()} SendAFun. Made with ❤️.</p>
</footer>

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

// ── Run ──────────────────────────────────────────────────────────────────────
build();