#!/usr/bin/env node
/**
 * Batch-validate: for a sample of N cards, verify that
 *  card.bgImage (cards-config.json) === state.bgImg.src actual assignment in dist HTML
 *  AND that the URL category directory matches the card's category.
 */
const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const CONFIG     = JSON.parse(fs.readFileSync(path.join(ROOT, 'source', 'cards-config.json'), 'utf-8'));
const DIST_CARD  = path.join(ROOT, 'dist', 'card');

const cards = CONFIG.cards || [];

// 每个分类抽 4 张
const byCat = {};
for (const c of cards) {
  (byCat[c.category] = byCat[c.category] || []).push(c);
}
function seededShuffle(arr, seed) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const samples = [];
for (const cat of Object.keys(byCat).sort()) {
  const pool = byCat[cat].slice();
  seededShuffle(pool, cat.length * 31 + 7);
  samples.push(...pool.slice(0, 4));
}
console.log(`\n=== Sample size: ${samples.length} cards (4 from each of ${Object.keys(byCat).length} categories) ===\n`);

// Init 行的精确正则：
// state.bgImg.src = 'https://...' || 'https://placehold.co/600x800/1a1a2e/ffffff?text=SendAFun';
const RE = /state\.bgImg\.src\s*=\s*'([^']+)'\s*\|\|\s*'https:\/\/placehold/;

const mismatches = [];
for (const card of samples) {
  const htmlPath = path.join(DIST_CARD, `${card.slug}.html`);
  if (!fs.existsSync(htmlPath)) {
    mismatches.push({ cat: card.category, slug: card.slug.slice(0, 70), reason: 'MISSING_HTML',
      expected: card.bgImage.slice(-60), actual: null });
    continue;
  }
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const m = html.match(RE);
  if (!m) {
    mismatches.push({ cat: card.category, slug: card.slug.slice(0, 70), reason: 'NO_INIT_MATCH',
      expected: card.bgImage.slice(-60), actual: null });
    continue;
  }
  const actual = m[1];
  if (actual !== card.bgImage) {
    mismatches.push({ cat: card.category, slug: card.slug.slice(0, 70), reason: 'BG_MISMATCH',
      expected: card.bgImage.slice(-60), actual: actual.slice(-60) });
    continue;
  }
  // Category directory check: second path segment must equal card.category
  // e.g. https://<cdn>/christmas/christmas-pexels-10520454-vertical.webp
  const rel = actual.replace(/^https?:\/\//, '');  // drop protocol
  const parts = rel.split('/');
  const urlCat = parts[1] || '???';
  if (urlCat !== card.category) {
    mismatches.push({ cat: card.category, slug: card.slug.slice(0, 70), reason: 'CATEGORY_DIR_MISMATCH',
      expected: card.category, actual: urlCat });
  }
}

console.log(`Samples checked : ${samples.length}`);
console.log(`Mismatches      : ${mismatches.length}`);
console.log('');
if (mismatches.length === 0) {
  console.log('✅  100% 全部匹配 — 每一张卡 cards-config.bgImage 与 dist HTML 的 init() state.bgImg.src 赋值完全一致');
  console.log('✅  100% 分类目录匹配 — URL 中的 {category}/ 目录名与 card.category 字段一致');
} else {
  console.log('❌  存在不匹配！详情如下：\n');
  mismatches.slice(0, 30).forEach(m => {
    console.log(`  [${m.cat.padEnd(20)}] ${m.slug}`);
    console.log(`    Reason  : ${m.reason}`);
    console.log(`    Expected: ...${m.expected}`);
    if (m.actual) console.log(`    Actual  : ...${m.actual}`);
    console.log('');
  });
}

// 额外抽 10 张：打印分类名 + URL 目录 + 末尾 55 字符 直观校验
console.log('\n--- 直观抽 10 张：卡片分类 vs URL 分类 vs URL 末尾 55 字符 ---');
const extra = samples.slice(0, Math.min(10, samples.length));
for (const card of extra) {
  const html = fs.readFileSync(path.join(DIST_CARD, `${card.slug}.html`), 'utf-8');
  const m = html.match(RE);
  if (!m) continue;
  const url = m[1];
  const urlCat = url.split('/')[4] || '???';  // 0:https:,1:,2:,3:<cdn>,4:category
  const mark = urlCat === card.category ? '✅' : '❌';
  console.log(`  ${mark} card.category=${card.category.padEnd(20)}  URL.category=${urlCat.padEnd(20)}  tail=${url.slice(-55)}`);
}
console.log('');
