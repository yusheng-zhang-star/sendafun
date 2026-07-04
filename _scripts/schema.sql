-- =============================================
-- SendAFun Cards — Cloudflare D1 Schema
-- 使用方法（CF Dashboard 创建完 D1 DB + 填完 wrangler.toml database_id 之后）：
--   wrangler d1 execute sendafun-cards --remote --file=_scripts/schema.sql
-- =============================================

-- ---------- 主表：卡片元数据 ----------
CREATE TABLE IF NOT EXISTS cards (
  slug                TEXT PRIMARY KEY NOT NULL,
  title               TEXT NOT NULL,
  category            TEXT NOT NULL,
  tags                TEXT NOT NULL DEFAULT '[]',       -- JSON 数组
  style               TEXT,
  bg_image            TEXT NOT NULL,
  bg_image_watermark  TEXT NOT NULL,
  default_text        TEXT NOT NULL,
  default_font        TEXT NOT NULL,
  default_color       TEXT NOT NULL,
  default_filter      TEXT,
  aspect_ratio        TEXT NOT NULL DEFAULT '3/4',
  og_image            TEXT,
  pexels_id           TEXT NOT NULL DEFAULT '',         -- Pexels 素材 ID，用于从 sendafun-originals 桶取高清原图
  emotional_tags      TEXT NOT NULL DEFAULT '[]',       -- Step4 §148: 人际情感标签 JSON 数组，e.g. ["浪漫","感激"]
  envelope_style_id   TEXT NOT NULL DEFAULT '',         -- Step4 §148: 信封样式 ID（预设值，DOC §12 定义）
  geo_country_target  TEXT NOT NULL DEFAULT '[]',       -- Step4 §148: 目标国家 ISO 3166-1 alpha-2 JSON 数组（默认空占位 []，后续用 --include-geo-defaults 填充）
  seo                 TEXT NOT NULL DEFAULT '{}',       -- JSON 对象 {title, description, h1, keywords, intro_text, og_image}
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ---------- 索引：覆盖 99% 筛选场景 ----------
CREATE INDEX IF NOT EXISTS idx_cards_category      ON cards(category);
CREATE INDEX IF NOT EXISTS idx_cards_style         ON cards(style);
CREATE INDEX IF NOT EXISTS idx_cards_created_at    ON cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cards_cat_created   ON cards(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cards_style_created ON cards(style, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cards_pexels_id     ON cards(pexels_id);

-- ---------- 全文搜索（FTS5）：title / default_text / tags 可搜 ----------
CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
  title,
  default_text,
  tags,
  category UNINDEXED,
  style UNINDEXED,
  slug UNINDEXED,
  content='cards',
  content_rowid='rowid',
  tokenize='porter unicode61 remove_diacritics 1'
);

-- ---------- FTS 触发器：增删改自动同步 ----------
CREATE TRIGGER IF NOT EXISTS cards_ai AFTER INSERT ON cards BEGIN
  INSERT INTO cards_fts(rowid, title, default_text, tags, category, style, slug)
  VALUES (new.rowid, new.title, new.default_text, new.tags, new.category, new.style, new.slug);
END;

CREATE TRIGGER IF NOT EXISTS cards_ad AFTER DELETE ON cards BEGIN
  INSERT INTO cards_fts(cards_fts, rowid, title, default_text, tags, category, style, slug)
  VALUES ('delete', old.rowid, old.title, old.default_text, old.tags, old.category, old.style, old.slug);
END;

CREATE TRIGGER IF NOT EXISTS cards_au AFTER UPDATE ON cards BEGIN
  INSERT INTO cards_fts(cards_fts, rowid, title, default_text, tags, category, style, slug)
  VALUES ('delete', old.rowid, old.title, old.default_text, old.tags, old.category, old.style, old.slug);
  INSERT INTO cards_fts(rowid, title, default_text, tags, category, style, slug)
  VALUES (new.rowid, new.title, new.default_text, new.tags, new.category, new.style, new.slug);
END;


-- =============================================
-- ✅ 一次性回填：已存在 cards 表（3885 张迁移过的卡）加列 + 填 pexels_id
-- =============================================
-- 加列（IF NOT EXISTS 在旧版 SQLite 不支持，D1 会自动处理重复报错的话就单独执行下面一行）
-- ALTER TABLE cards ADD COLUMN pexels_id TEXT NOT NULL DEFAULT '';
-- 回填：从 slug 最后一段解析数字作为 pexels_id，不是数字则留空
-- UPDATE cards SET pexels_id = (
--   CASE WHEN substr(slug, length(slug) - instr(reverse(slug), '-') + 2) GLOB '[0-9]*'
--        THEN substr(slug, length(slug) - instr(reverse(slug), '-') + 2)
--        ELSE '' END
-- ) WHERE pexels_id = '' OR pexels_id IS NULL;
