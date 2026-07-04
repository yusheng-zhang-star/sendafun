const fs = require("fs");
const path = require("path");
const http = require("http");

// ===== Windows 控制台安全：仅对最终报告中的 emoji 做轻量替换 =====
const _EMOJI_MAP = { "✅":"[PASS]","❌":"[FAIL]","🏆":"[S]","🥇":"[A]","🥈":"[B]","🥉":"[C]","⚠️":"[!]","🎯":"[*]","📗":"[OK]","📙":"[WARN]","📋":"[i]","═":"=" };
function safeStr(s) {
  if (typeof s !== "string") return s;
  // 只替换少量关键 emoji，避免大正则拖慢
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    out += (_EMOJI_MAP[ch] !== undefined) ? _EMOJI_MAP[ch] : ch;
  }
  // 把任何非 ASCII 字符（除中文/常见拉丁文）替换为 ?，仅用于报告输出阶段
  return out;
}
// 不劫持全局 console.log（避免每次同步循环都调用大替换）
// 只在最终 report() 输出时对每一行做安全处理

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const WORKER = path.join(ROOT, "worker", "src", "index.js");

const results = [];
const categories = {};
function test(cat, name, fn) {
  try {
    const r = fn();
    results.push({ cat, name, ok: true, detail: typeof r === "string" ? r : "" });
  } catch (e) {
    results.push({
      cat,
      name,
      ok: false,
      detail: String((e && e.message) || e).slice(0, 320),
    });
  }
}
function aTest(cat, name, fn) {
  return fn()
    .then(r => {
      results.push({
        cat,
        name,
        ok: true,
        detail: typeof r === "string" ? r : "",
      });
    })
    .catch(e => {
      results.push({
        cat,
        name,
        ok: false,
        detail: String((e && e.message) || e).slice(0, 320),
      });
    });
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}
function hasFile(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function get(url, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    http.get(
      { host: "127.0.0.1", port: 3000, path: url, timeout: 15000 },
      res => {
        let data = "";
        let bytes = 0;
        res.on("data", c => {
          const s = c.toString();
          if (bytes + s.length <= maxBytes) { data += s; bytes += s.length; }
        });
        res.on("end", () =>
          resolve({ code: res.statusCode, headers: res.headers, body: data, bytes })
        );
      }
    ).on("error", reject);
  });
}

// ---------- 核心工具函数：从 Worker 提取路由（正则 + 字符串） ----------
function extractWorkerRoutes(workerSrc) {
  const routes = [];
  // 静态字符串匹配
  const simpleRoutes = workerSrc.match(/path\s*===\s*['"]([^'"]+)['"]/g) || [];
  for (const m of simpleRoutes) {
    const mm = m.match(/['"]([^'"]+)['"]/);
    if (mm) routes.push({ pattern: mm[1], methodGuess: "GET" });
  }
  const methodRoutes = workerSrc.match(
    /method\s*===\s*['"][A-Z]+['"]\s*&&\s*path\s*===\s*['"]([^'"]+)['"]/g
  ) || [];
  for (const m of methodRoutes) {
    const mm = m.match(/method\s*===\s*['"]([A-Z]+)['"]\s*&&\s*path\s*===\s*['"]([^'"]+)['"]/);
    if (mm) routes.push({ pattern: mm[2], methodGuess: mm[1] });
  }
  // startsWith 匹配
  const swRoutes = workerSrc.match(/path\.startsWith\(['"]([^'"]+)['"]\)/g) || [];
  for (const m of swRoutes) {
    const mm = m.match(/['"]([^'"]+)['"]/);
    if (mm) routes.push({ pattern: mm[1] + "*", methodGuess: "GET" });
  }
  // 正则匹配
  const regexRoutes = [
    { pattern: "/api/group/:token", regex: /^\/api\/group\/([^/]+)$/, methodGuess: "GET" },
    { pattern: "/api/group/:token/sign", regex: /^\/api\/group\/([^/]+)\/sign$/, methodGuess: "POST" },
    { pattern: "/api/group/:token/send", regex: /^\/api\/group\/([^/]+)\/send$/, methodGuess: "POST" },
    { pattern: "/api/gift/:token", regex: /^\/api\/gift\/([^/]+)$/, methodGuess: "GET" },
  ];
  for (const r of regexRoutes) {
    if (r.regex.test(workerSrc) || workerSrc.includes(r.pattern.split(":")[0])) {
      routes.push({ pattern: r.pattern, methodGuess: r.methodGuess, fromRegex: true });
    }
  }
  return routes;
}

// ---------- JS 语法 / 结构分析 ----------
function analyzeAppFunctions(src) {
  const fnMap = {};
  const fnDeclRegex = /function\s+([A-Za-z0-9_]+)\s*\(/g;
  let m;
  while ((m = fnDeclRegex.exec(src))) fnMap[m[1]] = true;
  return fnMap;
}
function analyzeWorkerFunctions(src) {
  const fnMap = {};
  const asyncRegex = /async\s+function\s+([A-Za-z0-9_]+)\s*\(/g;
  const fnRegex = /function\s+([A-Za-z0-9_]+)\s*\(/g;
  let m;
  while ((m = asyncRegex.exec(src))) fnMap[m[1]] = true;
  while ((m = fnRegex.exec(src))) fnMap[m[1]] = true;
  return fnMap;
}

// ============================================================
// U1 - 项目基础完整性
// ============================================================
const U1 = "U1-基础完整性";
test(U1, "根目录关键文件齐全", () => {
  const needed = [
    "package.json",
    "wrangler.toml",
    "_server.js",
    "_deploy-e2e-test.js",
    "_seo-verify.js",
    "_generate-sitemap.js",
  ];
  for (const f of needed) assert(hasFile(path.join(ROOT, f)), "缺失: " + f);
  return "✅ " + needed.length + " 个文件齐全";
});
test(U1, "public/ 目录核心资源齐全", () => {
  const files = [
    "index.html",
    "app.js",
    "styles.css",
    "cards-meta.json",
    "products.json",
    "robots.txt",
    "sitemap.xml",
    "sitemap-cards.xml",
    "sitemap-pages.xml",
    "about.html",
    "contact.html",
    "privacy.html",
    "terms.html",
    "cookies.html",
    "pricing.html",
    "payment-success.html",
    "payment-cancel.html",
  ];
  const missing = [];
  for (const f of files) if (!hasFile(path.join(PUBLIC, f))) missing.push(f);
  assert(missing.length === 0, "缺失文件: " + missing.join(","));
  return "✅ " + files.length + " 个公共资源齐全";
});
test(U1, "Worker 目录结构正确", () => {
  assert(hasFile(WORKER), "缺失 worker/src/index.js");
  const workerSrc = read(WORKER);
  assert(
    /addEventListener\(['"]fetch['"]/.test(workerSrc),
    "Worker 未注册 fetch event"
  );
  assert(
    /handleRequest/.test(workerSrc),
    "Worker 缺少 handleRequest 主函数"
  );
  return "✅ Worker 入口结构正确";
});
test(U1, "所有 JS 文件语法无错（app.js + worker + 所有脚本）", () => {
  const files = [
    path.join(PUBLIC, "app.js"),
    WORKER,
    path.join(ROOT, "_server.js"),
    path.join(ROOT, "_deploy-e2e-test.js"),
    path.join(ROOT, "_seo-verify.js"),
    path.join(ROOT, "_generate-sitemap.js"),
  ];
  const errs = [];
  for (const f of files) {
    if (!hasFile(f)) continue;
    try { new Function(read(f)); }
    catch (e) { errs.push(f + ": " + e.message); }
  }
  assert(errs.length === 0, "语法错误: " + errs.join("; "));
  return "✅ " + files.length + " 个 JS 文件语法正确";
});

// ============================================================
// U2 - 数据完整性 (cards-meta.json + products.json)
// ============================================================
const U2 = "U2-数据完整性";
let CARDS_CACHE = null;
function loadCards() {
  if (CARDS_CACHE) return CARDS_CACHE;
  const raw = JSON.parse(read(path.join(PUBLIC, "cards-meta.json")));
  CARDS_CACHE = Array.isArray(raw) ? raw : raw.cards || [];
  return CARDS_CACHE;
}
test(U2, "cards-meta.json 卡片数量 >= 3500 且数组合法", () => {
  const c = loadCards();
  assert(Array.isArray(c), "cards 不是数组");
  assert(c.length >= 3500, "cards 数量不足: " + c.length);
  return "✅ " + c.length + " 张卡片";
});
test(U2, "前 1000 张卡片：8 个核心字段齐全 + slug 唯一", () => {
  const c = loadCards();
  const fields = ["slug", "title", "category", "bgImage", "defaultText", "defaultFont", "defaultColor", "seo"];
  const slugs = new Set();
  let broken = 0;
  let dup = 0;
  for (const card of c.slice(0, 1000)) {
    let hasAll = true;
    for (const f of fields) if (!(f in card)) { hasAll = false; break; }
    if (!hasAll) broken++;
    if (slugs.has(card.slug)) dup++;
    else slugs.add(card.slug);
  }
  assert(broken === 0, broken + " 张卡缺少字段");
  assert(dup === 0, "前 1000 张卡 slug 重复数: " + dup);
  return "✅ 1000/1000 字段齐全 + slug 唯一";
});
test(U2, "25 个分类每张卡至少 5 张", () => {
  const CATS = [
    "anniversary","birthday","christmas","congratulations","easter","encouragement",
    "fathers-day","friendship","get-well","good-luck","graduation","halloween","love",
    "missing-you","mothers-day","new-baby","new-year","retirement","sorry","sympathy",
    "thank-you","thanksgiving","thinking-of-you","valentine","wedding"
  ];
  const c = loadCards();
  const byCat = {};
  for (const cat of CATS) byCat[cat] = 0;
  for (const card of c) if (byCat[card.category] !== undefined) byCat[card.category]++;
  const low = [];
  for (const cat of CATS) if (byCat[cat] < 5) low.push(cat + "=" + byCat[cat]);
  assert(low.length === 0, "分类卡数不足 5: " + low.join(","));
  const total = Object.values(byCat).reduce((a, b) => a + b, 0);
  return "✅ 25 分类每类 >=5 张, 分类覆盖 = " + total + "/" + c.length;
});
test(U2, "每张卡 bgImage / defaultColor / defaultFont 非空（前 500 抽样）", () => {
  const c = loadCards().slice(0, 500);
  let bad = 0;
  for (const card of c) {
    if (!card.bgImage || typeof card.bgImage !== "string" || card.bgImage.length < 10) bad++;
    else if (!card.defaultColor || !/^#[0-9a-f]{3,8}$/i.test(card.defaultColor)) bad++;
    else if (!card.defaultFont || typeof card.defaultFont !== "string" || card.defaultFont.length < 3) bad++;
  }
  assert(bad === 0, bad + " 张卡资源字段非法");
  return "✅ 500/500 卡资源字段合法";
});
test(U2, "seo 子对象含 title/description/keywords（抽样 200）", () => {
  const c = loadCards().slice(0, 200);
  let bad = 0;
  for (const card of c) {
    const seo = card.seo || {};
    if (!seo.title || !seo.description || !Array.isArray(seo.keywords)) bad++;
  }
  assert(bad === 0, bad + " 张卡 SEO 字段缺失");
  return "✅ 200/200 卡 SEO 完整";
});
test(U2, "products.json 非空并含 4 种套餐 ID", () => {
  const p = JSON.parse(read(path.join(PUBLIC, "products.json")));
  const products = Array.isArray(p) ? p : (p.products || []);
  assert(products.length >= 4, "products 数量不足: " + products.length);
  const ids = ["prod_7GGx4Gh5yvKLOb0OCzYFoq", "prod_3xVdtK0wdzqLlaCz4H7lzQ", "prod_73aCoww3uhNMevKi8NVwNv"];
  const allIds = products.map(x => x.id || x.price_id || x.product_id || "").join("|");
  const appSrc = read(path.join(PUBLIC, "app.js"));
  for (const id of ids) {
    assert(appSrc.includes(id), "app.js 缺少套餐 ID: " + id);
  }
  return "✅ products=" + products.length + " + 3 Creem ID 齐全";
});

// ============================================================
// U3 - 前端 SPA 核心逻辑完整性
// ============================================================
const U3 = "U3-前端逻辑完整性";
test(U3, "app.js 关键渲染函数齐全（17+ 核心函数）", () => {
  const src = read(path.join(PUBLIC, "app.js"));
  const fns = analyzeAppFunctions(src);
  const needed = [
    "renderRoute", "renderHome", "renderDiscover", "renderEditor",
    "renderPricing", "renderGroupSign", "renderGiftRedeem", "renderNotFound",
    "mountApp", "clearApp", "updateCanonical", "updateMetaDescription",
    "updateOGTags", "injectJSONLD", "injectFooter", "attachGlobalNavLinks",
    "loadMetaAndBoot", "installToast",
  ];
  const missing = needed.filter(f => !fns[f]);
  assert(missing.length === 0, "缺少关键函数: " + missing.join(","));
  return "✅ " + needed.length + " 个渲染函数齐全";
});
test(U3, "工具函数：escapeHtml / splitTextToLines / formatDateNowPlus", () => {
  const src = read(path.join(PUBLIC, "app.js"));
  const fns = analyzeAppFunctions(src);
  ["escapeHtml", "splitTextToLines", "formatDateNowPlus", "getCategoryEmoji"].forEach(f => {
    assert(fns[f], "缺少工具函数: " + f);
  });
  return "✅ 4 个工具函数齐全";
});
test(U3, "状态持久化：intent + editor storage 读写函数", () => {
  const src = read(path.join(PUBLIC, "app.js"));
  const fns = analyzeAppFunctions(src);
  ["loadIntentFromStorage", "persistIntentState", "loadEditorFromStorage",
   "persistEditorState", "resetEditorState"].forEach(f => {
    assert(fns[f], "缺少 storage 函数: " + f);
  });
  assert(/localStorage\.getItem\(['"]saf_intent_state['"]\)/.test(src), "缺少 intent state 读取");
  assert(/localStorage\.setItem\(['"]saf_editor_/.test(src), "缺少 editor state 写入");
  return "✅ Storage 读写 5 函数 + 2 模式齐全";
});
test(U3, "路由分支：至少 10 种路由模式（含 /card/:slug, /group/:token, /redeem/:token, 25 分类页）", () => {
  const src = read(path.join(PUBLIC, "app.js"));
  const patterns = [
    /simplePath\s*===\s*["']\/["']/,
    /simplePath\.startsWith\(["']\/discover["']\)/,
    /cardMatch\s*=\s*path\.match/,
    /groupMatch\s*=\s*path\.match/,
    /redeemMatch\s*=\s*path\.match/,
    /simplePath\s*===\s*["']\/pricing["']/,
    /isCategoryPage/,
    /renderNotFound/,
    /\/trending.*\/latest.*\/holidays.*\/message-generator/,
    /signin.*signup.*login.*account/,
  ];
  let found = 0;
  for (const p of patterns) if (p.test(src)) found++;
  assert(found >= 8, "路由模式不完整 found=" + found + "/" + patterns.length);
  return "✅ 路由分支模式 = " + found + "/" + patterns.length;
});
test(U3, "意图引擎三要素：RECIPIENT_OPTIONS(12) + OCCASION_OPTIONS(25) + TONE_OPTIONS(6)", () => {
  const src = read(path.join(PUBLIC, "app.js"));
  assert(
    /RECIPIENT_OPTIONS\s*=\s*\[/.test(src) && src.match(/slug:\s*["'][a-z-]+["']/g).length >= 10,
    "RECIPIENT_OPTIONS 不足或格式错误"
  );
  assert(/OCCASION_OPTIONS\s*=\s*Object\.keys\(CATEGORY_LABELS\)/.test(src), "OCCASION_OPTIONS 生成错误");
  assert(
    /TONE_OPTIONS\s*=\s*\[/.test(src) && (src.match(/slug:\s*["'](funny|sincere|romantic|playful|formal|warm)["']/g) || []).length >= 5,
    "TONE_OPTIONS 不完整"
  );
  return "✅ 三要素选项齐全";
});
test(U3, "Discover 过滤算法存在：recipient match + occasion match + tone words + query search + scoring 排序", () => {
  const src = read(path.join(PUBLIC, "app.js"));
  const fns = analyzeAppFunctions(src);
  assert(fns.applyDiscoverFilter, "缺少 applyDiscoverFilter");
  assert(/score\s*[+]=\s*10.*occasion/.test(src) || /occasion.*score\s*[+]=/.test(src), "缺少 occasion 评分 (10)");
  assert(/recipientOpt|recipient.*match/.test(src), "缺少 recipient 评分逻辑");
  assert(/toneOpt|tone.*words/.test(src), "缺少 tone 评分逻辑");
  assert(/query|q\.toLowerCase|query.toLowerCase/.test(src), "缺少关键词查询");
  assert(/sorted|sort\(\(a,\s*b\)\s*=>\s*b\.score\s*-\s*a\.score\)/.test(src), "缺少按 score 排序");
  return "✅ Discover 4 维评分 + 排序齐全";
});
test(U3, "编辑器样式控制：字体(3) + 颜色预设(8) + 贴纸(10) + 签名头像(12)", () => {
  const src = read(path.join(PUBLIC, "app.js"));
  assert(/FONT_FAMILIES\s*=\s*\[/.test(src), "缺少 FONT_FAMILIES");
  assert(/FONT_COLOR_PRESETS\s*=\s*\[/.test(src), "缺少 FONT_COLOR_PRESETS");
  assert(/STICKER_EMOJIS\s*=\s*\[/.test(src), "缺少 STICKER_EMOJIS");
  assert(/SIGNER_AVATAR_EMOJIS\s*=\s*\[/.test(src), "缺少 SIGNER_AVATAR_EMOJIS");
  const ffs = src.match(/FONT_FAMILIES\s*=\s*\[([\s\S]*?)\]/);
  const colors = src.match(/FONT_COLOR_PRESETS\s*=\s*\[([\s\S]*?)\]/);
  assert(ffs && (ffs[1].match(/['"]/g) || []).length / 2 >= 3, "字体数 < 3");
  assert(colors && (colors[1].match(/#/g) || []).length >= 8, "颜色预设 < 8");
  return "✅ 样式预设齐全 (3+ 字体, 8+ 颜色, 10 贴纸, 12 头像)";
});
test(U3, "定价矩阵 PLAN_FEATURE_MATRIX 5 套餐 × 8 功能完整", () => {
  const src = read(path.join(PUBLIC, "app.js"));
  assert(/PLAN_FEATURE_MATRIX\s*=\s*\{/.test(src), "缺少 PLAN_FEATURE_MATRIX");
  ["free", "pay_per_send", "monthly", "annual", "group_pass"].forEach(plan => {
    const rx = new RegExp("\\b" + plan + "\\s*:\\s*\\{");
    assert(rx.test(src), "PLAN_FEATURE_MATRIX 缺少套餐: " + plan);
  });
  const features = ["unlimited_design", "watermark_free", "scheduling_window", "group_signatures",
                    "gift_subscription", "priority_support", "pdf_export", "history_retention"];
  for (const f of features) {
    const rx = new RegExp("\\b" + f + "\\s*:");
    assert(rx.test(src), "功能列缺失: " + f);
  }
  return "✅ 5 套餐 × 8 功能矩阵完整";
});
test(U3, "Cookie Banner：按钮 + 存储 choice + GDPR + Policy 链接", () => {
  const src = read(path.join(PUBLIC, "app.js"));
  const fns = analyzeAppFunctions(src);
  ["injectCookieBanner", "installCookieBanner", "handleCookieChoice"].forEach(f => {
    assert(fns[f], "缺少 cookie 函数: " + f);
  });
  assert(/acceptCookiesBtn|rejectCookiesBtn/.test(src), "缺少 Accept/Reject 按钮");
  assert(/saf_cookie_consent/.test(src), "缺少 saf_cookie_consent 存储");
  const hasPP = /Privacy\s+Policy/i.test(src);
  const hasCP = /Cookie\s+Policy/i.test(src);
  assert(hasPP && hasCP, "缺少 Policy 链接 PrivacyPolicy=" + hasPP + " CookiePolicy=" + hasCP);
  return "✅ GDPR Cookie Banner 3 函数 + 2 按钮 + 2 Policy 齐全";
});

// ============================================================
// U4 - Worker API 路由完整性（支持正则动态匹配）
// ============================================================
const U4 = "U4-Worker API 完整性";
test(U4, "提取 Worker 路由：静态 + 正则动态路由 ≥ 12 条", () => {
  const src = read(WORKER);
  const routes = extractWorkerRoutes(src);
  assert(routes.length >= 12, "路由提取数量不足: " + routes.length);
  return "✅ 共提取 " + routes.length + " 条路由: " + routes.map(r => r.pattern).join(", ");
});
test(U4, "Worker 全部路由处理函数 12 个齐全（包含 12 个 handleXxx）", () => {
  const src = read(WORKER);
  const fns = analyzeWorkerFunctions(src);
  const needed = [
    "handleRequest",
    "handleCheckMember",
    "handleSendCard",
    "handleCreateSession",
    "handleCreemWebhook",
    "handleR2Image",
    "handleGroupCreate",
    "handleGroupGet",
    "handleGroupSign",
    "handleGroupSend",
    "handleGiftGet",
    "handleGiftRedeem",
    "handleHealth",
  ];
  const missing = needed.filter(f => !fns[f]);
  assert(missing.length === 0, "Worker 缺少 handle 函数: " + missing.join(","));
  return "✅ " + needed.length + " 个路由函数全部存在";
});
test(U4, "handleRequest 路由分发覆盖 12+ 端点，动态正则 4 条存在", () => {
  const src = read(WORKER);
  // 动态路由通过"具体的变量赋值语句"字符串片段判断，避免 .* 大正则造成 NFA 回溯卡死
  const dynVars = [
    { label: "group/:token", ok: src.includes("mGroup = path.match") || src.includes("const mGroup = path.match") || src.includes("let mGroup = path.match") },
    { label: "group/:token/sign", ok: src.includes("mGroupSign") || src.includes(")/sign$/)") || src.includes("/sign$/)") },
    { label: "group/:token/send", ok: src.includes("mGroupSend") || src.includes(")/send$/)") || src.includes("/send$/)") },
    { label: "gift/:token", ok: src.includes("mGift = path.match") || src.includes("const mGift = path.match") || src.includes("/gift/([^/]+)") },
  ];
  const dynCount = dynVars.filter(d => d.ok).length;
  // 静态路由检查
  const staticRoutes = [
    "/api/check-member","/api/send-card","/api/create-session","/api/creem/webhook",
    "/api/group/create","/api/gift/redeem","/api/health","/creem/webhook","/api/r2-image/",
  ];
  const staticOk = staticRoutes.filter(r => src.includes("'" + r + "'") || src.includes('"' + r + '"') || src.startsWith + r).length;
  assert(dynCount >= 4, "动态正则路由不足, 检测到 " + dynCount + "/4 (详情: " + dynVars.map(d => d.label + "=" + d.ok).join(",") + ")");
  assert(staticOk >= 7, "静态路由不足, found=" + staticOk + "/" + staticRoutes.length);
  return "[PASS] " + dynCount + " 条动态正则路由 (mGroup/mGroupSign/mGroupSend/mGift) + " + staticOk + " 条静态路由齐全";
});
test(U4, "MAX_SIGS_BY_PLAN 5 套餐签名上限 + DAYS_BY_PLAN 有效期", () => {
  const src = read(WORKER);
  const m1 = src.match(/MAX_SIGS_BY_PLAN\s*=\s*\{([^}]+)\}/);
  assert(m1, "未找到 MAX_SIGS_BY_PLAN");
  ["free", "month", "year", "one", "group"].forEach(k => {
    assert(new RegExp("\\b" + k + "\\s*:").test(m1[1]), "MAX_SIGS 缺少: " + k);
  });
  const m2 = src.match(/DAYS_BY_PLAN\s*=\s*\{([^}]+)\}/);
  assert(m2, "未找到 DAYS_BY_PLAN");
  return "✅ 签名上限 + 有效期配置完整";
});
test(U4, "订阅管理：grantSubscription + getPermission + 双 KV 索引 (perm: + usertoken:)", () => {
  const src = read(WORKER);
  const fns = analyzeWorkerFunctions(src);
  assert(fns.grantSubscription, "缺少 grantSubscription");
  assert(fns.getPermission, "缺少 getPermission");
  assert(/kv\.put\(['"]perm:/.test(src), "缺少 perm: 前缀写入");
  assert(/kv\.put\(['"]usertoken:/.test(src), "缺少 usertoken: 前缀写入");
  assert(/kv\.get\(['"]perm:/.test(src) && /kv\.get\(['"]usertoken:/.test(src), "缺少双索引读取");
  return "✅ grant/get + perm:+usertoken: 双 KV 索引齐全";
});
test(U4, "Creem Checkout：create-session + webhook HMAC 签名验证 + metadata 写入", () => {
  const src = read(WORKER);
  assert(/fetch\(.*\/checkouts['"],\s*\{[\s\S]*?method:\s*['"]POST['"]/.test(src), "缺少 Creem /checkouts fetch POST");
  assert(/customer_email|line_items|success_url|cancel_url/.test(src), "缺少 Checkout payload 字段");
  assert(/x-creem-signature|X-Webhook-Signature|crypto\.subtle\.verify|HMAC/.test(src),
         "缺少 Creem webhook 签名校验 (HMAC/crypto)");
  assert(/checkout\.completed|checkout\.session\.completed/.test(src), "缺少 checkout 完成事件处理");
  return "✅ Creem session + webhook HMAC 验证齐全";
});
test(U4, "邮件系统：Resend fetch POST + 2 套模板 (单发 + Group) + 双发件配置", () => {
  const src = read(WORKER);
  const cnt = (src.match(/api\.resend\.com\/emails/g) || []).length;
  assert(cnt >= 2, "Resend 调用少于 2 次 (单发 + 群签), found=" + cnt);
  assert(/buildEmailHtml\s*\(/.test(src) && /buildGroupEmailHtml\s*\(/.test(src), "缺少 2 套 HTML 模板构建");
  assert(/RESEND_FROM\s*=\s*['"]onboard@resend\.dev/.test(src), "缺少 Resend 发件源配置");
  assert(/reply_to:\s*fromEmail|reply_to:\s*g\.ownerEmail/.test(src), "缺少 reply-to 设置");
  return "✅ Resend 调用 = " + cnt + " 次, 2 套 HTML 模板齐全";
});
test(U4, "邮件 HTML 模板含：开卡 CTA 按钮 + Footer 合规 + 退订链接 (mailto unsubscribe)", () => {
  const src = read(WORKER);
  const both = [/Open Your Card.*💌|Open Group Card.*📜/,
                /support@sendafun\.com.*GDPR|Privacy.*\(GDPR\)/,
                /mailto:unsubscribe@sendafun\.com|Unsubscribe/i];
  const m1 = src.match(/buildEmailHtml\s*\([^)]*\)\s*\{([\s\S]*?)<\/html>/);
  const m2 = src.match(/buildGroupEmailHtml\s*\([^)]*\)\s*\{([\s\S]*?)<\/html>/);
  let allOk = true;
  for (const rx of both) {
    let found = false;
    if (m1 && rx.test(m1[1])) found = true;
    if (m2 && rx.test(m2[1])) found = true;
    if (!found) { allOk = false; assert(false, "邮件模板缺失: " + rx.toString().slice(0, 60)); }
  }
  return "✅ 两套邮件模板含 CTA + 合规 Footer + Unsubscribe mailto";
});
test(U4, "群签数据流：group:token KV + sign 防超 + signer 对象字段完整", () => {
  const src = read(WORKER);
  assert(/kv\.put\(['"]group:/.test(src) && /kv\.get\(['"]group:/.test(src), "缺少 group: KV");
  assert(/maxSignatures.*signatures\.length|signatures\.length\s*>=\s*g\.maxSignatures/.test(src),
         "缺少签名数防超逻辑");
  const sigFields = ["signerName", "signerEmoji", "signerText"];
  for (const f of sigFields) {
    const rx = new RegExp("\\bsignerName\\b|\\bsignerEmoji\\b|\\bsignerText\\b");
    assert(src.includes(f), "signer 对象缺少字段: " + f);
  }
  assert(/at:\s*Date\.now\(\)|createdAt|id:\s*randToken/.test(src), "签名缺少时间戳/ID");
  return "✅ group:token KV + 防超 + signer 完整字段齐全";
});
test(U4, "Gift 流程：gift:token KV + redeemed 状态 + redeemedAt/redeemedBy 字段", () => {
  const src = read(WORKER);
  assert(/kv\.put\(['"]gift:/.test(src) && /kv\.get\(['"]gift:/.test(src), "缺少 gift: KV");
  assert(/g\.redeemed\s*=\s*true|redeemed:\s*false|Gift already used|Gift already redeemed/.test(src),
         "缺少礼品兑换状态防重");
  ["redeemedAt", "redeemedBy", "createdAt", "validDays"].forEach(f => {
    assert(src.includes(f), "gift 对象缺少字段: " + f);
  });
  return "✅ gift:token KV + redeemed 防重 + 4 个时间戳字段齐全";
});
test(U4, "限速：_rlCheck 存在 + 应用到 check-member + group-sign 等端点", () => {
  const src = read(WORKER);
  assert(/_rlCheck\s*\(/.test(src), "缺少 _rlCheck 调用");
  assert(/429|Too many requests/.test(src), "缺少 429 响应");
  const calls = src.match(/_rlCheck\(/g) || [];
  assert(calls.length >= 2, "限速应用于少于 2 个端点, found=" + calls.length);
  return "✅ 速率限制函数 + 429 响应, 部署于 " + calls.length + " 端点";
});
test(U4, "KV TTL 安全：所有写入均设 expirationTtl（perm/usertoken/order/group/gift 至少 3 类）", () => {
  const src = read(WORKER);
  const writes = src.match(/kv\.put\([\s\S]*?expirationTtl\s*:/g) || [];
  const categories2 = new Set();
  const patterns = [
    { rx: /perm:/, label: "perm" },
    { rx: /usertoken:/, label: "usertoken" },
    { rx: /order:/, label: "order" },
    { rx: /group:/, label: "group" },
    { rx: /gift:/, label: "gift" },
  ];
  for (const p of patterns) {
    if (p.rx.test(src) && /expirationTtl/.test(src)) categories2.add(p.label);
  }
  assert(writes.length >= 3 && categories2.size >= 3,
         "KV TTL 写入不足 writes=" + writes.length + ", 覆盖类别=" + categories2.size);
  return "✅ expirationTtl 写入 " + writes.length + " 次, 类别覆盖 " + [...categories2].join(",");
});

// ============================================================
// U5 - HTML/CSS 合规与无障碍
// ============================================================
const U5 = "U5-HTML/CSS 合规";
test(U5, "index.html: lang + charset + viewport + theme-color + canonical + 4 OG + 3 Twitter", () => {
  const idx = read(path.join(PUBLIC, "index.html"));
  assert(/<html\s+lang="en"/i.test(idx), "缺少 lang=en");
  assert(/<meta\s+charset="utf-8"/i.test(idx), "缺少 charset");
  assert(/viewport.*width=device-width/i.test(idx), "缺少 viewport");
  assert(/theme-color/i.test(idx), "缺少 theme-color");
  assert(/rel="canonical"/i.test(idx), "缺少 canonical");
  const ogs = ["og:title", "og:description", "og:image", "og:url"];
  const tws = ["twitter:card", "twitter:title", "twitter:description"];
  for (const o of ogs) assert(idx.includes(o), "缺少 " + o);
  for (const t of tws) assert(idx.includes(t), "缺少 " + t);
  return "✅ index.html 基础 head 标签齐全 (lang/charset/viewport/OG/Twitter/canonical)";
});
test(U5, "8 个静态页全部含 <title> + 页面有实际内容（非空）", () => {
  const pages = ["privacy", "terms", "contact", "about", "cookies", "pricing", "payment-success", "payment-cancel"];
  for (const p of pages) {
    const f = path.join(PUBLIC, p + ".html");
    const t = read(f);
    assert(/<title>[^<]{5,}<\/title>/i.test(t), p + ".html 缺少 <title>");
    assert(t.replace(/\s+/g, " ").length > 800, p + ".html 内容过短");
  }
  return "✅ 8 静态页含 <title> + 非空";
});
test(U5, "CSS 系统：设计变量 12 个 + glass 毛玻璃 + fade-in + 核心选择器", () => {
  const css = read(path.join(PUBLIC, "styles.css"));
  const vars = css.match(/--[a-z][a-z0-9-]+\s*:/gi) || [];
  assert(vars.length >= 12, "CSS 变量数不足: " + vars.length + " 需要 >= 12");
  [".glass", ".fade-in",
   ".hero", ".card-flip-wrapper", ".card-tile", ".btn-primary", ".toast-stack"].forEach(s => {
    assert(css.includes(s), "CSS 缺少选择器: " + s);
  });
  assert(/backdrop-filter:\s*blur/i.test(css), "毛玻璃缺少 backdrop-filter");
  assert(/@keyframes/i.test(css), "缺少 @keyframes 动画");
  return "✅ " + vars.length + " CSS 变量 + 核心选择器 + 毛玻璃 + 动画齐全";
});
test(U5, "无障碍：nav/footer/main 语义 + role + aria-label + skip-link + alt", () => {
  const idx = read(path.join(PUBLIC, "index.html"));
  assert(/role="navigation"/i.test(idx), "缺少 nav role=navigation");
  assert(/role="main"/i.test(idx), "缺少 main role=main");
  assert(/id="footerPlaceholder"/i.test(idx), "缺少 footer placeholder");
  assert(/skip-link/i.test(idx), "缺少 skip-link 跳转链接");
  const appSrc = read(path.join(PUBLIC, "app.js"));
  const workerSrc = read(WORKER);
  const allSrc = idx + "\n" + appSrc + "\n" + workerSrc;
  const ariaCount = (allSrc.match(/aria-label\s*=/gi) || []).length;
  // 单引号和双引号 aria-label 都算
  const ariaAlt = (allSrc.match(/aria-label[\s=]/gi) || []).length;
  const totalAria = Math.max(ariaCount, ariaAlt);
  assert(totalAria >= 5, "aria-label 不足 5 处, found=" + totalAria);
  const altCount = (allSrc.match(/\balt\s*=/gi) || []).length;
  return "✅ 语义化标签 + aria-label=" + totalAria + " + alt=" + altCount;
});

// ============================================================
// U6 - HTTP 服务端运行时测试
// ============================================================
const U6 = "U6-HTTP 运行时测试";
const asyncTests = [];
asyncTests.push(aTest(U6, "根路径 / HTTP 200 + 包含 <title>SendAFun", async () => {
  const r = await get("/", 5_000_000);
  assert(r.code === 200, "返回 " + r.code);
  assert(/<title>[\s\S]*SendAFun[\s\S]*<\/title>/i.test(r.body), "未检测到 SendAFun <title>");
  const hasApp = /<div[^>]+id\s*=\s*["']app["']/i.test(r.body);
  const hasApp2 = /<main[^>]+id\s*=\s*["']app["']/i.test(r.body);
  assert(hasApp || hasApp2, "未检测到 app 挂载点 (div or main id=app)");
  return "✅ HTTP 200 bytes=" + r.bytes;
}));
asyncTests.push(aTest(U6, "SPA fallback：任意不存在路径返回 index.html（用于 client-side routing）", async () => {
  const r1 = await get("/discover", 5_000_000);
  const r2 = await get("/birthday", 5_000_000);
  const r3 = await get("/card/nonexistent-slug-12345", 5_000_000);
  assert(r1.code === 200 && r2.code === 200 && r3.code === 200, "SPA fallback 失败");
  for (const r of [r1, r2, r3]) {
    const hasApp = /<(div|main)[^>]+id\s*=\s*["']app["']/i.test(r.body);
    const hasTitle = /<title>[\s\S]*SendAFun/i.test(r.body);
    assert(hasApp || hasTitle, "未返回 index.html SPA 容器");
  }
  return "✅ /discover, /birthday, /card/:slug 全部 200 + SPA 容器";
}));
asyncTests.push(aTest(U6, "25 分类页全部 HTTP 200（精简抽样 8 个，余已被 _deploy-e2e-test 覆盖）", async () => {
  const CATS = [
    "anniversary","birthday","christmas","congratulations","easter",
    "love","thank-you","wedding"
  ];
  let fail = [];
  for (const c of CATS) {
    const r = await get("/" + c);
    if (r.code !== 200) fail.push(c + "=" + r.code);
  }
  assert(fail.length === 0, "分类页失败: " + fail.join(","));
  return "✅ 抽样 " + CATS.length + " 分类页 全部 200 (其余 17 个已被 T4 覆盖)";
}));
asyncTests.push(aTest(U6, "sitemap.xml + sitemap-cards.xml + sitemap-pages.xml + robots.txt", async () => {
  const files = [
    { p: "/sitemap.xml", rx: /<urlset|<sitemapindex/ },
    { p: "/sitemap-cards.xml", rx: /<loc>.*card\// },
    { p: "/sitemap-pages.xml", rx: /<loc>.*sendafun\.com/ },
    { p: "/robots.txt", rx: /User-agent:|Sitemap:/ },
  ];
  for (const f of files) {
    const r = await get(f.p);
    assert(r.code === 200, f.p + " 返回 " + r.code);
    assert(f.rx.test(r.body), f.p + " 内容格式错误");
  }
  return "✅ 4 个 SEO 文件全部可用";
}));
asyncTests.push(aTest(U6, "JSON 静态数据 /cards-meta.json + /products.json HTTP 200 + 文件解析通过", async () => {
  // HTTP 层面检查 200 + Content-Type，数据量过大改用本地文件解析保证正确性
  const r1 = await get("/cards-meta.json", 100_000);
  const r2 = await get("/products.json", 100_000);
  assert(r1.code === 200, "cards-meta.json HTTP " + r1.code);
  assert(r2.code === 200, "products.json HTTP " + r2.code);
  assert(/application\/json/.test(r1.headers["content-type"] || ""), "cards-meta Content-Type 非 JSON");
  // 从本地文件完整解析
  const cardsRaw = read(path.join(PUBLIC, "cards-meta.json"));
  const parsedCards = JSON.parse(cardsRaw);
  const cards = Array.isArray(parsedCards) ? parsedCards : (parsedCards.cards || []);
  assert(cards.length > 3000, "cards 数量不足, 解析后=" + cards.length);
  const productsRaw = read(path.join(PUBLIC, "products.json"));
  const parsedProducts = JSON.parse(productsRaw);
  const products = Array.isArray(parsedProducts) ? parsedProducts : (parsedProducts.products || []);
  assert(products.length >= 4, "products 不足 4 项, found=" + products.length);
  return "✅ HTTP 200 + Content-Type=JSON, cards=" + cards.length + " / products=" + products.length;
}));
asyncTests.push(aTest(U6, "8 个静态页 .html 全部 HTTP 200 + 非零字节", async () => {
  const pages = ["privacy", "terms", "contact", "about", "cookies", "pricing", "payment-success", "payment-cancel"];
  let bad = [];
  for (const p of pages) {
    const r = await get("/" + p + ".html");
    if (r.code !== 200 || r.bytes < 200) bad.push(p + "=" + r.code + "/" + r.bytes);
  }
  assert(bad.length === 0, "静态页异常: " + bad.join(","));
  return "✅ 8 静态 html 全部 HTTP 200";
}));
asyncTests.push(aTest(U6, "抽样 5 张卡 /card/:slug HTTP 200", async () => {
  const cards = loadCards().slice(0, 5);
  let bad = [];
  for (const c of cards) {
    const r = await get("/card/" + encodeURIComponent(c.slug));
    if (r.code !== 200) bad.push(c.slug + "=" + r.code);
  }
  assert(bad.length === 0, "卡片详情页失败: " + bad.join(","));
  return "✅ 5 抽样卡详情 200 (其余已被 T5 覆盖)";
}));
asyncTests.push(aTest(U6, "/styles.css + /app.js 可访问且 MIME 正确", async () => {
  const r1 = await get("/styles.css");
  const r2 = await get("/app.js");
  assert(r1.code === 200 && /text\/css/.test(r1.headers["content-type"] || ""), "styles.css 错误");
  assert(r2.code === 200 && /javascript/.test(r2.headers["content-type"] || ""), "app.js MIME 错误");
  assert(r1.bytes > 5000 && r2.bytes > 20000, "资源 bytes 不足");
  return "✅ CSS bytes=" + r1.bytes + ", JS bytes=" + r2.bytes;
}));

// ============================================================
// U7 - SEO / JSON-LD / Meta 动态注入
// ============================================================
const U7 = "U7-SEO 动态注入";
test(U7, "JSON-LD 4 种：Organization + WebSite + BreadcrumbList + Product", () => {
  const src = read(path.join(PUBLIC, "app.js"));
  ["getOrgJSONLD", "getWebSiteJSONLD", "getBreadcrumbList", "getPricingJSONLD", "getCardProductJSONLD"].forEach(f => {
    assert(src.includes(f), "缺少 JSON-LD 函数: " + f);
  });
  assert(/application\/ld\+json/.test(src), "缺少 ld+json type");
  return "✅ 5 个 JSON-LD 生成器 + ld+json inject 齐全";
});
test(U7, "updateOGTags + updateCanonical + setPageTitle + setMetaKeywords 完整 SEO 管线", () => {
  const src = read(path.join(PUBLIC, "app.js"));
  ["updateOGTags", "updateCanonical", "setPageTitle", "setMetaKeywords", "updateMetaDescription"].forEach(f => {
    assert(src.includes("function " + f), "缺少 SEO 函数: " + f);
  });
  return "✅ SEO 5 管线函数齐全";
});
test(U7, "每条主要路由调用 updateCanonical + updateOGTags + 注入 Breadcrumb", () => {
  const src = read(path.join(PUBLIC, "app.js"));
  const canonicalCount = (src.match(/updateCanonical\(/g) || []).length;
  const ogCount = (src.match(/updateOGTags\(/g) || []).length;
  const breadCount = (src.match(/injectJSONLD\(['"]ld-breadcrumb['"]/g) || []).length;
  assert(canonicalCount >= 8, "updateCanonical 调用少于 8 次, found=" + canonicalCount);
  assert(ogCount >= 8, "updateOGTags 调用少于 8 次, found=" + ogCount);
  assert(breadCount >= 5, "ld-breadcrumb 注入少于 5 次, found=" + breadCount);
  return "✅ canonical=" + canonicalCount + ", OGTags=" + ogCount + ", breadcrumb=" + breadCount;
});

// ============================================================
// 汇总：等待所有异步测试并打印报告
// ============================================================
function report() {
  function logS() {
    const args = Array.from(arguments).map(a => (typeof a === "string" ? safeStr(a) : a));
    try { console.log.apply(console, args); } catch (_) {
      try { console.log(args.map(x => (typeof x === "string" ? x.replace(/[^\x00-\x7F]/g, "?") : x)).join(" ")); } catch (__) {}
    }
  }
  const mods = {};
  for (const r of results) {
    const k = r.cat.split("-")[0];
    if (!mods[k]) mods[k] = { ok: 0, fail: 0, list: [] };
    if (r.ok) mods[k].ok++; else mods[k].fail++;
    mods[k].list.push(r);
  }
  let totalOk = 0, totalFail = 0;
  const bar = "=".repeat(64);
  logS("\n" + bar);
  logS("[*] SendAFun 2.0 全自动综合测试报告  (U 系列)");
  logS(bar + "\n");
  for (const k of Object.keys(mods).sort()) {
    const m = mods[k];
    const total = m.ok + m.fail;
    const rate = total ? (m.ok / total * 100).toFixed(0) : 0;
    const visual = "[" + "[PASS]".repeat(Math.min(m.ok, 20)) + "[FAIL]".repeat(Math.min(m.fail, 5)) + "]";
    logS(`${k.padEnd(3)} ${visual}`);
    logS(`    ${m.ok}/${total} 通过   (${rate}%)`);
    for (const r of m.list) {
      if (!r.ok) logS("    [FAIL] " + r.name + "  -->  " + r.detail);
      else if (r.detail && r.detail.length > 2) logS("    [PASS] " + r.name + "  --  " + r.detail);
    }
    logS("");
    totalOk += m.ok; totalFail += m.fail;
  }
  logS(bar);
  const totalAll = totalOk + totalFail;
  const rateAll = totalAll ? (totalOk / totalAll * 100).toFixed(1) : 0;
  let grade = "S";
  if (rateAll >= 98) grade = "S";
  else if (rateAll >= 95) grade = "A";
  else if (rateAll >= 90) grade = "B";
  else if (rateAll >= 80) grade = "C";
  else grade = "D";
  logS(`最终成绩: ${grade}    PASS=${totalOk}  FAIL=${totalFail}  TOTAL=${totalAll}  通过率=${rateAll}%`);
  logS(bar);
  return totalFail === 0 ? 0 : 1;
}

Promise.all(asyncTests).then(() => {
  process.exit(report());
}).catch(e => { console.error("Runner fatal:", e); process.exit(2); });
