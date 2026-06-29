# SendAFun 开发文档 vs 代码实现 — 差距分析报告

> 分析日期：2026-06-28
> 对比基准：项目开发文档（2026-06-27 版）vs 实际代码
> 分析视角：欧美资深工程师 + 产品经理联合审查

---

## 一、总体结论

**开发文档质量：8/10** — 产品定义清晰，用户画像详实，功能规划完整，安全意识到位。

**代码实现质量：2.3/10** — 文档描述了 100% 的功能，代码实现了约 30% 的骨架，其中一半是坏的。

**核心问题：OpenClaw 写了一份很好的产品文档，但生成代码时完全没有按照文档执行。** 文档说"前端调 Worker POST /api/create-session"，代码里前端用 setTimeout 假装支付。文档说"Webhook → KV 写入"，代码里 KV 的 key 前缀都对不上。这不是"差几个 bug"，是"文档读了一遍，然后凭记忆瞎写"。

---

## 二、确认的 Bug（文档验证 + 代码实证）

### 2.1 支付流程 — 代码完全偏离文档设计

| 文档描述 | 代码实现 | 判定 |
|---------|---------|------|
| 前端调 `POST /api/create-session` 创建 Creem 会话 | 前端 `simulatePaymentThenDelivery()` 用 setTimeout 假装支付 | ❌ P0 |
| 跳转 Creem Hosted Checkout 完成支付 | 从不跳转，从不调 API | ❌ P0 |
| Creem Webhook → Worker 写 KV 权限 | Worker 有 webhook 处理，但前端从不触发支付流程 | ❌ P0 |
| Success URL 跳回 → 轮询等待 → 展示送达选择 | 无 Success 页面，无轮询逻辑 | ❌ P0 |
| 过渡信任页：金额+支付方式+"redirected to Creem's secure page" | 有 modal 但只显示"Continue to Creem"，点击后走假支付 | ❌ P0 |

**文档明确写了正确流程（第 5.2 节 + 第 8.21 节 ①②），代码完全无视。**

### 2.2 前后端 API 字段不匹配 — 文档定义了契约，代码两边各写各的

#### send-card API

| 文档隐含字段 | 前端发送 | 后端期望 | 匹配？ |
|-------------|---------|---------|--------|
| 收卡人邮箱 | `recipientEmail` | `toEmail` | ❌ |
| 送卡人姓名 | `senderName` | `fromName` | ❌ |
| 送卡人邮箱 | —（缺失） | `fromEmail`（必需） | ❌ |
| 收卡人姓名 | —（缺失） | `toName` | ❌ |
| 卡片样式 | `cardSlug`, `font`, `color`, `filter` | `imageUrl`, `backgroundColor`, `accentColor`, `sticker` | ❌ |

#### set-reminder API

| 文档定义 | 前端发送 | 后端期望 | 匹配？ |
|---------|---------|---------|--------|
| key=`reminder:{email}:{date}` | — | 写入 `rem:{email}:{date}` | ❌ key 格式不对 |
| 日期字段 | `month`, `day`（分开传） | `date`（单个字段） | ❌ |
| 读取 key | — | 读取 `reminders:by-date:{date}` | ❌ 与写入不匹配 |

#### gift-free-card API

| 文档描述 | 前端发送 | 后端期望 | 匹配？ |
|---------|---------|---------|--------|
| 送朋友免费卡 | `{ email: state.userEmail }` | `{ fromEmail, toEmail, fromName, toName, message }` | ❌ |

#### lookup-user API

| 文档描述 | 前端期望 | 后端返回 | 匹配？ |
|---------|---------|---------|--------|
| 返回购买记录/会员状态 | `data.name`（用于显示"Welcome back, {name}"） | `{email, isMember, memberPlan, memberExpiresAt, cardsSent, giftsSent}` — 无 name 字段 | ❌ |

**结论：4 个核心 API 全部字段不匹配。前端和后端像是两个人在两个房间里分别写的，从未对过接口文档。**

### 2.3 年费会员 TTL 截断 — 文档说 365 天，代码给 1 天

**文档第 5.7 节**："购买权限 24h TTL 自动过期" — 这是针对**单张购买**的安全措施。

**代码**：
```javascript
const PT = 86400;  // 1 day
const t = Math.min(PT, Math.ceil((exp - Date.now()) / 1000));
```
`Math.min(86400, 31536000)` = 86400。年费会员付 $19.99，KV 记录 24 小时后过期。

**文档意图**：单张 = 24h TTL，年费 = 365 天 TTL。代码用 `Math.min` 把两种情况都截断为 1 天。

### 2.4 滤镜参数错误 — 文档列了 4 种滤镜，全部不工作

**文档第 8.6 节**：4 种色彩滤镜（暖/冷/黑白/复古），"默认应用最佳推荐滤镜"。

**代码**：`applyWarm(buf)` 只传 1 个参数，函数定义需要 2 个（`ctx, data`）。`data = undefined` → TypeError → 被 try/catch 静默吞掉。4 个滤镜按钮全是死的。

### 2.5 QR 码是假的 — 文档提到二维码功能

**代码**：`drawQR()` 画随机点阵，不是 QR 编码。任何手机扫码失败。

### 2.6 Undo 破坏背景图

**代码**：`JSON.stringify(state)` 把 Image 对象序列化为 `{}`，Undo 后背景图丢失。

### 2.7 MailChannels 已停用 — 文档指定用 MailChannels

**文档第 3 节**：送达用 MailChannels（免费邮件）。

**现实**：MailChannels 的 Cloudflare 免费集成已于 2024 年停用。`sendMailChannels()` 调用 `api.mailchannels.net` 会返回 403。**这是文档级别的过时，不仅仅是代码问题。**

---

## 三、文档揭示的新问题（之前审计未发现）

### 3.1 Success URL / Cancel URL 路径不匹配

| | 文档（8.21 ②） | 代码 |
|---|---|---|
| Success URL | `/payment-success?session_id={CHECKOUT_SESSION_ID}` | `/success?session_id={CHECKOUT_SESSION_ID}` |
| Cancel URL | `/payment-cancel` | `/` |

路径不一致，即使 Creem 后台按文档配置，代码生成的 URL 也对不上。

### 3.2 提醒提前天数不匹配

| | 文档（8.10 节） | 代码 |
|---|---|---|
| 提前提醒 | 到日期前 **3 天** | 检查当天 + 明天 + 后天（**1-2 天**） |

代码 `handleCronReminders` 检查 `[今天, 明天, 后天]`，文档要求提前 3 天通知。

### 3.3 回送价格逻辑完全缺失

**文档第 8.20 节**明确定义了回送定价：
- 首次回送：$0.99（半价，新用户转化）
- 后续回送：$1.99（正常价）
- 年费用户：免费

**代码**：无任何回送定价逻辑。`handleSendCard` 只检查有没有权限或免费卡额度，不区分首次/后续，不支持 $0.99 价格。

### 3.4 Re-engagement 邮件缺失

**文档第 8.21 ④ 节**：付款后 3 天自动发 re-engagement 邮件。

**代码**：无此功能。Cron 只检查提醒，不发 re-engagement 邮件。

### 3.5 收卡人页面缺少 OG 标签

**文档第 8.21 ⑧ 节**：`/view/{token}` 必须包含 OG 标签（og:title, og:image, og:description）。

**代码**：`renderCardHtml()` 生成的 HTML 无任何 OG 标签。分享到社交媒体无预览图。

### 3.6 邮件标题格式不匹配

**文档第 8.21 ③ 节**：邮件标题包含送卡人姓名，用 "💌 Jennifer sent you a birthday card!"

**代码**：
```javascript
var su = String.fromCodePoint(127865) + " " + (b.fromName||"Someone") + " sent you a card!";
```
- `127865` = 🍱（便当盒 emoji），不是 💌（情书 emoji = 128140）
- 标题说 "a card" 而非 "a birthday card" — 文档强调包含节日类型

### 3.7 回复链接路由不存在

**代码** `renderCardHtml()` 中：
```javascript
var ru = SITE_URL + "/send?replyTo=" + encodeURIComponent(card.fromEmail);
```
"Reply with a Card" 按钮链接到 `/send?replyTo=email`，但 Worker 没有 `/send` 路由，Pages 也没有 `/send` 页面。点击会 404。

### 3.8 免费卡数量与文档不符

**代码**：兑换后写入 `{remaining: 3}`（3 张免费卡）。

**文档**：未明确指定数量，但第 7.2 节描述"送朋友免费卡"是单张概念（"填朋友邮箱 → Worker 生成兑换码 → 朋友领取卡"），暗示 1 张而非 3 张。需确认产品意图。

### 3.9 卡片数据 TTL 过短

**代码**：`kv.put("card:" + token, ..., {expirationTtl: 864e4})` = 10 天。

收卡人如果 10 天后打开邮件链接，卡片已过期消失。文档未明确 TTL，但考虑到生日卡可能被延迟查看，10 天偏短。建议 30-90 天。

---

## 四、文档描述但代码完全缺失的功能

| # | 功能 | 文档章节 | 代码状态 |
|---|------|---------|---------|
| 1 | **支付过渡信任页**（金额+支付方式+跳转说明） | 5.2, 8.9, 8.21① | ❌ 只有简单 modal，无信任元素 |
| 2 | **Success URL 轮询页面** | 8.21② | ❌ 不存在 |
| 3 | **邮件防垃圾箱**（SPF/DKIM/DMARC + 提示检查垃圾箱） | 8.21③ | ❌ 不存在 |
| 4 | **Re-engagement 邮件**（3 天后跟进） | 8.21④ | ❌ 不存在 |
| 5 | **年费推荐弹窗**（支付后推荐 $19.99/year） | 8.16④ | ❌ 不存在 |
| 6 | **回送功能**（收卡人回复卡片） | 8.11, 8.20 | ❌ 路由不存在 |
| 7 | **回送半价逻辑**（$0.99 首次） | 8.20 | ❌ 不存在 |
| 8 | **OG 标签**（收卡人页面社交分享） | 8.21⑧ | ❌ 不存在 |
| 9 | **首页轮播**（手动滑动展示作品） | 8.3 | ❌ 是硬编码假数据 |
| 10 | **分类页瀑布流** | 8.4 | ❌ 分类页未生成 |
| 11 | **Mobile First 键盘适配**（visualViewport API） | 8.16① | ❌ 禁止缩放反而违反无障碍 |
| 12 | **默认展示最佳效果**（预设祝福语+最佳字体+滤镜） | 8.21⑦ | ❌ 打开是空白模板 |
| 13 | **"Customize — it's easy" 文案** | 8.6 | ❌ 用的是 "Customize" |
| 14 | **Cancel anytime 标注** | 8.19 | ❌ 不存在 |
| 15 | **付款前展示送达选项** | 8.8 | ❌ 送达选项在付款后才出现 |
| 16 | **风格维度筛选**（warm/funny/artistic/hand-drawn） | 8.18 | ❌ `filterByStyle()` 是空操作 |
| 17 | **R2 存储集成** | 6.1-6.4 | ❌ 未实现（文档说 3 天后开通） |
| 18 | **构建脚本拆分**（sitemap/cards JSON 拆分） | 9.3 | ❌ 只有 generate-cards.js |
| 19 | **robots.txt** | 9.3 | ❌ 不存在 |
| 20 | **sitemap.xml** | 9.3 | ❌ 不存在 |
| 21 | **_headers / _redirects** | 部署规范 | ❌ 不存在 |
| 22 | **wrangler.toml** | 11 部署 | ❌ 不存在 |
| 23 | **Cron Trigger 配置** | 8.10 | ❌ 代码有 handler 但无 wrangler 配置 |
| 24 | **广告位预留**（adsEnabled 变量） | 8.22 | ❌ 不存在 |
| 25 | **Google Analytics** | 3 | ❌ 不存在 |

**25 项文档描述的功能，代码完全缺失。**

---

## 五、文档本身的问题

### 5.1 MailChannels 已停用 ⚠️
文档第 3 节指定 MailChannels 作为邮件服务，但 MailChannels 的 Cloudflare 免费集成已于 2024 年停用。需要更换邮件服务商（Resend、SendGrid、Amazon SES 等）。

### 5.2 Creem API 格式未验证
文档未包含 Creem API 的具体格式文档。代码使用 `https://api.creem.io/v1/checkout/sessions` 和 `X-API-KEY` header，需对照 Creem 最新 API 文档验证。

### 5.3 "购买权限 24h TTL" 表述模糊
文档第 5.7 节说"购买权限 24h TTL 自动过期"，但没有明确说明这只适用于单张购买。代码误读为所有权限都 24h 过期。建议改为"单张购买权限 24h TTL；年费会员权限 365 天 TTL"。

### 5.4 免费卡数量未定义
文档说"送朋友免费卡"但未明确每次赠送几张。代码给了 3 张，需确认产品意图。

---

## 六、做得对的部分（公允评价）

| 项目 | 评价 |
|------|------|
| Worker API 路由覆盖 | ✅ 文档列的 9 个 API 路由全部存在 |
| Webhook 签名验证 | ✅ HMAC-SHA256 + 时间窗口校验，实现正确 |
| RateLimiter | ✅ IP+邮箱双维度限流 5次/分钟，与文档一致 |
| lookup-user 无注册设计 | ✅ 实现了邮箱查 KV，符合文档"无注册"理念 |
| 收卡人页面 `/view/{token}` | ✅ Worker 渲染 HTML，有品牌曝光和回复入口（虽然链接坏了） |
| 构建脚本增量机制 | ✅ 缓存+hash 比对，逻辑合理 |
| 图片处理脚本 | ✅ HSL 偏移+三尺寸+WebP，质量过关 |
| KV 数据结构设计 | ✅ perm/gift/freecard/cards:sent 等 key 命名有层次 |

---

## 七、修复优先级矩阵

### P0 — 不修不能上线（收入/安全/核心流程）

| # | 问题 | 修复量 |
|---|------|--------|
| 1 | 支付流程重写：前端接 `/api/create-session` → Creem 跳转 → Success URL 轮询 | 大 |
| 2 | 4 个 API 字段对齐：send-card / set-reminder / gift-free-card / lookup-user | 中 |
| 3 | Creem Price ID 替换为真实 ID | 小 |
| 4 | 年费 TTL 修复：`Math.min` → `Math.max` 或去掉 cap | 小 |
| 5 | 滤镜参数修复：`applyWarm(buf)` → `applyWarm(ctx, buf)` | 小 |
| 6 | 提醒 KV key 统一 + 创建 by-date 索引 | 中 |
| 7 | MailChannels → 替换为可用邮件服务 | 中 |
| 8 | QR 码：引入 qrcode.js 库或移除功能 | 小 |
| 9 | Undo：Image 对象不入 JSON，单独存引用 | 中 |
| 10 | XSS：showToast 用 textContent 代替 innerHTML | 小 |
| 11 | CORS：限制为 sendafun.com | 小 |
| 12 | wrangler.toml + Cron Trigger 配置 | 小 |

### P1 — 上线前应修复

| # | 问题 | 修复量 |
|---|------|--------|
| 13 | 支付过渡信任页（金额+支付方式+跳转说明） | 中 |
| 14 | Success URL 页面 + webhook 轮询 | 中 |
| 15 | 邮件防垃圾箱（SPF/DKIM/DMARC + 提示） | 中 |
| 16 | 收卡人页面 OG 标签 | 小 |
| 17 | 回复链接 `/send` 路由实现 | 中 |
| 18 | 邮件标题 emoji 修正 + 含节日类型 | 小 |
| 19 | 默认展示最佳效果（预设文字+字体+滤镜） | 中 |
| 20 | 年费推荐弹窗 | 中 |
| 21 | 付款前展示送达选项 | 小 |
| 22 | "Cancel anytime" 标注 | 小 |
| 23 | 提醒提前 3 天（改 cron 逻辑） | 小 |
| 24 | 卡片数据 TTL 延长至 30-90 天 | 小 |
| 25 | 礼物兑换加速率限制 | 小 |
| 26 | viewport 允许缩放（去 user-scalable=no） | 小 |
| 27 | robots.txt + sitemap.xml | 小 |
| 28 | _headers 文件 | 小 |

### P2 — Phase 1 可没有

| # | 问题 |
|---|------|
| 29 | 回送半价逻辑（$0.99 首次） |
| 30 | Re-engagement 邮件（3 天后跟进） |
| 31 | 风格维度筛选 |
| 32 | 首页轮播手动滑动 |
| 33 | 广告位预留（adsEnabled 变量） |
| 34 | Google Analytics |
| 35 | R2 存储集成 |
| 36 | 编辑器预览邮件效果 |
| 37 | 前后对比按钮 |

---

## 八、最终评估

### 文档 vs 代码覆盖率

| 维度 | 文档定义 | 代码实现 | 覆盖率 |
|------|---------|---------|--------|
| API 路由 | 9 个 | 9 个 | 100% |
| API 字段契约 | 9 个 | 0 个正确 | 0% |
| 支付流程 | 完整 | 假的 | 0% |
| 前端功能 | 25 项 | 5 项基本可用 | 20% |
| 安全措施 | 5 项 | 2 项（webhook 签名 + 限流） | 40% |
| SEO 基础 | 5 项 | 0 项 | 0% |
| 邮件送达 | 3 项 | 0 项可用 | 0% |
| 部署配置 | 4 项 | 0 项 | 0% |

### 结论

**这份开发文档是好的。问题出在 OpenClaw 生成代码时没有遵循文档。**

文档描述的是一个三层解耦、支付安全、用户体验优秀的贺卡平台。代码实现的是一个前端假装支付、后端字段乱来、邮件发不出去、QR 扫不了的半成品。

**建议路径**：
1. 文档保留作为产品需求文档（需更新 MailChannels → 替代方案）
2. Worker 后端基本可用，需修复 TTL、key、字段映射等问题
3. 前端模板需要重写支付流程和 API 调用层
4. 构建脚本基本可用，需补 sitemap/robots 拆分
5. 补齐 wrangler.toml + _headers 部署配置
