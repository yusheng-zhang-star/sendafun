#!/usr/bin/env node

/**
 * generate-pages.js
 * 批量生成静态HTML页面
 * 读取 card-template.html + data/cards.json → 输出每个卡片的HTML页面
 * 
 * 用法: node scripts/generate-pages.js
 * 输出: output/ 目录下所有HTML
 */

const fs = require('fs');
const path = require('path');

const DOMAIN = 'sendafun.com';

const templatePath = path.join(__dirname, '..', 'templates', 'card-template.html');
const cardsPath = path.join(__dirname, '..', 'data', 'cards.json');
const outputDir = path.join(__dirname, '..', 'output');
const sitemapPath = path.join(outputDir, 'sitemap.xml');

function capitalize(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function loadTemplate() {
  return fs.readFileSync(templatePath, 'utf-8');
}

function loadCards() {
  const raw = fs.readFileSync(cardsPath, 'utf-8');
  return JSON.parse(raw);
}

function renderCard(template, card) {
  return template
    .replace(/\{\{TITLE\}\}/g, card.title)
    .replace(/\{\{META_DESC\}\}/g, card.meta_desc)
    .replace(/\{\{SLUG\}\}/g, card.slug)
    .replace(/\{\{CATEGORY\}\}/g, card.category)
    .replace(/\{\{CATEGORY_DISPLAY\}\}/g, capitalize(card.category))
    .replace(/\{\{RECIPIENT\}\}/g, card.recipient)
    .replace(/\{\{RECIPIENT_DISPLAY\}\}/g, capitalize(card.recipient))
    .replace(/\{\{STYLE_DISPLAY\}\}/g, capitalize(card.style))
    .replace(/\{\{CARD_ID\}\}/g, card.id)
    .replace(/\{\{DEFAULT_MESSAGE\}\}/g, card.message || '')
    .replace(/\{\{IMAGE_SQUARE\}\}/g, card.images.square)
    .replace(/\{\{IMAGE_VERTICAL\}\}/g, card.images.vertical)
    .replace(/\{\{IMAGE_HORIZONTAL\}\}/g, card.images.horizontal)
    .replace(/\{\{DOMAIN\}\}/g, DOMAIN);
}

function generateSitemap(cards) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  // 首页
  xml += `  <url><loc>https://${DOMAIN}/</loc><priority>1.0</priority></url>\n`;
  
  const cats = new Set();
  cards.forEach(c => {
    if (!cats.has(c.category)) {
      cats.add(c.category);
      xml += `  <url><loc>https://${DOMAIN}/category/${c.category}</loc><priority>0.8</priority></url>\n`;
    }
  });
  
  cards.forEach(c => {
    xml += `  <url><loc>https://${DOMAIN}/${c.slug}</loc><priority>0.6</priority></url>\n`;
  });
  
  xml += '</urlset>';
  return xml;
}

function main() {
  console.log('📦 Loading template...');
  const template = loadTemplate();
  
  console.log('📦 Loading cards data...');
  const cards = loadCards();
  console.log(`   Found ${cards.length} cards`);
  
  // 清理输出目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 生成分类页
  const catDir = path.join(outputDir, 'category');
  if (!fs.existsSync(catDir)) fs.mkdirSync(catDir);
  
  const catGroups = {};
  cards.forEach(c => {
    if (!catGroups[c.category]) catGroups[c.category] = [];
    catGroups[c.category].push(c);
  });
  
  Object.keys(catGroups).forEach(cat => {
    const catHtml = generateCategoryPage(cat, catGroups[cat]);
    // Cloudflare Pages 的干净 URL: category/birthday/index.html → /category/birthday/
    const catOutDir = path.join(catDir, cat);
    if (!fs.existsSync(catOutDir)) fs.mkdirSync(catOutDir);
    fs.writeFileSync(path.join(catOutDir, 'index.html'), catHtml);
    console.log(`  ✅ category/${cat}/index.html`);
  });
  
  // 生成每张卡片的页面
  cards.forEach((card, i) => {
    const html = renderCard(template, card);
    const cardDir = path.join(outputDir, card.slug);
    if (!fs.existsSync(cardDir)) fs.mkdirSync(cardDir);
    fs.writeFileSync(path.join(cardDir, 'index.html'), html);
    
    if ((i + 1) % 1000 === 0) {
      console.log(`  ✅ Generated ${i + 1}/${cards.length} pages...`);
    }
  });
  
  console.log(`  ✅ Generated ${cards.length} card pages`);
  
  // 生成 sitemap
  const sitemap = generateSitemap(cards);
  fs.writeFileSync(sitemapPath, sitemap);
  console.log('  ✅ sitemap.xml generated');
  
  // 复制首页
  fs.copyFileSync(
    path.join(__dirname, '..', 'index.html'),
    path.join(outputDir, 'index.html')
  );
  console.log('  ✅ index.html copied');
  
  console.log('\n🎉 Done! Pages are in output/');
  console.log(`   Total: ${cards.length} card pages + ${Object.keys(catGroups).length} category pages`);
  console.log('\n⚠️  Before deploying:');
  console.log('   1. Update DOMAIN in this script');
  console.log('   2. Upload images to R2 first');
  console.log('   3. Copy output/ contents to your repo root');
}

function generateCategoryPage(category, cards) {
  const catDisplay = capitalize(category);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Browse ${cards.length} beautiful ${catDisplay} greeting cards. Personalize and download HD for free." />
  <title>${catDisplay} Cards - Free ${catDisplay} Greeting Cards Online</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    /* Same styles as index.html for consistency */
    :root {
      --bg: #f8f6f3; --card-bg: #ffffff; --text: #1a1a1a;
      --text-muted: #6b6b6b; --accent: #4a7c59; --accent-light: #e8f0e4;
      --border: #e5e5e5; --shadow: 0 2px 12px rgba(0,0,0,0.06);
      --radius: 16px; --radius-sm: 8px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg); color: var(--text); line-height: 1.6;
    }
    nav {
      background: var(--card-bg); border-bottom: 1px solid var(--border);
      padding: 12px 24px; display: flex; align-items: center;
      justify-content: space-between; position: sticky; top: 0; z-index: 100;
    }
    .logo { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-weight: 700; color: var(--accent); text-decoration: none; }
    .nav-links { display: flex; gap: 20px; font-size: 0.9rem; }
    .nav-links a { color: var(--text-muted); text-decoration: none; }
    .breadcrumb { padding: 16px 24px; font-size: 0.85rem; color: var(--text-muted); max-width: 1280px; margin: 0 auto; }
    .breadcrumb a { color: var(--text-muted); text-decoration: none; }
    .page-header { max-width: 1280px; margin: 0 auto; padding: 0 24px 20px; }
    .page-header h1 { font-family: 'Playfair Display', serif; font-size: 2rem; }
    .page-header .count { color: var(--text-muted); }
    .filter-bar { max-width: 1280px; margin: 0 auto; padding: 0 24px 16px; display: flex; gap: 8px; flex-wrap: wrap; }
    .filter-bar a {
      padding: 4px 14px; border: 1px solid var(--border); border-radius: 20px;
      font-size: 0.85rem; color: var(--text-muted); text-decoration: none;
    }
    .filter-bar a:hover { border-color: var(--accent); color: var(--accent); }
    .card-grid {
      max-width: 1280px; margin: 0 auto; padding: 0 24px 40px;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); gap: 16px;
    }
    .card-thumb {
      border-radius: var(--radius-sm); overflow: hidden; box-shadow: var(--shadow);
      background: var(--card-bg); transition: box-shadow 0.2s; text-decoration: none; color: var(--text);
    }
    .card-thumb:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.10); }
    .card-thumb img { width: 100%; aspect-ratio: 4/5; object-fit: cover; display: block; }
    .card-thumb .label { padding: 8px 12px; font-size: 0.85rem; font-weight: 500; }
    footer { border-top: 1px solid var(--border); padding: 32px 24px; text-align: center; font-size: 0.8rem; color: var(--text-muted); }
    footer a { color: var(--text-muted); text-decoration: none; margin: 0 12px; }
  </style>
</head>
<body>
<nav>
  <a href="/" class="logo">SmartCards</a>
  <div class="nav-links"><a href="/">Home</a></div>
</nav>
<div class="breadcrumb"><a href="/">Home</a> &rsaquo; ${catDisplay} Cards</div>
<div class="page-header">
  <h1>${catDisplay} Cards</h1>
  <div class="count">${cards.length} cards</div>
</div>
<div class="filter-bar">
  <a href="/category/${category}">All</a>
  ${[...new Set(cards.map(c => capitalize(c.recipient)))].slice(0, 12).map(r => `<a href="/category/${category}/for-${r.toLowerCase()}">For ${r}</a>`).join('')}
  ${[...new Set(cards.map(c => capitalize(c.style)))].slice(0, 8).map(s => `<a href="/category/${category}?style=${s.toLowerCase()}">${s}</a>`).join('')}
</div>
<div class="card-grid">
  ${cards.slice(0, 48).map(c => `
  <a href="/${c.slug}" class="card-thumb">
    <img src="${c.images.square}" alt="${c.title}" loading="lazy" />
    <div class="label">${c.title}</div>
  </a>`).join('')}
</div>
<footer>
  <a href="/">Home</a>
  <a href="/privacy">Privacy</a>
  <a href="/terms">Terms</a>
  <p style="margin-top:12px">&copy; 2026 SmartCards.</p>
</footer>
</body>
</html>`;
}

main();
