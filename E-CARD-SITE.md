# 💌 SendAFun — 电子贺卡网站完整项目文档

> 项目：面向美国用户的电子贺卡网站
> 最后更新：2026-06-27
> 品牌：SendAFun（sendafun.com）
> 状态：待开发（支付已切换 Creem，R2 3天后开通）

---

## 一、项目定位

### 1.1 一句话定位

**帮美国用户在 2 分钟内做好一张贺卡，并帮你送到收卡人手上。**

### 1.2 目标用户

- **主用户群**：美国 25-45 岁，有送礼需求的普通人
- **使用场景**：70% 手机，20% 平板，10% 桌面
- **用户画像（两个典型）**：
  - **Mike**（42 岁，销售）：着急买卡，需要"快+简单"，送了就走。愿意付 $1.99
  - **Sarah**（28 岁，设计师）：追求设计感，要独特性。愿意付 $19.99/年无限做

### 1.3 核心差异

| 对比维度 | Hallmark / 传统贺卡 | SendAFun |
|----------|--------------------|----------|
| 花时间 | 出门买 + 邮寄 | **2 分钟手机搞定** |
| 送达 | 自己邮寄 | **帮你发短信/邮件** |
| 设计 | 固定印刷 | **自定义文字/字体/颜色** |
| 价格 | $5-10 | **$1.99 起** |

### 1.4 收入模型

| 收入来源 | 谁付钱 | 价格 | 什么时候收 |
|---------|--------|------|-----------|
| **单张下载** | 用户 | **$1.99/张** | 用户下载无水印卡时 |
| **年度订阅** | 用户 | **$19.99/年**（约合 $1.67/月）| 用户注册订阅时 |
| **广告（Phase 2）** | 广告商 | CPM $5-15/千次展示 | 用户浏览页面时 |
| **AI定制（Phase 4）** | 用户 | $1/10次（预留）| 用户使用 AI 生图时 |

---

## 二、技术架构（动静分离三层）

```
┌──────────────────────────────────────────────────────────┐
│  静态层（Cloudflare Pages CDN）                           │
│  • 首页、分类页、单卡页 HTML（构建期生成）                   │
│  • 水印预览图（WebP）                                     │
│  • 拆分后 sitemap + cards JSON（前端懒加载）               │
│  负责：SEO、页面骨架                                      │
├──────────────────────────────────────────────────────────┤
│  前端客户端动态（浏览器 JS 本地运算）                        │
│  • Canvas 文字渲染（双缓冲 + debounce 300ms）             │
│  • 字体/颜色/位置/滤镜调整                                │
│  • 截图分享（生成带水印预览图）                             │
│  • localStorage 收藏/编辑历史/购买记录                     │
│  负责：用户交互、编辑、分享生成（零后端请求）                 │
├──────────────────────────────────────────────────────────┤
│  边缘服务端动态（Cloudflare Worker 独立部署）               │
│  • POST /api/create-session — Creem 支付                 │
│  • POST /api/webhook — Creem 回调 + KV 写入              │
│  • GET /api/check-member — 查用户权限                    │
│  • POST /api/send-card — 发短信/邮件送达                 │
│  • POST /api/gift-free-card — 送朋友免费卡               │
│  • GET /api/redeem-gift — 兑换免费卡                     │
│  负责：支付、鉴权、送达、裂变                               │
└──────────────────────────────────────────────────────────┘
```

**三层完全解耦**：
- 改模板/素材 → 只重建 Pages（增量模式分钟级）
- 改支付/送达逻辑 → 只部署 Worker（1-3 秒）
- 用户编辑/预览/本地缓存 → 纯前端，不走网络

---

## 三、技术栈

| 环节 | 技术 | 说明 |
|------|------|------|
| 前端 | 静态 HTML + 原生 JS | 不依赖框架，SEO 最优 |
| 静态托管 | **Cloudflare Pages** | 全球 CDN，绑定 Git |
| 图片存储 | **Cloudflare R2**（正式）/ GitHub 仓库（临时） | 水印公开 + 无水印私有 |
| 构建脚本 | Node.js | 增量/全量/sample 三种模式 |
| 支付 | **Creem** | 3.9%+$0.40，提现到支付宝 |
| API层 | **Cloudflare Worker** | 独立部署，支付/鉴权/送达 |
| 权限存储 | **Cloudflare KV** | 会员/已购卡片/兑换码 |
| 送达 | **MailChannels**（免费邮件）/ Twilio（短信，Phase 2） | 付费后帮用户送达 |
| 分析 | Google Analytics | 统计流量 |

---

## 四、网站地图（完整功能清单）

### 4.1 所有页面

| 页面 | URL | 生成方式 | 说明 |
|------|-----|---------|------|
| 首页 | `/` | 构建脚本生成 | 精选卡片瀑布流 + 3 步教程 + 场景入口 |
| 分类页 | `/category/{tag}` | 构建脚本生成 | 按收卡人+风格过滤，热门排行 |
| 单卡页 | `/card/{slug}` | 构建脚本生成 | **核心页面**，预览+编辑器+付费+分享 |
| 关于 | `/about` | 手动编写 | 品牌故事 |
| 帮助/FAQ | `/faq` | 手动编写 | 常见问题 |
| 隐私条款 | `/privacy` | 手动编写 | 法律页面 |
| 404 | `/404.html` | 手动编写 | 错误页面 |

### 4.2 单卡页（card-template.html）功能列表

```
┌──────────────────────────────────────────────────────┐
│  面包屑：Home > Birthday > For Mom > Funny Card      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────┐   ┌──────────────┐ │
│  │    卡片全屏预览（Canvas）     │   │ 📝 编辑祝福语  │ │
│  │    水印淡 logo（15%）        │   │ [输入框+模板]   │ │
│  │                             │   │ 字体选择(6种)  │ │
│  │  [Square] [Vertical] [H]    │   │ 颜色选择(8色)  │ │
│  │                             │   │ 位置(顶/中/底) │ │
│  │  💬 截图分享（生成预览图）    │   │ 滤镜(4种)      │ │
│  │  🔗 复制链接（空模板）        │   │              │ │
│  │  📱 二维码                   │   │ ❤️ 收藏       │ │
│  └─────────────────────────────┘   └──────────────┘ │
│                                                      │
│  💰 付费区                                           │
│  ┌──────────────────────────────────────────────┐   │
│  │  $1.99 下载无水印 + 送达     🔒 Secured by Creem │ │
│  │  or                            *Tax may apply   │ │
│  │  $19.99/year 无限下载 + 送达                    │ │
│  │  [💳 Pay with Card] [🍎 Apple Pay]               │ │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  "别人用这张卡做出来的"                               │
│  ┌────┐┌────┐┌────┐┌────┐                         │
│  │示例1││示例2││示例3││示例4│  ← 模拟数据/用户UGC   │
│  └────┘└────┘└────┘└────┘                         │
│                                                      │
│  相关推荐                                             │
│  ┌────┐┌────┐┌────┐┌────┐                         │
│  │卡图 ││卡图 ││卡图 ││卡图 │                         │
│  └────┘└────┘└────┘└────┘                         │
└──────────────────────────────────────────────────────┘
```

---

## 五、支付方案（Creem）

### 5.1 定价

| 商品 | 价格 | Creem 类型 | 目标用户 |
|------|------|-----------|---------|
| 单张高清无水印送达 | **$1.99** | One-time | 偶尔送卡 |
| 年度无限会员 | **$19.99/年** | Subscription | 经常送卡 |

**为什么不设 $4.99/月**：美国人习惯年度订阅，月费 $4.99 跟 Netflix 差不多，但贺卡使用频率远低于流媒体。$19.99/年 约合 $1.67/月，决策门槛低很多。

### 5.2 付费流程

```
用户编辑卡片 → 点击 "Download & Send"
  ↓
前端调 Worker POST /api/create-session
  ↓
跳转到 Creem 支付页（显示过渡弹窗 "Secured by Creem"）
  ↓
用户用 信用卡 / Apple Pay / Google Pay 支付（含税标注）
  ↓
Creem Webhook → Worker 写入 KV 权限
  ↓
页面跳回 → 显示送达选择：
  [📱 发短信给收卡人（Phase 2）]
  [✉️ 发邮件给收卡人（今天可用）]
  [💾 下载到设备]
  ↓
送达完毕 → 弹窗：
  "送你一张免费卡，送给你的朋友吧"（裂变入口）
```

### 5.3 提现

Creem 支持中国大陆个人 Alipay 提现：
- 每月 1 号/15 号结算，最低 $50
- 单次限额 5 万人民币，年限额 30-60 万
- 手续费 7 USD 或 1%（取高值）

### 5.4 支持的付款方式（Creem 支持，美国用户全覆盖）

| 付款方式 | 美国用户覆盖率 | Creem | 说明 |
|----------|-------------|-------|------|
| Visa / Mastercard / Amex | 99% | ✅ | 标准信用卡 |
| **Apple Pay** | iPhone 用户标配 | ✅ | Face ID 一键支付 |
| **Google Pay** | Android 用户标配 | ✅ | 指纹一键支付 |
| **PayPal** | 老用户常用 | ✅ | 账户内余额支付 |
| 本地支付方式 | 因地区而异 | ✅ | 自动适配用户所在地 |
| 微信支付 / 支付宝 | 海外华人 | ⏳ Coming Soon | 后续可开通 |

**收的是美元，提现到支付宝是人民币。**

### 5.5 完整资金流向

```
用户付 $1.99（USD）
  → Creem 扣 3.9% + $0.40 手续费
  → 净收入 = $1.99 - $0.48 = $1.51
  ↓
Creem 每月 1 号/15 号结算（最低 $50）
  → 提现到你的支付宝（自动换算为人民币）
  → 单次上限 5 万人民币，年限额 30-60 万
  → 提现手续费 7 USD 或 1%（取高值）

例：月售 1000 张
  $1.51 × 1000 = $1,510/月
  提现到支付宝 ≈ 10,500 人民币/月
```

### 5.6 广告收入（Phase 2）

Google AdSense 按展示（CPM）和点击（CPC）计费。贺卡站适合展示广告。

```
预估：100 万月 PV
  美国流量 CPM ≈ $5-15
  填充率 ≈ 50-70%
  按保守 $5 CPM、60% 填充率：
    1,000,000 × 60% × $5 / 1000 = $3,000/月
```

注意：新站 AdSense 审核严格，建议 Phase 1 不上广告，等域名 3-6 个月后申请。

### 5.7 安全性

- Webhook 签名校验（环境变量 `CREEM_WEBHOOK_SECRET`）
- IP/邮箱双维度限流 5次/分钟
- 购买权限 24h TTL 自动过期
- 密钥存 Worker 环境变量，前端零暴露

---

## 六、图片与存储

### 6.1 存储架构

```
R2 桶（默认）/ GitHub（临时）：
├── public/ (watermarked)      ← 公开预览（logo 水印 15%）
└── private/ (no watermark)    ← 私有（Worker 鉴权后下载/送达）
```

### 6.2 水印规范

- ❌ 不用 "PREVIEW" 字样（用户体验差）
- ✅ 用淡品牌 logo（15% 透明度），位置角落
- ✅ 且：免费预览图使用**低分辨率版本**（600px 宽），付费下载为高清（1920px）
- 双重保护：低分辨率 + logo 水印

### 6.3 Phase 1 临时方案

R2 开通前：
- 水印图放 GitHub 仓库，Pages 托管
- 无水印原图**不上线**，付费功能等 R2 再开（Pages 无目录级权限控制）

### 6.4 Phase 2（R2 开通后）

- 全量图片迁移 R2（public + private）
- Worker 生成签名 URL（24h TTL），用户直接下载，不走 Worker 中转

---

## 七、裂变功能

### 7.1 截图分享（MVP）

用户编辑好 → 点分享 → Canvas 渲染当前状态为带水印预览图 → 可保存/发送到 iMessage / WhatsApp / Instagram

**对方看到的是带文字的卡片预览，不是空模板。** 截图自带网站链接水印。

### 7.2 送朋友免费卡（MVP）

```
付费完成后 → 弹窗："送你一张免费卡"
  → 填朋友邮箱
  → Worker 生成兑换码 → 发邮件给朋友
  → 朋友领取卡 → 看到网站 → 可能转化
```

### 7.3 裂变效果预估

100 个付费用户 → 每人送 1 张免费卡 → 100 新用户 → 10% 付费 = 10 个 → 循环

### 7.4 暂缓的裂变功能

- 定时发送：转化链路弱，不做
- 拼图解锁：容易被刷，不做
- 多人协作：开发量大，Phase 3

---

## 八、用户体验与视觉规范

### 8.1 设计目标

**让人"哇"的贺卡网站。** 不是"又一个贺卡站"，而是打开就觉得"这个不一样"。

设计参考方向：**Apple 展示页的干净 + Pinterest 的探索感**——干净、沉浸、有呼吸感。

### 8.2 用户群体的需求差异

| 用户 | 代表 | 核心诉求 | 对应设计 |
|------|------|---------|---------|
| **年轻人**（18-25） | Jake | 看起来 cool，能发 Instagram，不老土 | 模板句子口语化、多风格展示、无水印卡角落品牌名 |
| **主力用户**（35-60） | Karen | 简单、安全、不焦虑 | 明确按钮文案、大可读字体、付款信任、提醒功能 |

### 8.3 首页布局（新颖版）

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   全屏展示一张"别人做好的卡片"（示例，带真实祝福语）         │
│   左右滑动 / 点击箭头 切换到下一张                         │
│   ↓                                                      │
│   "by Sarah · For my mom's birthday"                     │
│                                                          │
│   [✨ Make your own →]                                    │
│                                                          │
│   ┌──────────────────┐ ┌───────────┐ ┌──────────┐      │
│   │ 🎂 Browse Birthday│ │ ❤️ Love   │ │ 🎄 Christmas│  ← 大字卡片按钮
│   └──────────────────┘ └───────────┘ └──────────┘      │
│   ┌──────────────┐ ┌───────────┐ ┌─────────────┐      │
│   │ 🙏 Thank You │ │ 💪 Get Well│ │ ✨ Just Because│    │
│   └──────────────┘ └───────────┘ └─────────────┘      │
│                                                          │
│   (右下角微动效：渐变光影缓慢流动)                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**核心思路**：轮播展示"作品"吸引用户，下方用**卡片式按钮**提供明确的分类入口（Karen 需要看到"Browse"按钮，而不是文字链接）。首页轮播卡片覆盖 4+ 种风格（深情/搞笑/极简/手写），让所有年龄的用户都能找到共鸣（Jake 的需求）。

### 8.4 分类页布局

```
┌──────────────────────────────────────────────────────────┐
│   🎂 Birthday Cards                                       │
│                                                          │
│   筛选栏（横向滚动）：                                     │
│   [All] [For Mom] [For Dad] [For Wife] [Funny] ...       │
│                                                          │
│   瀑布流展示（Masonry，大小不一）                           │
│   ┌──────┐┌──┐┌────┐┌──┐┌────┐┌────┐                  │
│   │      ││  ││    ││  ││    ││    │                     │
│   │ 🖼️大 ││小││ 🖼️ ││小││ 🖼️ ││ 🖼️ │                     │
│   │      ││  ││    ││  ││    ││    │                     │
│   └──────┘└──┘└────┘└──┘└────┘└────┘                     │
│                                                          │
│   [Load More]                                             │
└──────────────────────────────────────────────────────────┘
```

### 8.5 单卡页布局（新颖版）

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Cards                       ❤️  💬  📱        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │         卡片全屏沉浸展示                              │  │
│  │       （铺满屏幕宽度，背景柔光）                       │  │
│  │                                                    │  │
│  │     [Watermarked Preview - 15% logo 角落]            │  │
│  │     [无水印版右下角：sendafun.com 淡色水印]            │  │
│  │                                                    │  │
│  │  [Square] [Vertical] [Horizontal]                   │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─── 底部浮动面板（向上滑出）───────────────────────────┐│
│  │ 📝 Customize — it's easy ✨                         ││
│  │ [输入框]  💡 "The one that makes them cry"          ││
│  │            💡 "The one that makes them laugh"        ││
│  │            💡 "Short & sweet" / "Inside joke vibes" ││
│  │ 🅰️ 字体预览图  🎨 颜色  📐 位置  🌈 滤镜  🔠 大/中/小││
│  │                                                    ││
│  │ ✉️ Send via Email ($1.99)   or  💾 Download only    ││
│  │ 🔒 Secured by Creem · Apple Pay · Google Pay        ││
│  │    Tax may apply                                    ││
│  │                                                    ││
│  │ 用户不点编辑时，面板收起的，页面纯粹展示卡片            ││
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  "Cards made by others"                                   │
│  ┌────┐┌────┐┌────┐┌────┐                              │
│  │示例││示例││示例││示例│  ← 模拟数据/用户UGC            │
│  └────┘└────┘└────┘└────┘                              │
│                                                          │
│  Related │ [Sponsored]（广告位，Phase 2）                  │
│  ┌────┐┌────┐┌────┐┌────┐                              │
│  └────┘└────┘└────┘└────┘                              │
└──────────────────────────────────────────────────────────┘
```

### 8.6 编辑器体验

| 功能 | MVP | 说明 |
|------|-----|------|
| 文字输入 | ✅ | debounce 300ms，不闪白 |
| 模板句子 | ✅ | **口语化分类**："Make them cry""Make them laugh""Short & sweet""Inside joke" |
| 字体 | ✅ | 6 种 Google Fonts，**用预览缩略图代替字体名**（Karen 需求）|
| 颜色 | ✅ | 8 色调色盘 |
| 位置 | ✅ | 顶部/中部/底部 |
| 滤镜 | ✅ | 4 种色彩滤镜（暖/冷/黑白/复古）|
| 文字大小 | ✅ | 大/中/小三档，**默认 Medium-Large（Karen 需求）** |
| 编辑按钮文案 | ✅ | 不用 "Edit"，用 "Customize — it's easy ✨"（Karen 需求）|
| 拖拽自由排版 | ❌ | Phase 2 |

### 8.7 下载与品牌曝光

**关键规则（来自 Jake 的反馈）**：

> **每张被送出去的卡片，都是一次免费广告。**

- **无水印下载版**：卡片右下角加 **淡色 "sendafun.com"** 文字（15% 透明度）
- **截图分享版**：水印 logo 放在**角落**，不覆盖卡片主体文字
- **邮件送达版**：邮件末尾带 "Made with ❤️ on sendafun.com"

这个设计让每个付费用户在帮你打广告，且不影响用户体验。

### 8.8 付款前展示送达选项（Jake 的需求）

在用户点击付费按钮前，浮动面板的付费区域**已经显示**送达方式：

```
✉️ Send via Email ($1.99)
    → 你会在付款后填写收卡人邮箱，我们帮你发送

or

💾 Download only ($1.99)
    → 付款后直接下载图片
```

让用户在付钱之前就知道"我付了 $1.99 会得到什么"，减少付款后的困惑。

### 8.9 付款信任（加强版——Karen 的需求）

跳转 Creem 前弹过渡页：

```
🔒 Secure Checkout

You're paying $1.99 for your card
Paid via Creem — trusted by 3,000+ businesses

Visa · Mastercard · Amex · Apple Pay · Google Pay

[Continue to secure payment →]     [Cancel]
```

**关键差异**：
- 写明**具体金额**（用户不困惑）
- 写明**具体支付方式**（用户确认自己有其中一种）
- 提 "trusted by 3,000+ businesses"（增加信任感）
- 按钮明确 "Continue to secure payment"（不是模糊的 "Submit"）

**此外，Creem 支付页面的错误提示必须友好化**（Dave 的需求）：
- ❌ 不要用 "Invalid card number" —— Dave 会慌
- ✅ 改用 "Hmm, that card number doesn't look right. It should be 16 digits. Check the front of your card and try again."
- ✅ 字段名用通俗语言：将 "CVC" 写成 "CVC (3 digits on the back of your card)"
- **这些提示在 Creem 的 iframe 中可能无法自定义，但在过渡页和指南中可以提前说明**

### 8.10 支付后：提醒功能（Karen 的核心需求）

```
付款完成后 → 弹窗：
🎉 Card sent! Want us to remind you before the next birthday?

[📅 Set a reminder] → 选日期 + 选关系（Mom/Dad/Spouse...）
    → Worker 存 KV（key=reminder:{email}:{date}）
    → 到日期前 3 天，Cron Trigger 发邮件：
      "📌 Don't forget! Your mom's birthday is in 3 days"
      "Make a card on sendafun.com →"
```

开发量小（KV + Cron Trigger），但留存效果强。中年用户（Karen 类）非常依赖这类提醒，她们是家庭生日的"记忆中枢"。

### 8.11 收卡人页面 & 回送功能（Susan 的需求）

收卡人打开邮件 → 点击链接 → 看到 **/view/{token}** 页面（Worker 路由），内容：

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│       💌 Karen sent you a birthday card!                  │
│                                                          │
│       [全屏展示卡片，右下角淡色 sendafun.com 品牌名]       │
│                                                          │
│       📸 Share this card                                 │
│       [Save image] [Share on Instagram] [Forward]         │
│                                                          │
│       ✨ Reply with a card ✨  ← 核心转化入口              │
│       → 直接进入编辑器，预填感谢模板                       │
│       → 不收卡人钱，收卡人回送 = 新用户转化                 │
│                                                          │
│       More cards like this:                              │
│       ┌────┐┌────┐┌────┐┌────┐                          │
│       │ 🖼️ ││ 🖼️ ││ 🖼️ ││ 🖼️ │  ← 同风格+同节日推荐     │
│       └────┘└────┘└────┘└────┘                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**关键规则**：
- 收卡人也可下载带品牌名的中等分辨率版本（促进传播）
- 推荐卡片按"同风格+同节日"匹配
- "Reply with a card" 是免费转化入口——预填 "Thank you for the card!" 模板

### 8.12 用户识别：无注册账号（Dave 的需求）

**不设注册系统。用购买邮箱自动识别。**

```
用户第一次购买：dave@gmail.com → Worker 写 KV key={email}:{purchase_info}
用户回访：输入邮箱 dave@gmail.com → Worker 查 KV → 显示购买记录/会员状态
补充：付款后设置 Cookie + localStorage 本地标记
```

架构：Worker 新增路由 `POST /api/lookup-user`，查 KV 返回用户状态。

**为什么不做注册系统**：美国用户对"注册"的抵触感很强。Pinterest 早期就是无注册模式，用户用邮箱就能收藏。如果 Dave 每次来都要填邮箱重新付款，他会觉得烦；但如果要注册，他直接关。用邮箱自动识别是最优解。

### 8.13 送达流程

付费后 → 用户选择送达方式：

```
[✉️ Send via Email] → 输入收卡人邮箱 → Worker 调 MailChannels
[💾 Download to Device] → 直接下载
[📱 Send via SMS]（Phase 2，需 Twilio）
```

### 8.14 留存

- localStorage 存：收藏卡片、编辑草稿、购买历史
- 购买时收集邮箱 → 后续邮件推荐新卡片（含退订选项）
- **生日提醒订阅**（8.10 节）

### 8.15 编辑器细节优化

**滤镜**：默认应用"最佳推荐滤镜"（设计师预设的），加 "Undo" 按钮让用户放心尝试。避免 Dave 式的"选错了能回去吗"焦虑。

**编辑器整体**：任何可能导致用户困惑的界面元素，都应该有温和的引导提示，而不是冰冷的错误消息。每条操作都要让用户知道"你不会搞坏东西"。

### 8.16 Mobile First（手机优先——Jennifer 的核心需求）

**Jennifer 的使用场景**：70% 用户在手机上操作。Jennifer 在晚上 9 点以后，孩子们睡了，她瘫在沙发上用手机操作。**手机体验不好 = 失去 Jennifer = 失去 60% 的收入。**

**核心规范**：

**① 编辑器键盘弹出不遮挡预览（Jennifer P0）**
```
手机端卡片页布局（键盘收起时）：
┌─────────────────────────────┐
│      全屏卡片预览            │
│                             │
└─────────────────────────────┘
│  📝 Customize                │  ← 底部面板收起状态

手机端卡片页布局（键盘弹出时）：
┌─────────────────────────────┐
│   卡片小尺寸实时预览          │  ← 自动缩小到键盘上方，不遮挡
├─────────────────────────────┤
│  Happy birthday to...        │  ← 输入框
│ [字体] [颜色] [大小]         │  ← 工具栏固定在键盘上方
└─────────────────────────────┘
```

实现方式：监听键盘弹出事件（visualViewport API）→ 页面滚动使输入框紧贴键盘上方 + 预览图缩小 + 不遮挡。

**② 触控友好**
- 所有按钮最小尺寸 ≥44px（Apple HIG 标准）
- 字体选择、颜色选择、筛选项用大触摸区域
- 没有需要精确点击的小图标

**③ Mobile First 优先于桌面**
- 先写手机版 CSS（单列，全宽）
- 桌面版用 max-width 限制 + 优雅拉伸
- 不写"桌面版 → 缩小到手机"的思路

**④ 支付后的年费推荐弹窗（Jennifer 需求）**
```
🎉 Card sent to Olivia!

You just saved yourself a trip to the store.
Got more birthdays coming up? (You know you do…)

✨ For just $19.99/year, every card from now on is FREE.

[Subscribe $19.99/year — save 80%]  [No thanks, just this one]
```

在手机屏幕上，这个弹窗应该占据大部分屏幕，按钮足够大。目标用户是 Jennifer 这样的重复购买者，一次性购买后推荐年费转化率最高。

### 8.17 首页快速入口（Jennifer 的需求）

Jennifer 打开网站时，脑子里已经装满了家庭成员的各种日期。她需要的是"快速定位目标"，不是漫无目的的浏览。

```
首页新增模块：
┌──────────────────────────────────────────────────────┐
│  I need a card for...                                 │
│                                                       │
│  [🎂 Birthday]  [🎄 Christmas]  [🙏 Thank You]        │
│  [👩  Mom]      [👨  Dad]       [👫 Partner]          │
│  [👶  Kid]      [👩‍🏫 Teacher]   [🎁 Any occasion]      │
│                                                       │
│  点击 → 直接跳转到筛选好的结果页                         │
│  例如点击 [Mom] → 展示 "For Mom" 分类下的热门卡          │
└──────────────────────────────────────────────────────┘
```

### 8.18 分类筛选增加"风格"维度（Jennifer 的需求）

当前筛选只按"给谁"分类（For Mom/For Dad/For Wife），缺少风格维度。

```
筛选栏方案（两行横向滚动）：
行 1：[All] [For Mom] [For Dad] [For Wife] [For Friend]
行 2：[Style: All] [❤️ Warm] [😂 Funny] [🎨 Artistic] [✍️ Hand-drawn]
```

实现方式：卡片元数据增加 `style` 字段（warm/funny/artistic/hand-drawn），前端筛选时双维度过滤。

### 8.19 年费标注"Cancel anytime"（Jennifer 的需求）

年费方案旁边必须清晰标注可随时取消，消除用户对自动续费的担忧：

```
            ✨ $19.99/year — unlimited cards
            Cancel anytime no questions asked
            (That's ~$1.67/month vs $1.99 per card)
```

对比文案要直观：告诉用户年费相当于每张卡 $0.40（按 50 张/年算），而不是只告诉用户月均多少钱。

### 8.20 回送价格逻辑（Jennifer 的需求）

**送朋友免费卡 vs 回送功能的价格逻辑必须清晰**，不能让 Jennifer 的朋友钻漏洞：

| 场景 | 赠送者 | 收卡人 | 价格 |
|------|--------|--------|------|
| 付费用户送朋友免费卡 | 已付费用户 | 朋友收到预览版 | 送卡人免费 |
| **朋友回送一张** | 收卡人 | 原送卡人 | **$0.99（半价，作为新用户转化）** |
| 正常付费 | 新用户 | 任何人 | $1.99 |
| 年费用户 | 已订阅 | 任何人 | 免费 |

回送半价只对**第一次**生效（通过 Cookie/Creem 邮箱追踪）。之后回送就走正常 $1.99 价格。

### 8.21 用户旅程完整漏洞修复清单

来自全流程审查发现的 10 个漏洞，按优先级排列：

#### P0（必须修复才能上线）

**① 过渡页说明 Creem 跳转机制（信任补充）**
Creem 目前使用 Hosted Checkout 模式（必须跳转到 checkout.creem.io 完成支付），无法嵌入当前页面。但跳转本身不是问题——关键是用户跳转前不能慌。

过渡页新增说明：
```
🔒 Secure Checkout

You're paying $1.99 for your card
You'll be redirected to Creem's secure payment page
(It'll have a different URL — that's normal, it's secure)
Trusted by 3,000+ businesses worldwide

Visa · Mastercard · Amex · Apple Pay · Google Pay

[Continue to secure payment →]     [Cancel]
```

关键行："You'll be redirected to Creem's secure payment page (It'll have a different URL — that's normal, it's secure)"——提前告诉用户会被跳转，URL 不一样是正常的。

**② Creem 付款 Success URL（不能依赖 Webhook 返回用户）**
Creem 付款完成后，用户会通过 Success URL 跳回 sendafun.com，而不是通过 Webhook 跳转。Webhook 只用于后端写 KV。必须在 Creem 后台配置：
- Success URL: `https://sendafun.com/payment-success?session_id={CHECKOUT_SESSION_ID}`
- Cancel URL: `https://sendafun.com/payment-cancel`
Success URL 页面需等待 2-3 秒（轮询 Webhook 写入完成），再展示送达选择界面。如果超时则展示"处理中，稍后送达"提示。

**③ 邮件送达防垃圾箱策略**
新域名发送的邮件容易进 Gmail/Outlook 垃圾箱，可能导致付费用户花钱送了卡但对方没收到。
- 上线前配置 SPF / DKIM / DMARC DNS 记录
- 邮件中增加提示："If you don't see it, check your spam folder 💌"
- 默认"下载为主，邮件为辅"：用户付完先下载，再选择"也发邮件"
- 邮件标题包含送卡人姓名：勿用 "You received a card"，用 "💌 Jennifer sent you a birthday card!"

**④ 支付后再参与邮件——解决用户用完不回访**
付款完成后 3 天，Worker Cron Trigger 自动发送 re-engagement 邮件：
```
Subject: Your card was a hit! Ready for the next one?

Hi {name},
You sent a birthday card last week. Hope they loved it!
Your card is saved in your account.
Next card: 2 minutes flat. ✨

👉 sendafun.com
```
用户设置了提醒的不发（避免重复）。邮件内容可配置，可在 Worker 环境变量中关掉。

#### P1（上线前修复，但 P0 优先）

**⑤ 首页轮播手动滑动代替自动轮播**
轮播不要自动切换。用户手动左右滑动或点击箭头切换。悬停时也不自动切。

**⑥ 分类页空模板与示例卡区分**
示例卡缩略图右下角加 "Example" 小标签。或者默认只展示空模板，筛选器提供 "Show examples" 开关。

**⑦ 单卡页默认展示最佳效果**
单卡页打开时，预览图默认展示带预设祝福语+最佳字体+最佳滤镜的成品效果（不是空白模板）。让用户一进来就看到"最好看的样子"，编辑只是调成自己喜欢的。

**⑧ 收卡页面 Open Graph 标签**
收卡人页面 `/view/{token}` 的 `<head>` 必须包含：
```html
<meta property="og:title" content="💌 A birthday card for you!" />
<meta property="og:image" content="https://sendafun.com/api/card-image/{token}" />
<meta property="og:description" content="{送卡人姓名} sent you a birthday card ❤️" />
```
确保分享到 Instagram/Facebook 时显示卡片预览图。

#### P2（Phase 1 可没有，但先记录）

**⑨ 编辑阶段"预览邮件效果"**
付费前用户可预览收卡人收到的邮件模板效果。不是必须功能，但能提升付费信心。

**⑩ 编辑阶段"前后对比"按钮**
加一个临时切换的 "See before/after" 按钮——按住显示默认状态，松开显示编辑后状态。方便用户判断自己的改动是否更好看。

### 8.22 广告位预留

所有广告位不破坏沉浸感：

- **首页**：轮播卡片之间插入广告卡片，标注 "Sponsored"
- **分类页**：瀑布流中每 8-10 张插入一个原生广告块
- **卡片页**：底部 "相关推荐" 区域中混入广告

控制方式：模板顶部全局变量 `adsEnabled: false` → 改为 `true` 全站广告一键开启。不改模板，不重跑构建。

---

## 九、构建脚本设计

### 9.1 三种模式

| 模式 | 命令 | 用途 |
|------|------|------|
| 增量 | `node generate-cards.js` | 只处理新增/变更卡片 |
| 全量 | `node generate-cards.js --force` | 改模板时重建全部 |
| Sample | `node generate-cards.js --sample=10` | 改模板后先验证 10 张 |

### 9.2 增量原理

- 缓存文件 `.cards-cache.json` 记录每张卡片的 `lastModified` + 图片 hash
- 只有变更卡片才生成 HTML + 压缩水印图

### 9.3 产物拆分

- sitemap：每 1 万 URL 拆分，批量提交 GSC
- cards.json：每 1 万条拆分，前端懒加载分页
- robots.txt：屏蔽 `/api/*`

---

## 十、开发和部署安全规范

### 10.1 三条铁律

**铁律一：改模板先 --sample=10 验证。** 直接全量如果模板有 bug，6 万页全部污染。

**铁律二：Worker 和 Pages 分开上线。** 至少间隔 1 小时，确保前一版没问题再动另一版。

**铁律三：Git 回滚比重跑快。** `git revert HEAD --no-edit && git push` → 2-5 分钟恢复。

### 10.2 紧急回滚

1. `git revert` + push（2-5 分钟）
2. 或 Cloudflare Pages Dashboard → Deployments → Rollback（30 秒）

### 10.3 日常维护工作量

| 操作 | 频率 | 耗时 | 风险 |
|------|------|------|------|
| 新增卡（增量） | 每周 | 1-3 分钟 | 极低 |
| 改文案（单条） | 每周 | 秒级 | 极低 |
| 改 Worker 逻辑 | 数月 | 3 秒 | 低 |
| 改模板样式 | 数月 | 15-20 分钟 | 中（sample 兜底）|

---

## 十一、项目文件结构

```
e-card-project/
├── source/
│   ├── images/raw/            ← Pexels 原图（不入 Git）
│   └── cards-config.json      ← 全量卡片元数据
│
├── build-script/
│   ├── generate-cards.js      ← 构建脚本（增量/全量/sample）
│   ├── split-sitemap.js       ← sitemap 拆分
│   └── split-cards-json.js    ← JSON 拆分
│
├── dist/                      ← 构建产物（Pages 部署目录）
│   ├── index.html
│   ├── category/*.html
│   ├── card/*.html             ← 单卡页（含编辑器+付费+分享）
│   ├── view/                   ← 收卡人页面（Worker 渲染，非构建生成
│   ├── images/watermark/
│   ├── cards-*.json
│   ├── sitemap-*.xml
│   ├── robots.txt
│   └── css/ js/ fonts/
│
├── worker/
│   └── src/index.js           ← 独立 Worker（支付/鉴权/送达/裂变）
│
├── templates/
│   └── card-template.html     ← 唯一模板（含 Canvas/编辑/付费/分享）
│
├── deploy-guide.md            ← 给 Workbuffy 的部署说明
└── .gitignore
```

### 部署

- **Pages**：git push → 自动部署（增量 2-8 分钟，全量 15-30 分钟）
- **Worker**：`cd worker && npx wrangler deploy`（1-3 秒，独立于 Pages）

---

## 十二、API 路由一览

| 路由 | 方法 | 功能 | 说明 |
|------|------|------|------|
| `/api/create-session` | POST | 创建 Creem 支付会话 | 前端 AJAX 调用 |
| `/api/webhook` | POST | Creem 支付回掉 | Webhook Secret 校验 |
| `/api/check-member` | GET | 查询用户权限 | 传邮箱参数 |
| `/api/lookup-user` | POST | **回访用户识别** | 输入邮箱查 KV，返购买记录/会员状态 |
| `/api/send-card` | POST | 送达卡片 | 发邮件/短信 |
| `/api/view-card` | GET | **收卡人查看卡片** | token 鉴权，返回卡片页面 |
| `/api/gift-free-card` | POST | 送朋友免费卡 | 生成兑换码+发邮件 |
| `/api/redeem-gift` | GET | 兑换免费卡 | 验证+写入 KV |
| `/api/set-reminder` | POST | **设置生日提醒** | 存 KV，Cron Trigger 到期发邮件 |

---

## 十三、项目账号

| 平台 | 账号 | 密钥 | 说明 |
|------|------|------|------|
| Pexels | gpszys | `317HEsJWr…` | 图片素材，200次/h |
| Pixabay | gpszys | `50203631-…` | 备选素材 |
| GitHub | yusheng-zhang-star | `ghp_…` | 代码托管 |
| Cloudflare | （待注册） | （待配置） | Pages + R2 + Worker + KV |
| Creem | （待注册） | （待获取） | **主支付方案**，提现到支付宝 |
| QQ邮箱 SMTP | 331728525@qq.com | `tugnq…` | 备用邮件发送 |
