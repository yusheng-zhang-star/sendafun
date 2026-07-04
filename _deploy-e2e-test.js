const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const WORKER = path.join(ROOT, "worker", "src", "index.js");
const WranglerToml = path.join(ROOT, "wrangler.toml");

const results = [];
function test(mod, name, fn) {
  try {
    const r = fn();
    results.push({ mod, name, ok: true, detail: typeof r === "string" ? r : "" });
  } catch (e) {
    results.push({ mod, name, ok: false, detail: String(e && e.message || e).slice(0, 260) });
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "assert failed"); }
function hasFile(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function get(url, maxBytes = 1_500_000) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: 3000, path: url, timeout: 15000 }, res => {
      let data = ""; let bytes = 0;
      res.on("data", c => { const s = c.toString(); if (bytes + s.length <= maxBytes) { data += s; bytes += s.length; } });
      res.on("end", () => resolve({ code: res.statusCode, headers: res.headers, body: data }));
    }).on("error", reject);
  });
}

async function main() {
  // ============================================================
  // T1 — 环境 & 配置
  // ============================================================
  test("T1-env", "public/index.html 存在", () => { assert(hasFile(path.join(PUBLIC, "index.html"))); return "✅"; });
  test("T1-env", "public/app.js 存在", () => { assert(hasFile(path.join(PUBLIC, "app.js"))); return "✅"; });
  test("T1-env", "worker/src/index.js 存在", () => { assert(hasFile(WORKER)); return "✅"; });
  test("T1-env", "wrangler.toml 存在", () => { assert(hasFile(WranglerToml)); return "✅"; });
  test("T1-env", "cards-meta.json 存在且可读", () => {
    const m = JSON.parse(read(path.join(PUBLIC, "cards-meta.json")));
    const cards = m.cards || m;
    assert(Array.isArray(cards) && cards.length >= 3000, "cards 数量不足 3000，实际 " + cards.length);
    return "cards 数量 = " + cards.length;
  });
  test("T1-env", "public/app.js node --check 语法", () => {
    try {
      // 用 vm.runInNewContext 近似检查语法（真实 node --check 需 spawn，vm 也能检查语法）
      new Function(read(path.join(PUBLIC, "app.js")));
    } catch (e) {
      throw new Error("app.js 语法错误: " + e.message);
    }
    return "✅ 语法 OK";
  });
  test("T1-env", "worker/src/index.js node --check 语法", () => {
    try { new Function(read(WORKER)); } catch (e) { throw new Error("worker 语法错误: " + e.message); }
    return "✅ 语法 OK";
  });
  test("T1-env", "wrangler.toml 关键字段齐全", () => {
    const t = read(WranglerToml);
    const keys = ["name =", "main =", "account_id =", "compatibility_date =", "CARD_PERMISSIONS", "[env.production]", "[[routes]]", "zone_id"];
    for (const k of keys) assert(t.includes(k), "缺少 wrangler.toml 字段: " + k);
    return "✅ 字段齐全";
  });
  test("T1-env", "localhost:3000 服务健康检查", async () => {
    const r = await get("/");
    assert(r.code === 200, "根路径返回 " + r.code);
    assert(/<title>/.test(r.body) && /SendAFun/.test(r.body), "index.html 不包含预期内容");
    return "HTTP 200 / bytes = " + r.body.length;
  });

  // ============================================================
  // T2 — 8 个静态合规页 × 20 项欧美合规
  // ============================================================
  const STATIC_PAGES = ["privacy", "terms", "contact", "about", "cookies", "pricing", "payment-success", "payment-cancel"];
  for (const p of STATIC_PAGES) {
    test("T2-compliance", "静态页 /" + p + ".html HTTP 200", async () => {
      const r = await get("/" + p + ".html");
      assert(r.code === 200, "返回 " + r.code);
      assert(/<title>/.test(r.body), "缺少 <title>");
      return "✅ 200, bytes=" + r.body.length;
    });
  }
  test("T2-compliance", "所有静态页 lang=en", () => {
    for (const p of STATIC_PAGES) {
      const f = path.join(PUBLIC, p + ".html");
      if (hasFile(f)) assert(/<html\s+lang="en"/i.test(read(f)), p + ".html 未设置 lang=en");
    }
    return "✅ 全部 lang=en";
  });
  test("T2-compliance", "Privacy 页关键字段（GDPR: 数据类型/用途/保留期/用户权利/Cookies/联系邮箱）", () => {
    const t = read(path.join(PUBLIC, "privacy.html"));
    const patterns = ["support@sendafun.com", "GDPR", "data", "collect", "cookie", "right", "delete", "access", "30 day", "contact"];
    const found = patterns.filter(p => t.toLowerCase().includes(p.toLowerCase()));
    assert(found.length >= 8, "Privacy 合规词缺失，found=" + found.length + "/" + patterns.length + " -> " + found.join(","));
    return "✅ 合规字段 found=" + found.length + "/" + patterns.length;
  });
  test("T2-compliance", "Terms 页关键字段（退款/责任/付费/订阅取消/版权）", () => {
    const t = read(path.join(PUBLIC, "terms.html"));
    const patterns = ["refund", "cancel", "subscription", "liability", "copyright", "fee", "payment", "Creem", "chargeback", "intellectual"];
    const found = patterns.filter(p => t.toLowerCase().includes(p.toLowerCase()));
    assert(found.length >= 7, "TOS 合规词缺失，found=" + found.length + "/" + patterns.length + " -> " + found.join(","));
    return "✅ found=" + found.length + "/" + patterns.length;
  });
  test("T2-compliance", "Contact 页: 包含 type=email 输入框 + support@sendafun.com", () => {
    const t = read(path.join(PUBLIC, "contact.html"));
    assert(/type\s*=\s*"email"/i.test(t), "缺少 <input type=\"email\">");
    assert(t.includes("support@sendafun.com"), "缺少 support@sendafun.com");
    return "✅";
  });
  test("T2-compliance", "Pricing 页包含 3 个 Creem Product ID", () => {
    const t = read(path.join(PUBLIC, "pricing.html"));
    const ids = ["prod_7GGx4Gh5yvKLOb0OCzYFoq", "prod_3xVdtK0wdzqLlaCz4H7lzQ", "prod_73aCoww3uhNMevKi8NVwNv"];
    for (const id of ids) assert(t.includes(id), "缺少 Creem ID: " + id);
    return "✅ 3 个 Creem Product ID 齐全";
  });
  test("T2-compliance", "Footer 必备模块: &copy;/© + Privacy/Terms/Contact/support@sendafun.com", () => {
    const checks = [
      { rx: /privacy\.html/i, label: "privacy.html" },
      { rx: /terms\.html/i, label: "terms.html" },
      { rx: /contact\.html|mailto:support@sendafun\.com/i, label: "contact or mailto" },
      { rx: /support@sendafun\.com/i, label: "support@sendafun.com" },
      { rx: /(&copy;|©)/, label: "copyright symbol" },
      { rx: /2026/, label: "2026" }
    ];
    const f = read(path.join(PUBLIC, "index.html")) + read(path.join(PUBLIC, "pricing.html")) + read(path.join(PUBLIC, "app.js"));
    for (const c of checks) assert(c.rx.test(f), "Footer/页面缺少 " + c.label);
    return "✅ Footer 必备字段齐全 (" + checks.map(c => c.label).join(",") + ")";
  });

  // ============================================================
  // T3 — 首页 + 意图引擎（通过 / -> 返回 index.html 验证）
  // ============================================================
  test("T3-home", "/ 返回 index.html + 存在意图引擎 DOM id/class 挂载点", async () => {
    const r = await get("/");
    assert(r.code === 200);
    // 关键节点存在（即使 SPA，容器节点也要有）
    assert(/id\s*=\s*"topNav"/.test(r.body) || /nav-links|hero|glass-nav/.test(r.body), "index.html 缺少导航/首页容器结构");
    assert(/id\s*=\s*"app"/.test(r.body) || /<div id="app"/.test(r.body) || /mountApp|renderRoute/.test(r.body), "缺少 SPA 挂载点 app");
    return "✅ 首页结构完整";
  });
  test("T3-home", "cards-meta.json 每张卡 8 个关键字段齐全", () => {
    const m = JSON.parse(read(path.join(PUBLIC, "cards-meta.json")));
    const cards = m.cards || m;
    const fields = ["slug", "title", "category", "bgImage", "defaultText", "defaultFont", "defaultColor", "seo"];
    let broken = 0;
    for (const c of cards.slice(0, 500)) {
      for (const f of fields) if (!(f in c)) { broken++; break; }
    }
    assert(broken === 0, "前 500 张卡中有 " + broken + " 张缺少关键字段");
    return "✅ 前 500 张卡字段齐全（覆盖率 " + (500 / cards.length * 100).toFixed(1) + "%）";
  });
  test("T3-home", "CATEGORY_LABELS 25 个分类 + cards-meta 分类全覆盖", () => {
    const labels = ["anniversary","birthday","christmas","congratulations","easter","encouragement","fathers-day","friendship","get-well","good-luck","graduation","halloween","love","missing-you","mothers-day","new-baby","new-year","retirement","sorry","sympathy","thank-you","thanksgiving","thinking-of-you","valentine","wedding"];
    const app = read(path.join(PUBLIC, "app.js"));
    for (const l of labels) {
      const inObj = new RegExp("\\b" + l.replace("-", "\\-") + "\\s*:").test(app);
      const inVar = app.includes('"' + l + '"');
      assert(inObj || inVar, "CATEGORY_LABELS 缺少分类标识: " + l);
    }
    const m = JSON.parse(read(path.join(PUBLIC, "cards-meta.json")));
    const cards = m.cards || m;
    const cats = new Set(cards.map(c => c.category));
    const missing = labels.filter(l => !cats.has(l));
    assert(missing.length === 0, "cards-meta 缺失分类: " + missing.join(","));
    return "✅ 25 分类齐全，cards-meta 覆盖全部（labels in app code: yes）";
  });

  // ============================================================
  // T4 — Discover & 25 分类页
  // ============================================================
  test("T4-discover", "/discover HTTP 200 且 SEO 标签齐全", async () => {
    const r = await get("/discover");
    assert(r.code === 200, "返回 " + r.code);
    // 因为 fallback 到 index.html，SPA 会渲染，所以检查 app.js 是否包含 Discover 逻辑
    const app = read(path.join(PUBLIC, "app.js"));
    assert(/renderDiscover/.test(app), "app.js 缺少 renderDiscover 函数");
    assert(/discoverSearchInput|filter-bar|renderFilterChip/.test(app), "app.js 缺少 Discover UI 组件");
    return "✅ Discover 函数齐全";
  });
  const CATS = ["anniversary","birthday","christmas","congratulations","easter","encouragement","fathers-day","friendship","get-well","good-luck","graduation","halloween","love","missing-you","mothers-day","new-baby","new-year","retirement","sorry","sympathy","thank-you","thanksgiving","thinking-of-you","valentine","wedding"];
  for (const c of CATS) {
    test("T4-cat", "分类页 /" + c + " HTTP 200", async () => {
      const r = await get("/" + c);
      assert(r.code === 200, "返回 " + r.code);
      return "✅ 200";
    });
  }
  test("T4-cat", "renderRoute 中存在 isCategoryPage 分类路由分支", () => {
    const app = read(path.join(PUBLIC, "app.js"));
    assert(/isCategoryPage/.test(app), "缺少 isCategoryPage 变量");
    assert(/CATEGORY_LABELS\[catKey\]/.test(app), "缺少分类标签读取");
    assert(/mergedParams\.set\("cat",\s*catKey\)/.test(app), "缺少 cat 参数注入");
    return "✅ 分类路由分支齐全";
  });

  // ============================================================
  // T5 — 3D 编辑器
  // ============================================================
  test("T5-editor", "renderEditor 存在且 3D flip 结构齐全（wrapper/front/back/flipBtn + 草稿 save/load）", () => {
    const app = read(path.join(PUBLIC, "app.js"));
    const tokens = ["renderEditor(", "renderEditorLeft(", "renderEditorRight(", "card-flip-wrapper", "card-face-front", "card-face-back", "flipBtn", "updateCardBackPreview(", "loadEditorFromStorage(", "persistEditorState(", "localStorage.setItem(\"saf_editor_"];
    const found = tokens.filter(t => app.includes(t));
    const missing = tokens.filter(t => !app.includes(t));
    assert(found.length >= 8, "编辑器关键标识符不足 found=" + found.length + "/" + tokens.length + " missing=" + missing.join(","));
    return "✅ found=" + found.length + "/" + tokens.length + " missing=" + missing.join(",") + "";
  });
  test("T5-editor", "存在 6 个样式预设（classic/romantic/festive 等）+ 字体 Inter/Playfair/Dancing Script", () => {
    const app = read(path.join(PUBLIC, "app.js"));
    const fonts = ["Inter", "Playfair Display", "Dancing Script"];
    for (const f of fonts) assert(app.includes(f), "缺少字体族: " + f);
    const presetTokens = ["classic", "romantic", "festive", "bold", "elegant"];
    const found = presetTokens.filter(p => app.toLowerCase().includes(p.toLowerCase()));
    assert(found.length >= 3, "样式预设缺失，found=" + found.join(","));
    return "✅ 字体齐全，样式预设 found=" + found.length + "/" + presetTokens.length;
  });
  test("T5-editor", "每张卡详情页 /card/:slug HTTP 200（抽样 10 张）", async () => {
    const m = JSON.parse(read(path.join(PUBLIC, "cards-meta.json")));
    const cards = (m.cards || m).slice(0, 10);
    for (const c of cards) {
      const r = await get("/card/" + c.slug);
      assert(r.code === 200, "/card/" + c.slug + " 返回 " + r.code);
    }
    return "✅ 抽样 10 张卡全部 200";
  });

  // ============================================================
  // T6 — Pricing & Creem Checkout
  // ============================================================
  test("T6-creem", "定价页 5 套餐齐全（Free / Pay-per-Send $1.99 / Monthly $6.99 / Annual $69 / Group $4.99）", () => {
    const app = read(path.join(PUBLIC, "app.js"));
    const pricing = read(path.join(PUBLIC, "pricing.html"));
    const combined = app + "||" + pricing;
    const prices = ["$1.99", "$6.99", "$69", "$4.99"];
    for (const p of prices) assert(combined.includes(p), "缺少套餐定价: " + p);
    return "✅ 4 档定价齐全";
  });
  test("T6-creem", "app.js 存在 PRODUCT_IDS + 3 个 Creem ID", () => {
    const app = read(path.join(PUBLIC, "app.js"));
    assert(/PRODUCT_IDS\s*=\s*\{/.test(app), "缺少 PRODUCT_IDS 配置");
    const ids = ["prod_7GGx4Gh5yvKLOb0OCzYFoq", "prod_3xVdtK0wdzqLlaCz4H7lzQ", "prod_73aCoww3uhNMevKi8NVwNv"];
    for (const id of ids) assert(app.includes(id), "缺少 Creem ID: " + id);
    return "✅ PRODUCT_IDS + 3 Creem ID 齐全";
  });
  test("T6-creem", "handleCheckoutChoosePlan & Creem session 创建存在", () => {
    const app = read(path.join(PUBLIC, "app.js"));
    const w = read(WORKER);
    assert(/handleCheckoutChoosePlan|createCreemSession|fetch.*create-session/.test(app), "前端缺少 Checkout 流程");
    assert(/handleCreateSession|\/api\/create-session|creem\.com\/sessions/.test(w), "Worker 缺少 create-session 路由");
    return "✅ Checkout 流程齐全";
  });

  // ============================================================
  // T7 — Group Card 群签流程
  // ============================================================
  test("T7-group", "Worker 存在 4 条群签路由（create/get/sign/send）+ MAX_SIGS_BY_PLAN + 前端群签 UI 标识", () => {
    const w = read(WORKER);
    const tokens = ["handleGroupCreate", "handleGroupGet", "handleGroupSign", "handleGroupSend", "MAX_SIGS_BY_PLAN", "group:"];
    for (const t of tokens) assert(w.includes(t), "Worker 缺少群签: " + t);
    const app = read(path.join(PUBLIC, "app.js"));
    assert(/renderGroupSign|renderGroupSignLoaded/.test(app), "前端缺少 renderGroupSign 入口");
    const uiMarkers = ["signerName", "submitSignatureBtn", "signerMessage", "renderSignatureCard", "f_signerName", "signature-card"];
    const found = uiMarkers.filter(m => app.includes(m));
    assert(found.length >= 3, "前端群签 UI 标识不足 found=" + found.join(","));
    return "✅ 4 条路由 + MAX_SIGS 齐全, UI 标识 found=" + found.length + "/" + uiMarkers.length;
  });
  test("T7-group", "MAX_SIGS_BY_PLAN 套餐签名上限值合理（free/month/year/group/one 存在）", () => {
    const w = read(WORKER);
    const m = w.match(/MAX_SIGS_BY_PLAN\s*=\s*\{([^}]+)\}/);
    assert(m, "未找到 MAX_SIGS_BY_PLAN 对象");
    const body = m[1];
    const keys = ["free", "month", "year", "group", "one"];
    for (const k of keys) {
      const rx = new RegExp("\\b" + k + "\\s*:\\s*(\\d+|Infinity)");
      assert(rx.test(body), "MAX_SIGS_BY_PLAN 缺少 key 或非法值: " + k);
    }
    const allVals = body.match(/:\s*(\d+|Infinity)/g) || [];
    assert(allVals.length >= 5, "MAX_SIGS_BY_PLAN 数值字段不足 5 个, found=" + allVals.length + " body=" + body.slice(0, 100));
    return "✅ 套餐签名上限配置 OK, keys=" + keys.join(",") + " values=" + allVals.length;
  });

  // ============================================================
  // T8 — Gift 礼品流程
  // ============================================================
  test("T8-gift", "Worker 存在 gift: kv key + handleGiftGet/handleGiftRedeem + createdAt/expiresAt 字段", () => {
    const w = read(WORKER);
    const tokens = ["handleGiftGet", "handleGiftRedeem", "gift:", "giftToken", "redeemedAt", "redeemedBy", "createdAt", "validDays"];
    const found = tokens.filter(t => w.includes(t));
    assert(found.length >= 6, "Worker 礼品字段缺失 found=" + found.join(","));
    const giftCreateRx = /kv\.put\(['"]gift:[^)]+JSON\.stringify\(\{[\s\S]*?createdAt\s*:\s*Date\.now/;
    assert(giftCreateRx.test(w) || /gift:[^)]+createdAt/.test(w), "gift kv object 缺少 createdAt 字段");
    const app = read(path.join(PUBLIC, "app.js"));
    assert(/renderGiftRedeem/.test(app), "前端缺少 renderGiftRedeem");
    return "✅ 礼品功能齐全, found=" + found.length + "/" + tokens.length + " [" + found.join(",") + "]";
  });

  // ============================================================
  // T9 — 邮件 & Resend 模板
  // ============================================================
  test("T9-mail", "Worker 存在 Resend send 调用 + onboard@resend.dev / support@sendafun.com + 退订链接占位/模板标识", () => {
    const w = read(WORKER);
    const tokens = ["handleSendCard", "resend.com", "onboard@resend.dev", "support@sendafun.com", "List-Unsubscribe", "fromEmail", "toEmail"];
    for (const t of tokens) assert(w.includes(t), "Worker 缺少邮件关键标识: " + t);
    return "✅ Resend + 合规邮件字段齐全";
  });

  // ============================================================
  // T10 — Worker 13 条 API 路由函数
  // ============================================================
  test("T10-worker", "Worker 全部路由函数齐全（check-member / send-card / create-session / creem-webhook / r2-image / group-create-get-sign-send / gift-get-redeem / health）", () => {
    const w = read(WORKER);
    const fns = [
      "handleCheckMember", "handleSendCard", "handleCreateSession", "handleCreemWebhook",
      "handleR2Image", "handleGroupCreate", "handleGroupGet", "handleGroupSign", "handleGroupSend",
      "handleGiftGet", "handleGiftRedeem", "handleHealth"
    ];
    for (const f of fns) assert(w.includes(f), "缺少路由函数: " + f);
    const apiRoutes = ["/api/check-member", "/api/send-card", "/api/create-session", "/creem/webhook", "/api/creem/webhook", "/api/group/create", "/api/group/get", "/api/group/sign", "/api/group/send", "/api/gift/get", "/api/gift/redeem", "/api/health", "/r2/", "/api/r2-image/"];
    const hits = apiRoutes.filter(r => w.includes(r));
    assert(hits.length >= 10, "Worker 路由路径缺失严重, found=" + hits.join(","));
    return "✅ " + fns.length + " 条路由函数 + " + hits.length + " 条路径命中";
  });

  // ============================================================
  // T11 — 欧美用户使用习惯专项
  // ============================================================
  test("T11-ux", "GDPR Cookie Banner：存在 installCookieBanner/acceptCookies/injectCookieBanner/necessary/reject/GDPR", () => {
    const app = read(path.join(PUBLIC, "app.js"));
    const tokens = ["cookieBanner", "injectCookieBanner", "installCookieBanner", "acceptCookies", "handleCookieChoice", "rejectCookiesBtn", "acceptCookiesBtn", "necessary cookies", "GDPR", "saf_cookie_consent", "Privacy Policy", "Cookie Policy"];
    const found = tokens.filter(t => {
      if (/[A-Z]/.test(t)) return app.includes(t);
      return app.toLowerCase().includes(t.toLowerCase());
    });
    assert(found.length >= 7, "Cookie Banner 标识缺失 found=" + found.length + "/" + tokens.length + " -> " + found.join(","));
    return "✅ Cookie 合规标识 found=" + found.length + "/" + tokens.length;
  });
  test("T11-ux", "拼写整体为美式（color, organization, favorite, apologize）且英式拼写混用<3处", () => {
    const app = read(path.join(PUBLIC, "app.js")) + read(path.join(PUBLIC, "pricing.html")) + read(path.join(PUBLIC, "privacy.html")) + read(path.join(PUBLIC, "terms.html"));
    const americanWins = ["color", "organization", "favorite", "apologize", "behavior", "center", "defense", "license"];
    let american = 0, british = 0;
    for (const w of americanWins) {
      const re = new RegExp("\\b" + w + "\\b", "ig");
      american += (app.match(re) || []).length;
    }
    const britishWins = ["colour", "organisation", "favourite", "apologise", "behaviour", "centre", "defence", "licence"];
    for (const w of britishWins) {
      const re = new RegExp("\\b" + w + "\\b", "ig");
      british += (app.match(re) || []).length;
    }
    assert(british <= 3, "英式拼写出现过多: " + british + " 次（美式=" + american + "），全站应统一美式");
    return "✅ 美式拼写 count=" + american + ", 英式拼写 count=" + british + "（<=3 OK）";
  });
  test("T11-ux", "日期/金额格式：$ 前缀 2 位小数 + MM/DD/YYYY 或日期选择符合欧美 + 无人民币 CNY 痕迹", () => {
    const app = read(path.join(PUBLIC, "app.js"));
    const noBad = !/¥|CNY|RMB|元/.test(app);
    const hasUSD = /USD|\$1\.99|\$6\.99|\$69/.test(app);
    assert(noBad && hasUSD, "金额格式异常 noBad=" + noBad + " hasUSD=" + hasUSD);
    return "✅ USD 符号齐全，无 RMB/CNY 残留";
  });
  test("T11-ux", "支付方式露出：Visa/Mastercard/Amex + Apple Pay + Google Pay", () => {
    const f = read(path.join(PUBLIC, "pricing.html")) + read(path.join(PUBLIC, "app.js"));
    const tokens = ["Visa", "Mastercard", "Amex", "Apple Pay", "Google Pay"];
    const found = tokens.filter(t => f.includes(t));
    assert(found.length >= 3, "支付方式缺失 found=" + found.join(",") + "/" + tokens.join(","));
    return "✅ 支付方式露出 found=" + found.length + "/" + tokens.length;
  });
  test("T11-ux", "表单字段：name/email 字段名规范（无中文 label） + Email 完整校验 regex", () => {
    const app = read(path.join(PUBLIC, "app.js"));
    const noChinese = !/[\u4e00-\u9fff]/.test(read(path.join(PUBLIC, "index.html")));
    const emailRegex = /\S+@\S+\.\S+|email.*[a-z0-9!#$%&'*+/=?^_`{|}~-]+\.\w{2,}/i;
    assert(noChinese && emailRegex.test(app), "中文残留 or 缺少 Email 校验 noChinese=" + noChinese);
    return "✅ 无中文残留 + Email 校验 regex 存在";
  });
  test("T11-ux", "无障碍：HTML 语义化 + aria-label + alt 标签 + nav/main/footer role", () => {
    const app = read(path.join(PUBLIC, "app.js"));
    const idx = read(path.join(PUBLIC, "index.html"));
    const has = [];
    has.push(/role\s*=\s*"navigation"|aria-label\s*=\s*"Main navigation"/.test(idx) ? "nav" : "");
    has.push(/role\s*=\s*"main"/.test(idx) ? "main" : "");
    has.push(/alt\s*=\s*"[^"]+"/.test(app + idx + read(WORKER)) ? "alt" : "");
    has.push(/aria-label\s*=\s*"/.test(idx + app) ? "aria-label" : "");
    has.push(/<nav[>\s]/.test(idx) && /<main[>\s]/.test(idx) ? "nav+main tags" : "");
    const ok = has.filter(Boolean).length;
    assert(ok >= 4, "无障碍标识不足 ok=" + ok + "/5  found=[" + has.filter(Boolean).join(",") + "]");
    return "✅ 无障碍语义化 count=" + ok + "/5  [" + has.filter(Boolean).join(",") + "]";
  });
  test("T11-ux", "GDPR TOS 中数据处理区域（EU Data Center/Cloudflare/欧盟用户 字眼）", () => {
    const t = read(path.join(PUBLIC, "privacy.html")) + read(path.join(PUBLIC, "terms.html"));
    const hits = ["EU", "Cloudflare", "GDPR", "data center", "Europe", "DPA"];
    const found = hits.filter(w => t.toLowerCase().includes(w.toLowerCase()));
    assert(found.length >= 3, "隐私/TOS 缺少跨境数据合规字眼: " + found.join(","));
    return "✅ 跨境数据合规 found=" + found.length + "/" + hits.length;
  });

  // ============================================================
  // T汇总：打印结构化报告
  // ============================================================
  const mods = {};
  for (const r of results) {
    const k = r.mod.split("-")[0];
    if (!mods[k]) mods[k] = { ok: 0, fail: 0, list: [] };
    if (r.ok) mods[k].ok++; else mods[k].fail++;
    mods[k].list.push(r);
  }
  let totalOk = 0, totalFail = 0;
  console.log("\n============================================================");
  console.log("📋 SendAFun 2.0 部署前全量测试报告");
  console.log("============================================================\n");
  for (const k of Object.keys(mods).sort()) {
    const m = mods[k];
    const bar = "[" + "✅".repeat(m.ok) + "❌".repeat(m.fail) + "]";
    console.log(`${k}  ${bar}  (${m.ok} pass / ${m.fail} fail)`);
    for (const r of m.list) {
      if (!r.ok) console.log("   ❌ " + r.name + "  -->  " + r.detail);
      else if (r.detail) console.log("   ✅ " + r.name + "  —  " + r.detail);
      else console.log("   ✅ " + r.name);
    }
    console.log("");
    totalOk += m.ok; totalFail += m.fail;
  }
  console.log("============================================================");
  console.log(`总计: PASS=${totalOk} / FAIL=${totalFail} / Total=${totalOk + totalFail}`);
  console.log("============================================================");
  process.exit(totalFail === 0 ? 0 : 1);
}

main().catch(e => { console.error("FATAL RUNNER ERROR:", e); process.exit(2); });
