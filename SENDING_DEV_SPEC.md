# SendAFun 开发规格书（权威版）

> **此文档是写代码前的唯一参考。所有 API 字段、KV key、TTL 值以此为准。**
> 最后更新：2026-06-29
> 基于：原始产品文档 + 代码审计报告(30项) + 文档差距分析(25项缺失/9项新发现) + 安全漏洞审计(20项) + 素材管理规格 + 欧美挑刺清单(合规+安全+无障碍) + 欧美付费用户产品挑刺清单(UX+功能缺口) + Canvas高级编辑功能规格 + AdSense内容要求规范 + 第二轮产品挑刺清单(老年用户+企业用户+竞品深挖) + 第三轮产品挑刺清单(Z世代+收件人视角+分享便利性) + 裂变增长机制设计(Viral Loop) + 双桶设计考量(成本分析+安全边界+竞品对标) + 分享功能补全(WhatsApp/IG Stories/OG协议) + Resend邮件服务接入(API Key配置+.env+.gitignore)
> 项目路径：`E:\网站项目\sendafun\`
> 域名：sendafun.com

---

## 目录

1. [项目定位](#1-项目定位)
2. [技术架构](#2-技术架构)
3. [技术栈](#3-技术栈)
4. [R2 双桶存储设计](#4-r2-双桶存储设计)
5. [API 契约（字段级）](#5-api-契约字段级)
6. [KV 数据结构](#6-kv-数据结构)
7. [支付流程（完整链路）](#7-支付流程完整链路)
8. [安全规格](#8-安全规格)
9. [邮件服务](#9-邮件服务)
10. [前端规格](#10-前端规格)
11. [构建脚本](#11-构建脚本)
12. [部署配置](#12-部署配置)
13. [已知 Bug 修复清单](#13-已知-bug-修复清单)
14. [功能缺失清单](#14-功能缺失清单)
15. [文件结构](#15-文件结构)
16. [项目账号](#16-项目账号)
17. [素材管理规格](#17-素材管理规格)
18. [欧美挑刺清单（合规+安全+无障碍）](#18-欧美挑刺清单合规安全无障碍)
19. [欧美付费用户产品挑刺清单（UX+功能缺口）](#19-欧美付费用户产品挑刺清单ux-功能缺口)
20. [AdSense 内容要求 & 页面文字量规范](#20-adsense-内容要求--页面文字量规范)
21. [第二轮产品挑刺（老年用户+企业用户+竞品深挖）](#21-第二轮产品挑刺老年用户--企业用户--竞品深挖)
22. [第三轮产品挑刺（Z世代+收件人视角+分享便利性）](#22-第三轮产品挑刺z-世代--收件人视角--分享便利性)
23. [裂变增长机制设计（Viral Loop）](#23-裂变增长机制设计viral-loop)
24. [分享功能补全（Sharing Platform Coverage）](#24-分享功能补全sharing-platform-coverage)
25. [当前开发进度 & 后续 TODO](#25-当前开发进度--后续-todo)
26. [图片去重处理（多层流水线）](#26-图片去重处理多层流水线)
27. [KV 素材追踪系统 & 低绩效图片替换](#27-kv-素材追踪系统--低绩效图片替换)
28. [每张卡片页唯一 SEO 方案（Title/Description/OG）](#28-每张卡片页唯一-seo-方案title--description--og-待确认)

---

## 1. 项目定位

**帮美国用户在 2 分钟内做好一张贺卡，并帮你送到收卡人手上。**

- 目标用户：美国 25-45 岁，70% 手机用户
- 收入模型：$1.99/次（单次） + $6.99/月（月订阅） + $69/年（年付）
- 核心差异：2 分钟手机搞定 + 帮你送达 + 自定义文字/字体/颜色

### 用户画像

| 用户 | 年龄 | 核心诉求 | 设计对应 |
|------|------|---------|---------|
| Mike（销售） | 42 | 快+简单，送了就走 | $1.99 一步到位 |
| Sarah（设计师） | 28 | 设计感，独特性 | $19.99/年无限做 |
| Jennifer（妈妈） | 35 | 手机好操作，不焦虑 | Mobile First + 提醒功能 |
| Karen（家庭主妇） | 50 | 简单安全不焦虑 | 大按钮 + 信任页 + Cancel anytime |

---

## 2. 技术架构

```
┌──────────────────────────────────────────────────────────┐
│  静态层 — Cloudflare Pages CDN                           │
│  首页/分类页/单卡页 HTML（构建期生成）                      │
│  水印预览图（R2 public 桶，CDN 缓存）                      │
│  CSS/JS/字体（CDN 缓存 7 天）                              │
├──────────────────────────────────────────────────────────┤
│  前端动态 — 浏览器 JS（零网络请求）                        │
│  Canvas 双缓冲渲染 + debounce 300ms                       │
│  文字/字体/颜色/位置/滤镜编辑                              │
│  localStorage 收藏/草稿（仅 UI，不作权限判断）              │
│  截图分享（生成带水印预览图）                               │
├──────────────────────────────────────────────────────────┤
│  边缘服务 — Cloudflare Worker                             │
│  支付（Creem Hosted Checkout）                            │
│  鉴权（user_token Cookie + KV）                           │
│  送达（Resend 邮件 API）                                  │
│  R2 签名 URL 生成（高清原图下载）                          │
│  裂变（送朋友免费卡 + 回送）                               │
│  提醒（KV + Cron Trigger）                                │
│  存储：Cloudflare KV（权限/会话/兑换码/提醒）               │
│  存储：Cloudflare R2（图片，双桶）                         │
└──────────────────────────────────────────────────────────┘
```

三层完全解耦：
- 改模板/素材 → 只重建 Pages
- 改支付/送达逻辑 → 只部署 Worker
- 用户编辑/预览 → 纯前端，不走网络

---

## 3. 技术栈

| 环节 | 技术 | 说明 |
|------|------|------|
| 前端 | 静态 HTML + 原生 JS | 无框架，SEO 最优 |
| 静态托管 | Cloudflare Pages | git push 自动部署 |
| 图片存储 | **Cloudflare R2（双桶）** | public 水印预览 + private 高清原图 |
| 构建脚本 | Node.js | 增量/全量/sample 三模式 |
| 支付 | **Creem** | Hosted Checkout，跳转 checkout.creem.io |
| API 层 | Cloudflare Worker | 独立部署 |
| 权限存储 | Cloudflare KV | 会员/已购/兑换码/提醒/会话 |
| 邮件送达 | **Resend** | ~~MailChannels 已停用~~ |
| 短信送达 | Twilio（Phase 2） | 暂不实现 |
| 分析 | Google Analytics | Phase 2 |

### 技术栈变更说明

| 原文档 | 修正后 | 原因 |
|--------|--------|------|
| MailChannels | **Resend** | MailChannels Cloudflare 免费集成 2024 年已停用 |
| R2 24h 签名 URL | **R2 5 分钟签名 URL** | 24h 过长，链接泄露风险高 |
| 明文邮箱鉴权 | **user_token Cookie 鉴权** | 防止水平越权 |
| GitHub 临时托管图片 | **R2 双桶** | 用户已开通 R2 |

---

## 4. R2 双桶存储设计

### 4.1 桶结构

```
Bucket 1: sendafun-preview (公开读)
├── birthday-mom-01-preview.webp      ← 600px 宽，带水印 logo 15%
├── birthday-dad-01-preview.webp
└── ...

Bucket 2: sendafun-originals (私有，仅 Worker 访问)
├── birthday-mom-01-original.png      ← 1920px 宽，无水印，右下角淡色 sendafun.com
├── birthday-dad-01-original.png
└── ...
```

### 4.2 访问规则

| 桶 | 内容 | 访问方式 | CDN 缓存 |
|----|------|---------|---------|
| `sendafun-preview` | 水印预览图（600px WebP） | 公开读，Pages/前端直接 `<img src>` | 30 天 |
| `sendafun-originals` | 无水印高清原图（1920px PNG） | Worker 生成签名 URL，5 分钟过期 | 不缓存 |

### 4.3 下载流程

```
用户付费后 → 前端调 /api/download?cardSlug=xxx
  → Worker 校验 user_token + KV 权限
  → Worker 查 KV 确认用户已购该卡或有年费会员
  → Worker 生成 R2 签名 URL（5 分钟 TTL）
  → 返回签名 URL 给前端
  → 前端 <a download> 触发下载
```

### 4.4 安全要求

- 签名 URL TTL = **5 分钟**（不是 24 小时）
- Worker 生成签名 URL 前必须校验 KV 中的购买记录
- ⚠️ **禁止在 URL 中传递 user_token**（浏览器历史/服务器日志/Referer 全泄露）—— 见第 18 章 18.1.2
- `originals/` 目录永远不进 git，不进 Pages 部署
- 构建脚本必须强制过滤 `originals/` 目录

### 4.5 水印规范

- 预览图：淡色品牌 logo，15% 透明度，放右下角
- 高清原图：右下角淡色 "sendafun.com" 文字，15% 透明度
- 不用 "PREVIEW" 字样
- 预览图低分辨率（600px），高清图 1920px，双重保护


### 4.6 双桶设计考量

**为什么需要双桶？**

单桶方案无法同时解决以下矛盾：

| 矛盾 | 说明 |
|------|------|
| **公开预览 vs 付费下载** | 预览图必须公开才能让收件人查看卡片；原图必须付费后才能下载 |
| **CDN 缓存 vs 访问控制** | 预览图可以 CDN 缓存 30 天；原图不能缓存（签名 URL 5 分钟） |
| **水印保护 vs 高清输出** | 预览图带水印；原图无水印供付费用户下载 |
| **成本分离** | 预览图流量大文件小；原图流量小文件大，分开计费更透明 |

**成本分析**（月预估）：

| 桶 | 文件大小 | 月访问量 | 月流量 | 月成本 |
|----|---------|---------|--------|--------|
| sendafun-preview | 80KB WebP | 10,000 次 | 800MB | $0.02 |
| sendafun-originals | 2MB PNG | 100 次 | 200MB | $0.004 |

**安全边界**：

1. 预览桶公开读 —— 仅 600px 带水印图，无法高质打印
2. 原图桶私有 —— Worker 签名 URL，5 分钟过期
3. 签名 URL 不含 user_token —— 防 Referer 泄露（见 18.1.2）
4. 原图桶不进 git —— 构建脚本强制过滤

**扩展场景**：

- 品牌水印（Section 23 方式 2）：仅改预览桶，不影响原图
- 节日限定设计：预览桶快速更新，原图桶稳定
- 多尺寸支持（未来）：预览桶 300px/600px，原图桶 1920px

**与竞品对标**：

| 竞品 | 预览方案 | 原图方案 |
|------|---------|---------|
| Moonpig | 公开预览（低分辨率） | 付费后邮件发送 |
| American Greetings | 会员专属预览 | 付费后下载 |
| SendAFun | 公开预览（600px WebP） | R2 签名 URL（5 分钟） |

---

---

## 5. API 契约（字段级）

> **以下字段名是前后端对接的唯一标准。前端发送和后端接收必须完全一致。**

### 5.1 POST /api/create-session — 创建支付会话

**请求：**
```json
{
  "email": "user@gmail.com",        // 必填，用户邮箱
  "plan": "single",                  // 必填，"single" | "annual"
  "cardSlug": "beautiful-birthday-mom",  // 可选，单张购买时关联卡片
  "delivery": "email"                // 可选，"email" | "download"
}
```

**响应：**
```json
{
  "url": "https://checkout.creem.io/...",  // Creem 支付页 URL，前端跳转
  "sessionId": "sess_xxx"
}
```

**Worker 逻辑：**
1. 校验 email 格式 + plan 合法性
2. RateLimiter：IP 5次/分钟 + email 5次/分钟
3. 调用 Creem API 创建 session
4. 将 session 存入 KV：`session:{sessionId}` → `{email, plan, cardSlug, createdAt}`，TTL 15 分钟
5. Success URL = `https://sendafun.com/payment-success?session_id={CHECKOUT_SESSION_ID}`
6. Cancel URL = `https://sendafun.com/payment-cancel`

### 5.2 POST /api/webhook — Creem 支付回调

**请求头：** `X-Webhook-Signature`（HMAC-SHA256 签名）

**Worker 逻辑：**

1. 读取 raw body，用 `CREEM_WEBHOOK_SECRET` 做 HMAC-SHA256 校验
2. 校验时间窗口（±5 分钟）
3. 解析事件类型：`checkout.completed` 或 `checkout.session.completed`
4. 提取 `customer_email` 和 `metadata.plan`
5. 生成 `user_token`（**随机 UUID**，不是 HMAC(email)）—— 见第 18 章 18.1.3
6. 写入 KV 权限记录
7. 返回 `{received: true}`

**不返回任何错误详情给客户端**（防止信息泄露）。

### 5.3 GET /api/check-member — 查询用户权限

**请求：** Cookie 头携带 `user_token`

**响应：**
```json
{
  "isMember": true,
  "plan": "annual",
  "expiresAt": 1750291200000,
  "daysLeft": 245
}
```

**Worker 逻辑：**
1. 从 Cookie 提取 `user_token`，反查 KV 获取 email
2. 查 `perm:{email}` 获取权限记录
3. 检查过期时间，过期则删除并返回 `isMember: false`

### 5.4 POST /api/lookup-user — 用户识别（无注册）

**请求：**
```json
{
  "email": "user@gmail.com"
}
```

**响应：**
```json
{
  "email": "user@gmail.com",
  "isMember": true,
  "memberPlan": "annual",
  "memberExpiresAt": 1750291200000,
  "cardsSent": 5,
  "giftsSent": 2,
  "userToken": "xxx"              // 首次识别时生成，写入 Cookie
}
```

> 注意：不返回 `name` 字段。前端不要期望 `data.name`。

**Worker 逻辑：**
1. RateLimiter：IP 5次/分钟 + email 5次/分钟
2. 查 KV 权限记录
3. 查 `cards:sent:{email}` 计数
4. 查 `gift:history:{email}` 记录
5. 如果用户没有 `user_token`，生成一个并存入 KV

### 5.5 POST /api/send-card — 送达卡片

**请求：**
```json
{
  "fromEmail": "sender@gmail.com",   // 必填，送卡人邮箱
  "fromName": "Jennifer",             // 必填，送卡人姓名
  "toEmail": "recipient@gmail.com",   // 必填，收卡人邮箱
  "toName": "Mom",                    // 可选，收卡人姓名
  "message": "Happy birthday Mom!",   // 可选，祝福语
  "cardSlug": "beautiful-birthday-mom",  // 必填，卡片 slug
  "imageUrl": "",                     // 可选，卡片预览图 URL
  "backgroundColor": "#fdf6e3",       // 可选，卡片背景色
  "accentColor": "#e17055",           // 可选，卡片强调色
  "sticker": "🎂"                     // 可选，贴纸 emoji
}
```

> 前端必须用这些字段名。**不是** `recipientEmail`/`senderName`。

**响应：**
```json
{
  "success": true,
  "token": "abc123...",
  "viewUrl": "https://sendafun.com/view/abc123..."
}
```

**Worker 逻辑：**
1. 校验邮箱格式（RFC 5322 正则）
2. RateLimiter：IP 5次/分钟 + fromEmail 5次/分钟 + **fromEmail 每日上限 10 次**
3. 校验送卡人权限（会员或免费卡额度）
4. 生成 token（32 字节随机，256 位熵）
5. 存入 KV：`card:{token}` → 卡片数据，TTL = **30 天**（不是 10 天）
6. 如使用免费卡，扣减 `freecard:{email}.remaining`
7. 递增 `cards:sent:{email}` 计数
8. 调用 Resend 发邮件给收卡人
9. 邮件标题：`💌 Jennifer sent you a card!`（emoji 用 128140，不是 127865）

### 5.6 GET /api/view-card — 查看卡片（API 模式）

**请求：** `?token=xxx`

**响应：** HTML 页面（Worker 渲染）

**Worker 逻辑：**
1. 查 KV `card:{token}`
2. 不存在 → 404 页面
3. 存在 → 渲染卡片 HTML（含 OG 标签）

### 5.7 GET /view/:token — 查看卡片（路由模式）

与 5.6 相同，URL 路径格式不同。Worker 从 URL 提取 token。

**渲染要求：**
- HTML `<head>` 必须包含 OG 标签：
  - `og:title` — `💌 A card for you!`
  - `og:description` — `{fromName} sent you a card ❤️`
  - `og:image` — 卡片预览图 URL
- "Reply with a Card" 按钮链接到 `/card/{slug}?replyTo={fromEmail}`
- 卡片 TTL = 30 天，过期显示 "This card may have expired"

### 5.8 POST /api/gift-free-card — 送朋友免费卡

**请求：**
```json
{
  "fromEmail": "sender@gmail.com",   // 必填
  "fromName": "Jennifer",             // 可选
  "toEmail": "friend@gmail.com",      // 必填
  "toName": "Sarah",                  // 可选
  "message": "Check out this site!"   // 可选
}
```

> 前端必须用 `fromEmail`/`toEmail`。**不是** `email`。

**响应：**
```json
{
  "success": true,
  "giftToken": "gift_abc123...",
  "redeemUrl": "https://sendafun.com/api/redeem-gift?token=gift_abc123&email=friend@gmail.com"
}
```

**Worker 逻辑：**
1. 校验送卡人是付费会员
2. RateLimiter + **每日上限 3 个兑换码/用户**
3. 生成 gift token
4. 存入 KV：`gift:{token}` → 礼物数据，TTL = 7 天
5. 记录到 `gift:history:{fromEmail}`
6. 发邮件给朋友

### 5.9 GET /api/redeem-gift — 兑换免费卡

**请求：** `?token=gift_xxx&email=friend@gmail.com`

**响应：** HTML 页面

**Worker 逻辑：**
1. 查 KV `gift:{token}`
2. 校验 email 匹配
3. 检查是否已兑换
4. 写入 `freecard:{email}` → `{remaining: 1}`，TTL = 365 天
5. 渲染成功页面

> 免费卡数量 = **1 张**（不是 3 张）。需加 RateLimiter。

### 5.10 POST /api/set-reminder — 设置生日提醒

**请求：**
```json
{
  "email": "user@gmail.com",
  "date": "2026-12-25",           // 必填，YYYY-MM-DD 格式
  "name": "Mom",                   // 可选，提醒对象姓名
  "message": "Mom's birthday"      // 可选
}
```

> 前端必须传 `date` 字段（单个字符串）。**不是** `month` + `day` 分开传。

**响应：**
```json
{
  "success": true,
  "message": "Reminder set for 2026-12-25"
}
```

**Worker 逻辑：**
1. RateLimiter
2. 存入 KV 两个 key：
   - `rem:{email}:{date}` → 提醒详情，TTL = 365 天
   - **同时写入索引**：`reminders:by-date:{date}` → `[list of rem keys]`，TTL = 365 天
3. 如果索引不存在则创建，存在则追加

> KV key 前缀必须统一。写入和读取都用 `rem:` 前缀。Cron 读取时用 `reminders:by-date:{date}` 索引获取 key 列表，再逐个读 `rem:` key。

### 5.11 GET /api/download — 下载高清原图（新增）

**请求：** Cookie 携带 `user_token`，Query 参数 `?cardSlug=xxx`

**响应：**
```json
{
  "downloadUrl": "https://sendafun-originals.r2.cloudflarestorage.com/...?X-Amz-Signature=..."
}
```

**Worker 逻辑：**
1. 从 Cookie 提取 `user_token`，反查 email
2. 查 KV 确认用户有权限（`single` 已购该卡 或 `annual` 会员）
3. 生成 R2 签名 URL，TTL = 5 分钟
4. 返回签名 URL

### 5.12 POST /api/reply-card — 回送功能（新增）

**请求：**
```json
{
  "replyToEmail": "original-sender@gmail.com",
  "fromEmail": "recipient@gmail.com",
  "fromName": "Sarah",
  "message": "Thank you for the card!",
  "cardSlug": "thank-you-friend"
}
```

**Worker 逻辑：**
1. 检查 `replyToEmail` 是否在 KV 中有记录（确认是真实送卡人）
2. 检查 `fromEmail` 是否为首次回送（查 `reply:history:{email}`）
3. 首次回送价格 = $0.99（创建 Creem session 时用特殊 price_id）
4. 后续回送 = $1.99 正常价
5. 年费用户免费

---

## 6. KV 数据结构

### 6.1 完整 Key Schema

| Key 格式 | 值 | TTL | 用途 |
|---------|-----|-----|------|
| `perm:{email}` | `{email, plan, grantedAt, expiresAt, active, userToken}` | 单张=24h, 年费=365天 | 会员权限 |
| `session:{sessionId}` | `{email, plan, cardSlug, delivery, createdAt}` | 15 分钟 | 支付会话 |
| `card:{token}` | `{fromName, fromEmail, toName, toEmail, message, imageUrl, ...}` | 30 天 | 卡片数据 |
| `freecard:{email}` | `{email, remaining, ttl}` | 365 天 | 免费卡额度 |
| `gift:{token}` | `{fromEmail, toEmail, toName, message, createdAt, redeemed, token}` | 7 天 | 兑换码 |
| `gift:history:{email}` | `[{toEmail, toName, token, sentAt}]` | 365 天 | 赠送历史 |
| `cards:sent:{email}` | `数字字符串` | 365 天 | 发送计数 |
| `rem:{email}:{date}` | `{email, date, name, message, createdAt}` | 365 天 | 提醒详情 |
| `reminders:by-date:{date}` | `["rem:email1:date", "rem:email2:date"]` | 365 天 | 提醒日期索引 |
| `usertoken:{token}` | `email` | 365 天 | token → email 反查（**随机 token，不是 HMAC**） |
| `reply:history:{email}` | `[{date, replyToEmail}]` | 365 天 | 回送历史 |
| `rl:{key}:{windowStart}` | `计数` | 70 秒 | 限流计数器 |

### 6.2 TTL 规则

| 数据类型 | TTL | 原因 |
|---------|-----|------|
| 单张购买权限 | **24 小时** | 单次购买，当天有效 |
| 年费会员权限 | **365 天** | 年度订阅 |
| 支付会话 | 15 分钟 | 防止僵尸会话 |
| 卡片数据 | 30 天 | 生日卡可能延迟查看 |
| 兑换码 | 7 天 | 限时兑换 |
| 免费卡额度 | 365 天 | 跟随会员周期 |
| 提醒数据 | 365 天 | 年度循环 |
| R2 签名 URL | 5 分钟 | 防止链接泄露 |

> 代码中 `grantPermission` 的 `Math.min(PT, ...)` 必须改为按 plan 区分：
> - `single` → TTL = 86400（24h）
> - `annual` → TTL = 31536000（365 天）
> - 不要用 `Math.min` 统一截断

---

## 7. 支付流程（完整链路）

### 7.1 产品定义（3个产品）

| 产品ID | 产品名称 | 价格 | 计费周期 | Creem Product ID |
|--------|---------|------|---------|-----------------|
| `sendafun_pay_per_send` | 按次发送 | $1.99/次 | 一次性 | `prod_7GGx4Gh5yvKLOb0OCzYFoq` |
| `sendafun_monthly_subscription` | 月订阅 | $6.99/月 | 月付，自动续费 | `prod_3xVdtK0wdzqLlaCz4H7lzQ` |
| `sendafun_annual_subscription` | 月订阅年付 | $69/年 | 年付，自动续费 | `prod_73aCoww3uhNMevKi8NVwNv` |

**订阅政策**：
- ✅ 到期自动续费（Auto-renew）
- ✅ 用户可随时取消（Cancel anytime）
- ✅ 取消后当期剩余时间仍可用，下个周期不扣费
- ❌ 不支持中途退款（需在 `/refund-policy` 页面说明）

**Creem 手续费**：
- 美国卡：2.9% + $0.30/笔
- 国际卡：3.9% + $0.30/笔
- 实际到账：按次 $1.63、月订 $6.49、年付 $66.70

### 7.2 正确流程

```
1. 用户编辑卡片 → 点击 "Download & Send"
2. 前端显示过渡信任页：
   ┌──────────────────────────────────┐
   │  🔒 Secure Checkout              │
   │                                  │
   │  You're paying $1.99 for your card│
   │  You'll be redirected to Creem's │
   │  secure payment page             │
   │  (Different URL — that's normal) │
   │  Trusted by 3,000+ businesses    │
   │                                  │
   │  Visa · MC · Amex · Apple Pay    │
   │  · Google Pay                    │
   │                                  │
   │  [Continue to payment →] [Cancel]│
   └──────────────────────────────────┘
3. 前端调 POST /api/create-session {email, plan, cardSlug, delivery}
4. Worker 调 Creem API 创建 session → 返回 checkout URL
5. 前端 window.location = checkout URL（跳转 Creem）
6. 用户在 Creem 完成支付
7. Creem Webhook → POST /api/webhook → Worker 写 KV 权限
8. Creem 跳转 Success URL → /payment-success?session_id=xxx
9. 前端轮询 GET /api/check-member（Cookie 携带 user_token）
   → Worker 也可主动调 Creem 查询 session 状态（二次校验）
10. 权限确认 → 展示送达选项
11. 送达完成 → 弹窗推荐年费 + 送朋友免费卡
```

### 7.2 前端禁止行为

- 禁止用 `setTimeout` 假装支付（删除 `simulatePaymentThenDelivery()`）
- 禁止跳过 Creem 直接打开发卡弹窗
- 禁止在前端判断权限后直接提供下载（必须走 Worker）

### 7.3 Creem 配置

| 配置项 | 值 |
|--------|-----|
| Store ID | `sto_5CSCNwFCgLO6F2XAZ8ZJlD` |
| Success URL | `https://sendafun.com/payment-success?session_id={CHECKOUT_SESSION_ID}` |
| Cancel URL | `https://sendafun.com/payment-cancel` |
| Webhook URL | `https://sendafun.com/api/webhook` |
| Product ID (按次) | `prod_7GGx4Gh5yvKLOb0OCzYFoq` ← $1.99 一次性 |
| Product ID (月订) | `prod_3xVdtK0wdzqLlaCz4H7lzQ` ← $6.99/月 自动续费 |
| Product ID (年付) | `prod_73aCoww3uhNMevKi8NVwNv` ← $69/年 自动续费 |

> Creem 使用 Product ID（`prod_` 前缀）而非 Price ID。端点 `/v1/checkouts`，传 `product_id` 参数创建 checkout session。

### 7.4 支付二次校验

`/payment-success` 页面轮询 `/api/check-member` 时，Worker 应：
1. 先查 KV `session:{sessionId}` 确认会话存在且未过期
2. 如 KV 中已有权限记录，直接返回成功
3. 如 KV 中无权限记录（webhook 可能延迟），**主动调 Creem API 查询 session 状态**
4. Creem 确认已支付 → 写 KV 权限 → 返回成功
5. Creem 确认未支付 → 返回"处理中"
6. 超时 30 秒仍未支付 → 返回"如果已扣款请联系支持"

### 7.5 退款政策（新增，见第 18 章 18.1.5）

- 创建 `/refund-policy` 页面
- 支付过渡页底部加：`"By proceeding, you agree to our [Refund Policy]"`
- Creem checkout 页面也需展示退款政策链接（在 Creem 后台配置）

---

## 8. 安全规格

### 8.1 鉴权机制

**user_token 方案（替代明文邮箱）：**

1. 用户首次付费后，Worker 生成 `user_token = crypto.randomUUID()`（**随机**，不是 HMAC(email)）
2. 存入 KV 两个地方：
   - `usertoken:{token}` → `email`，TTL 365 天
   - `perm:{email}.userToken` = `token`
3. 通过 `Set-Cookie` 写入浏览器：`user_token=xxx; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`
4. 后续所有鉴权接口从 Cookie 读 `user_token`，反查 KV 获取 email
5. **接口禁止直接接收前端传入的 email 参数做权限判断**
6. **禁止在 URL 参数中传递 user_token**（见第 18 章 18.1.2）

### 8.2 CORS

```javascript
// 限制为 sendafun.com（含 www 子域）
const ALLOWED_ORIGIN = "https://sendafun.com";
const ALLOWED_ORIGIN_WWW = "https://www.sendafun.com";
```

### 8.3 限流规则

| 接口 | IP 限制 | 用户限制 | 日限额 |
|------|--------|---------|--------|
| create-session | 5次/分钟 | 5次/分钟/email | — |
| send-card | 5次/分钟 | 5次/分钟/fromEmail | **10次/天/fromEmail** |
| gift-free-card | 5次/分钟 | 5次/分钟/fromEmail | **3次/天/fromEmail** |
| lookup-user | 5次/分钟 | 5次/分钟/email | — |
| set-reminder | 5次/分钟 | 5次/分钟/email | — |
| redeem-gift | 5次/分钟 | — | — |
| download | 5次/分钟 | 5次/分钟/token | — |
| view-card | 10次/分钟/IP | — | — |
| delete-me | 5次/分钟 | 5次/分钟/email | — |

### 8.4 输入校验

所有接口必须校验：
- 邮箱格式：`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`（至少）
- 字符串长度限制（message ≤ 500 字符，name ≤ 100 字符）
- HTML 注入过滤（Worker `esc()` 函数已有，前端 `showToast` 改用 `textContent`）

### 8.5 Webhook 安全

- HMAC-SHA256 签名校验（代码已实现，L41-49，正确）
- 时间窗口 ±5 分钟（已实现）
- 签名校验失败返回 401，不返回错误详情
- IP 白名单：可选（Creem 如发布官方 IP 段则配置）

### 8.6 R2 安全

- 签名 URL TTL = 5 分钟
- Worker 生成 URL 前校验 KV 购买记录
- **禁止在 URL 中带 user_token 参数**（下载全程用 HttpOnly Cookie 鉴权）
- `originals/` 目录不进 git、不进 Pages

### 8.7 XSS 防护

- Worker `esc()` 函数：转义 `& < > " '`（补充单引号 `'` → `&#39;`)
- 前端 `showToast()`：用 `textContent` 代替 `innerHTML`
- 前端所有用户输入渲染前做 HTML 实体转义
- Canvas `fillText` 天然安全（不执行脚本）

### 8.8 邮件合规

- 所有营销/提醒邮件必须包含退订链接（CAN-SPAM Act / GDPR 要求）
- 邮件 footer：`You're receiving this because {fromName} sent you a card on SendAFun. [Unsubscribe]`
- 退订链接 → `/api/unsubscribe?email=xxx&token=xxx` → KV 加入黑名单

### 8.9 CSRF 保护（新增，见第 18 章 18.2.2）

所有 POST 接口必须校验 `X-CSRF-Token` header（值与 `user_token` Cookie 相同）：

```javascript
// Worker 侧（所有 POST 接口）
if (request.method === 'POST') {
  const csrf = request.headers.get('X-CSRF-Token');
  const cookie = request.headers.get('Cookie') || '';
  const userToken = extractToken(cookie);  // 从 Cookie 提取 user_token
  if (!csrf || csrf !== userToken) {
    return new Response('CSRF mismatch', { status: 403 });
  }
}
```

### 8.10 安全审计采纳清单

| 审计项 | 采纳 | 说明 |
|--------|------|------|
| Webhook IP 白名单 | 可选 | HMAC 签名是主要防线 |
| 支付后端二次校验 | ✅ 必须 | Worker 主动调 Creem 查询 |
| 支付会话 TTL + 用户绑定 | ✅ 必须 | 15 分钟 TTL，绑定 email |
| R2 URL 绑定用户 | ✅ 必须 | 5 分钟 TTL + Cookie 鉴权（不用 URL 参数） |
| R2 临时方案隔离 | ✅ 必须 | originals 不上线 |
| user_token 鉴权 | ✅ 必须 | 替代明文邮箱，**用随机 token** |
| 兑换码日限额 | ✅ 必须 | 3次/天，兑换 1 次 |
| View token 限流 | ✅ 必须 | token 熵值已够（256位），加限流 |
| 邮件接口输入过滤 | ✅ 必须 | 格式校验 + 日限额 |
| localStorage 不作权限判断 | ✅ 必须 | 前端只做 UI |
| WAF/爬虫防护 | ✅ 运维 | CF WAF 规则配置 |
| 提醒数据 token 校验 | ✅ 必须 | 通过 user_token 访问 |
| XSS 输入转义 | ✅ 已部分处理 | 补充单引号 + textContent |
| GDPR/CCPA 合规 | ✅ 必须 | Cookie 弹窗 + 退订链接 + 数据删除权 |
| KV 清理机制 | ✅ 已处理 | 各 key 都有 expirationTtl |
| CSRF 保护 | ✅ 必须（新增） | 所有 POST 接口加 X-CSRF-Token 校验 |

---

## 9. 邮件服务


### 9.1 服务商

**Resend**（替代 MailChannels）

- MailChannels Cloudflare 免费集成 2024 年已停用
- Resend 免费层 3000 封/月，足够初期
- API：`https://api.resend.com/emails`
- 认证：`Authorization: Bearer {RESEND_API_KEY}`
- Worker 函数：`sendResend(o)`（详见 worker/src/index.js 第72行）

**环境变量配置（Cloudflare Pages Dashboard）：**

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `RESEND_API_KEY` | `re_...` | Resend API Key（生产环境必须配置） |
| `RESEND_FROM_EMAIL` | `onboard@resend.dev` | 开发阶段使用；生产需验证域名后改为 `hello@sendafun.com` |

**本地开发（`.env` 文件）：**

```
RESEND_API_KEY=re_your_key_here
RESEND_FROM_EMAIL=onboard@resend.dev
```

> ⚠️ `.env` 已加入 `.gitignore`，不会提交到 git

**Resend API 请求格式：**

```json
{
  "from": "onboard@resend.dev",
  "to": ["recipient@example.com"],
  "subject": "Your subject",
  "html": "<p>Email body</p>",
  "reply_to": "hello@sendafun.com"
}
```

> `reply_to` 字段：收件人点回复时，回复邮件发到 `reply_to` 地址（需为验证过的邮箱/域名）

**生产环境部署步骤：**

1. 在 Resend Dashboard 添加并验证 `sendafun.com` 域名
2. 按 Resend 提示添加 SPF/DKIM/DMARC DNS 记录
3. 更新 Cloudflare Pages 环境变量 `RESEND_FROM_EMAIL=hello@sendafun.com`
4. 测试发送，检查垃圾箱评分（Resend Dashboard → Analytics）


### 9.2 发送场景

| 场景 | 发件人 | 标题 | 模板 |
|------|--------|------|------|
| 卡片送达 | cards@sendafun.com | `💌 {fromName} sent you a card!` | 卡片预览 + View 按钮 |
| 免费卡赠送 | cards@sendafun.com | `🎁 {fromName} sent you a free card!` | 兑换按钮 |
| 生日提醒 | reminders@sendafun.com | `📌 Don't forget! {name}'s birthday is coming up!` | 送卡按钮 |
| Re-engagement | hello@sendafun.com | `Your card was a hit! Ready for the next one?` | 回访引导 |


### 9.3 邮件防垃圾箱

- 配置 SPF / DKIM / DMARC DNS 记录
- 邮件中增加提示："If you don't see it, check your spam folder 💌"
- 默认"下载为主，邮件为辅"
- 邮件标题包含送卡人姓名


### 9.4 Emoji 修正

| 用途 | 正确 emoji | Unicode | 代码原值（错误） |
|------|-----------|---------|----------------| 
| 卡片送达标题 | 💌 | 128140 | 127865 (🍱 便当盒) |
| 免费卡赠送标题 | 🎁 | 127873 | 正确 |
| 生日提醒标题 | 📌 | 128204 | — |

---

### 9.5 Cloudflare Pages 环境变量配置（部署必做）

Worker 代码读取 `env.RESEND_API_KEY` 和 `env.RESEND_FROM_EMAIL`，必须在 Cloudflare Pages Dashboard 中配置，否则邮件发送会失败。

**配置路径：**

```
Cloudflare Dashboard → SendAFun 项目 → Settings → Environment Variables → Production
```

**需添加的变量：**

| 变量名 | 值 | 说明 | 必填 |
|--------|-----|------|------|
| `RESEND_API_KEY` | `re_...` | Resend API Key（从 Resend Dashboard → API Keys 获取） | ✅ |
| `RESEND_FROM_EMAIL` | `onboard@resend.dev` | 开发阶段使用；生产改为 `hello@sendafun.com`（需验证域名） | ✅ |
| `CREEM_API_KEY` | `creem_...` | Creem 支付 API Key | ✅ |
| `CREEM_WEBHOOK_SECRET` | `whsec_...` | Creem Webhook 签名密钥 | ✅ |
| `SITE_URL` | `https://sendafun.com` | 生产域名（默认已配置则跳过） | ✅ |

> ⚠️ **Type 选择 `Secret`**（RESEND_API_KEY、CREEM_API_KEY、CREEM_WEBHOOK_SECRET），部署日志中不会显示明文

**配置步骤：**

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 登录
2. 左侧菜单 **Workers & Pages** → 找到 `sendafun` 项目 → 点击进入
3. 顶部标签页 **Settings** → 左侧 **Environment Variables**
4. 点击 **Add variable**
5. 填入变量名和值，Type 选 `Secret`（API Key 类）或 `Plain Text`（URL 类）
6. **Add variable** 后，必须点 **Save** 按钮（页面底部）
7. 保存后重新部署：**Deployments** 标签 → 最新部署 → **Retry deployment**

**验证配置是否生效：**

部署完成后，访问 `https://sendafun.com/api/check-member?email=test@test.com`，应返回 JSON（不报错 500）。

如果报 500，检查 Cloudflare Pages → **Deployments** → 最新部署 → **View Build Logs**，搜索 `RESEND_API_KEY` 相关错误。

---


### 9.6 生产环境 Resend 域名验证

开发阶段用 `onboard@resend.dev`（Resend 预验证，无需额外配置）。生产环境需验证自有域名，否则邮件进垃圾箱概率高。

**步骤：**

1. 登录 [Resend Dashboard](https://resend.com/domains)
2. **Add Domain** → 输入 `sendafun.com`
3. Resend 生成 3 条 DNS 记录（复制备用）：

| 记录类型 | 主机名 | 值 |
|---------|--------|-----|
| `MX` | `@` 或 `sendafun.com` | `feedback-smtp.resend.com` |
| `TXT` (SPF) | `@` | `v=spf1 include:_spf.resend.com ~all` |
| `TXT` (DKIM) | `resend._domainkey` | `p=MIGf...`（Resend 生成的长字符串） |

4. 到域名 DNS 管理后台（Namecheap/Cloudflare/GoDaddy）添加这 3 条记录
5. 回到 Resend Dashboard，点 **Verify** → 等待验证（通常 10 分钟内）
6. 验证成功后，更新 Cloudflare Pages 环境变量 `RESEND_FROM_EMAIL=hello@sendafun.com`

**验证成功后发件人配置：**

| 场景 | from 地址 | 说明 |
|------|----------|------|
| 卡片送达 | `cards@sendafun.com` | 需在 Resend 中添加该地址为 **Verified Sender** |
| 免费卡赠送 | `cards@sendafun.com` | 同上 |
| 生日提醒 | `reminders@sendafun.com` | 同上 |
| 联系人表单 | `hello@sendafun.com` | 主域名邮箱 |

> Resend 免费层支持添加多个 Verified Sender 地址（无需额外 MX 记录）

---


## 10. 前端规格

### 10.1 Canvas 编辑器（高级版）

| 功能 | 规格 | 优先级 |
|------|------|--------|
| **多层文字** | 支持多个独立文本框，每个可单独编辑/删除/排序 | 🔴 P0 |
| **文字特效** | 阴影（4 方向）、描边（1-5px）、发光效果 | 🔴 P0 |
| **贴纸库** | 50+ 贴纸（节日/情感/装饰），拖放定位 | 🔴 P0 |
| **字体扩展** | 新增手写字体：`Dancing Script`, `Caveat`, `Homemade Apple` | 🔴 P0 |
| **文字旋转** | 拖动旋转手柄，0-360° | 🟡 P1 |
| **透明度控制** | 文字/贴纸透明度滑块 0-100% | 🟡 P1 |
| **图层管理** | 图层面板显示所有元素，可调整顺序/删除 | 🔴 P0 |
| **实时预览** | 「Preview as recipient」按钮，弹出手机帧模拟视图 | 🔴 P0 |
| **Before/After** | 滤镜效果 before/after 滑块对比 | 🟡 P1 |
| **模板预设** | 一键应用设计师预设（布局+字体+颜色组合） | 🟡 P1 |
| **双缓冲渲染** | backBuffer + debounce 300ms | ✅ 已实现 |
| **颜色选择** | 8 色调色盘（对比度 ≥ 4.5:1） | ✅ 需验证对比度 |
| **位置** | 自由拖放（不限于顶/中/底） | 🔴 P0 |
| **滤镜** | 4 种（暖/冷/黑白/复古） | ❌ 参数错误，需修 |
| **Undo/Redo** | 历史栈，支持多步 | ❌ 需修复（见 10.3） |
| **无障碍** | aria-label + aria-live 播报 | ❌ 缺失，见第 18 章 18.1.4 |

#### 10.1.1 数据结构调整

当前 `state` 只支持单个文本框，需改为多图层结构：

```javascript
const state = {
  bgImg: null,          // 背景图
  layers: [             // 多图层，按渲染顺序排序
    {
      id: 'layer-1',
      type: 'text',      // 'text' | 'sticker'
      content: 'Happy Birthday!',
      font: 'Dancing Script',
      color: '#ffffff',
      size: 32,          // px
      x: 100,            // 画布坐标
      y: 200,
      rotation: 0,       // 度数
      opacity: 1,        // 0-1
      effects: {         // 文字特效
        shadow: { enabled: true, color: '#000000', blur: 4, offsetX: 2, offsetY: 2 },
        stroke: { enabled: true, color: '#000000', width: 2 },
        glow: { enabled: false, color: '#ffffff', blur: 8 }
      },
      selected: true    // 当前选中图层
    },
    {
      id: 'layer-2',
      type: 'sticker',
      content: '🎂',     // emoji 或贴纸 ID
      size: 64,
      x: 150,
      y: 300,
      rotation: 0,
      opacity: 1
    }
  ],
  filter: 'none',       // 背景滤镜
  activeLayerId: 'layer-1'
};
```

#### 10.1.2 图层管理 UI

```
┌─────────────────────────────────┐
│  Canvas 编辑器                  │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  │    Canvas 渲染区         │   │
│  │    (点击选中图层)        │   │
│  │                         │   │
│  └─────────────────────────┘   │
│  ┌─ Layers ───────────────┐   │
│  │ 👁 Text: "Happy..."    │   │
│  │ 👁 🎂 Sticker           │   │
│  │ [+ Add Text] [+ Sticker]│   │
│  └─────────────────────────┘   │
│  ┌─ Effects ──────────────┐   │
│  │ ☑ Shadow  [设置]        │   │
│  │ ☐ Stroke  [设置]        │   │
│  │ ☐ Glow    [设置]        │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

#### 10.1.3 实时预览功能

点击「Preview as recipient」按钮后：

```javascript
function showRecipientPreview() {
  // 1. 渲染最终卡片到隐藏 Canvas
  const finalCanvas = renderCard(state);
  // 2. 弹出模态框，显示手机帧 + 卡片
  openModal({
    title: 'How your recipient sees it',
    content: `
      <div class="phone-frame">
        <div class="phone-screen">
          <img src="${finalCanvas.toDataURL()}" />
          <p class="preview-message">A card from ${state.fromName || 'you'}</p>
        </div>
      </div>
      <div class="preview-actions">
        <button onclick="closeModal()">Back to Edit</button>
        <button onclick="proceedToCheckout()">Looks good, send it!</button>
      </div>
    `
  });
}
```

#### 10.1.4 贴纸库结构

```javascript
// stickers.js — 贴纸数据
export const STICKERS = {
  birthday: [
    { id: 'cake', emoji: '🎂', label: 'Cake' },
    { id: 'balloon', emoji: '🎈', label: 'Balloon' },
    { id: 'gift', emoji: '🎁', label: 'Gift' },
    { id: 'party', emoji: '🎉', label: 'Party' },
    // ... 20+ 生日贴纸
  ],
  love: [
    { id: 'heart', emoji: '❤️', label: 'Heart' },
    { id: 'rose', emoji: '🌹', label: 'Rose' },
    // ...
  ],
  // 每个分类 10-20 贴纸
};
```

### 10.2 滤镜修复

```javascript
// 错误（当前）：
warm: { fn: function(ctx, buf) { applyWarm(buf) } },  // 只传 1 个参数

// 正确：
warm: { fn: function(ctx, buf) { applyWarm(ctx, buf) } },  // 传 2 个参数
```

所有滤镜函数定义 `applyWarm(ctx, data)` 需要两个参数，调用时必须都传。

### 10.3 Undo 修复

```javascript
// 错误：JSON.stringify(state) 把 Image 对象序列化为 {}
// 正确：bgImg 不入 JSON，单独存引用

function pushHistory() {
  const bgImgRef = state.bgImg;
  state.bgImg = null;  // 临时移除
  const snap = JSON.stringify(state);
  state.bgImg = bgImgRef;  // 恢复
  state.history.push({ snap: snap, bgImg: bgImgRef });
}

function undo() {
  const entry = state.history[--state.historyIdx];
  Object.assign(state, JSON.parse(entry.snap));
  state.bgImg = entry.bgImg;  // 恢复引用
  render();
}
```

### 10.4 支付流程修复

删除 `simulatePaymentThenDelivery()` 函数，替换为：

```javascript
function proceedToCheckout() {
  // 1. 显示过渡信任页（含退款政策链接）
  openModal(modalTrustPage);
  // 2. 用户点击 Continue → 调 API
  // 3. POST /api/create-session
  // 4. window.location = response.url（跳转 Creem）
}
```

### 10.5 API 字段修复

| API | 前端当前（错误） | 前端应改为 |
|-----|-----------------|-----------|
| send-card | `recipientEmail` | `toEmail` |
| send-card | `senderName` | `fromName` |
| send-card | 缺失 | 添加 `fromEmail` |
| send-card | 缺失 | 添加 `toName` |
| send-card | `cardSlug, font, color, filter` | 保留 `cardSlug`，其余移到卡片数据 |
| set-reminder | `month, day` | `date`（YYYY-MM-DD） |
| gift-free-card | `email` | `fromEmail, toEmail, fromName, toName` |
| lookup-user | 期望 `data.name` | 删除，不期望 name 字段 |

### 10.6 其他前端修复

| 问题 | 修复 |
|------|------|
| `showToast` 用 `innerHTML` | 改用 `textContent` |
| viewport `user-scalable=no` | 移除，允许缩放（WCAG 2.1） |
| presetTexts 含 HTML 实体 | 用真实字符，不用 `&mdash;` |
| `/send?replyTo=` 链接 | 改为 `/card/{slug}?replyTo={email}` |
| 社区轮播假数据 | 标注 "Example" 或后续接 UGC |
| `filterByStyle()` 空操作 | 实现风格筛选或移除按钮 |
| `© 2026` 硬编码 | 用 `new Date().getFullYear()` |
| ogImage 404 | 生成 OG 图或移除引用 |

### 10.7 移动端 + 无障碍

- 所有按钮最小尺寸 ≥ 44px（Apple HIG / WCAG 2.5.8）
- viewport 允许缩放
- 键盘弹出时用 `visualViewport API` 调整布局
- 先写手机版 CSS，桌面版用 `max-width` 拉伸
- **Canvas 无障碍**（见第 18 章 18.1.4）：
  - 添加 `aria-live="polite"` 区域实时播报编辑状态
  - 所有按钮加 `aria-label`
  - Canvas 加 `role="img"` + `aria-label="Card preview"`

---

## 11. 构建脚本

### 11.1 三种模式

```bash
node build-script/generate-cards.js              # 增量
node build-script/generate-cards.js --force      # 全量
node build-script/generate-cards.js --sample=10  # 测试 10 张
```

### 11.2 增量原理

- `.cards-cache.json` 记录每张卡的 `lastModified` + 图片 hash
- 只有变更卡片才重新生成 HTML
- 改模板时必须 `--force` 全量重建

### 11.3 产物

| 文件 | 说明 |
|------|------|
| `dist/index.html` | 首页 |
| `dist/category/*.html` | 分类页 |
| `dist/card/*.html` | 单卡页 |
| `dist/sitemap.xml` | 站点地图 |
| `dist/robots.txt` | 屏蔽 `/api/*` |
| `dist/_headers` | Cloudflare Pages 缓存规则 |
| `dist/_redirects` | 路由规则 |

### 11.4 安全要求

- `.gitignore` 必须排除 `source/images/raw/`（原图不入 git）
- `.gitignore` 必须排除 `originals/`（高清无水印图不进 Pages）
- `.cards-cache.json` 不入 git（防止篡改跳过校验）
- **（新增）** `source/images/` 三尺寸 WebP **不入 git** —— 改用 Git LFS 或从 R2 动态拉取（见第 18 章 18.2.5）

### 11.5 图片路径修复

`cards-config.json` 中 `bgImage` 路径 `public/birthday-mom-01.webp` 与实际文件位置不匹配。需要统一为：

```json
"bgImage": "images/birthday-mom-01.webp",
"bgImageWatermark": "images/watermark/birthday-mom-01.webp"
```

图片实际存放在 `source/images/{category}/` 目录。

---

## 12. 部署配置

### 12.1 wrangler.toml（Worker 配置，需创建）

```toml
name = "sendafun-worker"
main = "worker/src/index.js"
compatibility_date = "2024-01-01"

[env.production]
vars = { SITE_URL = "https://sendafun.com" }

# KV 命名空间
[[env.production.kv_namespaces]]
binding = "CARD_PERMISSIONS"
id = "需在 CF Dashboard 创建后填入"

# R2 桶
[[env.production.r2_buckets]]
binding = "PREVIEW_BUCKET"
bucket_name = "sendafun-preview"

[[env.production.r2_buckets]]
binding = "ORIGINALS_BUCKET"
bucket_name = "sendafun-originals"

# Cron Trigger — 每 6 小时检查提醒
[env.production.triggers]
crons = ["0 */6 * * *"]

# 环境变量（敏感信息用 wrangler secret put 设置）
# CREEM_API_KEY
# CREEM_WEBHOOK_SECRET
# RESEND_API_KEY
# WORKER_SECRET（用于 user_token HMAC —— 仅用于 cookie 签名，token 本身随机生成）
```

### 12.2 _headers（Pages 配置，需创建）

```
# HTML 页面 — 12h 缓存 + SWR
/
  Cache-Control: public, max-age=43200, stale-while-revalidate=3600

/card/*
  Cache-Control: public, max-age=43200, stale-while-revalidate=3600

/category/*
  Cache-Control: public, max-age=43200, stale-while-revalidate=3600

# 静态资源
/css/*
  Cache-Control: public, max-age=604800

/js/*
  Cache-Control: public, max-age=604800

/images/*
  Cache-Control: public, max-age=2592000

# 字体和 favicon
/fonts/*
  Cache-Control: public, max-age=31536000

/favicon*
  Cache-Control: public, max-age=31536000

# API 不缓存
/api/*
  Cache-Control: no-store
```

### 12.3 _redirects（需创建）

```
# 支付成功/取消页面
/payment-success/*    /payment-success.html    200
/payment-cancel       /payment-cancel.html      200

# 回送路由
/send                 /card/thank-you-friend    302
```

### 12.4 robots.txt（需创建）

```
User-agent: *
Disallow: /api/
Allow: /
Sitemap: https://sendafun.com/sitemap.xml
```

### 12.5 DNS 记录

| 类型 | 名称 | 值 | 用途 |
|------|------|-----|------|
| A/CNAME | @ | CF Pages | 主站 |
| A/CNAME | www | CF Pages | www 跳转 |
| TXT | @ | `v=spf1 include:_spf.resend.com ~all` | SPF |
| TXT | resend._domainkey | DKIM 公钥 | DKIM |
| TXT | _dmarc | `v=DMARC1; p=quarantine; rua=mailto:admin@sendafun.com` | DMARC |

### 12.6 部署流程

1. **Pages**：`git push` → CF Pages 自动部署（2-8 分钟）
2. **Worker**：`cd worker && npx wrangler deploy`（1-3 秒）
3. **铁律**：Worker 和 Pages 分开上线，至少间隔 1 小时
4. **回滚**：`git revert HEAD --no-edit && git push` 或 CF Dashboard → Rollback

---

## 13. 已知 Bug 修复清单

### P0 — 不修不能上线

| # | Bug | 文件 | 修复方案 |
|---|-----|------|---------|
| 1 | 支付是假的（setTimeout 模拟） | script.html L625-641 | 删除，接真实 /api/create-session + Creem 跳转 |
| 2 | Price ID 是占位符 | worker L108 | 替换为真实 Creem Price ID |
| 3 | 年费 TTL 被截断为 1 天 | worker L56-62 | 按 plan 区分 TTL，不用 Math.min |
| 4 | send-card 字段不匹配 | script.html L647-658 + worker L190-236 | 统一为 fromEmail/toEmail/fromName/toName |
| 5 | set-reminder 字段不匹配 | script.html L691-704 + worker L295-307 | 统一用 date 字段 |
| 6 | gift-free-card 字段不匹配 | script.html L670-674 + worker L251-279 | 统一为 fromEmail/toEmail |
| 7 | KV key 不匹配（rem: vs reminders:by-date:） | worker L304 vs L317 | 写入时同时创建 by-date 索引 |
| 8 | 滤镜参数错误 | script.html L399-404 | applyWarm(ctx, buf) 传两个参数 |
| 9 | MailChannels 已停用 | worker L72-82 | 替换为 Resend API |
| 10 | CORS 全开 | worker L104 | 限制为 https://sendafun.com |
| 11 | XSS: showToast innerHTML | script.html | 改用 textContent |
| 12 | 无 wrangler.toml | worker/ | 创建配置文件 |
| 13 | user_token 可预测（HMAC(email)） | worker L55 | 改为 crypto.randomUUID()（见 18.1.3） |
| 14 | Token 在 URL 中泄露 | worker L130+ | 下载用 Cookie 鉴权，URL 不带 token（见 18.1.2） |
| 15 | 无 CSRF 保护 | worker 所有 POST | 加 X-CSRF-Token 校验（见 18.2.2） |
| 16 | Canvas 无障碍缺失 | script.html | 加 aria-label + aria-live（见 18.1.4） |

### P1 — 上线前应修复

| # | Bug | 修复方案 |
|---|-----|---------|
| 17 | QR 码是假的 | 引入 qrcode.js 或移除功能 |
| 18 | Undo 破坏背景图 | Image 对象不入 JSON |
| 19 | 邮件标题 emoji 错误（🍱 → 💌） | 128140 |
| 20 | 卡片 TTL 10 天 → 30 天 | 864e4 → 2592e3 |
| 21 | 提醒检查 1-2 天 → 3 天 | 检查 [今天, 明天, 后天, 大后天] |
| 22 | 免费卡 3 张 → 1 张 | remaining: 1 |
| 23 | Success URL 路径不一致 | 统一为 /payment-success |
| 24 | /send 路由不存在 | 改为 /card/{slug}?replyTo= |
| 25 | viewport 禁止缩放 | 移除 user-scalable=no |
| 26 | 无 OG 标签 | renderCardHtml 添加 OG meta |
| 27 | 礼物兑换无限流 | 加 RateLimiter |
| 28 | 无 robots.txt | 创建 |
| 29 | 无 sitemap.xml | 构建脚本生成 |
| 30 | 无 _headers | 创建 |
| 31 | ogImage 404 | 生成或移除 |
| 32 | 图片路径不匹配 | 修正 cards-config.json |
| 33 | Worker 全局变量竞态 | 改为局部变量 |
| 34 | esc() 不转义单引号 | 补充 ' → &#39; |
| 35 | Cookie 同意横幅缺失 | 欧盟用户需弹窗（见 18.1.1） |
| 36 | 退款政策缺失 | 创建 /refund-policy（见 18.1.5） |
| 37 | 数据删除权缺失 | 新增 /api/delete-me（见 18.2.3） |
| 38 | COPPA 年龄门控缺失 | 首页加年龄验证（见 18.2.1） |
| 39 | 颜色对比度未检查 | 8 色盘验证 WCAG 4.5:1（见 18.2.4） |
| 40 | 8971 张图入 git | 改用 Git LFS 或 R2（见 18.2.5） |

---

## 14. 功能缺失清单

### 14.1 P0 缺失（不实现不能上线）

| # | 功能 | 说明 |
|---|------|------|
| 1 | 支付过渡信任页 | 金额 + 支付方式 + 跳转说明 + 退款政策链接 |
| 2 | /payment-success 页面 | 轮询权限 + 展示送达选项 |
| 3 | user_token 鉴权 | Cookie + KV，替代明文邮箱，**随机 token** |
| 4 | R2 双桶集成 | preview 公开 + originals 私有 |
| 5 | /api/download 路由 | Worker 签名 URL 下载 |
| 6 | 支付二次校验 | Worker 调 Creem 查询 session |
| 7 | 输入校验 | 邮箱格式 + 长度限制 |
| 8 | 日限额 | send-card 10次/天，gift 3次/天 |
| 9 | CSRF 保护 | 所有 POST 接口加校验 |
| 10 | Cookie 同意横幅 | 欧盟用户合规 |

### 14.2 P1 缺失（上线前应实现）

| # | 功能 | 说明 |
|---|------|------|
| 11 | 邮件退订链接 | GDPR/CCPA 合规 |
| 12 | SPF/DKIM/DMARC | 防垃圾箱 |
| 13 | 回送功能 | /api/reply-card + $0.99 首次 |
| 14 | 年费推荐弹窗 | 支付后推荐 $19.99/年 |
| 15 | 默认展示最佳效果 | 预设文字 + 字体 + 滤镜 |
| 16 | Cancel anytime 标注 | 年费方案旁 |
| 17 | 付款前展示送达选项 | 不等付完才显示 |
| 18 | Cron Trigger 配置 | wrangler.toml crons |
| 19 | 邮件提示检查垃圾箱 | "check your spam folder" |
| 20 | 数据删除权 API | /api/delete-me（GDPR Art.17） |
| 21 | COPPA 年龄门控 | 首页加验证 |
| 22 | 颜色对比度验证 | WCAG 2.1 AA 4.5:1 |

### 14.3 P2 缺失（Phase 1 可没有）

| # | 功能 |
|---|------|
| 23 | Re-engagement 邮件（3 天后跟进） |
| 24 | 风格维度筛选（warm/funny/artistic） |
| 25 | 首页轮播手动滑动 |
| 26 | Google Analytics |
| 27 | 预览邮件效果 |
| 28 | 前后对比按钮 |
| 29 | Google AdSense（Phase 2） |
| 30 | Twilio 短信送达（Phase 2） |
| 31 | 物理贺卡配送（Phase 2，美国市场预期） |
| 32 | 定时送达（Phase 2，`scheduledAt` 字段） |
| 33 | 多语言 /es/（Phase 2，拉丁裔市场） |

---

## 15. 文件结构

```
sendafun/
├── source/
│   ├── cards-config.json           # 卡片元数据（12 张）
│   └── images/{category}/          # 三尺寸 WebP 图（不入 git，用 Git LFS）
│
├── build-script/
│   ├── generate-cards.js           # 构建脚本（增量/全量/sample）
│   ├── process-images.py           # 图片处理（HSL + 三尺寸 + WebP）
│   └── process-images.js           # ❌ 废弃，勿用
│
├── templates/
│   ├── card-template.html          # 单卡页模板（含 Canvas 编辑器）
│   └── segments/                   # 分段模板
│       ├── head.html                # 含 OG 标签 + aria 属性
│       ├── canvas.html             # 含 aria-live 区域
│       ├── script.html
│       ├── foot.html
│       └── end.html
│
├── dist/                           # 构建产物（Pages 部署目录）
│   ├── index.html
│   ├── category/*.html
│   ├── card/*.html
│   ├── payment-success.html        # ← 需创建
│   ├── payment-cancel.html         # ← 需创建
│   ├── refund-policy.html         # ← 需创建（见 18.1.5）
│   ├── images/                     # ← 从 R2 拉取，不入 git
│   ├── css/
│   ├── js/
│   ├── fonts/
│   ├── sitemap.xml                 # ← 需创建
│   ├── robots.txt                  # ← 需创建
│   ├── _headers                    # ← 需创建
│   └── _redirects                  # ← 需创建
│
├── worker/
│   ├── src/index.js                # Worker 主文件（含 CSRF 校验 + Cookie 同意逻辑）
│   ├── wrangler.toml               # ← 需创建（含 CORS 双域配置）
│   └── package.json                # ← 需创建
│
├── .gitignore                      # ← 需创建/更新（加 images/ LFS 规则）
├── .cards-cache.json               # 构建缓存（不入 git）
├── CODE_AUDIT_REPORT.md            # 代码审计报告（参考）
├── DOC_VS_CODE_GAP_ANALYSIS.md     # 文档差距分析（参考）
└── SENDING_DEV_SPEC.md             # ← 本文档（权威规格）
```

### .gitignore 必须包含

```
source/images/raw/
source/images/**/*.webp
originals/
.cards-cache.json
node_modules/
.wrangler/
```

> **注意**：`source/images/` 三尺寸 WebP **不入 git 本体**，改用 `git lfs track "source/images/**/*.webp"`。

---

## 16. 项目账号

| 平台 | 用途 | 状态 |
|------|------|------|
| Cloudflare | Pages + R2 + Worker + KV | R2 已配置 ✅ |
| Creem | 支付（提现到支付宝） | 待注册，需创建 3 个 Price ID |
| Resend | 邮件送达 | 待注册 |
| GitHub | 代码托管 | yusheng-zhang-star |
| Pexels | 图片素材 | 200次/h |
| Google Analytics | 流量分析 | Phase 2 |
| Twilio | 短信送达 | Phase 2 |

### R2 凭证（2026-06-29 配置完成 ✅）

| 项目 | 值 |
|------|-----|
| Account ID | `dbacad9daf4c611ca4143f74fc33c2d3` |
| S3 API 端点 | `https://dbacad9daf4c611ca4143f74fc33c2d3.r2.cloudflarestorage.com` |
| sendafun-preview Public URL | `https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev` |
| Access Key ID | `f69e5241221d849255f0e4c885035933` |
| Secret Access Key | `ed04d97fbb52d04780f19704e897fc7ca162a41b54afa7e35a2142a7ac184fc2` |
| sendafun-preview | Public（水印图 600px WebP） |
| sendafun-originals | Private（高清原图 1920px PNG） |
| Token 权限 | Object Read & Write，限定2个桶，TTL: Forever |

### 必须在上线前完成

- [x] Cloudflare R2 双桶创建（sendafun-preview + sendafun-originals）
- [ ] Cloudflare KV 命名空间创建
- [ ] Creem 注册 + 创建 3 个 Price ID（$1.99 / $19.99 / $0.99）
- [ ] Resend 注册 + 获取 API Key
- [ ] SPF/DKIM/DMARC DNS 记录配置
- [ ] wrangler.toml 配置完成（含 CORS 双域）
- [ ] Worker secrets 设置（CREEM_API_KEY, CREEM_WEBHOOK_SECRET, RESEND_API_KEY, WORKER_SECRET）
- [ ] Cookie 同意横幅实现（GDPR 合规）
- [ ] 退款政策页面创建
- [ ] CSRF 保护实现（所有 POST 接口）
- [ ] Canvas 无障碍属性添加
- [ ] Git LFS 配置（或 images/ 改用 R2 拉取）

---

## 17. 素材管理规格

> **独立 Skill：`sendafun-asset-manager`**（路径 `~/.workbuddy/skills/sendafun-asset-manager/`）
>
> 触发词："sendafun 素材"、"替换贺卡图"、"新增贺卡"、"素材分析"、"跳出率分析"、"素材管理"

### 17.1 素材目录结构

```
素材源目录（原图，不入 git）：
E:\网站项目\素材\source\{分类}          ← JPG/PNG 原图
E:\网站项目\sendafun\source\images\raw\   ← 临时原图，不入 git

素材输出目录（WebP，Git LFS 管理）：
E:\网站项目\sendafun\source\images\{category}\
  ├── {category}-pexels-{id}-00-horizontal.webp   ← 原图裁剪 1920×1080
  ├── {category}-pexels-{id}-00-square.webp       ← 原图裁剪 1080×1080
  ├── {category}-pexels-{id}-00-vertical.webp     ← 原图裁剪 1080×1920
  ├── {category}-pexels-{id}-horizontal.webp      ← HSL偏移版 1920×1080
  ├── {category}-pexels-{id}-square.webp          ← HSL偏移版 1080×1080
  └── {category}-pexels-{id}-vertical.webp        ← HSL偏移版 1080×1920

水印预览图（入 git）：
E:\网站项目\sendafun\source\images\watermark\
  └── {filename}.webp                            ← 600px 宽 + 品牌水印 15%

高清原图（不入 git，只传 R2）：
E:\网站项目\sendafun\originals\
  └── {slug}-original.png                        ← 1920px 宽 + 淡色 sendafun.com

归档目录（替换下来的旧图，入 git 以防回滚）：
E:\网站项目\sendafun\source\images\_archive\{date}\
```

### 17.2 命名规范

| 元素 | 规则 | 示例 |
|------|------|------|
| 分类目录 | 全小写，连字符分隔 | `fathers-day` |
| 图片文件名 | `{category}-pexels-{id}-{variant}-{orientation}.webp` | `birthday-pexels-1008396-00-vertical.webp` |
| variant | `00` = 原图裁剪，无后缀 = HSL 偏移版 | `00` / `` (空) |
| orientation | `horizontal` / `square` / `vertical` | `vertical` |
| 卡片 slug | 全小写，连字符分隔，语义化 | `beautiful-birthday-mom` |
| ogImage | `https://sendafun.com/og/{filename}.jpg` | `https://sendafun.com/og/birthday-mom-01.jpg` |

### 17.3 三尺寸标准

| 尺寸 | 宽×高 | 用途 | 格式 |
|------|-------|------|------|
| horizontal | 1920×1080 | OG 图 / 横版卡片 | WebP |
| square | 1080×1080 | 社交分享 | WebP |
| vertical | 1080×1920 | 竖版卡片（手机全屏） | WebP |
| preview | 600px 宽 | R2 preview 桶，带水印 | WebP |
| original | 1920px 宽 | R2 originals 桶，无水印 | PNG |

### 17.4 当前分类（17 个）

| 分类目录 | 卡片数 | 素材数 |
|---------|--------|--------|
| anniversary | 1 | 829 |
| birthday | 2 | 1575 |
| christmas | 0 | 591 |
| congratulations | 2 | 504 |
| easter | 0 | 450 |
| encouragement | 1 | 261 |
| fathers-day | 0 | 450 |
| friendship | 0 | 450 |
| get-well | 0 | 450 |
| good-luck | 0 | 450 |
| graduation | 0 | 450 |
| halloween | 0 | 450 |
| love | 1 | 390 |
| missing-you | 0 | 450 |
| mothers-day | 0 | 549 |
| new-baby | 1 | 444 |
| new-year | 0 | 228 |
| **合计** | **12** | **8971** |

> 有 8959 张孤儿素材（未被任何卡片引用），可作为替换备选库。

### 17.5 R2 上传规则

#### preview 桶（sendafun-preview）

| 属性 | 值 |
|------|-----|
| 尺寸 | 600px 宽 |
| 格式 | WebP |
| 水印 | 右下角 15% 透明度品牌 logo |
| 命名 | `{slug}-preview.webp` |
| 访问 | 公开读 |
| CDN 缓存 | 30 天 |

```bash
npx wrangler r2 object put sendafun-preview/{slug}-preview.webp \
  --file "source/images/watermark/{filename}.webp" \
  --content-type "image/webp"
```

#### originals 桶（sendafun-originals）

| 属性 | 值 |
|------|-----|
| 尺寸 | 1920px 宽 |
| 格式 | PNG |
| 水印 | 右下角 15% 透明度 "sendafun.com" 文字 |
| 命名 | `{slug}-original.png` |
| 访问 | 私有，Worker 签名 URL 5 分钟过期 |
| CDN 缓存 | 不缓存 |

```bash
npx wrangler r2 object put sendafun-originals/{slug}-original.png \
  --file "originals/{filename}.png" \
  --content-type "image/png"
```

### 17.6 SEO 保护规则（铁律）

1. **URL 不变**：`/card/{slug}` 一旦上线，slug 永不修改
2. **不删页面**：即使替换图片，HTML 文件路径不变
3. **301 重定向**：如必须改 slug（极端情况），在 `_redirects` 中加 301 到新 slug
4. **图片路径稳定**：bgImage 路径尽量不变，替换文件内容而非路径引用
5. **sitemap 同步**：新增/下线卡片后必须更新 sitemap.xml
6. **canonical 标签**：每个卡片页必须有 `<link rel="canonical" href="https://sendafun.com/card/{slug}">`
7. **旧图归档**：替换后的旧图移到 `source/images/_archive/{date}/`，不从 git 删除

### 17.7 素材审计流程

**频率：每周一次**

1. 读取 `source/cards-config.json`，提取所有 slug + bgImage + bgImageWatermark
2. 遍历 `source/images/{category}/`，统计每个分类的图片数量
3. 交叉比对：
   - cards-config 引用了但文件不存在的图片 → ❌ 缺失
   - 存在但未被任何卡片引用的图片 → ⚠️ 孤儿素材（备选库）
   - cards-config 中的 category 在 source/images 中不存在 → ❌ 分类缺失
4. 检查 R2 桶：preview 桶是否有对应 `-preview.webp`，originals 桶是否有 `-original.png`
5. 输出审计报告

### 17.8 性能分析流程

**频率：每月一次**

**前提：** CF Analytics（Page Views）+ Google Analytics（Bounce Rate，Phase 2）

1. 调用 CF GraphQL API 获取 `/card/{slug}` 各页面的 Page Views
2. 筛选规则：

| 类别 | 条件 | 操作 |
|------|------|------|
| 替换候选 | Bounce Rate > 80% 且 PV > 10 | 从孤儿素材库推荐同分类替换 |
| 下线候选 | PV = 0 持续 30 天 | 考虑从导航移除（但保留 URL） |
| 优秀素材 | Bounce Rate < 40% | 保留不动 |

3. 对替换候选，从孤儿素材库中推荐同分类的替换图片
4. 输出替换建议清单（人工审核后执行）

### 17.9 替换图片流程

**铁律：不改变 slug，不改变 URL，只替换图片文件内容。**

```
1. 读取 cards-config.json 确认目标卡片的 bgImage 路径
2. 备份旧图 → source/images/_archive/{date}/
3. 准备新原图 → E:\网站项目\素材\source\{category}\
4. 运行 process-images.py → 生成三尺寸 WebP
5. 用新图覆盖旧图文件名（或更新 cards-config.json 指向新文件，但 slug 不变）
6. 生成水印图 → source/images/watermark/
7. 构建：node build-script/generate-cards.js --force
8. 上传 R2：覆盖 preview 桶 + originals 桶中的旧图
9. 清 CF 缓存（精准）：card/{slug} + bgImage URL + category/{category}
10. 部署：git push
11. 记录到 asset-changelog.md
```

### 17.10 新增卡片流程

```
1. 准备原图 → E:\网站项目\素材\source\{category}\
2. 图片处理：python build-script/process-images.py
3. 生成水印图（Python PIL，600px + 15% logo）
4. 在 cards-config.json 添加卡片配置
5. 构建：node build-script/generate-cards.js（增量）
6. 上传 R2（preview + originals）
7. 部署：git push → CF Pages 自动部署
8. 清 CF 缓存（首页 + 新卡片页 + 新分类页）
9. 更新 sitemap.xml（构建脚本自动生成）
```

### 17.11 新增分类流程

```
1. 创建素材目录：E:\网站项目\素材\source\{category_underscore}\
2. 创建输出目录：source/images/{category_hyphen}/
3. 在 process-images.py 的 CAT_MAP 中添加映射
4. 在 generate-cards.js 的 CATEGORY_LABELS 中添加显示名
5. 放入原图，运行 process-images.py
6. 创建卡片配置（cards-config.json）
7. 全量构建：node build-script/generate-cards.js --force
8. 部署 + 清缓存（全站）
```

### 17.12 图片处理脚本

**使用 `process-images.py`（Python + PIL），不使用 `process-images.js`（已废弃）。**

```bash
# 全量处理（跳过已存在）
python build-script/process-images.py

# 强制重新处理
python build-script/process-images.py --force
```

**处理流程：**
1. 读取 `E:\网站项目\素材\source\{category}\` 下的 JPG/PNG 原图
2. HSL 偏移：色相 ±15、饱和度 ±15%、亮度 ±8%、对比度 ±10%
3. 裁剪三尺寸：horizontal(1920×1080) / square(1080×1080) / vertical(1080×1920)
4. 转 WebP 输出到 `source/images/{category}/`
5. 每张原图生成 6 个文件（2 变体 × 3 尺寸）

### 17.13 缓存清理

#### 精准清理（替换图片时）

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      "https://sendafun.com/card/{slug}",
      "https://sendafun.com/{bgImage_path}",
      "https://sendafun.com/category/{category}"
    ]
  }'
```

#### 全站清理（新增分类时）

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything": true}'
```

### 17.14 替换日志

所有素材替换操作记录到 `E:\网站项目\sendafun\asset-changelog.md`：

```markdown
## 2026-06-28 替换记录

| 卡片 slug | 旧图 | 新图 | 原因 | 操作人 |
|-----------|------|------|------|--------|
| beautiful-birthday-mom | birthday-mom-01 | birthday-pexels-1008396 | 跳出率 85% | 小骞 |
```

### 17.15 定期维护计划

| 频率 | 任务 | 模式 |
|------|------|------|
| 每周 | 素材审计（缺失/孤儿检查） | asset-audit |
| 每月 | 性能分析（跳出率/PV 排名） | performance-analysis |
| 每月 | 执行替换（人工审核后） | replace-image |
| 按需 | 新增卡片 | add-card |
| 按需 | 新增分类 | add-category |
| 按需 | 批量上传素材 | batch-upload |

---

## 18. 欧美挑刺清单（合规 + 安全 + 无障碍）

> **以下问题由虚拟挑刺角色发现（2026-06-28 审查）**：
> - 🇺🇸 **Alex**（产品经理）→ UX 信任/支付流/退款政策
> - 🇮🇳 **Priya**（安全工程师）→ OWASP Top 10/逻辑漏洞/CSRF
> - 🇩🇪 **Lars**（支付合规）→ PCI-DSS/GDPR/欧盟消费者保护
> - 🇺🇸 **Sarah**（残障用户）→ ADA 无障碍/Canvas 可访问性

---

### 18.1 🔴 P0 — 不修不能上线（欧盟/美国法律）

#### 18.1.1 Cookie 同意横幅（GDPR Art.5 + ePrivacy Directive）

**挑刺人**：🇩🇪 Lars（GDPR 合规）

**问题**：Section 8.1 `user_token` Cookie 设置 `SameSite=Strict; HttpOnly`，但**无用户同意横幅**。
欧盟用户访问即用 Cookie，违反 GDPR Art.5(3) ePrivacy Directive，最高罚款 4% 年营收或 €20M。

**修复方案**：
```
1. 首页加载时检测 GeoIP（CF 免费提供 cf-ipcountry header）
2. 欧盟 IP → 显示 Cookie 横幅：
   [必要 Cookies] [分析 Cookies] [营销 Cookies] [接受所选] [拒绝非必要]
3. user_token 属于"必要"，可在同意前设置
4. 分析/营销 Cookie 需用户主动勾选
5. 用户选择存入 KV：cookie:consent:{email} → {necessary:true, analytics:bool, marketing:bool}
6. 美国/非欧盟 IP → 可省略横幅（CCPA 仅需"不卖我数据"链接）
```

**参考**：https://gdpr.eu/cookies/

#### 18.1.2 Token 在 URL 中泄露（OWASP A09:2021）

**挑刺人**：🇮🇳 Priya（安全工程师）

**问题**：原文档 Section 4.4 和 8.6 写「URL 中带 user_token 参数」。
`user_token` 出现在 URL → 浏览器历史记录、服务器 access log、Referer header 全泄露。

**修复方案**：
- **删除** Section 4.4 第 3 条「URL 中附加用户 token 参数，下载时 Worker 二次校验」
- **删除** Section 8.6 第 3 条「URL 中带 user_token 参数，下载时二次校验」
- 下载全程用 HttpOnly Cookie 鉴权，URL 不带任何 token
- `/api/download` 从 Cookie 读 `user_token`，不接收 URL 参数

#### 18.1.3 user_token 可预测（OWASP A02:2021）

**挑刺人**：🇮🇳 Priya（安全工程师）

**问题**：原文档 Section 8.1 第 1 条 `user_token = HMAC-SHA256(email, WORKER_SECRET)`。
同邮箱永远生成相同 token → 一旦泄露，攻击者可以永久冒充该用户。

**修复方案**：
```javascript
// ❌ 错误（原文档）
user_token = HMAC-SHA256(email, WORKER_SECRET)

// ✅ 正确
user_token = crypto.randomUUID()  // 或 crypto.getRandomValues(32)
// KV 存：usertoken:{user_token} → email
// TTL = 365 天，用户主动退出时删除
```

**修改位置**：Section 8.1 第 1 条、Section 6.1 `usertoken:{token}` 行、Section 5.2 Webhook 逻辑第 5 条

#### 18.1.4 Canvas 无障碍（ADA Title III / WCAG 2.1 AA）

**挑刺人**：🇺🇸 Sarah（残障用户，屏幕阅读器用户）

**问题**：Section 10.1 Canvas 编辑器对屏幕阅读器**完全不可见**。
美国 ADA（Americans with Disabilities Act）要求网站对视障用户可访问，违者罚款 $75,000 起。

**修复方案**：
```html
<!-- 在 Canvas 容器旁添加隐藏的 aria-live 区域 -->
<div aria-live="polite" aria-atomic="true" class="sr-only" id="canvas-announcer">
  <!-- JS 更新此处文本，屏幕阅读器自动播报 -->
</div>

<!-- 所有按钮必须有 aria-label -->
<button aria-label="Undo last change" id="btn-undo">↩️</button>
<button aria-label="Change text color" id="btn-color">🎨</button>

<!-- Canvas 本身添加 role 和 aria-label -->
<canvas role="img" aria-label="Card preview" id="card-canvas"></canvas>
```

**修改位置**：Section 10.1 新增「无障碍」列；Section 10.7 补充；templates/segments/canvas.html 添加 aria 属性

#### 18.1.5 退款政策缺失（FTC 16 CFR Part 435 / 欧盟消费者权利指令）

**挑刺人**：🇺🇸 Alex（产品经理）

**问题**：支付流程无退款政策。`$1.99` 单次购买在美国受 FTC "Mail or Telephone Order Merchandise Rule" 监管，需在支付前展示退款条款。

**修复方案**：
1. 创建 `/refund-policy` 页面（英文，清晰条款）
2. 支付过渡页（Section 7.1）底部加：
   `"By proceeding, you agree to our [Refund Policy](#refund-policy)"`
3. Creem checkout 页面也需展示退款政策链接（在 Creem 后台配置）
4. 退款窗口：数字商品（已下载）不适用强制退款，但需在政策中声明

---

### 18.2 🟡 P1 — 上线前应修复

#### 18.2.1 COPPA 年龄门控（美国儿童在线隐私保护法）

**挑刺人**：🇩🇪 Lars（支付合规）

**问题**：无年龄验证。如 13 岁以下儿童使用，违反 COPPA，罚款 $46,517/次。

**修复方案**：首页加年龄门控（轻量级，不打扰成人）：
```html
<!-- 首次访问弹出，选"Under 13"则跳转家长同意页 -->
<div id="age-gate" class="modal">
  <p>Are you 13 or older?</p>
  <button id="btn-yes">Yes, I'm 13+</button>
  <button id="btn-no">No, I need parent permission</button>
</div>
```

#### 18.2.2 CSRF 保护（OWASP A05:2021）

**挑刺人**：🇮🇳 Priya（安全工程师）

**问题**：所有 POST 接口无 CSRF token。虽然 Cookie 设了 `SameSite=Strict`，但 Worker 侧无校验，攻击者可构造恶意页面触发请求。

**修复方案**：Worker 所有 POST 接口校验 `X-CSRF-Token` header（值与 `user_token` Cookie 相同）：

```javascript
// Worker 侧（所有 POST 接口）
if (request.method === 'POST') {
  const csrf = request.headers.get('X-CSRF-Token');
  const cookie = request.headers.get('Cookie') || '';
  const userToken = extractToken(cookie);  // 从 Cookie 提取 user_token
  if (!csrf || csrf !== userToken) {
    return new Response('CSRF mismatch', { status: 403 });
  }
}
```

前端所有 `fetch()` POST 请求加 header：
```javascript
fetch('/api/send-card', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCookie('user_token')
  },
  body: JSON.stringify(payload)
})
```

#### 18.2.3 数据删除权（GDPR Art.17 / CCPA §1798.105）

**挑刺人**：🇩🇪 Lars（GDPR 合规）

**问题**：无「删除我的数据」接口。GDPR 用户有权「被遗忘」，CCPA 用户有权删除个人信息。

**修复方案**：新增 `DELETE /api/delete-me`，接收 Cookie `user_token`，删除 KV 中所有该用户的 key（`perm:`, `freecard:`, `rem:`, `usertoken:`），返回「数据已删除」confirmation。

#### 18.2.4 颜色对比度（WCAG 2.1 AA 1.4.3）

**挑刺人**：🇺🇸 Sarah（残障用户）

**问题**：Section 10.1 提到 8 色调色盘，但未检查对比度。WCAG 2.1 AA 要求普通文本对比度 ≥ 4.5:1。

**修复方案**：用 https://webaim.org/resources/contrastchecker/ 检查 8 色 + 白底对比度，不合规的替换。

#### 18.2.5 Git 仓库体积（技术债）

**挑刺人**：🇮🇳 Priya（安全工程师）

**问题**：8971 张 WebP 入 git → 仓库体积迅速膨胀（预估 500MB+），`git clone` 慢，CF Pages 构建超时风险。

**修复方案**（二选一）：
- **方案 A**：改用 Git LFS 管理 `source/images/`
  ```bash
  git lfs install
  git lfs track "source/images/**/*.webp"
  git add .gitattributes
  ```
- **方案 B**（推荐）：`source/images/` 不入 git，构建时从 R2 下载

**修改位置**：Section 11.4 `.gitignore` 更新；`.gitattributes` 新增 LFS 规则

---

### 18.3 🟢 P2 — Phase 2 处理

#### 18.3.1 物理贺卡配送（美国市场预期）

**挑刺人**：🇺🇸 Alex（产品经理）

**问题**：美国用户期望电子贺卡 + 物理印刷配送选项（如 Moonpig、Blue Mountain）。

**建议**：Phase 2 接入打印服务商 API（如 Prodigi、Printful）。

#### 18.3.2 Scheduled Delivery（美国用户习惯）

**挑刺人**：🇺🇸 Alex（产品经理）

**问题**：卡片只能即时送达，无「定时发送」功能。

**建议**：Section 5.5 `POST /api/send-card` 新增 `scheduledAt: "2026-12-25T09:00:00Z"` 字段，Worker Cron 到时触发发送。

#### 18.3.3 多语言（西班牙语市场）

**挑刺人**：🇺🇸 Alex（产品经理）

**问题**：美国拉丁裔 6000 万+，只提供英文界面。

**建议**：Phase 2 新增 `/es/` 路径，复用 SmartImgKit 多语种模式。

---

### 18.4 挑刺汇总表

| # | 挑刺人 | 严重度 | 问题 | 修改位置 |
|---|---------|--------|------|---------|
| 1 | Lars (🇩🇪) | 🔴 P0 | Cookie 同意横幅缺失（GDPR） | 新增 18.1.1；worker 新增 GeoIP 检测 |
| 2 | Priya (🇮🇳) | 🔴 P0 | Token 在 URL 中泄露 | Section 4.4, 8.6 删除 URL 参数说明 |
| 3 | Priya (🇮🇳) | 🔴 P0 | user_token 可预测 | Section 8.1, 6.1, 5.2 |
| 4 | Sarah (🇺🇸) | 🔴 P0 | Canvas 对屏幕阅读器不可见（ADA） | Section 10.1, 10.7, templates |
| 5 | Alex (🇺🇸) | 🔴 P0 | 退款政策缺失（FTC） | 新增 18.1.5；创建 /refund-policy |
| 6 | Lars (🇩🇪) | 🟡 P1 | COPPA 年龄门控缺失 | 首页新增 age-gate |
| 7 | Priya (🇮🇳) | 🟡 P1 | CSRF 保护缺失 | Worker 所有 POST 接口 |
| 8 | Lars (🇩🇪) | 🟡 P1 | 数据删除权缺失（GDPR Art.17） | 新增 /api/delete-me |
| 9 | Sarah (🇺🇸) | 🟡 P1 | 颜色对比度未检查（WCAG） | Section 10.1 |
| 10 | Priya (🇮🇳) | 🟡 P1 | 8971 张图入 git（技术债） | Section 11.4 |
| 11 | Alex (🇺🇸) | 🟢 P2 | 物理贺卡配送缺失 | Phase 2 |
| 12 | Alex (🇺🇸) | 🟢 P2 | 定时送达缺失 | Phase 2 |
| 13 | Alex (🇺🇸) | 🟢 P2 | 西班牙语界面缺失 | Phase 2 |

---

## 19. 欧美付费用户产品挑刺清单（UX + 功能缺口）

> **审查时间**：2026-06-28
> **审查视角**：美国/欧盟付费主力用户（非律师/安全工程师视角）
> **审查方法**：按用户旅程（发现 → 做卡 → 付费 → 送达 → 复购）逐段挑刺
> **严重度定义**：
> - 🔴 P0：不实现会导致用户付款后失望/退款，直接影响转化
> - 🟡 P1：实现后才能留住用户，影响复购率
> - 🟢 P2：差异化功能，影响长期竞争力

---

### 19.1 用户旅程全景挑刺

#### 阶段 1：发现 & 首 impression

| # | 挑刺点 | 用户原话风格 | 严重度 | 修复方案 |
|---|--------|-------------|--------|---------|
| 1 | **Hero 图是假截图**，不是真实卡片预览 | "This looks fake, is this a real product?" | 🟡 P1 | Hero 区放真实卡片轮播（含文字/滤镜效果），不是设计师精选假图 |
| 2 | **没有社会证明**（ reviews/testimonials） | "Who else uses this? Is it legit?" | 🟡 P1 | 首页加三线：① 已送卡片数计数器 ② 用户评价（哪怕 3 条 fake 标注 Example）③ 媒体 Logo（如果有） |
| 3 | **价值主张不清晰** — $1.99 买的是什么？ | "Why not just send a free e-card from 123greetings?" | 🔴 P0 | Hero 区必须一句话说清差异：*"Real photo cards, not clip art. Delivered to their email inbox in 2 minutes."* |
| 4 | **移动端加载速度未承诺** | "Takes forever to load on my phone" | 🟡 P1 | Lighthouse Mobile Score 目标 ≥ 85，在首页标注 "Optimized for mobile" |

#### 阶段 2：选卡 & 编辑

| # | 挑刺点 | 用户原话风格 | 严重度 | 修复方案 |
|---|--------|-------------|--------|---------|
| 5 | **不能上传自己的照片** | "I want to use a photo of me and mom, not your stock image" | 🔴 P0 | 编辑页加「Upload your photo」按钮，替换背景图（前端 JS 实现，不新增 API） |
| 6 | **字体只有 6 种，且都是安全字体** | "These fonts look cheap, where's handwriting?" | 🟡 P1 | 加 2-3 种手写风格 Google Fonts（如 `Dancing Script`, `Caveat`, `Homemade Apple`） |
| 7 | **不能调整文字大小/位置（细粒度）** | "I want the text bigger and moved to the top" | 🟡 P1 | 当前只有大/中/小 + 顶/中/底，够了；但需确认移动端拖动是否可用（触屏） |
| 8 | **没有「预览收件人视角」** | "How does this actually look to my mom?" | 🔴 P0 | 编辑页加「Preview as recipient」按钮，弹出手机帧模拟收件人邮件/网页视图 |
| 9 | **滤镜效果看不见差别** | "I clicked 'warm' and nothing happened" | 🟡 P1 | 滤镜选择后 Canvas 实时渲染，加「before/after」快速对比按钮 |
| 10 | **移动端 Canvas 编辑体验未定义** | "I can't type on this thing on my phone" | 🔴 P0 | 触屏友好：点击 Canvas 弹出独立文字编辑浮层（非原位编辑），避免虚拟键盘遮挡 |

#### 阶段 3：付费

| # | 挑刺点 | 用户原话风格 | 严重度 | 修复方案 |
|---|--------|-------------|--------|---------|
| 11 | **支付方式不明** — Creem 支持 Apple Pay/Google Pay 吗？ | "I don't want to type my credit card number" | 🔴 P0 | 文档确认 Creem Hosted Checkout 是否支持 Apple Pay/Google Pay；如不支持，这是转化率杀手 |
| 12 | **没有 PayPal** | "I only pay with PayPal" | 🟡 P1 | Creem 是否支持 PayPal？不支持则需要评估切换支付网关 |
| 13 | **支付前没看到「退款保证」** | "What if I pay and it doesn't work?" | 🟡 P1 | 支付过渡页（Section 7.1）加「30-day money-back guarantee」badge（如适用） |
| 14 | **年费 $19.99 价值不明确** | "Why would I pay $20 when I only send 2 cards a year?" | 🟡 P1 | 支付页加「Most users send 15+ cards/year — break even at 10」提示 + 省多少钱计算器 |

#### 阶段 4：送达 & 分享

| # | 挑刺点 | 用户原话风格 | 严重度 | 修复方案 |
|---|--------|-------------|--------|---------|
| 15 | **不能定时发送**（最痛） | "I want this to arrive on mom's birthday, not today" | 🔴 P0 | Section 5.5 新增 `scheduledAt` 字段；Worker Cron 到时触发；用户可在支付前选「Send now」或「Schedule for...」 |
| 16 | **不能一次发给多个人** | "I want to send the same card to my whole family for Christmas" | 🔴 P0 | 收件人输入框支持逗号分隔多个邮箱，或「+ Add another recipient」按钮；按人数收费（$1.99 × N）或年费免费 |
| 17 | **发完后没有「再发一张」快捷入口** | "I just sent to mom, now I want to send a similar one to dad" | 🟡 P1 | 送卡成功页加「Send a similar card」按钮，预填相同文案/滤镜，只换收件人 |
| 18 | **收件人视图（/view/:token）移动端未优化** | "My mom said the card looks weird on her iPhone" | 🔴 P0 | /view/:token 页面必须独立测试 iOS Safari + Android Chrome；字体大小/行高/按钮尺寸分别验证 |
| 19 | **邮件标题可被邮箱服务商拦截** | "Mom said it went to spam" | 🟡 P1 | 邮件标题避免 spam 触发词（"FREE", "CLICK HERE"）；发件人域名用 `cards@sendafun.com` 而非 `noreply`；DKIM/SPF/DMARC 必须配置（Section 14.2 #12） |
| 20 | **没有「已读回执」** | "Did mom even open my card?" | 🟢 P2 | Phase 2：在 /view/:token 页面加透明 1px 跟踪像素或 beacon，记录打开事件到 KV |

#### 阶段 5：复购 & 留存

| # | 挑刺点 | 用户原话风格 | 严重度 | 修复方案 |
|---|--------|-------------|--------|---------|
| 21 | **没有账户仪表盘** | "Where can I see all the cards I've sent?" | 🟡 P1 | 登录后（输入邮箱即可，无密码）展示：① 已送卡片历史 ② 年费到期时间 ③ 免费卡剩余额度 |
| 22 | **没有提醒/通知** | "I forgot mom's birthday again" | 🔴 P0 | 用户送卡后提示「Add a reminder for next year?」，存入 KV Cron；或导入 Google Calendar 功能 |
| 23 | **没有推荐奖励** | "I told my friend about this, do I get anything?" | 🟢 P2 | Phase 2：推荐朋友注册，双方各得 1 张免费卡 |
| 24 | **年费用户没有专属权益感知** | "I paid $20, but it feels the same as before" | 🟡 P1 | 年费用户在编辑页看到「✨ Premium: No watermark + Priority delivery」标识 |

---

### 19.2 欧美竞品对标（功能差距）

| 功能 | Moonpig（英国头部） | Blue Mountain | SendAFun 当前 | 差距 |
|------|-------------------|---------------|-------------|------|
| 定时发送 | ✅ | ✅ | ❌ | 🔴 大 |
| 多收件人 | ✅ | ✅ | ❌ | 🔴 大 |
| 上传照片 | ✅ | ✅ | ❌ | 🔴 大 |
| 物理印刷配送 | ✅ | ✅ | ❌ | 🟡 中（Phase 2） |
| 移动 App | ✅ iOS/Android | ✅ iOS/Android | ❌（仅 Web） | 🟡 中 |
| Apple Pay | ✅ | ✅ | ❓（取决于 Creem） | 🔴 大 |
| 已读回执 | ❌ | ✅ | ❌ | 🟢 小 |
| 账户仪表盘 | ✅ | ✅ | ❌ | 🟡 中 |

---

### 19.3 优先级排序（从付费用户视角）

#### 🔴 P0 — 上线前必须有（否则用户付钱后失望）

1. **定时发送**（`scheduledAt` 字段 + Cron Trigger）—— 用户旅程核心需求
2. **上传自己的照片**（前端 JS，不新增 API）——“Personal touch” 是 $1.99 的核心价值
3. **多收件人发送**（字段扩展 + 批量计费）——“I want to send to my whole family”
4. **支付过渡页优化**（价值主张 + 信任信号 + 退款政策链接）—— 转化率直接相关
5. **确认 Creem 支持 Apple Pay / Google Pay** —— 如果不支持，欧美转化率腰斩
6. **/view/:token 移动端独立测试** —— 收件人体验是产品门面

#### 🟡 P1 — 上线后 30 天内实现（影响复购）

7. **账户仪表盘**（「我的卡片」历史 + 年费状态）
8. **提醒功能完善**（送卡后提示「提醒我明年今天」）
9. **字体扩展**（加手写字体）
10. **成功页「再发一张」快捷入口**
11. **邮件标题/发件人优化**（防垃圾箱）

#### 🟢 P2 — Phase 2

12. **已读回执**（跟踪像素）
13. **推荐奖励**（Referral program）
14. **物理印刷配送**（接入 Printful/Prodigi API）
15. **iOS/Android App**（Phase 3）

---

### 19.4 移动端体验专项挑刺

美国 70% 用户来自手机（Section 1 用户画像），但文档对移动端体验的描述只有「Mobile First」四个字。

| 场景 | 当前状态 | 问题 | 修复 |
|------|---------|------|------|
| 首页加载 | ❓ 未测试 | 图片过多导致加载慢 | 首页懒加载 + 分页，首批只加载 6 张卡片 |
| 选卡页 | ❓ 未测试 | 分类页滚动不流畅 | CSS `overflow-scroll: touch` + `-webkit-overflow-scrolling: touch` |
| 编辑页 — 输入文字 | ❓ 未测试 | 虚拟键盘遮挡 Canvas | `visualViewport API` 监听键盘展开，自动滚动到输入框 |
| 编辑页 — 拖动文字位置 | ❓ 未测试 | 触屏 drag 事件是否生效 | 需要 `touchstart/touchmove/touchend` 实现，不能只靠 mouse 事件 |
| 编辑页 — 选择滤镜/字体 | ❓ 未测试 | 下拉菜单在手机上难用 | 改为横向滑动选择器（iOS 风格） |
| 支付页 | ❓ 未测试 | Creem Hosted Checkout 移动端体验 | 必须用手机测试整个支付流程，截图记录 |
| 送卡成功页 | ❓ 未测试 | 按钮是否够大（44px 最小） | 所有 CTA 按钮 ≥ 44px，间距 ≥ 8px |

---

### 19.5 定价心理挑刺（欧美用户价格敏感度）

| 挑刺点 | 分析 | 建议 |
|--------|------|------|
| **$1.99 太高** | 竞品 Moonpig 实体卡 $3-5 + 运费，但用户潜意识对比的是「免费 e-card」 | 首页加对比：`Physical card $5 + shipping vs. SendAFun $1.99, instant` |
| **年费 $19.99 门槛高** | 用户不知道自己一年会发几张卡，「unlimited」感知弱 | 加「Average user saves $47/year vs. buying cards at CVS」 |
| **没有「买 5 张送 1 张」** | 美国用户习惯 bulk discount | Phase 2 加包购选项：$8.99 for 5 cards（$1.80/张） |
| **免费卡只有 1 张** | 太少，用户无法体验完整流程 | 改为：注册邮箱验证后得 2 张免费卡（需权衡成本） |

---

### 19.6 修改记录

本节写入 `SENDING_DEV_SPEC.md` Section 19（新增），同时更新：
- Section 5.5 `POST /api/send-card` 新增 `scheduledAt` 字段
- Section 5.5 新增「多收件人」字段规范（`toEmails: []` 或循环调用）
- Section 14 功能缺失清单 — 将本节 P0 项同步纳入
- 目录 — 新增 Section 19 条目

---

## 20. AdSense 内容要求 & 页面文字量规范

> **目标**：满足 Google AdSense 审批要求，每个页面至少有 300-500 字独特内容
> **问题**：当前所有页面（首页/分类页/卡片页）文字量严重不足，会被 AdSense 拒绝
> **方案**：在不破坏设计的前提下，各页面增加有价值的内容区块

---

### 20.1 AdSense 审批核心要求

| 要求 | 说明 | 当前状态 |
|------|------|---------|
| **独特内容** | 每页至少 300-500 字原创文字 | ❌ 严重不足 |
| **导航清晰** | 有清晰的菜单和内部链接 | ❌ 缺失 |
| **关于页/联系页** | 必须有 `About` 和 `Contact` 页面 | ❌ 缺失 |
| **隐私政策** | 必须有（Section 18 已要求） | 🟡 待创建 |
| **无空白页** | 不能有「正在建设中」页面 | ✅ 无 |
| **英文内容** | 全站英文，语法正确 | ✅ |
| **加载速度** | Lighthouse ≥ 85（移动端） | ❓ 未测试 |

---

### 20.2 各页面内容增量方案

#### 20.2.1 首页（index.html）— 目标 500+ 字

当前：Hero 区 + 卡片轮播 = ~50 字

**新增内容区块**：

```html
<!-- 1. How it works — 3 步，每步 50 字 -->
<section id="how-it-works">
  <h2>How it works</h2>
  <div class="steps">
    <div class="step">
      <h3>1. Choose a card</h3>
      <p>Browse our collection of beautifully designed photo cards for every occasion. 
         From birthdays to anniversaries, we have the perfect card for you.</p>
    </div>
    <div class="step">
      <h3>2. Personalize it</h3>
      <p>Add your own message, choose from 20+ fonts, apply filters, and make it truly yours. 
         You can even upload your own photos to make it extra special.</p>
    </div>
    <div class="step">
      <h3>3. Send instantly</h3>
      <p>Enter the recipient's email and we'll deliver your card instantly. 
         They'll receive a beautiful digital card they can view on any device.</p>
    </div>
  </div>
</section>

<!-- 2. Why SendAFun — 对比表格，~100 字 -->
<section id="why-us">
  <h2>Why SendAFun?</h2>
  <div class="comparison">
    <div class="option">
      <h3>Traditional Cards</h3>
      <ul>
        <li>$5+ per card + shipping</li>
        <li>3-7 days delivery</li>
        <li>Limited customization</li>
      </ul>
    </div>
    <div class="option highlight">
      <h3>SendAFun</h3>
      <ul>
        <li>$1.99 per card, instant</li>
        <li>Delivered in 2 minutes</li>
        <li>Full creative control</li>
      </ul>
    </div>
  </div>
</section>

<!-- 3. Testimonials — 3 条评价，每条 ~50 字 -->
<section id="testimonials">
  <h2>What our users say</h2>
  <div class="reviews">
    <blockquote>
      <p>"I sent a card to my mom for her birthday and she loved it! 
         So easy to use and much more personal than a generic e-card."</p>
      <cite>— Sarah M., California</cite>
    </blockquote>
    <!-- 更多评价 -->
  </div>
</section>

<!-- 4. FAQ — 5 个问题，每个 ~50 字 -->
<section id="faq">
  <h2>Frequently Asked Questions</h2>
  <details>
    <summary>Can I schedule a card for later?</summary>
    <p>Yes! When you're about to send, click "Schedule for later" and pick the date. 
       We'll deliver it exactly on time.</p>
  </details>
  <!-- 更多 FAQ -->
</section>
```

**总字数**：Hero(50) + How it works(150) + Why us(100) + Testimonials(150) + FAQ(250) = **700+ 字**

---

#### 20.2.2 分类页（category/{category}.html）— 目标 300+ 字

当前：分类标题 + 卡片网格 = ~20 字

**新增内容**：

```html
<section class="category-intro">
  <h1>Birthday Cards</h1>
  <p>Make their birthday unforgettable with a personalized digital card. 
     Our birthday collection includes designs for mom, dad, friends, and colleagues. 
     Add your own photos, choose from 20+ fonts, and make it truly special.</p>
  <p>Why send a generic e-card when you can create something unique? 
     With SendAFun, you can create a beautiful card in under 2 minutes.</p>
</section>

<section class="category-tips">
  <h2>Tips for the perfect birthday card</h2>
  <ul>
    <li>Add a personal photo — it makes all the difference</li>
    <li>Keep your message short and heartfelt</li>
    <li>Choose a font that matches your relationship</li>
  </ul>
</section>
```

**总字数**：~300 字

---

#### 20.2.3 卡片页（card/{slug}.html）— 目标 400+ 字

当前：Canvas 编辑器 + 发送表单 = ~100 字

**新增内容**：

```html
<section class="card-description">
  <h2>About this card</h2>
  <p>This beautiful birthday card features a warm, festive design perfect for mom. 
     Personalize it with your own message, photos, and style choices.</p>
</section>

<section class="card-tips">
  <h2>How to make it special</h2>
  <ol>
    <li>Click on the text to edit it</li>
    <li>Upload a photo of you and mom together</li>
    <li>Choose a handwritten font for a personal touch</li>
    <li>Add a sticker or emoji to make it fun</li>
    <li>Preview it to see how mom will see it</li>
  </ol>
</section>

<section class="related-cards">
  <h2>You might also like</h2>
  <!-- 3 张相关卡片 -->
</section>
```

**总字数**：~400 字

---

#### 20.2.4 必需静态页（AdSense 强制要求）

| 页面 | 最低字数 | 内容要求 |
|------|---------|---------|
| `/about` | 300+ | 公司介绍、使命、团队（可虚构） |
| `/contact` | 200+ | 联系表单 + 邮箱 + 地址（可虚构） |
| `/privacy-policy` | 500+ | GDPR 合规隐私政策（Section 18 已要求） |
| `/terms` | 500+ | 服务条款 |
| `/refund-policy` | 300+ | 退款政策（Section 18 已要求） |

---

### 20.3 内容质量标准

| 标准 | 要求 |
|------|------|
| **原创性** | 不能从其他网站复制粘贴 |
| **相关性** | 内容必须与贺卡/送卡相关 |
| **语法** | 英文语法正确，无拼写错误 |
| **格式** | 使用标题、段落、列表，不堆砌关键词 |
| **价值** | 对用户真正有用，不是填充文字 |

---

### 20.4 实现优先级

| 页面 | 优先级 | 说明 |
|------|--------|------|
| 首页内容增量 | 🔴 P0 | AdSense 审批第一步 |
| `/about` 创建 | 🔴 P0 | 强制要求 |
| `/contact` 创建 | 🔴 P0 | 强制要求 |
| `/privacy-policy` 创建 | 🔴 P0 | 已规划（Section 18） |
| `/terms` 创建 | 🔴 P0 | 强制要求 |
| 分类页内容增量 | 🟡 P1 | 影响 SEO + AdSense |
| 卡片页内容增量 | 🟡 P1 | 影响转化率 |
| `/refund-policy` 创建 | 🟡 P1 | 已规划（Section 18） |

---

## 21. 第二轮产品挑刺（老年用户 + 企业用户 + 竞品深挖）

> **审查时间**：2026-06-28（第二轮）
> **审查视角**：① 65+ 老年用户（视力差/手指不灵活/不懂触屏）② 企业行政（批量发节日卡）③ 竞品功能深挖（Moonpig/Blue Mountain/American Greetings）
> **与第一轮差异**：第一轮覆盖通用付费用户旅程；第二轮覆盖边缘用户群（老年/企业）+ 竞品功能差距

---

### 21.1 老年用户（65+）专项挑刺

**用户特征**：视力差（需 18pt+ 字体）、手指不灵活（需 44px+ 按钮）、不懂触屏手势、害怕点错、需要高对比度

| # | 挑刺点 | 用户原话风格 | 严重度 | 修复方案 |
|---|--------|-------------|--------|---------|
| 1 | **按钮太小**，手机上点不准 | "I can't hit that tiny button with my thumb" | 🔴 P0 | 所有 CTA 按钮最小 44×44px，字体 18pt+ |
| 2 | **没有「大字体模式」** | "I can't read this, the letters are too small" | 🟡 P1 | 加「无障碍」切换按钮，一键切换 18pt 大字模式 |
| 3 | **颜色对比度不足**（灰底灰字） | "Is there text here? I can't see it" | 🔴 P0 | 所有文字对比度 ≥ 4.5:1（WCAG AA），错误提示用红色非灰色 |
| 4 | **没有语音朗读**（Screen Reader 不支持） | "My screen reader can't read this page" | 🟡 P1 | 所有图片加 `alt`，所有按钮加 `aria-label`，Canvas 加 `role="img"` |
| 5 | **编辑页太复杂**，好多选项 | "I just want to type 'Happy Birthday' and send it" | 🔴 P0 | 加「简单模式」开关：隐藏滤镜/贴纸/字体选择，只留打字 + 选卡 + 发送 |
| 6 | **没有电话客服**，只有邮箱 | "I don't use email, can I call you?" | 🟢 P2 | 加 VoIP 客服按钮（如 Tawk.to 免费版），老年用户偏好实时对话 |

**无障碍合规要求（ADA Section 508）**：
- 所有按钮 ≥ 44×44px 触摸目标
- 所有文字对比度 ≥ 4.5:1
- 支持键盘导航（Tab 键遍历所有交互元素）
- 支持 Screen Reader（NVDA/JAWS）

---

### 21.2 企业用户（HR/行政）专项挑刺

**用户特征**：要批量发 50+ 张卡、需要公司 Logo、需要发送记录导出、需要代付（公司信用卡）

| # | 挑刺点 | 用户原话风格 | 严重度 | 修复方案 |
|---|--------|-------------|--------|---------|
| 7 | **不能批量发送**（50 个员工邮箱） | "I'm not typing 50 emails one by one" | 🔴 P0 | 加「Bulk Send」功能：上传 CSV（name, email, card-type），系统批量生成卡片 + 发送 |
| 8 | **不能加公司 Logo** | "We need our company logo on the card" | 🟡 P1 | 编辑页加「Branding」区块（仅年费用户），上传 Logo 显示在卡片角落 |
| 9 | **没有发送记录导出** | "I need to prove to my boss we sent cards to all clients" | 🟡 P1 | 用户后台加「Export CSV」按钮，导出发送记录（收件人/时间/状态） |
| 10 | **没有「代付」功能**（公司卡付，员工选卡） | "My assistant should be able to send cards on our company account" | 🟢 P2 | 年费账户加「Team Member」邀请功能（最多 5 个），共享同一个付费额度 |
| 11 | **没有节日模板套餐**（Christmas/Thanksgiving 批量） | "I want to send the same design to all clients, just with their names" | 🟡 P1 | 加「Mail Merge」功能：卡片正文插入 `{{name}}` 变量，批量替换收件人姓名 |

**Bulk Send 功能规格（P0）**：
```
CSV 格式：
name,email,card_type,message
Alice Johnson,alice@company.com,birthday,"Happy Birthday!"
Bob Smith,bob@company.com,thank_you,"Thanks for everything!"

后端处理：
1. 解析 CSV → 生成 N 个预览链接
2. 批量创建卡片（state 存 KV）
3. 批量发送邮件（Resend API 批量调用）
4. 返回发送状态报告（成功/失败列表）
```

---

### 21.3 竞品功能深挖（Moonpig/Blue Mountain/American Greetings）

**方法**：对比三大竞品功能清单，标记 SendAFun 缺失项

| 竞品功能 | Moonpig | Blue Mountain | American Greetings | SendAFun 状态 | 优先级 |
|---------|---------|--------------|-------------------|---------------|--------|
| **照片拼贴（多张照片）** | ✅ | ❌ | ✅ | ❌ 缺失 | 🔴 P0 |
| **视频贺卡**（上传 30s 视频） | ❌ | ✅ | ❌ | ❌ 缺失 | 🟡 P1 |
| **音乐贺卡**（内置音乐播放） | ❌ | ✅ | ✅ | ❌ 缺失 | 🟢 P2 |
| **定时发送**（Schedule） | ✅ | ✅ | ✅ | ❌ 缺失（Section 19 #15 已提） | 🔴 P0 |
| **纸质卡 + 数字卡混合** | ✅ | ❌ | ❌ | ❌ 缺失 | 🟢 P2 |
| **收件人地址簿** | ✅ | ✅ | ✅ | ❌ 缺失 | 🟡 P1 |
| **「写给自己的卡」**（self-send） | ❌ | ❌ | ✅ | ❌ 缺失 | 🟢 P2 |
| **GIF/动图贺卡** | ❌ | ✅ | ❌ | ❌ 缺失 | 🟡 P1 |

**关键差距分析**：

1. **照片拼贴**（P0）— Moonpig 允许用户上传 2-9 张照片拼成一张卡片，这是他们的 Top 3 功能。SendAFun 目前只支持 1 张背景图替换。
   - 实现方案：Canvas 支持多图片图层，前端 JS 实现拼贴布局选择器（2 张/3 张/4 张网格）。
   
2. **视频贺卡**（P1）— Blue Mountain 的差异化功能，上传 30s 视频嵌入卡片，收件人打开后自动播放。
   - 实现方案：支持 MP4 上传 → R2 存储 → 卡片页嵌入 `<video controls>` 标签。
   
3. **收件人地址簿**（P1）— 所有竞品都有，用户保存常用收件人（姓名/邮箱/生日），下次发送自动填充。
   - 实现方案：`address_book` KV 存储（key = user_token，value = JSON 数组）。
   
4. **GIF/动图贺卡**（P1）— Blue Mountain 支持在卡片中嵌入 GIF 动图，增加趣味性。
   - 实现方案：允许在贴纸库中选择 GIF 动图，Canvas 渲染时保留动画。

---

### 21.4 移动端专项挑刺（补充第一轮）

**第一轮已提**：#4（移动端加载速度）、#10（Canvas 触屏编辑）

**第二轮补充**：

| # | 挑刺点 | 用户原话风格 | 严重度 | 修复方案 |
|---|--------|-------------|--------|---------|
| 12 | **虚拟键盘遮挡输入框** | "I type my message and the keyboard covers the text box" | 🔴 P0 | 输入框自动滚动到可视区域（`scrollIntoView` + `100px` 偏移） |
| 13 | **没有「保存到相册」**（手机端） | "I want to save this card to my photos" | 🟡 P1 | 加「Save to Photos」按钮（手机端检测 `navigator.userAgent`），触发 Canvas → PNG 下载 |
| 14 | **Payment 页在手机上加载慢** | "The payment page takes forever to load on 4G" | 🔴 P0 | Creem Hosted Checkout 用 `loading="lazy"` + 预连接（`dns-prefetch`） |

---

### 21.5 综合优先级排序（合并第一轮 + 第二轮）

| 优先级 | 功能 | 来源 | 预计工作量（人天） |
|--------|------|------|---------------------|
| 🔴 P0 | 移动端 Canvas 编辑优化（触屏友好） | 第一轮 #10 | 2d |
| 🔴 P0 | 预览收件人视角 | 第一轮 #8 | 0.5d |
| 🔴 P0 | 定时发送 | 第一轮 #15 | 3d |
| 🔴 P0 | 批量发送（CSV 上传） | 第二轮 #7 | 5d |
| 🔴 P0 | 照片拼贴（多图层） | 第二轮竞品 | 5d |
| 🔴 P0 | 虚拟键盘遮挡修复 | 第二轮 #12 | 0.5d |
| 🔴 P0 | 按钮最小 44px + 高对比度 | 第二轮 #1/#3 | 1d |
| 🟡 P1 | 社会证明（评价/计数器） | 第一轮 #2 | 1d |
| 🟡 P1 | 手写字体（Google Fonts） | 第一轮 #6 | 0.5d |
| 🟡 P1 | 地址簿 | 第二轮 #12 | 2d |
| 🟡 P1 | 大字体模式 | 第二轮 #2 | 0.5d |
| 🟡 P1 | Mail Merge（变量替换） | 第二轮 #11 | 2d |
| 🟡 P1 | 视频贺卡 | 第二轮竞品 | 3d |
| 🟢 P2 | 音乐贺卡 | 第二轮竞品 | 5d |
| 🟢 P2 | Team Member（代付） | 第二轮 #10 | 3d |
| 🟢 P2 | GIF/动图贺卡 | 第二轮竞品 | 1d |

---

### 21.6 实现路线图建议（更新版）

**Phase 1（即刻实现，2 周内）**：
- 移动端 Canvas 编辑优化（P0，触屏友好）
- 虚拟键盘遮挡修复（P0）
- 按钮 44px + 高对比度（P0，无障碍）
- 预览收件人视角（P0，减少退款）

**Phase 2（1 个月内）**：
- 定时发送（P0，竞品标配）
- 照片拼贴（P0，竞品 Top 3 功能）
- 地址簿（P1，留存率）

**Phase 3（2 个月内）**：
- 批量发送 CSV（P0，企业用户）
- 社会证明（P1，转化率）
- Mail Merge（P1，企业用户）

**Phase 4（3 个月内）**：
- 视频贺卡（P1，差异化）
- Team Member（P2，B 端扩张）
- 音乐贺卡（P2，锦上添花）

---

> **第二轮挑刺总结**：
> - 老年用户：无障碍是合规要求（ADA），不实现可能被起诉
> - 企业用户：Bulk Send 是最高 ROI 功能（企业用户 LTV 是个人的 10x）
> - 竞品对标：照片拼贴是 Must-have，视频贺卡是 Nice-to-have

---

## 22. 第三轮产品挑刺（Z 世代 + 收件人视角 + 分享便利性）

> **审查时间**：2026-06-28（第三轮）
> **审查视角**：① Z 世代（16-25 岁，Instagram/TikTok 原生用户）② 收件人视角（收到卡后想转发）③ 微信/WhatsApp 重度用户
> **核心问题**：当前分享方式（Web Share API + 复制链接 + 二维码）对年轻用户不够方便，收件人无法便捷转发

---

### 22.1 当前分享方式盘点

| 方式 | 实现位置 | 覆盖场景 | 问题 |
|------|---------|---------|------|
| Web Share API（`navigator.share`） | `card-template.html` 第 830 行 | 手机端分享到其他 App | 桌面端不支持；部分 App 不在分享列表里 |
| 复制链接 | 同上（fallback） | 所有平台 | 用户不知道粘贴到哪里；链接没有预览图 |
| 二维码 | `btnQR` 按钮 | 线下扫码 | Z 世代不用二维码；场景极有限 |

**核心缺口**：
1. 没有 Instagram Stories 分享（Z 世代最常用）
2. 没有 WhatsApp Web 直接分享（桌面端）
3. `og:image` 缺失 —— 分享到微信/WhatsApp 时没有预览图，只有链接
4. 收件人收到邮件后，没有「转发给朋友」按钮

---

### 22.2 Z 世代（16-25 岁）专项挑刺

**用户特征**：手机原生、不用邮件、所有内容都发 Stories/Status、期待视觉冲击力

| # | 挑刺点 | 用户原话风格 | 严重度 | 修复方案 |
|---|--------|-------------|--------|---------|
| 1 | **不能发 Instagram Stories** | "I made this cute card, how do I post it to my story?" | 🔴 P0 | 加「Share to IG Stories」按钮：生成 9:16 竖版图片 → 调用 IG Stories API（或引导手动保存+上传） |
| 2 | **分享到 WhatsApp Status 太麻烦** | "I want one tap to post to my status" | 🔴 P0 | 加 WhatsApp Status 分享按钮：`https://wa.me/?text={url}`（手机端自动唤起） |
| 3 | **卡片没有动效** | "This is boring, I want it to move like on TikTok" | 🟡 P1 | 加「Animated Text」选项：文字逐字出现 + 闪烁效果（Canvas 动画 → GIF/MP4 导出） |
| 4 | **没有 TikTok 分享** | "Can I post this as a TikTok?" | 🟡 P1 | 导出 9:16 视频（卡片动画 + 音乐）→ 引导用户上传到 TikTok |
| 5 | **og:image 缺失** | "I sent the link on WhatsApp and it's just a gray box" | 🔴 P0 | 每张卡片生成 `og:image`（600×600 PNG），放在 R2 + 公共访问；`<head>` 加 `meta property="og:image"` |

**Instagram Stories 分享实现方案（P0）**：
```
方案 A（推荐）：生成 9:16 竖版 PNG → 用户提供「Save to Photos」→ 手动上传到 IG
方案 B（进阶）：使用 Instagram Content Publishing API → 需要 Instagram Business Account
→ 先实现方案 A（快速），方案 B 在 Phase 3 考虑
```

**WhatsApp Status 分享实现（P0）**：
```
手机端：`window.open('whatsapp://status?text=' + encodeURIComponent(url))`
桌面端：`window.open('https://web.whatsapp.com/' + '?text=' + ...)`（有限支持）
→ 更简单：直接给 `https://wa.me/?text={url}` 链接，WhatsApp 会自动创建新消息
```

---

### 22.3 收件人视角专项挑刺

**当前流程**：发件人付费 → 收件人收到邮件 → 点击链接查看卡片 → **结束**

**问题**：收件人想转发卡片给其他人，但没有便捷方式。

| # | 挑刺点 | 用户原话风格 | 严重度 | 修复方案 |
|---|--------|-------------|--------|---------|
| 6 | **收件人想转发，只能转发邮件** | "I want to send this card to my sister, but I can only forward the email" | 🔴 P0 | 卡片页加「Send to a friend」按钮（收件人视角）→ 跳转创建同款卡片，预填相同设计 |
| 7 | **没有「收藏」功能** | "I want to save this card to my collection" | 🟡 P1 | 加「★ Save」按钮（无需登录）→ 用 `localStorage` 存 `saved_cards` 数组 |
| 8 | **卡片过期后无法查看** | "I got this card 2 months ago and now the link is dead" | 🔴 P0 | TTL 从 30d 延长到 90d（或永久，R2 存储成本低）→ Section 5 已规划 30d→90d |
| 9 | **没有「回复卡片」功能** | "I want to send a thank-you card back" | 🟡 P1 | 卡片页加「Send a reply card」按钮 → 跳转创建页，预填「Thank You」类别 + 收件人为原发件人 |

---

### 22.4 微信/WhatsApp 重度用户挑刺

**用户特征**：中国/东南亚/拉美用户，习惯用微信/WhatsApp 分享一切

| # | 挑刺点 | 用户原话风格 | 严重度 | 修复方案 |
|---|--------|-------------|--------|---------|
| 10 | **微信分享没有缩略图** | "我发给朋友，只显示了一串链接，没有图片" | 🔴 P0 | 加 `og:image` + `og:title` + `og:description`（微信爬虫会读取） |
| 11 | **没有「发给微信好友」按钮** | "I want to open WeChat and send this card" | 🟡 P1 | 加微信分享按钮（需微信 JSSDK，或个人号无法调用 → 提供「复制链接」引导手动粘贴） |
| 12 | **WhatsApp 分享后预览图不显示** | "The link preview shows a broken image" | 🔴 P0 | `og:image` 必须是绝对 URL（以 `https://` 开头），且图片尺寸 ≥ 300×300 |

**og:image 规格要求**：
```html
<!-- 每张卡片页的 <head> 中必须加 -->
<meta property="og:title" content="You got a card from Mom!" />
<meta property="og:description" content="Click to view the card" />
<meta property="og:image" content="https://sendafun.com/cards/preview/{slug}.png" />
<meta property="og:image:width" content="600" />
<meta property="og:image:height" content="600" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://sendafun.com/cards/preview/{slug}.png" />
```

**构建时自动生成 og:image**：
- 方案：`generate-cards.js` 构建时，对每张卡片调用 `node-canvas` 渲染 600×600 PNG → 存 R2 `og-images/` 前缀
- 替代方案（更快）：卡片页 JS 在首次加载时，用 Canvas 生成 600×600 截图 → 转 Blob → 上传 R2（需要 Worker 支持）

---

### 22.5 综合优先级（第三轮新增）

| 优先级 | 功能 | 来源 | 预计工作量 |
|--------|------|------|---------|
| 🔴 P0 | `og:image` 生成 + OG 标签 | #5/#10/#12 | 2d |
| 🔴 P0 | WhatsApp Status 分享按钮 | #2 | 0.5d |
| 🔴 P0 | 「Send to a friend」（收件人转发） | #6 | 1d |
| 🔴 P0 | 卡片 TTL 延长到 90d | #8 | 0.5d（改 KV TTL） |
| 🟡 P1 | Instagram Stories 分享（方案 A） | #1 | 1d |
| 🟡 P1 | 「★ Save」收藏功能 | #7 | 0.5d |
| 🟡 P1 | 「Send a reply card」 | #9 | 1d |
| 🟡 P1 | 动画文字/动效卡片 | #3 | 3d |

---

### 22.6 实现路线图（第三轮补充）

**Phase 1（即刻，1 周内）**：
- `og:image` 生成 + OG 标签（P0，影响所有社交分享）
- WhatsApp Status 分享按钮（P0，30 分钟搞定）
- 卡片 TTL 延长到 90d（P0，改 KV TTL）

**Phase 2（1 个月内）**：
- 「Send to a friend」按钮（P0，收件人转发 = 免费增长）
- Instagram Stories 分享（P1，Z 世代增长）
- 「★ Save」收藏（P1，留存率）

**Phase 3（2 个月内）**：
- 动画文字/动效卡片（P1，差异化）
- 「Send a reply card」（P1，复购率）

---

> **第三轮挑刺总结**：
> - 当前分享方式对 Z 世代不够方便（没有 IG/TikTok 分享）
> - `og:image` 缺失是致命问题 —— 所有社交分享都只有链接，没有预览图
> - 收件人转发功能缺失 = 失去免费增长机会
> - 优先级最高：`og:image` + WhatsApp Status 分享（2 天工作量，覆盖 80% 用户）



---

## 23. 裂变增长机制设计（ Viral Loop ）

> **设计时间**：2026-06-28
> **目标**：利用每张卡片作为免费广告位，让收件人转化为发件人，形成自增长循环
> **核心洞察**：贺卡产品的天然裂变路径是「发件人 → 收件人 → 新发件人」，因为收件人刚体验了产品价值（收到一张精美卡片），转化意愿最强

---

### 23.1 裂变路径全景图

```
┌─────────────────────────────────────────────────────────┐
│                    裂变循环图                          │
│                                                         │
│   [发件人A] ──发卡片──→ [收件人B]                      │
│                           │                            │
│                           ↓                            │
│                      [看到卡片]                         │
│                           │                            │
│               ┌───────┬───┴───┬───────┐           │
│               ↓       ↓       ↓       ↓           │
│          [转发卡片] [自己也发] [忽略] [举报]       │
│               │       │                            │
│               ↓       ↓                            │
│          [新发件人C] [新发件人D]                    │
│               │       │                            │
│               └───────┴──────────→ [卡片继续传播]  │
└─────────────────────────────────────────────────────────┘
```

**关键指标**：
- **收件人 → 发件人转化率**（目标：15%，行业均值 8%）
- **K-Factor**（每个用户带来多少新用户，目标：> 1.2）
- **裂变成本**（CAC via viral，目标：<$0.50）

---

### 23.2 裂变方式清单（8 种）

#### 方式 1：「转发卡片」按钮（收件人 → 新发件人）

**触发时机**：收件人打开卡片页
**机制**：卡片页加「Send a card to someone else」按钮，点击后：
1. 跳转创建页，预填相同设计（类别/滤镜/贴纸）
2. URL 带 `?ref={sender_token}` 参数
3. 发件人 A 获得 1 张免费卡（当新用户付费时）

**技术实现**：
```javascript
// 卡片页 URL：/card/{slug}?ref={sender_token}
// 收件人点击「Send a card」→ /create?template={slug}&ref={sender_token}
// Worker 记录：推荐关系存 KV { key: `ref:${new_user_token}`, value: { referrer: sender_token, status: 'pending' } }
// 当新用户付费 → 更新 status = 'converted' → 给推荐人发邮件 + 加免费卡额度
```

**优先级**：🔴 P0（最高 ROI，零成本）

---

#### 方式 2：「Made with SendAFun」品牌水印（每张卡片都是广告）

**机制**：每张卡片底部加一行小字 + Logo：
> *"You received this card via SendAFun. Make your own card → sendafun.com"*

**样式规格**：
- 位置：卡片最下方（不影响主要内容）
- 字体：12pt，灰色（#98989d）
- 移动端：折叠为「ℹ️ About this card」点击展开
- 付费用户可选「Remove branding」（$0.99/次 或 年费免费）

**技术实现**：
```javascript
// Canvas 渲染时，最后一层：
if (!state.removeBranding) {
  ctx.font = '12px Inter';
  ctx.fillStyle = '#98989d';
  ctx.textAlign = 'center';
  ctx.fillText('Made with SendAFun · sendafun.com', canvas.width/2, canvas.height - 20);
}
```

**优先级**：🔴 P0（每张卡片都是免费广告位，不实现等于浪费）

---

#### 方式 3：推荐奖励计划（Referral Program）

**机制**：
- 发件人分享专属链接：`sendafun.com/?ref={user_token}`
- 好友通过链接注册/发卡 → 双方都得奖励
- 奖励阶梯：

| 成功推荐人数 | 发件人奖励 | 新用户奖励 |
|-------------|-------------|-------------|
| 1 人 | 1 张免费卡 | 首张卡 $0.99（原价 $1.99） |
| 3 人 | 3 张免费卡 | — |
| 5 人 | 年费会员 5 折 | — |
| 10 人 | 终身免费（发 50 张/年） | — |

**技术实现**：
```javascript
// KV 存储结构
kv.put(`referral:${referrer_token}`, JSON.stringify({
  count: 0,
  rewarded: [1, 3, 5, 10],  // 已达成里程碑
  pending: []  // 待审核（防止作弊）
}));

// 新用户注册（首次访问带 ?ref=xxx）
if (urlParams.get('ref')) {
  const referrer = urlParams.get('ref');
  // 验证 referrer 有效
  // 存推荐关系
  kv.put(`ref:${new_user_token}`, JSON.stringify({
    referrer,
    createdAt: Date.now(),
    status: 'registered'  // → 'paid' → 'rewarded'
  }));
}
```

**防作弊机制**：
- 同一 IP 只能推荐 1 个账号
- 推荐人必须付费后，才发奖励（防止自刷）
- 退款时，相应奖励收回

**优先级**：🟡 P1（需要 KV 存储 + 邮件通知，Phase 2 实现）

---

#### 方式 4：群签贺卡（Group Card）—— 多人签名的裂变

**机制**：发件人创建「群签卡片」，分享链接给多个朋友，每个人可以加自己的留言 + 贴纸，最后一起发给收件人。

**裂变效应**：N 个签名人 = N 个潜在新用户

**技术实现**：
```javascript
// 数据结构
const groupCard = {
  id: 'group-{slug}',
  creator: user_token,
  recipients: ['email1', 'email2'],
  contributors: [
    { name: 'Alice', message: 'Happy Birthday!', stickers: ['🎂'] },
    { name: 'Bob', message: 'Best wishes!', stickers: ['🎉'] }
  ],
  maxContributors: 20,
  expiresAt: Date.now() + 7 * 24 * 3600 * 1000  // 7 天后自动发送
};
```

**优先级**：🟡 P1（社交场景强，但开发量大，Phase 3 实现）

---

#### 方式 5：节日挑战（Gamification）

**机制**：节日期间（Christmas/Valentine's/Thanksgiving），发起挑战：
- 「发 3 张卡片，解锁限定设计」
- 「发 5 张卡片，获得「Holiday Hero」徽章 + 社交媒体分享素材」

**优先级**：🟢 P2（锦上添花，Phase 4 实现）

---

#### 方式 6：批量发卡的「拼团」模式

**机制**：用户购买「5 张卡 $8.99」（原价 $1.99×5 = $9.95，打 9 折），然后鼓励用户「邀请 4 个朋友，每人发 1 张，平摊成本」。

**裂变效应**：1 个购买用户 → 4 个新用户

**优先级**：🟡 P1（需要社交分享引导 + 拼团状态追踪）

---

#### 方式 7：卡片页的「Others also sent」（社会证明 + 裂变）

**机制**：卡片页底部加一块：
> *"Alice also sent a 'Happy Birthday' card to Bob"*
> *"123 people sent cards using this design this month"*

**效果**：社会证明 → 激发收件人也来发卡

**技术实现**：
```javascript
// KV 存储：每个设计的发送次数
kv.incr(`design_count:${slug}`);

// 卡片页读取
const count = await kv.get(`design_count:${slug}`);
// 显示：「Joined 123 others who sent this card」
```

**优先级**：🟡 P1（快速实现，1 天搞定）

---

#### 方式 8：邮件签名档（Email Signature）

**机制**：发件人收到「卡片已送达」邮件后，邮件底部加 CTA：
> *"Want to send a card too? Get $1 OFF → sendafun.com/?ref=xxx"*

**优先级**：🟢 P2（邮件模板改造，30 分钟搞定，但效果有限）

---

### 23.3 裂变优先级排序

| 方式 | 开发量 | 预期 K-Factor 贡献 | 优先级 |
|------|--------|-------------------|--------|
| 方式 2：品牌水印 | 0.5d | +0.3 | 🔴 P0 |
| 方式 1：转发按钮 | 1d | +0.4 | 🔴 P0 |
| 方式 7：社会证明 | 1d | +0.2 | 🟡 P1 |
| 方式 3：推荐奖励 | 3d | +0.5 | 🟡 P1 |
| 方式 4：群签贺卡 | 5d | +0.8 | 🟡 P1 |
| 方式 6：拼团模式 | 2d | +0.3 | 🟡 P1 |
| 方式 5：节日挑战 | 3d | +0.2 | 🟢 P2 |
| 方式 8：邮件签名 | 0.5d | +0.05 | 🟢 P2 |

**目标 K-Factor = 1.2 的拆解**：
- 平均每张卡片触达 1.2 个新潜在用户
- 转化率 12% → K-Factor = 1.2×0.12 = 0.144（需要推荐奖励叠加才能达到 >1）

---

### 23.4 技术实现规格

#### KV 存储结构（新增）

```javascript
// 推荐关系
kv.put(`ref:${new_user_token}`, JSON.stringify({
  referrer: referrer_token,
  registeredAt: timestamp,
  paidAt: null,
  rewardedAt: null
}));

// 推荐人统计
kv.put(`referral:${referrer_token}`, JSON.stringify({
  totalReferred: 5,
  totalConverted: 3,
  pendingReward: 2,  // 待发奖励（新用户已付费，但推荐人还没领）
  rewards: [
    { type: 'free_card', count: 3, grantedAt: timestamp }
  ]
}));

// 设计热度排行
kv.put(`design_count:${slug}`, count);
```

#### Worker API 新增端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/referral/create` | POST | 生成推荐链接 |
| `/api/referral/track` | POST | 记录推荐转化 |
| `/api/referral/reward` | POST | 发放推荐奖励 |
| `/api/group-card/create` | POST | 创建群签卡片 |
| `/api/group-card/contribute` | POST | 添加签名/留言 |

---

### 23.5 实现路线图（裂变专项）

**Phase 1（即刻，1 周内）**：
- 品牌水印（P0，0.5d）→ 每张卡片变成广告位
- 转发按钮（P0，1d）→ 收件人一键变发件人
- 邮件签名 CTA（P2，0.5d）→ 快速实验

**Phase 2（1 个月内）**：
- 推荐奖励计划（P1，3d）→ 系统化裂变
- 社会证明模块（P1，1d）→ 卡片页加「XXX people sent this」
- 拼团模式（P1，2d）→ 批量发卡裂变

**Phase 3（2 个月内）**：
- 群签贺卡（P1，5d）→ 最强社交裂变
- 邮件自动跟进（「Your card made someone's day, send another?」）

**Phase 4（3 个月内）**：
- 节日挑战（P2，3d）→ Gamification 留存
- 裂变数据看板（内部工具）→ 追踪 K-Factor

---

> **裂变设计总结**：
> 1. **品牌水印是零成本裂变** —— 每张卡片都是广告，不实现等于每天浪费几百个免费广告位
> 2. **转发按钮是最高转化路径** —— 收件人刚体验价值，转化率最高
> 3. **推荐奖励是系统化裂变** —— 需要 Phase 2 实现，但长期价值最大
> 4. **群签贺卡是社交裂变之王** —— 1 个群 = 10+ 个新用户，但开发量大



## 24. 分享功能补全（Sharing Platform Coverage）

> **设计时间**：2026-06-28
> **目标**：覆盖美国主流分享平台，收件人能一键分享到常用平台
> **当前状态**：Web Share API（移动端）+ 复制链接 + QR 码

---

### 24.1 当前分享方式

| 方式 | 技术 | 覆盖平台 | 问题 |
|------|------|---------|------|
| Web Share API | navigator.share() | iOS/Android 原生菜单（WhatsApp/iMessage/FB） | 桌面端不支持；无 og:image |
| 复制链接 | clipboard.writeText() | 全部平台（用户手动粘贴） | 体验差，需手动操作 |
| QR 码 | 前端生成 | 线下扫码 | 适合打印场景 |

---

### 24.2 海外主流分享平台覆盖矩阵（美国市场）

| 平台 | 渗透率 | 当前支持 | 优先级 | 实现方式 |
|------|--------|---------|--------|----------|
| iMessage（iOS） | ~90% | Web Share API 覆盖 | - | - |
| WhatsApp | ~70% | Web Share API 覆盖 | P0 | 专属按钮（wa.me）+ 预填文案 |
| Instagram Stories | ~50% | **不支持** | P0 | 生成 Story 尺寸图（1080x1920）+ 引导 |
| Email（Gmail/Outlook） | 高 | 仅复制链接 | P1 | 专属按钮（mailto: 或 Web Share） |
| Twitter/X | ~30% | **不支持** | P2 | 专属按钮 |
| LinkedIn | 职场场景 | **不支持** | P2 | 专属按钮 |

**关键发现**：
- WhatsApp 是最高频分享渠道（美国 70% 渗透率）
- Instagram Stories 是年轻人分享贺卡的核心场景（照片/卡片天然适合 Stories）
- Email 是桌面端主要分享方式（Web Share API 不支持桌面端）

---

### 24.3 分享功能补全实现

#### 24.3.1 WhatsApp 专属分享按钮（P0）

**触发时机**：收件人查看卡片页（`/card/{slug}`）

**机制**：
1. 卡片页底部加 Share on WhatsApp 按钮
2. 点击跳转 `https://wa.me/?text={urlencode(文案 + 链接)}`
3. 预填文案：「I just received a card via SendAFun! Check it out: {url}」

**技术实现**（前端）：

```javascript
// 卡片页添加 WhatsApp 分享按钮
const btn = document.createElement('a');
btn.href = `https://wa.me/?text=${encodeURIComponent('I just received a card! ' + window.location.href)}`;
btn.target = '_blank';
btn.rel = 'noopener noreferrer';
btn.className = 'share-btn whatsapp';
btn.innerHTML = 'Share on WhatsApp';
```

**OG 协议优化**（解决分享无预览图）：

```html
<meta property="og:title" content="You received a card!" />
<meta property="og:image" content="https://sendafun.com/og-image/{slug}.png" />
```

---

#### 24.3.2 Instagram Stories 支持（P0）

**触发时机**：收件人查看卡片页，点击「Share to Instagram Story」

**机制**：
1. 前端生成 Story 尺寸卡片图（1080x1920px）
2. 图片包含：卡片内容 + 二维码（指向卡片页）+ Made with SendAFun 水印
3. 引导用户：保存图片 → 打开 Instagram → Add to Story

**技术实现**（前端 Canvas）：

```javascript
function generateStoryImage(canvas) {
  const s = document.createElement('canvas');
  s.width = 1080; s.height = 1920;
  const ctx = s.getContext('2d');
  // 1. 绘制渐变背景
  // 2. 绘制卡片内容（居中 800x600）
  // 3. 绘制二维码（右下角 200x200）
  // 4. 绘制水印文字
  const url = s.toDataURL('image/png');
  return url;
}
```

**用户引导文案**：
1. Save this image
2. Open Instagram
3. Add to your Story
4. Tag us @sendafun

---

#### 24.3.3 Email 专属分享按钮（P1）

**触发时机**：收件人查看卡片页

**机制**：
1. 卡片页加 Share via Email 按钮
2. 点击调起邮件客户端（mailto:）或 Web Share API

**技术实现**：

```javascript
// 方式 1：mailto:（简单但样式差）
const btn = document.createElement('a');
btn.href = `mailto:?subject=${encodeURIComponent('Card!')}&body=${encodeURIComponent('Link: ' + location.href)}`;
btn.className = 'share-btn email';

// 方式 2：Web Share API（如果支持）
if (navigator.share) {
  btn.onclick = () => navigator.share({ title: 'Card!', url: location.href });
}
```

---

### 24.4 OG 协议（Open Graph）补全

**问题**：当前卡片页无 og:image，分享到社交媒体时无预览图。

**修复**：每张卡片页 head 中动态生成 OG 标签：

```html
<meta property="og:title" content="You received a card!" />
<meta property="og:description" content="Someone sent you a card via SendAFun." />
<meta property="og:image" content="https://sendafun.com/og-image/{slug}.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="https://sendafun.com/card/{slug}" />
<meta property="og:type" content="website" />
```

**og:image 生成方式**：
1. 方式 1（推荐）：Worker 按需生成（Canvas 截图 → PNG → R2 public 桶）
2. 方式 2：构建期预生成（增量构建时生成 OG 图）

---

### 24.5 实现路线图

**Phase 1（即刻，3 天内）**：
- OG 协议补全（P0，0.5d）→ 解决分享无预览图
- WhatsApp 专属按钮（P0，0.5d）→ 最高频渠道
- Instagram Stories 支持（P0，1d）→ 年轻人核心场景

**Phase 2（1 周内）**：
- Email 专属按钮（P1，0.5d）→ 桌面端主要方式
- Twitter/X 分享按钮（P2，0.5d）→ 低优先级

**Phase 3（1 个月内）**：
- LinkedIn 分享按钮（P2，0.5d）→ 职场场景
- 分享数据追踪（KV share_count:{slug}）→ 优化分享文案

---

### 24.6 分享数据追踪

**KV 存储结构**：

```javascript
// 每次分享事件
kv.incr(`share_count:${slug}`);
kv.incr(`share_count:${slug}:${platform}`);  // whatsapp/story/email/twitter
```

**用途**：
1. 优化分享文案（A/B test）
2. 识别热门卡片设计
3. 社会证明模块数据来源（Section 23 方式 7）

---

> **分享功能补全总结**：
> 1. **WhatsApp 是最高频渠道** —— 必须加专属按钮，不能只靠 Web Share API
> 2. **Instagram Stories 是年轻人核心场景** —— 需要生成 Story 尺寸图片
> 3. **OG 协议是基础设施** —— 没 og:image 所有分享都无预览图
> 4. **分享数据追踪是优化基础** —— 知道哪张卡被分享最多才能优化

---

---

## 25. 当前开发进度 & 后续 TODO

> **最后更新：2026-06-29 20:49**
> 本文档记录当前代码完成度，供后续接续开发参考。

---

### 25.1 整体完成度

| 层级 | 完成度 | 说明 |
|------|--------|------|
| 开发文档 | 95% | 本文档 28 章，后续写代码唯一参考 |
| 后端 Worker | 70% | 核心功能写完，未部署未测试 |
| 前端代码 | 60% | R2 图片上线，静态页完整，P0 bug 待修 |
| 基础设施 | 100% | KV/R2/Creem/Resend 均配置完成，双桶已填充 |
| 素材处理 | 85% | 5层去重流水线完成，11,631 WebP 已入 R2，3,879 原图上传中 |
| 端到端测试 | 0% | 未开始 |

---

### 25.2 已完成事项（2026-06-28 → 2026-06-29）

#### 基础设施
- [x] Cloudflare 接入 sendafun.com（Zone ID: `80ab5a9c4430b4f4c3657dfb5b94ff18`）
- [x] Email Routing 配置（`support@sendafun.com` → `331728525@qq.com`）
- [x] KV 命名空间创建（`sendafun-permissions`，ID: `7cd3408c3caf4fe9948cd156f6883acb`）
- [x] Wrangler 配置完成（wrangler.toml）
- [x] Creem 产品创建（3 个：单次/月订/年付）
- [x] Creem API Key 获取（`creem_test_6p3vwfxN0zfseek47G99gI`）
- [x] Creem KYC 验证提交（等待人工审核 24-48h）
- [x] Resend API Key 获取（`re_E4415y28_KngTFm6AxsSDfU1Ei24cAb32`）
- [x] 素材管理系统（`sendafun-asset-manager` skill）

#### R2 双桶 & 素材上线（🆕 2026-06-29）
- [x] R2 付费计划激活（Visa 卡绑定）
- [x] `sendafun-preview` 公开桶创建（7,163 WebP，11 分类 × 3 尺寸）
- [x] `sendafun-originals` 私有桶创建（3,879 高清原图，上传进行中）
- [x] R2 API Token 生成（`sendafun-backend`，永久有效）
- [x] `process-images-v2.py` 5层去重流水线完成（--force 全量处理）
- [x] 11,631 WebP 上传到 preview 桶
- [x] R2 CORS 配置（Canvas crossOrigin 问题修复）🆕
- [x] 3 个失败文件补传（retry-failed-preview.py）
- [x] 网站静态页改用 R2 CDN URL（`pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev`）
- [x] Git push → CF Pages 自动部署（commit `1146b44`，deployment `4f8c072f`）
- [x] sendafun.com 自定义域名 + SSL 激活
- [x] 验证：curl 确认首页 30 处 R2 URL，图片 200 OK WebP

#### 后端 Worker（worker/src/index.js）
- [x] Creem API 对接（test/prod 自动切换）
- [x] Checkout Session 创建（`/api/create-session`）
- [x] Webhook 处理（`/api/webhook`，HMAC 签名验证）
- [x] 权限授权（grantPermission，按 plan 区分 TTL）
- [x] user_token 生成（随机 UUID，Cookie + KV 双向映射）
- [x] 会员检验（handleCheckMember，Cookie 主路径 + email fallback）
- [x] 免费卡发放（1 张，修复原代码 3 张）
- [x] 邮件发送（Resend 替换 MailChannels）
- [x] R2 签名 URL 下载（`/api/download`，5min TTL）
- [x] 定时提醒（Cron Trigger，3 天提前）
- [x] 语法检查通过（`node --check`）

#### 配置文件
- [x] `products-config.json` — 真实 Product ID 写入
- [x] `.env` / `.env.example` — 环境变量模板
- [x] `.gitignore` — 排除 .env / dist / *.log
- [x] `wrangler.toml` — KV/R2/Cron/路由配置
- [x] R2 CORS 配置 — 2026-06-29 20:49

**R2 CORS 修复详情（2026-06-29 20:49）：**

根因：卡片详情页 `card-template.html` 第494-495行：
```javascript
state.bgImg = new Image();
state.bgImg.crossOrigin = 'Anonymous';  // 触发 CORS 请求
```
Canvas 渲染需要 `getImageData`（滤镜），但 R2 桶无 CORS → 图片被浏览器静默阻止。

修复：通过 Cloudflare API 配置 R2 桶 CORS：
- 端点：`PUT /accounts/{id}/r2/buckets/sendafun-preview/cors`
- 格式（Wrangler，注意不是 PascalCase）：
  ```json
  {"rules":[{"allowed":{"origins":["*"],"methods":["GET","HEAD"],"headers":["*"]},"maxAgeSeconds":3600}]}
  ```
- 验证：`Access-Control-Allow-Origin: *`，OPTIONS preflight 204

---

### 25.3 未完成事项（按优先级排序）

#### P0：上线前必须修复

| # | 问题 | 所在文件 | 说明 |
|---|------|---------|------|
| 1 | 支付流程纯前端模拟 | `source/js/app.js` | 前端不调 `/api/create-session`，用户免费发卡 |
| 2 | 前后端 API 字段名不匹配 | `app.js` vs `worker/src/index.js` | recipientEmail vs toEmail，字段全部对不上 |
| 3 | Cookie 同意横幅缺失 | 前端 HTML | GDPR 违法，欧盟用户访问即违规 |
| 4 | user_token 在 URL 中泄露 | 前端 JS | OWASP A09，浏览器历史/日志全泄露 |
| 5 | Canvas 无障碍缺失 | 前端 HTML/JS | ADA Title III 违规，屏幕阅读器不可见 |
| 6 | 退款政策页面缺失 | 前端 HTML | FTC 要求，$1.99 购买需有退款说明 |

#### P1：上线前应修复

| # | 问题 | 说明 |
|---|------|------|
| 7 | CSRF 保护缺失 | 所有 POST 接口无 CSRF token |
| 8 | COPPA 年龄门控缺失 | 13 岁以下儿童使用违法 |
| 9 | 数据删除权缺失 | 无 `DELETE /api/delete-me`（GDPR Art.17）|
| 10 | 颜色对比度未验证 | WCAG 2.1 AA 要求 ≥4.5:1 |

#### 部署前必须完成

| # | 任务 | 阻塞原因 |
|---|------|---------|
| D1 | `wrangler deploy` 部署 Worker | 等 R2 桶创建 + Webhook Secret |
| D2 | ~~R2 桶创建~~ | ✅ 已完成（双桶已填充） |
| D3 | Creem Webhook Secret 配置 | `wrangler secret put CREEM_WEBHOOK_SECRET` |
| D4 | Resend 生产域名验证 | 验证 `sendafun.com` 后改 from 地址 |
| D5 | 端到端测试 | 部署完成后：checkout → 支付 → webhook → 授权 |

---

### 25.4 后续开发优先级

**第一批（P0 前端修复）：**
1. 修复支付流程：前端调 `/api/create-session`，拿到 checkout_url 跳转
2. 统一 API 字段名（参考本文档 Section 5）
3. 加 Cookie 同意横幅（GDPR 合规）
4. user_token 改 Cookie 传递，移除 URL 参数
5. Canvas 加 `aria-label` / `role="img"` / 焦点管理

**第二批（部署 + 测试）：**
1. 创建 R2 桶（`sendafun-originals` + `sendafun-preview`）
2. `wrangler deploy`
3. Creem 后台填 Webhook URL
4. 端到端测试

**第三批（P1 合规）：**
1. CSRF 保护
2. COPPA 年龄门控
3. 数据删除接口
4. 颜色对比度检查

---

### 25.5 关键凭证汇总（代码集成用）

| 项目 | 值 | 所在文件 |
|------|-----|---------|
| Store ID | `sto_5CSCNwFCgLO6F2XAZ8ZJlD` | `products-config.json` |
| Creem API Key | `creem_test_7deQTeY7iE1fapgeaiLQ1u` | `.env` + Wrangler Secret |
| 按次付费 Product ID | `prod_7GGx4Gh5yvKLOb0OCzYFoq` | `products-config.json` |
| 月订阅 Product ID | `prod_3xVdtK0wdzqLlaCz4H7lzQ` | `products-config.json` |
| 年付 Product ID | `prod_73aCoww3uhNMevKi8NVwNv` | `products-config.json` |
| Resend API Key | `re_E4415y28_KngTFm6AxsSDfU1Ei24cAb32` | `.env` + Wrangler Secret |
| KV Namespace ID | `7cd3408c3caf4fe9948cd156f6883acb` | `wrangler.toml` |
| CF Zone ID | `80ab5a9c4430b4f4c3657dfb5b94ff18` | Cloudflare Dashboard |

---

### 25.6 开发环境启动检查清单

接续开发时，先确认：

- [ ] `.env` 文件存在且包含所有 API Key
- [ ] `node --version` ≥ 18（Worker 代码使用 fetch API）
- [ ] `wrangler --version` ≥ 3（已登录：`wrangler whoami`）
- [ ] Cloudflare 账号 R2 已开通（或 R2 桶已手动创建）
- [ ] 本地测试：`wrangler dev --local`（模拟 Worker 环境）

---

## 附录：文档变更记录

| 日期 | 变更 |
|------|------|
| 2026-06-27 | 原始产品文档创建 |
| 2026-06-28 | 新增第 19 章：欧美付费用户产品挑刺清单（UX+功能缺口）—— 从用户旅程5阶段系统挑刺，含竞品对标+移动端专项+定价心理分析 |
| 2026-06-28 | **重构 Section 10.1：Canvas 高级编辑功能规格（多层文字/特效/贴纸库/实时预览/图层管理）** |
| 2026-06-28 | **新增第 20 章：AdSense 内容要求 & 页面文字量规范（首页500+字/分类页300+字/必需静态页）** |
| 2026-06-28 | 代码审计 30 项 + 文档差距分析 + 安全审计采纳 → 合并为本文档 |
| 2026-06-28 | MailChannels → Resend；R2 24h → 5min；明文邮箱 → user_token；免费卡 3→1；卡片 TTL 10d→30d |
| 2026-06-28 | 新增第 17 章：素材管理规格；对应 sendafun-asset-manager skill |
| 2026-06-28 | 新增第 18 章：欧美挑刺清单（GDPR/COPPA/CSRF/ADA/退款政策/Token安全/Git体积） |
| 2026-06-28 | **新增第 21 章：第二轮产品挑刺（老年用户+企业用户+竞品深挖）—— 65+用户无障碍/批量发送/照片拼贴/视频贺卡** |
| 2026-06-28 | **新增第 22 章：第三轮产品挑刺（Z世代+收件人视角+分享便利性）—— og:image/IG Stories/WhatsApp Status/收件人转发** |
| 2026-06-28 | **新增第 23 章：裂变增长机制设计（Viral Loop）—— 8 种裂变方式/Branding水印/推荐奖励/群签贺卡/K-Factor** |
| 2026-06-28 | **新增 Section 4.6：双桶设计考量（安全边界/成本分析/竞品对标）** |
| 2026-06-28 | **新增第 24 章：分享功能补全（Sharing Platform Coverage）—— WhatsApp/IG Stories/Email/OG协议/分享数据追踪** |
| 2026-06-28 | **新增第 25 章：当前开发进度 & 后续 TODO——代码完成度/已完成事项/未完成P0P1清单/后续优先级/凭证汇总/启动检查清单** |
| 2026-06-29 | **R2 双桶创建+素材填充**：sendafun-preview (7,163 WebP) + sendafun-originals (3,879 原图)；5层去重流水线全量处理；网站改用 R2 CDN 图片；CF Pages 部署上线 sendafun.com |
| 2026-06-29 | 新增第26章：图片去重处理（多层流水线）、第27章：KV素材追踪系统 & 低绩效图片替换、第28章：每张卡片页唯一 SEO 方案 |
| 2026-06-29 | **R2 CORS 配置修复**：卡片详情页 Canvas `crossOrigin='Anonymous'` 需要 CORS，R2 桶配置后 `Access-Control-Allow-Origin: *` 生效 |

---

## 26. 图片去重处理（多层流水线）

> **问题**：Pexels 源图被多个贺卡网站使用，Google 通过感知哈希（pHash）识别雷同图，权重低的站点会被降权。
> **目标**：让每张输出图的 pHash 与原始 Pexels 图彻底不同，同时保持视觉质量。
> **触发**：上线前必须完成，否则 SEO 受罚。

### 26.1 当前处理流程（不足）

现有 `process-images.py` 只做 HSL 偏移 + 中心裁剪，pHash 差异不够。

### 26.2 多层去重流水线设计

```
源图（Pexels JPG）
  ↓
① 主体感知裁剪（不用中心裁剪）
  ↓
② HSL 随机偏移（加强版）
  ↓
③ 微纹理叠加（人眼不可见，pHash 变）
  ↓
④ 随机镜像翻转（50% 概率）
  ↓
⑤ WebP 随机编码参数
  ↓
输出 WebP（同显示 ID，内容已变）
```

### 26.3 各层实现说明

| 层 | 做法 | PIL 实现 | 参数范围 |
|----|------|----------|----------|
| ① 主体裁剪 | 计算图像熵（边缘密度），找视觉重心，偏裁 5-15% | `ImageFilter.FIND_EDGES` + 区域熵计算 | 偏移量随机 5-15% |
| ② HSL 加强 | 当前 ±15 太小，扩为 ±20-30 色相，饱和度 ±20% | `ImageEnhance.Color/Brightness/Contrast` | H:±25, S:±20%, L:±10%, C:±15% |
| ③ 微纹理 | 叠加 3-5% 透明度的单像素噪点层，或极轻高斯模糊 | `ImageFilter.GaussianBlur(0.3)` + 噪点层 | 透明度 3-5%，模糊半径 0.3px |
| ④ 随机镜像 | 水平翻转 50% 概率 | `img.transpose(Image.FLIP_LEFT_RIGHT)` | 50% 随机 |
| ⑤ 编码差异 | WebP quality 和 method 随机化 | `img.save(quality=rand, method=rand)` | quality: 80-90, method: 4-6 |

### 26.4 修改后的 `process-images.py` 核心函数

```python
import random, PIL.ImageFilter as F

def enhanced_process(img):
    """多层去重处理，返回处理后的 PIL Image"""
    img = img.convert("RGB")
    
    # ① 主体感知裁剪（简化版：计算各象限熵，选最高区域偏移裁剪）
    img = smart_crop(img)
    
    # ② HSL 加强偏移
    img = ImageEnhance.Color(img).enhance(random.uniform(0.8, 1.2))
    img = ImageEnhance.Brightness(img).enhance(random.uniform(0.9, 1.1))
    img = ImageEnhance.Contrast(img).enhance(random.uniform(0.85, 1.15))
    # RGB 通道偏移
    r, g, b = img.split()
    r = r.point(lambda x: max(0, min(255, x + random.randint(-25, 25))))
    g = g.point(lambda x: max(0, min(255, x + random.randint(-12, 12))))
    b = b.point(lambda x: max(0, min(255, x + random.randint(-12, 12))))
    img = Image.merge("RGB", (r, g, b))
    
    # ③ 微纹理：极轻高斯模糊 + 噪点层
    img = img.filter(F.GaussianBlur(0.3))
    # 叠加噪点层（实现略，见完整脚本）
    
    # ④ 随机镜像
    if random.random() > 0.5:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    
    return img

def smart_crop(img, target_w, target_h):
    """简化主体裁剪：计算图像各区域熵，偏移裁剪中心"""
    # 计算边缘图
    edges = img.filter(F.FIND_EDGES)
    # 将图分为 3x3 网格，计算每格平均亮度/边缘密度
    # 选择密度最高的区域作为视觉重心，偏移裁剪框
    # （完整实现见 process-images-v2.py）
    return crop_center(img, target_w, target_h)  # 暂回退到中心裁剪
```

### 26.5 文件名与 ID 体系

**显示 ID 永久不变**，源图可替换：

```
源图目录：pexels-10165858.jpg
    ↓ 多层处理
输出文件：birthday-10165858-00-horizontal.webp
              ^^^^^^^^^^^^^^^^
              显示 ID（永久不变，SEO 依赖此文件名）

替换时：
  删除/归档旧源图
  放入新源图，命名为 pexels-10165858.jpg（复用 ID）
  重新处理 → 输出同名 WebP → R2 覆盖上传
  HTML 页面引用的文件名不变 → SEO 零影响
```

### 26.6 实施步骤（2026-06-29 更新）

1. ✅ 重写 `build-script/process-images-v2.py`（5层去重流水线 + pexels-tags.json 导出）
2. ⏳ 对现有素材重新处理，对比 pHash 变化（需先安装 `imagehash` 库）
3. ⏳ 全部重新处理（2990+ 张源图），增量模式跳过已存在
4. ⏳ 上传到 R2（覆盖 `sendafun-preview` 桶）

> **当前状态**：`process-images-v2.py` 已就绪，增量处理模式默认跳过已存在文件。使用 `--force` 可强制重新处理全部素材。新版 `--tags-only` 模式可单独生成 pexels-tags.json。

---

## 27. KV 素材追踪系统 & 低绩效图片替换

> **背景**：预计素材总量 ~10 万张，用 JSON 文件管理会成巨无霸，查询慢、替换难。
> **方案**：用 Cloudflare KV 存储每张素材的元数据，显示 ID 作 Key，支持单条读写、批量筛选、快速替换。
> **参考**：见用户提供的 KV 方案说明（2026-06-29）。

### 27.1 KV 存储结构设计

**命名空间**：`SENDAFUN_ASSETS`（新建，与现有 KV 分离）

**Key 格式**：`asset:{category}:{display_id}`

**Value 结构（JSON）**：

```json
{
  "display_id": "birthday-10165858",
  "pexels_id": "10165858",
  "category": "birthday",
  "orientations": ["horizontal", "square", "vertical"],
  "r2_preview_paths": {
    "horizontal": "birthday-10165858-00-horizontal.webp",
    "square": "birthday-10165858-00-square.webp",
    "vertical": "birthday-10165858-00-vertical.webp"
  },
  "r2_original_path": "birthday-10165858-00-original.png",
  "upload_date": "2026-06-29",
  "last_replaced": null,
  "replace_count": 0,
  "views": 0,
  "bounce_rate": null,
  "avg_dwell_seconds": null,
  "revenue_generated": 0,
  "status": "active"
}
```

**辅助索引 Key**（用于批量筛选）：

| Key | Value | 用途 |
|-----|-------|------|
| `idx:low-perf:{category}` | JSON 数组：`[{display_id, views, bounce_rate}, ...]` | 快速获取低绩效列表 |
| `idx:all-ids:{category}` | JSON 数组：全部 display_id 列表 | 批量操作 |
| `meta:total-count` | 整数：全站素材总数 | 仪表盘显示 |

### 27.2 从现有系统迁移到 KV

**现有数据来源**：
- `source/images/{category}/` 目录下的 WebP 文件名
- `cards-config.json` 中的卡片配置

**迁移脚本** `build-script/migrate-to-kv.py`：

```python
# 伪代码
1. 遍历 source/images/ 每个分类目录
2. 解析每个文件名：{category}-{pexels_id}-00-{orientation}.webp
3. 对同一 pexels_id 的三个 orientation 合并为一条记录
4. 写入 KV：key = asset:{category}:{pexels_id}
5. 同时维护 idx:all-ids:{category} 列表
6. 完成后打印统计：共迁移 N 条记录
```

**写入 KV 方式**：通过 Workers KV API 或 `wrangler kv bulk put`

### 27.3 低绩效图片替换流程

**触发条件**（定期手动或自动化）：

| 指标 | 阈值 | 说明 |
|------|------|------|
| `views`（月） | < 10 | 无人访问 |
| `bounce_rate` | > 70% | 跳出率高 |
| `avg_dwell_seconds` | < 10s | 停留时间短 |
| `revenue_generated` | = 0（3个月） | 从未产生收入 |

**替换脚本** `build-script/replace-low-perf.py`：

```
输入：分类名（或 "all"）+ 阈值参数
输出：替换报告（CSV）

步骤：
1. 从 KV 读取 idx:low-perf:{category}（或全量扫描所有 asset:* key）
2. 按条件筛选低绩效 display_id 列表
3. 对每个低绩效 ID：
   a. 从 Pexels API 搜索同分类新图（不同 pexels_id）
   b. 下载新源图到 temp/{category}/
   c. 运行 process-images-v2.py 处理新图
   d. 上传到 R2：
      - preview 桶：覆盖同名 WebP 文件
      - originals 桶：覆盖同名 PNG 文件
   e. 更新 KV 中该条记录：
      - replace_count + 1
      - last_replaced = 今天日期
      - views 重置为 0（重新开始计数）
      - 保留原 display_id 不变
   f. 清除 R2 CDN 缓存（该文件路径）
4. 生成替换报告：
   - 旧 pexels_id → 新 pexels_id
   - 原 upload_date / 新 last_replaced
   - 替换前 views / bounce_rate
```

### 27.4 CDN 缓存清除策略

R2 公开桶（`sendafun-preview`）的文件被 CDN 缓存，覆盖后需要清除缓存。

**方案 A（推荐）**：文件名加版本参数
```
原文件：birthday-10165858-00-horizontal.webp
HTML 引用：birthday-10165858-00-horizontal.webp?v=1
替换后：HTML 引用?v=2（KV 中存储当前 version）
```

**方案 B**：Cloudflare API 清除缓存
```
POST /client/v4/zones/{zone_id}/purge_cache
Body: {"files": ["https://pub-xxx.r2.dev/birthday-10165858-00-horizontal.webp"]}
```
需在 Worker 中调用，或手动在 Dashboard 操作。

**最终选型**：方案 A（版本参数），无需额外 API 调用，CDN 自动拉取新版本。

→ KV 存储中增加字段 `"version": 1`，替换时 version + 1，前端从 KV 读取 version 拼到 URL。

### 27.5 KV 读写代码（Worker 侧）

**读取素材元数据**（Worker `index.js` 新增接口）：

```javascript
// GET /api/asset/{category}/{display_id}
// 返回 KV 中该素材的完整元数据
app.get('/api/asset/:cat/:id', async (req) => {
  const key = `asset:${req.params.cat}:${req.params.id}`;
  const data = await ASSETS.get(key, 'json');
  if (!data) return new Response('Not found', { status: 404 });
  return Response.json(data);
});
```

**批量获取低绩效列表**（Worker 侧）：

```javascript
// GET /api/assets/low-perf?category=birthday&max_bounce=70&min_views=10
app.get('/api/assets/low-perf', async (req) => {
  const { category, max_bounce, min_views } = req.query;
  const idxKey = `idx:low-perf:${category}`;
  const list = await ASSETS.get(idxKey, 'json') || [];
  const filtered = list.filter(a =>
    a.bounce_rate > max_bounce || a.views < min_views
  );
  return Response.json(filtered);
});
```

### 27.6 新增分类标准化流程

**脚本** `build-script/add-category.py`：

```bash
python add-category.py --name "sympathy" --display-name "Sympathy" --pexels-query "sympathy card condolence" --count 30
```

**自动完成**：
1. 在 `E:\网站项目\素材\source\` 创建分类目录
2. 调用 Pexels API 搜索并下载 `--count` 张源图（宽高比过滤：至少 1000px 短边）
3. 运行 `process-images-v2.py` 处理（多层去重）
4. 上传到 R2 `sendafun-preview` 桶
5. 写入 KV：每条素材的 `asset:{cat}:{id}` 记录
6. 更新 `idx:all-ids:{category}` 列表
7. 在 `cards-config.json` 追加分类配置
8. 运行 `generate-cards.js` 生成卡片 HTML
9. 输出部署检查清单

### 27.7 实施优先级

| 优先级 | 任务 | 阻塞原因 |
|--------|------|----------|
| P0 | 重写 `process-images-v2.py`（多层去重） | 上线前必须 |
| P0 | 迁移现有素材元数据到 KV | 替换功能依赖 |
| P1 | 写 `replace-low-perf.py` 替换脚本 | 上线后持续优化 |
| P1 | Worker 新增 `/api/asset/` 读取接口 | 前端动态读取素材元数据 |
| P2 | 写 `add-category.py` 新增分类脚本 | 扩品类时用 |
| P2 | KV 中增加 `version` 字段 + CDN 缓存版本化 | 替换功能完整闭环 |

---

> **写代码前必读此文档。API 字段名、KV key、TTL 值以此为准，不要看旧代码。**
> **第 18 章挑刺问题需在代码实现前逐一确认修复状态。**
> **第 26-27 章为 2026-06-29 新增：图片去重流水线 + KV 素材追踪系统。**

---



---

## 28. 每张卡片页唯一 SEO 方案（Title/Description/OG）【待确认细节】

### 28.1 核心原则

| 原则 | 说明 |
|------|------|
| **display_id 永久不变** | 图片可替换（R2 覆盖 + version 升级），但 URL 永远不变，SEO 权重不丢失 |
| **每张卡片页唯一内容** | Title / Description / OG tags 不与任何其它卡片页重复 |
| **内容来源** | Pexels 标签 + 模板组合生成，不依赖 AI API（节省成本） |
| **KV 存储** | SEO 字段存在 `asset:{category}:{display_id}` 记录中 |

### 28.2 KV 存储结构（新增 SEO 字段）

```json
{
  "display_id": "birthday-10165858",
  "pexels_id": "10165858",
  "r2_preview_paths": {
    "horizontal": "birthday-10165858-00-horizontal.webp",
    "vertical": "birthday-10165858-00-vertical.webp",
    "square": "birthday-10165858-00-square.webp"
  },
  "upload_date": "2026-06-29",
  "last_replaced": null,
  "replace_count": 0,
  "views": 0,
  "bounce_rate": null,
  "version": 1,
  "seo": {
    "title": "Funny Birthday Card for Best Friend - SendAFun",
    "description": "Make them laugh with this funny birthday card. Personalize with your own text, preview instantly, and send directly to their inbox. Only $1.99.",
    "og_image": "birthday-10165858-00-horizontal.webp",
    "keywords": ["birthday card", "funny birthday", "send card online"],
    "h1": "Funny Birthday Card for Best Friend",
    "intro_text": "Looking for the perfect funny birthday card? This design features a cheerful cake theme and is ready to personalize in 2 minutes."
  }
}
```

### 28.3 SEO 内容生成规则（Pexels 标签 + 模板）

**数据来源（Pexels API 返回）**：
```json
{
  "pexels_id": 10165858,
  "tags": ["birthday", "cake", "celebration", "happy", "party"],
  "photographer": "Jane Smith",
  "avg_color": "#FFD700"
}
```

**Title 模板（随机选 1 条，确保同分类不重复）**：

| 模板 | 示例输出 |
|------|----------|
| `{tag1} {category} for {audience} - SendAFun` | `Funny Birthday Card for Best Friend - SendAFun` |
| `Send a {tag1} {category} Online - ${price}` | `Send a Funny Birthday Card Online - $1.99` |
| `Personalized {tag1} {category} | SendAFun` | `Personalized Funny Birthday Card \| SendAFun` |
| `{tag2} Theme {category} - Custom & Fast` | `Cake Theme Birthday Card - Custom & Fast` |

> Title 长度控制在 **50-60 字符**，避免被 Google 截断。

**Description 模板（随机选 1 条）**：

| 模板 |
|------|
| `Make them smile with this {tag1} {category}. Personalize with your text, preview instantly, and send online. Only $1.99.` |
| `Create a custom {tag1} {category} in 2 minutes. Add your message, choose font & color, and deliver directly to inbox.` |
| `The perfect {tag1} {category} for {tag2} lovers. Mobile-friendly editor, instant preview, $1.99 one-time.` |

> Description 长度控制在 **120-155 字符**，避免被截断。

**H1 + Intro Text 模板**：

H1 与 Title 不同（避免关键词堆砌），Intro Text 约 150-200 词，为 AdSense 提供足够内容。

### 28.4 卡片页 HTML 模板（SEO 部分）

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta -->
  <title>{{seo.title}}</title>
  <meta name="description" content="{{seo.description}}">
  <meta name="keywords" content="{{seo.keywords | join}}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="{{seo.title}}">
  <meta property="og:description" content="{{seo.description}}">
  <meta property="og:image" content="https://pub-xxx.r2.dev/{{seo.og_image}}">
  <meta property="og:url" content="https://sendafun.com/cards/{{category}}/{{display_id}}.html">
  <meta property="og:type" content="product">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{{seo.title}}">
  <meta name="twitter:description" content="{{seo.description}}">
  <meta name="twitter:image" content="https://pub-xxx.r2.dev/{{seo.og_image}}">
  
  <!-- Canonical -->
  <link rel="canonical" href="https://sendafun.com/cards/{{category}}/{{display_id}}.html">
  
  <!-- Schema.org Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "{{seo.h1}}",
    "description": "{{seo.description}}",
    "image": "https://pub-xxx.r2.dev/{{seo.og_image}}",
    "offers": {
      "@type": "Offer",
      "price": "1.99",
      "priceCurrency": "USD"
    }
  }
  </script>
</head>
<body>
  <h1>{{seo.h1}}</h1>
  <p class="intro-text">{{seo.intro_text}}</p>
  <!-- Canvas 编辑器 below -->
</body>
</html>
```

### 28.5 构建时生成 SEO（Python 脚本）

**脚本**：`build-script/generate-seo.py`

```python
import json, random

TITLE_TEMPLATES = [
    "{tag1} {category} for {audience} - SendAFun",
    "Send a {tag1} {category} Online - $1.99",
    "Personalized {tag1} {category} | SendAFun",
    "{tag2} Theme {category} - Custom & Fast",
]
AUDIENCES = ["Best Friend", "Mom", "Dad", "Colleague", "Partner", "Family"]

def generate_seo(pexels_tags, category, display_id):
    tag1 = pexels_tags[0] if pexels_tags else category
    tag2 = pexels_tags[1] if len(pexels_tags) > 1 else tag1
    audience = random.choice(AUDIENCES)
    
    title = random.choice(TITLE_TEMPLATES)\
        .replace("{tag1}", tag1.title())\
        .replace("{tag2}", tag2.title())\
        .replace("{category}", category.title())\
        .replace("{audience}", audience)
    
    description = f"Make them smile with this {tag1} {category}. Personalize with your text, preview instantly. Only $1.99."
    
    return {
        "title": title[:60],
        "description": description[:155],
        "og_image": f"{display_id}-00-horizontal.webp",
        "keywords": pexels_tags[:5],
        "h1": title.replace(" - SendAFun", ""),
        "intro_text": f"Looking for the perfect {tag1} {category.lower()}? ..."
    }
```

### 28.6 已确认细节（✅ 2026-06-29 确认）

| # | 细节 | 确认方案 | 理由 |
|---|------|----------|------|
| 1 | **SEO 文案生成方式** | ✅ **Pexels 标签 + 模板**（免费） | 10万张省 $200，Pexels 标签质量够用 |
| 2 | **OG 图片方案** | ✅ **单独生成 OG 图**（1200×630px WebP） | CTR 更高，多存一张 WebP 成本可忽略 |
| 3 | **多语言 SEO** | ✅ **仅英文**（sendafun.com 主域） | 暂不做 ES/FR，先跑通英文版 |
| 4 | **Intro Text 长度** | ✅ **扩充到 300+ 词** | AdSense 审核要求每页有实质内容 |
| 5 | **Canonical URL 策略** | ✅ **不带 `?v=` 参数** | 最佳实践，确保权重集中 |
| 6 | **图片替换后 SEO 是否更新** | ✅ **不更新**（display_id 不变） | SEO 稳定更有利于长期排名 |
| 7 | **结构化数据类型** | ✅ **`Product`**（不改） | 适合电商/付费场景，富摘要展示价格 |

> OG 图命名规则：`{display_id}-og.webp`，存入 `sendafun-preview` 桶，URL 格式 `https://pub-xxx.r2.dev/{display_id}-og.webp`

### 28.7 实施步骤（2026-06-29 更新）

| Step | 内容 | 状态 |
|-------|------|------|
| 1 | 确认 28.6 细节 → 定稿 SEO 模板 | ✅ 已确认 |
| 2 | 写 generate-seo.py（批量生成 SEO 字段 + OG 图） | ✅ 已完成 |
| 3 | 更新 card-template.html（SEO meta / Schema.org / intro text） | ✅ 已完成 |
| 4 | 更新 generate-cards.js（读取 card.seo 字段） | ✅ 已完成 |
| 5 | 添加 .seo-intro CSS 样式 | ✅ 已完成 |
| 6 | process-images-v2.py（5层去重 + pexels-tags.json 导出） | ✅ 已完成 |
| 7 | 批量回填现有素材 SEO 数据（12 张卡片，300+ 词） | ✅ 已完成 |
| 8 | KV 导入脚本（cards-kv-bulk.json + API 导入） | ✅ 已完成 |
| 9 | 测试 generate-cards.js 渲染（--sample=3，全部通过） | ✅ 已完成 |
| 10 | 提交 Google Search Console Sitemap | ⏳ 上线后执行 |
| 11 | 图片重新处理（5层去重流水线应用到现有素材） | ⏳ 按需（素材量大，增量模式） |

### 28.8 已生成文件清单（2026-06-29）

| 文件 | 说明 |
|------|------|
| `build-script/generate-seo.py` | SEO 字段生成 + OG 图生成（Pillow 可选），300+ 词 intro text ✅ |
| `templates/card-template.html` | SEO meta / Canonical / Schema.org / intro text + `.seo-intro` CSS ✅ |
| `build-script/generate-cards.js` | `generateCardHtml()` 读取 `card.seo`，8 个 placeholder 全部替换 ✅ |
| `build-script/process-images-v2.py` | 5层去重流水线 + pexels-tags.json 生成 ✅ |
| `source/pexels-tags.json` | 12 张卡片标签（category 词库 + title 关键词 + card.tags） |
| `source/cards-seo.json` | SEO 数据独立文件（供 Worker KV 批量导入） |
| `source/cards-kv-bulk.json` | Cloudflare KV bulk put 格式（wrangler 或 API 导入） |
| `build-script/kv-import.py` | KV 导入工具（--generate / --import / --stats） |

### 28.9 KV 导入方法

```bash
# 方法1：wrangler CLI（推荐，需先 wrangler login）
cd E:\网站项目\sendafun
wrangler kv:bulk put --namespace-id=7cd3408c3caf4fe9948cd156f6883acb source/cards-kv-bulk.json

# 方法2：Python API（需 CF_API_TOKEN 环境变量）
python build-script/kv-import.py --import
```

> KV Key 格式: `asset:{category}:{slug}` (如 `asset:birthday:beautiful-birthday-mom`)

---

> **第 28 章为 2026-06-29 新增：每张卡片页唯一 SEO 方案（Title/Description/OG Tags）。**
> **✅ Steps 1-9 已完成，仅剩 Sitemap 提交（上线后执行）。**
