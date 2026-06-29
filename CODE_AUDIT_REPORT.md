# SendAFun 代码审计报告

> 审计日期：2026-06-28  
> 审计范围：`E:\网站项目\sendafun\` 全部代码  
> 审计视角：欧美资深工程师/QA/安全审计员挑刺视角

---

## 项目架构概览

| 组件 | 技术栈 | 文件 |
|------|--------|------|
| 前端 | 纯 HTML/CSS/Canvas JS（单文件模板） | `templates/card-template.html` |
| 构建脚本 | Node.js | `build-script/generate-cards.js` |
| 图片处理 | Python + PIL | `build-script/process-images.py` |
| 后端 API | Cloudflare Worker + KV | `worker/src/index.js` |
| 支付 | Creem | Worker 内集成 |
| 邮件 | MailChannels | Worker 内集成 |
| 配置 | JSON | `source/cards-config.json` |

---

## P0 — 致命问题（上线即崩溃）

### 1. 支付流程完全是假的 — 零收入

**文件**: `card-template.html` L1012-1028

```javascript
function simulatePaymentThenDelivery() {
  showToast('💳 Processing payment...', 2000);
  setTimeout(function() {
    showToast('✅ Payment successful!', 2000);
    setTimeout(function() {
      if (state.delivery === 'email') {
        openModal(modalDelivery);  // 直接跳到发卡！
      }
    }, 2200);
  }, 2500);
}
```

**问题**: 用户点击 "Continue to Checkout" → "Continue to Creem" 后，代码只是 `setTimeout` 假装处理了 2.5 秒，然后直接打开发卡弹窗。**从未调用 `/api/create-session` 创建真正的 Creem 支付会话**。用户不需要付一分钱就能发卡。

**Worker 侧**的 `handleSendCard` 虽然检查了 `getPermission()`，但由于下面的字段名不匹配问题，这个检查也形同虚设。

**影响**: 零收入。这个网站上线就是免费工具。

---

### 2. 前后端 API 字段名完全不匹配 — 发卡 API 永远失败

**前端** `sendCard()` (L1030-1067):
```javascript
fetch('/api/send-card', {
  body: JSON.stringify({
    cardSlug: '__CARD_SLUG__',
    recipientEmail: recipientEmail,   // ← 前端发的
    senderName: senderName.value,     // ← 前端发的
    message: state.text,
    font: state.fontFamily,
    color: state.color,
    filter: state.filter
  })
})
```

**后端** `handleSendCard()` (Worker L190-236):
```javascript
var b = await request.json();
if(!b.fromEmail || !b.toEmail) return err("fromEmail and toEmail required");
// 后端期望的：fromEmail, toEmail, fromName, toName, imageUrl, backgroundColor, accentColor, sticker
```

| 前端发送 | 后端期望 | 匹配？ |
|---------|---------|--------|
| `recipientEmail` | `toEmail` | ❌ |
| `senderName` | `fromName` | ❌ |
| —（缺失） | `fromEmail` | ❌ |
| —（缺失） | `toName` | ❌ |
| `cardSlug` | —（不使用） | — |
| `font` | —（不使用） | — |
| `color` | —（不使用） | — |
| `filter` | —（不使用） | — |

**结果**: API 永远返回 `{"error":"fromEmail and toEmail required"}`，发卡功能 100% 失败。前端 `catch` 块反而显示 "Card sent! (offline mode)" ——用户以为发出去了，实际什么都没发生。

---

### 3. Creem Price ID 是占位符 — 支付会话创建必然报错

**文件**: `worker/src/index.js` L108

```javascript
const PRICE_SINGLE = "price_single_card";
const PRICE_ANNUAL  = "price_annual_sub";
```

这不是真实的 Creem price ID（格式应为 `price_xxxxxxxxxxxx`）。`createCreemSession()` 会向 Creem API 发送无效的 price_id，返回 4xx 错误。

---

### 4. 年度会员权限 TTL 被截断为 1 天 — 付费用户次日失去访问权

**文件**: `worker/src/index.js` L56-62

```javascript
const PP = "perm:", PT = 86400;  // PT = 1 day in seconds

async function grantPermission(kv, email, plan, exp) {
  const k = PP + email.toLowerCase();
  const v = JSON.stringify({email, plan, grantedAt: Date.now(), expiresAt: exp, active: true});
  const t = Math.min(PT, Math.ceil((exp - Date.now()) / 1000));  // ← BUG
  await kv.put(k, v, {expirationTtl: t > 0 ? t : PT});
}
```

`Math.min(86400, 31536000)` = `86400`。年度会员（365天）的 KV 记录在 24 小时后自动过期。用户付了 $19.99，第二天就发不了卡了。

**正确写法**: `Math.max(PT, ...)` 或直接用 `Math.ceil((exp - Date.now()) / 1000)`。

---

### 5. 图片滤镜完全失效 — 参数传递错误

**文件**: `card-template.html` L399-404

```javascript
const FILTERS = {
  none:    { fn: function(ctx, buf) { return buf } },
  warm:    { fn: function(ctx, buf) { applyWarm(buf) } },     // ← 只传了1个参数
  cool:    { fn: function(ctx, buf) { applyCool(buf) } },
  bw:      { fn: function(ctx, buf) { applyBW(buf) } },
  vintage: { fn: function(ctx, buf) { applyVintage(buf) } },
};
```

但 `applyWarm` 的定义是：
```javascript
function applyWarm(ctx, data) {  // ← 需要2个参数
  for (let i = 0; i < data.data.length; i += 4) {  // data 是 undefined → TypeError
```

调用 `applyWarm(buf)` 时，`ctx = buf`（ImageData），`data = undefined`。`data.data` 抛出 `TypeError`，被 `try/catch` 静默吞掉。**所有滤镜按钮都是死的**。

---

### 6. 定时提醒功能完全断裂 — KV Key 不匹配

**写入** (`handleSetReminder` L295-307):
```javascript
await kv.put("rem:" + b.email + ":" + b.date, JSON.stringify({...}));
```

**读取** (`handleCronReminders` L309-335):
```javascript
var ik = "reminders:by-date:" + dt;  // ← 完全不同的 key 前缀！
var ir = await kv.get(ik, "text");
```

写入的 key 是 `rem:email:2026-06-28`，读取的 key 是 `reminders:by-date:2026-06-28`。**提醒永远不会被触发**。而且写入时也没有创建 `reminders:by-date:` 索引。

---

## P1 — 严重问题（安全漏洞 / 功能缺陷）

### 7. XSS 漏洞 — showToast 使用 innerHTML

**文件**: `card-template.html` L934-944

```javascript
function showToast(msg, duration) {
  const toast = document.createElement('div');
  toast.innerHTML = msg;  // ← 直接注入 HTML
```

多处调用将用户输入或 API 返回数据拼入 toast：
```javascript
showToast('✅ Welcome back' + (data.name ? ', ' + data.name : '') + '!');
```
如果 `data.name` 被攻击者控制（例如通过 lookup-user API 的响应投毒），可以注入任意 HTML/JS。

---

### 8. CORS 全开放 — 任何网站都可调用 API

**文件**: `worker/src/index.js` L104

```javascript
function json(d, s) {
  return new Response(JSON.stringify(d), {
    headers: {"Access-Control-Allow-Origin": "*", ...}
  });
}
```

所有 API 端点（包括创建支付会话、发卡、送礼）都允许任意来源跨域请求。攻击者可以在自己的网站上：
- 批量调用 `/api/create-session` 消耗你的 Creem API 额度
- 调用 `/api/send-card` 用你的 MailChannels 额度发垃圾邮件
- 调用 `/api/gift-free-card` 给自己发免费卡

---

### 9. QR 码是假的 — 无法扫描

**文件**: `card-template.html` L949-989

```javascript
function drawQR() {
  // Simplified QR via canvas - draw a placeholder matrix
  // Random-ish data dots
  for (let i = 0; i < 200; i++) {
    const x = (Math.abs((url.charCodeAt(i % url.length) * 7 + i * 13)) % ...) + cell*5;
    const y = (Math.abs((url.charCodeAt((i+1) % url.length) * 11 + i * 7)) % ...) + cell*5;
    qrCtx.fillRect(x, y, cell, cell);
  }
```

这不是 QR 码编码，只是画了三个定位标记 + 随机点阵。任何手机扫码都会失败。"Open on phone" 功能完全不可用。

---

### 10. Undo 功能会破坏背景图

**文件**: `card-template.html` L637-652

```javascript
function pushHistory() {
  const snap = JSON.stringify(state);  // state.bgImg 是 Image 对象
  state.history.push(snap);
}
function undo() {
  const snap = JSON.parse(state.history[state.historyIdx]);
  Object.assign(state, snap);  // bgImg 被覆盖为 {} 
  render();  // bgImg.complete 是 undefined → 画纯色背景
}
```

`JSON.stringify(new Image())` 返回 `"{}"`。Undo 后 `state.bgImg` 变成空对象，canvas 回退到纯色背景。

---

### 11. 卡片配置的图片路径与实际文件不匹配

**文件**: `source/cards-config.json`

```json
"bgImage": "public/birthday-mom-01.webp"
```

但实际图片在 `source/images/{category}/` 目录下（由 `process-images.py` 生成）。`generate-cards.js` 读取 `path.join(ROOT, 'source', card.bgImage)` = `source/public/birthday-mom-01.webp`——这个路径不存在。

构建脚本会跳过所有卡片或报错，`dist/` 下的 HTML 可能是之前某次手动修正后生成的，与配置文件不一致。

---

### 12. MailChannels 免费层已停用

**文件**: `worker/src/index.js` L72-82

MailChannels 的 Cloudflare 免费集成已于 2024 年停用。`sendMailChannels()` 调用 `https://api.mailchannels.net/tx/v1/send` 会返回 403 或连接失败。所有邮件发送（发卡、送礼、提醒）都不会工作，除非配置了付费的 MailChannels 账户并完成 SPF/DKIM 验证。

---

### 13. 礼物兑换无速率限制 — 可暴力破解

**文件**: `worker/src/index.js` L281-293

```javascript
async function handleRedeemGift(request, kv) {
  // GET 请求，无 RateLimiter
  var token = url.searchParams.get("token");
```

`handleRedeemGift` 是 GET 请求，没有经过 `rl.check()`。token 格式为 `gift_` + 16 字符 base36（约 80 bit），虽然暴力破解空间大，但缺少速率限制仍是不良实践。更严重的是，兑换后 `freecard` 额度被写入 KV，攻击者可以通过不断尝试消耗 KV 写入配额。

---

## P2 — 中等问题（代码质量 / UX）

### 14. Preset 文本包含原始 HTML 实体

```javascript
const presetTexts = {
  cry: "Make them cry &mdash; the good kind &#x1f622;",
```

这些文本通过 `data-preset` 属性读取后直接设为 `textInput.value`，用户会在输入框和贺卡上看到字面的 `&mdash;` 和 `&#x1f622;`，而不是破折号和 emoji。

---

### 15. ogImage 指向不存在的文件

```json
"ogImage": "https://sendafun.com/og/birthday-mom-01.jpg"
```

`dist/og/` 目录不存在。所有社交分享预览图都是 404。

---

### 16. Worker 缺少 wrangler.toml 和 package.json

`worker/` 目录只有 `src/index.js`，没有：
- `wrangler.toml`（KV 绑定、环境变量、Cron 触发器配置）
- `package.json`（依赖声明）
- `tsconfig.json`

Worker 无法直接 `wrangler deploy`。

---

### 17. 社区轮播和推荐卡片是硬编码假数据

```html
<div class="carousel-item">
  <div class="carousel-item-text">You're the best!</div>
  <div class="carousel-item-author">by Sarah K.</div>
```

4 个 "Cards made by others" 和 4 个 "You might also like" 全是写死的假数据，不可点击，不链接到任何卡片。

---

### 18. filterByStyle 是空操作

```javascript
function filterByStyle(style) {
  document.querySelector('.masonry-section').scrollIntoView({ behavior: 'smooth' });
}
```

"See all Warm & Cozy →" 按钮点击后只是滚动到页面底部，不做任何筛选。

---

### 19. 无障碍问题 — 禁止缩放

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

违反 WCAG 2.1 SC 1.4.4 (Resize Text)。视力障碍用户无法缩放页面。欧美市场可能面临 ADA 诉讼。

---

### 20. 缺少 SEO 基础设施

整个项目没有：
- `robots.txt`
- `sitemap.xml`
- `_headers`（Cloudflare Pages）
- `_redirects`
- `manifest.json` / PWA 配置
- 结构化数据 (JSON-LD Schema)

---

### 21. 邮箱验证过于简陋

```javascript
if (!email || !email.includes('@')) {
  showToast('Please enter a valid email');
```

`a@b` 就能通过验证。Worker 端也无正则验证。应使用 RFC 5322 正则或至少 `/\S+@\S+\.\S+/`。

---

### 22. 无 CSP (Content-Security-Policy)

Worker 返回的 HTML 没有 CSP 头。允许注入的脚本（通过 XSS 漏洞）可以加载外部资源。

---

## P3 — 小问题 / 代码异味

| # | 问题 | 位置 |
|---|------|------|
| 23 | Worker 使用 `var` 而非 `const/let` | `worker/src/index.js` 全局 |
| 24 | 全局变量 `CREEM_API_KEY` 等在 `fetch` 中赋值，多请求并发时有竞态风险 | L109-113 |
| 25 | `cards-config.json` 只有 12 张卡，但首页 masonry 随机选 12-20 张，可能展示全部 | generate-cards.js L468 |
| 26 | Canvas `toDataURL('image/png')` 在背景图跨域时会抛 SecurityError | L1072 |
| 27 | `maximum-scale=1.0` 同时出现在模板和生成页面中 | 无障碍 |
| 28 | footer 写 `© 2026` 硬编码年份 | card-template.html L385 |
| 29 | `process-images.js` 标注 "不完整，勿用" 但仍存在 | DEVELOPMENT.md |
| 30 | Worker `esc()` 函数不转义单引号 `'`，在单引号属性上下文中仍有 XSS 风险 | L84 |

---

## 总结评分

| 维度 | 评分 | 说明 |
|------|------|------|
| **功能完整性** | 2/10 | 支付是假的，发卡 API 字段不匹配，滤镜不工作，QR 是假的，提醒不触发 |
| **安全性** | 2/10 | 支付绕过、XSS、CORS 全开、无 CSRF、无 CSP |
| **代码质量** | 4/10 | 构建脚本尚可，Worker 代码可读但 bug 密集，前端代码有结构性问题 |
| **可部署性** | 1/10 | 无 wrangler.toml、无 package.json、Price ID 是假的、MailChannels 已停用 |
| **SEO** | 2/10 | 无 sitemap、无 robots、ogImage 404、无结构化数据 |
| **无障碍** | 3/10 | 禁止缩放、部分 aria、无键盘导航支持 |

**总评: 2.3/10 — 不可上线，需要大规模重构。**

核心问题不在代码风格，而在**前后端完全脱节**——OpenClaw 分别生成了前端模板和后端 Worker，但两者从未对接过。前端发的字段后端不认，后端要的字段前端不发；支付流程前端自己演了一遍，后端毫不知情。这不是修几个 bug 的问题，是需要重新设计 API 契约、重写支付流程、修复全部集成点的系统性问题。
