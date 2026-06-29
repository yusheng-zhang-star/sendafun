#!/usr/bin/env node
/**
 * process-images.js
 * 处理贺卡素材：HSL偏移 → 裁剪三个比例(square/vertical/horizontal) → 输出WebP
 * 
 * 输入：E:\网站项目\素材\source\{category}\  (原图 jpg/png)
 * 输出：E:\网站项目\sendafun\source\images\{category}\{category}-{source_id}-{size}.webp
 * 
 * 增量模式：检查输出文件已存在则跳过
 * 
 * 用法：node process-images.js
 *       node process-images.js --skip-existing  (默认)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const SOURCE_DIR = r"E:\网站项目\素材\source";
const OUTPUT_DIR = r"E:\网站项目\sendafun\source\images";

// 三尺寸
const SIZES = {
  square: { w: 1080, h: 1080 },
  vertical: { w: 1080, h: 1920 },
  horizontal: { w: 1920, h: 1080 },
};

// 支持的图片扩展名
const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// 需要分类映射（素材目录名 → 新项目分类名）
const CAT_MAP = {
  "anniversary": "anniversary",
  "birthday": "birthday",
  "christmas": "christmas",
  "congratulations": "congratulations",
  "easter": "easter",
  "encouragement": "encouragement",
  "fathers_day": "fathers-day",
  "friendship": "friendship",
  "get_well": "get-well",
  "good_luck": "good-luck",
  "graduation": "graduation",
  "halloween": "halloween",
  "love": "love",
  "missing_you": "missing-you",
  "mothers_day": "mothers-day",
  "new_baby": "new-baby",
  "new_year": "new-year",
  "retirement": "retirement",
  "sorry": "sorry",
  "sympathy": "sympathy",
  "thank_you": "thank-you",
  "thanksgiving": "thanksgiving",
  "thinking_of_you": "thinking-of-you",
  "valentine": "valentine",
  "wedding": "wedding",
};
