# SendAFun 开发文档

## 项目概述
电子贺卡网站，用户可自定义文字/字体/颜色后生成贺卡链接分享。

## 目录结构

```
sendafun/
├── source/
│   ├── cards-config.json         # 贺卡配置（12张）
│   └── images/{分类}/            # 三尺寸WebP图（square/vertical/horizontal）
├── build-script/
│   ├── generate-cards.js         # 核心生成器
│   ├── process-images.py         # 图片处理（✅ 可用）
│   └── process-images.js         # 图片处理（❌ 不完整，勿用）
├── templates/
│   ├── card-template.html        # 单卡页模板（55KB）
│   └── segments/                 # 分段模板
├── dist/                         # 构建输出
│   ├── index.html                # 首页
│   ├── category/                 # 分类页
│   └── card/                     # 单卡页
└── worker/                       # Cloudflare Worker
```

## 构建流程

### 1. 图片处理
```bash
python build-script/process-images.py
```
- 输入：`E:\网站项目\素材\source\{分类}\`
- 处理：HSL偏移 + 三尺寸裁剪
- 输出：`source/images/{分类}/{文件名}-{size}.webp`
- 增量模式（已存在的跳过）

### 2. 卡片生成
```bash
node build-script/generate-cards.js          # 增量
node build-script/generate-cards.js --force  # 全量
node build-script/generate-cards.js --sample=3  # 测试
```
- 读取 cards-config.json
- 替换模板占位符
- 输出到 dist/
- 自动生成 index.html + 分类页

## 卡片配置（cards-config.json）
每张卡片包含：
- slug / title / category / tags
- style（warm/classic/romantic/cheerful/calm/celebratory）
- bgImage / bgImageWatermark
- defaultText / defaultFont / defaultColor
- aspectRatio / ogImage

## 当前状态

### ✅ 已完成
- 构建脚本（generate-cards.js + process-images.py）
- 卡模板（含canvas编辑/文字定制/分享功能）
- 首页+分类页+单卡页模板
- 12张卡片配置
- 4个分类图片已处理

### ⏳ 未完成
- 其余11个分类图片未处理
- process-images.js 语法错误
- Cloudflare Pages 部署未配置
