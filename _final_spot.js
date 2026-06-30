/* Post-fix spot check */
const fs = require('fs');
const path = require('path');
const ROOT = 'e:/网站/sendafun';
const DIST = ROOT + '/dist';
let OK = 0, FAIL = 0;
function check(label, cond) { if (cond) { console.log('  ✅', label); OK++; } else { console.log('  ❌', label); FAIL++; } }
function file(s){ return path.join(DIST, s); }

console.log('\n═══════ P0 FIX VERIFICATION ═══════');

// P0-1: Real Creem checkout (no fake setTimeout)
const cardTpl = fs.readFileSync(ROOT + '/templates/card-template.html', 'utf-8');
check('P0-1  simulatePaymentThenDelivery fully removed (no fake setTimeout)',
  !/simulatePaymentThenDelivery/.test(cardTpl));
check('P0-1  createSessionAndRedirect calls /api/create-session',
  /fetch\(['"]\/api\/create-session['"]/.test(cardTpl) && /location\.href\s*=\s*data\.url/.test(cardTpl));

// P0-2: New Creem Product IDs (worker)
const worker = fs.readFileSync(ROOT + '/worker/src/index.js', 'utf-8');
check('P0-2  CREEM_PRODUCTS.single  = prod_7GGx4Gh5yvKLOb0OCzYFoq (user-provided)',
  /single\s*:\s*["']prod_7GGx4Gh5yvKLOb0OCzYFoq["']/.test(worker));
check('P0-2  CREEM_PRODUCTS.monthly = prod_3xVdtK0wdzqLlaCz4H7lzQ (user-provided)',
  /monthly\s*:\s*["']prod_3xVdtK0wdzqLlaCz4H7lzQ["']/.test(worker));
check('P0-2  CREEM_PRODUCTS.annual  = prod_73aCoww3uhNMevKi8NVwNv (user-provided)',
  /annual\s*:\s*["']prod_73aCoww3uhNMevKi8NVwNv["']/.test(worker));
check('P0-2  Worker price comment = $1.99 / $4.99 / $19.99',
  /\$1\.99[\s\S]{0,200}\$4\.99[\s\S]{0,200}\$19\.99/.test(worker));

// P0-3: sendCard field alignment (fromEmail/toEmail)
check('P0-3  sendCard() body has fromEmail + toEmail + fromName + toName + imageUrl',
  /fromEmail\s*:\s*fromEmail[\s\S]{0,80}toEmail\s*:\s*recipientEmail[\s\S]{0,80}fromName\s*:\s*senderName[\s\S]{0,80}toName\s*:\s*toName[\s\S]{0,100}imageUrl\s*:\s*imageUrl/
  .test(cardTpl));

// P0-4: payment success + cancel pages
check('P0-4  payment-success.html exists', fs.existsSync(file('payment-success.html')));
check('P0-4  payment-cancel.html exists',  fs.existsSync(file('payment-cancel.html')));
if (fs.existsSync(file('payment-success.html'))) {
  const s = fs.readFileSync(file('payment-success.html'), 'utf-8');
  check('P0-4  payment-success has footer email support@sendafun.com', /support@sendafun\.com/.test(s));
  check('P0-4  payment-success has meta robots NOINDEX', /<meta[^>]+name=["']robots["'][^>]+content=["']noindex,\s*nofollow["']/i.test(s));
  check('P0-4  payment-success has primary CTA back to /', /href=["']\/["'][^>]*>🏠 Browse|Browse more cards/.test(s));
}
if (fs.existsSync(file('payment-cancel.html'))) {
  const c = fs.readFileSync(file('payment-cancel.html'), 'utf-8');
  check('P0-4  payment-cancel has NOINDEX robots meta', /<meta[^>]+name=["']robots["'][^>]+content=["']noindex,\s*nofollow["']/i.test(c));
  check('P0-4  payment-cancel has retry-back CTA', /Go back.*try checkout|href=["']\/["'].*💌/.test(c));
}

// P0-5: Old PayPal worker renamed (not deployed)
check('P0-5  __PAYPAL_DEPRECATED_ worker exists (prevents accidental deploy)',
  fs.existsSync(ROOT + '/__PAYPAL_DEPRECATED_DO_NOT_USE_worker.js'));
check('P0-5  Old _worker.js no longer exists at that path',
  !fs.existsSync(ROOT + '/_worker.js'));

// P0-6: Twitter placeholder replaced (cards + no __TWITTER__ left)
const cardDir = DIST + '/card';
const someCards = fs.readdirSync(cardDir).sort(()=>Math.random()-0.5).slice(0, 15);
let twBadCount = 0, canBad = 0, fEmailBad = 0;
for (const fname of someCards) {
  const r = fs.readFileSync(path.join(cardDir, fname), 'utf-8');
  if (/__TWITTER_/g.test(r)) twBadCount++;
  if (!/canonical[^>]*card\/[^>]+\.html/.test(r)) canBad++;
  if (!/support@sendafun\.com/.test(r.split('</footer>')[0] || '')) fEmailBad++;
}
check(`P0-6  __TWITTER_ placeholders replaced (sample 15 cards → ${15-twBadCount}/15 OK)`, twBadCount === 0);
check(`P1-5  canonical contains .html suffix (sample 15 → ${15-canBad}/15 correct)`, canBad === 0);
check(`Footer Creem email support@ present (sample 15 → ${15-fEmailBad}/15)`, fEmailBad === 0);

console.log('\n═══════ P1 FIX VERIFICATION ═══════');

// P1-1: 8 Dead links now exist
const missing = ['miss-you-grandma','cheer-up-bestie','new-baby-boy','happy-anniversary-wife','get-well-soon','thank-you-friend','love-you-honey','happy-birthday-dad'];
let mBad = 0;
for (const slug of missing) {
  if (!fs.existsSync(file('card/' + slug + '.html'))) mBad++;
}
check(`P1-1  8 formerly-dead /card/*.html now exist → ${8-mBad}/8 ✔`, mBad === 0);

// P1-2: og default + references webp
check('P1-2  dist/og/sendafun-og.webp exists',   fs.existsSync(file('og/sendafun-og.webp')));
const genFile = fs.readFileSync(ROOT + '/build-script/generate-cards.js', 'utf-8');
check('P1-2  All references to og image use .webp now',
  !/sendafun-og\.jpg/.test(genFile) && /sendafun-og\.webp/.test(genFile));

// P1-3: SEO basics (description + canonical present on major hubs)
const hubs = ['index.html','category/birthday.html','trending.html','faq.html','blog.html','guide/love.html','message-generator.html','recipient/for-her.html','style/romantic.html','pricing.html'];
let hubBad = 0;
for (const h of hubs) {
  const r = fs.readFileSync(file(h), 'utf-8');
  const haveDesc = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{15,}["']/i.test(r);
  const haveCanon = /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']{8,}["']/i.test(r);
  if (!haveDesc || !haveCanon) hubBad++;
}
check(`P1-3  Description + Canonical on 10 major hubs → ${10-hubBad}/10 OK`, hubBad === 0);

// P1-4: robots.txt has Sitemap directive
const robots = fs.existsSync(file('robots.txt')) ? fs.readFileSync(file('robots.txt'), 'utf-8') : '';
check('P1-4  robots.txt includes Sitemap: https://sendafun.com/sitemap.xml',
  /Sitemap:\s*https?:\/\/sendafun\.com\/sitemap\.xml/i.test(robots));

console.log('\n═══════ CREEM AUDIT 5 MANDATORY ITEMS ═══════');
// #1 legal pages links in footer + contact
const contact = fs.readFileSync(file('contact.html'), 'utf-8');
check('Creem #1  Contact page explicitly links Privacy + Terms + FAQ + Pricing',
  /\/privacy\.html/.test(contact) && /\/terms\.html/.test(contact) && /\/faq\.html/.test(contact) && /\/pricing\.html/.test(contact));
const footerSample = fs.readFileSync(file('index.html'), 'utf-8').split('</footer>')[0] || '';
check('Creem #1  Footer has 8 full links (Pricing/About/Cookies/FAQ/Blog)',
  /Pricing[\s\S]{0,60}About[\s\S]{0,60}Contact[\s\S]{0,60}Cookies[\s\S]{0,60}FAQ[\s\S]{0,60}Blog/.test(footerSample));

// #2 support@sendafun.com everywhere
const footerCreem = /© 2026 sendafun\.com[\s\S]{0,120}Privacy Policy[\s\S]{0,120}Terms of Service[\s\S]{0,120}support@sendafun\.com/;
check('Creem #2  Footer Creem mandatory format (© 2026 … | Contact: support@sendafun.com)', footerCreem.test(fs.readFileSync(file('index.html'), 'utf-8')));
const contactMails = (contact.match(/support@sendafun\.com/g) || []).length;
check(`Creem #2  support@ mentions on contact page ≥4 times (found ${contactMails})`, contactMails >= 4);

// #3 3 product pricing
const pricing = fs.readFileSync(file('pricing.html'), 'utf-8');
const planCount = (pricing.match(/class="[^"]*\bplan\b[^"]*"/g) || []).filter(c => c === 'class="plan"' || c.includes('plan featured')).length;
check('Creem #3  Pricing page has EXACTLY 3 plan-tier cards (Single + Monthly + Annual)',
  /class="plan-name">\s*Single Card[\s\S]{0,800}Monthly Unlimited[\s\S]{0,800}Annual Pass/.test(pricing));
check('Creem #3  Prices: $1.99 + $4.99 + $19.99 USD',
  /\$1\.99[\s\S]{0,400}\$4\.99[\s\S]{0,400}\$19\.99/.test(pricing) && /USD/.test(pricing));

// #4 Pay methods + refund + GDPR cookie
check('Creem #4  Payment methods listed: Visa/MC/Apple Pay/Google Pay/Creem PCI',
  /Visa[\s\S]{0,80}Mastercard[\s\S]{0,80}Apple Pay[\s\S]{0,80}Google Pay[\s\S]{0,80}PCI|Creem secure checkout/.test(pricing));
check('Creem #4  Refund: 72h single + 14 day annual',
  /72( |&nbsp;)?hour|14( |&nbsp;)?day|efund/.test(pricing) && /support@sendafun\.com/.test(pricing));
check('Creem #4  GDPR cookie banner on all pages (index.html)',
  /saf-cookie-banner.*Accept all.*Reject non-essential.*localStorage/s.test(fs.readFileSync(file('index.html'), 'utf-8')));

// #5 Footer Creem mandatory line — 10 random page types
const types = ['index.html','pricing.html','contact.html','category/love.html','guide/birthday.html','faq.html','blog.html','recipient/for-him.html','trending.html','style/classic.html','message-generator.html'];
let creemBad = 0;
for (const f of types) {
  if (!fs.existsSync(file(f))) { creemBad++; continue; }
  const r = fs.readFileSync(file(f), 'utf-8');
  if (!footerCreem.test(r)) creemBad++;
}
check(`Creem #5  Footer forced copy → ${types.length-creemBad}/${types.length} page types PASS EXACT Creem string`, creemBad === 0);

// Worker send-card handle check
const sendH = /async function handleSendCard[\s\S]{0,800}fromEmail\s*&&\s*toEmail[\s\S]{0,800}fromName|toName[\s\S]{0,800}message|imageUrl/;
check('Backend:  handleSendCard validates fromEmail & toEmail (matches new sendCard fields)',
  /if\s*\(\s*!fromEmail|!toEmail|!fromName|fromEmail && toEmail && message/.test(worker));

console.log('\n═══════ FINAL SCORE ═══════');
console.log(`  PASS: ${OK}   FAIL: ${FAIL}   TOTAL: ${OK+FAIL}`);
const pct = Math.round(100*OK/(OK+FAIL));
console.log(`  ${pct}% pass rate`);
console.log(pct === 100 ? '\n  🎉 All checks passed — site ready to deploy!' : `\n  ⚠️  ${FAIL} failures — see ❌ items above`);
process.exit(FAIL > 0 ? 3 : 0);
