# Debug Session: discover-card-images-black
- **Status**: [OPEN] 🔧 FIX APPLIED + AWAITING POST-FIX VERIFICATION
- **Issue**: Discover 页预览的卡片图显示为黑色/未加载成功，用户反馈素材加载异常
- **Debug Server**: http://127.0.0.1:7777/health (运行中，IDE预览沙箱拦截上报)
- **Log File**: .dbg/trae-debug-log-discover-card-images-black.ndjson (0条 - 沙箱拦截)

## Reproduction Steps
1. 启动本地预览服务器 `node _server.js` (localhost:3000)
2. 浏览器访问 http://localhost:3000/discover
3. 等待卡片列表加载完毕
4. 观察卡片缩略图：大量黑块 / visibility="hidden" (onerror 直接隐藏)

## Hypotheses & Verification (FINAL)
| ID | Hypothesis | Likelihood | Effort | Verdict | Evidence Chain |
|----|------------|------------|--------|---------|----------------|
| A | IDE 内嵌预览浏览器 ORB 拦截 pub-*.r2.dev webp → 假阳性 | High | Low | ❌ REJECTED | 独立 Python HEAD 验证：79.2% = 真实 404，text/plain CL=0，非浏览器拦截 |
| B | D1 的 bgImageWatermark URL → R2 Preview 桶 key 不存在 → 404 | Med | Low | ✅ CONFIRMED ROOT CAUSE | 192卡跨8页采样：wm_404=152 (79.2%)，wm_ok=39；桶内真实key：250采样100% = `{cat}/{cat}-pexels-{N}-v2-vertical.webp` 且只含pexels |
| C | r2.dev CDN 防盗链(Referer/UA)阻断localhost | Med | Low | ❌ REJECTED | 三参照(空Referer / localhost / sendafun.com)全部 404 |
| D | 应该走同源 Worker /api/r2-image 代理而非r2.dev直链 | Med | Med | ❌ REJECTED | Worker代理(3种传参方式path/?url/?k)同样404：key在桶里不存在 |
| E | 前端renderCardTile写错img.src字段 | Low | Low | ❌ REJECTED | src顺序=bgImage/bgImageWatermark/R2_BASE已知图 完全正确；wm_same_as_bg=100%说明两字段不是拼写错 |

## Root Cause Chain (Confirmed via Python 4 probes)
1. **D1完整性灾难**：11,067 条模板中约 79% 的 `bgImageWatermark = bgImage` = 同一个不存在于任何R2桶的key
2. **格式错因**：D1中写入的 pexels 编号 (如 sorry 6935080, fathers-day 4543660/4545620/30012179/5791248/33270804) 在 Preview 和 Originals 两桶均不存在；有效编号区间来自实际桶采样：anniversary > 33629667/5705991/8014883, birthday > 8014697, christmas 8014697-100万+ 区间
3. **误触发 A**：404 响应 `text/plain CL=0` 在 `<img>` 标签下触发 Chromium ORB 二次拦截，让开发者误以为是跨域问题
4. **前端掩盖**：`onerror = visibility=hidden` 直接变全黑块 → 用户完全看不到问题根因

## Log Evidence (Independent Python probes, n=192 + 7 debug URLs + 2 buckets × 3000 sampled keys)
```
wm_404 rate    : 79.2% (152/192 cards, 8 pages across depth 1/2/3/5/10/20/50/99)
both_404 rate  : 79.2% (bgImage == bgImageWatermark for 100% of cards)
wm_ext         : 100% webp
categories     : sympathy 100% bad / fathers-day 84% / valentine 87.5% / friendship 79.2% / christmas 75% / sorry 13.3%
PREVIEW bucket pattern (250 sampled) : {cat}/{cat}-pexels-{N}-v2-vertical.webp  (100% webp, 100% v2, 100% pexels, 0% pixabay/unsplash)
ORIGINALS bucket pattern (750 sampled): same webp + sister PNG {cat}/pexels-{N}.png (1:1 mapping)
```

## Fix Strategy (Two-pronged)
### 🔧 Backend (Worker D1 response post-processing)
- **Goal**: 让 `/api/cards` / `/api/cards/:slug` 响应中的 bgImageWatermark / bgImage **100% 为真实存在的 R2 key URL**
- **Mechanics**:
  1. `KNOWN_GOOD_PER_CATEGORY`: 硬编码每分类 15–20 个确认存在的 pexels-{N} 编号（源自真实桶 HEAD 批量探测）
  2. `resolveGoodImage(card)`: 抽 key → 分类 → 如不符合新格式或编号不在白名单 → `hash(slug|key) % N_pool` 选确定性兜底编号
  3. Post-process `/api/cards` 24 list + `/api/cards/:slug` detail 的两个字段
  4. 重写后：Preview = `{cat}/{cat}-pexels-{GOOD_ID}-v2-vertical.webp` (watermarked webp)，Originals = `{cat}/pexels-{GOOD_ID}.png` (PNG母版)
  5. URL前缀继续使用 `https://pub-*.r2.dev/` 公网CDN

### 🔧 Frontend (Double insurance)
- `renderCardTile` 的 onerror 不再 `visibility:hidden`
- 改为调用 Worker 兜底逻辑或确定性分类占位（渐变+emoji+标题）

## Verification Conclusion
[待 post-fix 部署验证：79%坏→0%坏]
