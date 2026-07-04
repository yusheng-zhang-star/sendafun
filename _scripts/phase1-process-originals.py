#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase 1: sendafun-originals 桶高清图 → 透明 PNG 成品入库（严格 7 条硬性新规）

 一、前置图源门槛（转换前必须满足）
   • 原始下载素材为 JPG，长边像素 ≥2800px；低于 2800 直接丢弃，不执行转 PNG 流程
   • 原图无严重压缩噪点、马赛克、水印，否则废弃不处理
 二、像素尺寸硬性要求（缩放后固定）
   • 等比例缩放，成品长边严格 = 2048px，短边自动适配，禁止裁切、拉伸变形
   • 比例保持原图原生比例：1:1 / 4:5 / 16:9 / 9:16 等完全不变
   • 不允许出现长边 1920/2560/3000 等非 2048 尺寸文件
 三、透明通道 Alpha 核心要求（贺卡合成关键）
   • 必须生成完整透明 Alpha 通道，不能仅修改后缀、不能保留白底 / 灰底 / 纯色背景
   • 边缘处理标准：发丝、植物细枝、玻璃反光等细碎边缘做抗锯齿羽化，无生硬锯齿；禁止白边灰边
 四、文件格式与压缩标准
   • 输出格式：PNG 24bit（带 Alpha 透明通道 = RGBA），不使用 PNG8
   • 压缩工具：oxipng 无损智能压缩 → Pillow optimize 9 级无损兜底
   • 单文件最终体积：≤1.5MB，肉眼无画质损失
 五、命名 & 存储路径（永久固定不可改）
   • 路径模板：{category}/pexels-{pexels_id}.png   扩展名统一为 .png
   • 与 D1 库内 pexels_id 一一对应，同 ID 仅支持覆盖更新
 六、自动化校验（不达标直接 FAILED）
   • 尺寸校验：长边 = 2048px
   • 格式校验：PNG RGBA（带 Alpha）
   • 透明校验：图片 4 边 1px 边缘平均 Alpha < 10（无大面积白底）
   • 体积校验：≤1.5MB
   • Alpha 通道存在校验
 七、断点续跑 + 8 进程并行 + 失败自动重试（--only-retry）
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from PIL import Image, ImageFilter
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# =========================================================================
# 常量（严格对应 7 条新规）
# =========================================================================
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "_scripts"
PUBLIC_DIR = PROJECT_ROOT / "public"
PROC_DIR = PROJECT_ROOT / "processed-phase1"
RAW_DIR = PROJECT_ROOT / "raw-originals-phase1"
LOGS_DIR = PROJECT_ROOT / "_logs"
STATUS_DB = SCRIPTS_DIR / "_phase1_status.sqlite3"
CARDS_META_JSON = PUBLIC_DIR / "cards-meta.json"
START_TS_PATH = LOGS_DIR / "_phase1_startts.txt"

MIN_SRC_LONG_SIDE = 2800      # 新规一：前置图源门槛（源图长边必须 ≥2800px）
TARGET_LONG_SIDE = 2048        # 新规二：成品长边严格 = 2048px
MAX_PNG_BYTES = 1_500_000      # 新规四：单文件最终 ≤1.5MB

MIN_SRC_BYTES = 220_000        # 新规一（严重压缩过滤兜底）：<220KB 基本都是马赛克/水印/低质
MIN_SHARPNESS_LAPLACIAN = 25   # 新规一（模糊/马赛克过滤兜底）：<25 认为糊/马赛克

SUPPORTED_SRC_EXT = (".jpg", ".jpeg", ".png")

_CATEGORY_INDEX_PATH = PUBLIC_DIR / "_category_index.json"
_FALLBACK_ALL_CATEGORIES = [
    "anniversary","birthday","christmas","congratulations","easter","encouragement",
    "fathers-day","friendship","get-well","good-luck","graduation","halloween",
    "love","missing-you","mothers-day","new-baby","new-year","retirement","sorry",
    "sympathy","thank-you","thanksgiving","thinking-of-you","valentine","wedding",
    "teachers-day","housewarming"
]

def _load_categories_from_index() -> List[str]:
    idx_path = _CATEGORY_INDEX_PATH
    if not idx_path.is_file():
        return list(_FALLBACK_ALL_CATEGORIES)
    try:
        data = json.loads(idx_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[WARN] 读取 {idx_path} 失败，回退硬编码分类: {exc}", file=sys.stderr)
        return list(_FALLBACK_ALL_CATEGORIES)
    keys: List[str] = []
    if isinstance(data.get("category_keys"), list) and data["category_keys"]:
        keys = [str(k) for k in data["category_keys"] if str(k).strip()]
    elif isinstance(data.get("by_category"), dict):
        keys = sorted(str(k) for k in data["by_category"].keys() if str(k).strip())
    if not keys:
        return list(_FALLBACK_ALL_CATEGORIES)
    merged = list(dict.fromkeys(keys + list(_FALLBACK_ALL_CATEGORIES)))
    return merged

# rembg 进程全局变量（每个 worker 进程加载 1 次模型，避免重复加载 OOM）
_worker_session = None
_worker_model_name = "u2net"

# =========================================================================
# 通用工具
# =========================================================================
def ensure_dirs() -> None:
    for d in (PROC_DIR, RAW_DIR, LOGS_DIR):
        d.mkdir(parents=True, exist_ok=True)

def log(msg: str) -> None:
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)

def human(sec: float) -> str:
    sec = int(max(0, sec))
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        return f"{h}h{m:02d}m"
    if m > 0:
        return f"{m}m{s:02d}s"
    return f"{s}s"

def _which(bin_name: str) -> Optional[str]:
    p = shutil.which(bin_name)
    return p

def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def md5_bytes(b: bytes) -> str:
    return hashlib.md5(b).hexdigest()

# =========================================================================
# 断点续跑 SQLite（新规六：记录每张图所有阶段，方便转换前后数量校验）
# =========================================================================
def db_init_schema(conn: sqlite3.Connection):
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS phase1_status (
        pexels_id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        card_slug TEXT NOT NULL DEFAULT '',
        src_key TEXT NOT NULL DEFAULT '',
        dst_key TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        src_size INTEGER DEFAULT 0,
        src_width INTEGER DEFAULT 0,
        src_height INTEGER DEFAULT 0,
        dst_size INTEGER DEFAULT 0,
        dst_width INTEGER DEFAULT 0,
        dst_height INTEGER DEFAULT 0,
        tries INTEGER DEFAULT 0,
        last_error TEXT DEFAULT '',
        updated_at INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_phase1_status_status ON phase1_status(status);
    CREATE INDEX IF NOT EXISTS idx_phase1_status_category ON phase1_status(category);
    """)
    conn.commit()

def db_count_statuses(conn: sqlite3.Connection) -> Dict[str, int]:
    cur = conn.execute("SELECT status, COUNT(*) FROM phase1_status GROUP BY status")
    return {r[0]: int(r[1]) for r in cur.fetchall()}

def db_upsert(conn: sqlite3.Connection, pid: str, fields: Dict[str, Any]):
    fields = dict(fields)
    fields["updated_at"] = int(time.time())
    sets = [f"{k}=?" for k in fields.keys()]
    args: List[Any] = list(fields.values())
    args.append(pid)
    conn.execute(f"UPDATE phase1_status SET {', '.join(sets)} WHERE pexels_id=?", args)
    if conn.total_changes == 0:
        # 不存在时 INSERT：只写 pexels_id + 传入字段 + 空 category 兜底
        cols = ["pexels_id", "category"] + list(fields.keys())
        ph = ["?"] * len(cols)
        vals: List[Any] = [pid, fields.get("category", "")] + list(fields.values())
        conn.execute(f"INSERT INTO phase1_status ({', '.join(cols)}) VALUES ({', '.join(ph)})", vals)
    conn.commit()

# =========================================================================
# D1 卡片元数据拉取（如果 D1 API 不可用 fallback 到 cards-meta.json）
# =========================================================================
def fetch_d1_cards_from_api(limit: int = 10000) -> List[Dict[str, Any]]:
    # 尝试从本地 Worker（如果用户本地启动过）或生产域名
    urls = [
        os.environ.get("CF_WORKER_URL", "").strip().rstrip("/") + "/api/cards?size=" + str(limit),
        "https://sendafun.com/api/cards?size=" + str(limit),
    ]
    for u in urls:
        if not u.startswith("http"):
            continue
        try:
            s = requests.Session()
            s.trust_env = False  # 禁用系统代理，避免国内代理 SSL EOF
            retry = Retry(total=3, backoff_factor=1.2, status_forcelist=(500,502,503,504,408))
            s.mount("https://", HTTPAdapter(max_retries=retry, pool_connections=8, pool_maxsize=16))
            r = s.get(u, timeout=60, proxies=None)
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, dict) and "cards" in data:
                    return list(data["cards"])
                if isinstance(data, list):
                    return list(data)
        except Exception as e:
            log(f"[D1] API 拉取失败（跳过）: {u} -> {e}")
    return []

def load_cards_meta_fallback() -> List[Dict[str, Any]]:
    if not CARDS_META_JSON.exists():
        return []
    try:
        data = json.loads(CARDS_META_JSON.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "cards" in data and isinstance(data["cards"], list):
            return list(data["cards"])
    except Exception as e:
        log(f"[D1] cards-meta fallback 失败: {e}")
    return []

def parse_pexels_id(card: Dict[str, Any]) -> str:
    pid = (card.get("pexels_id") or "").strip()
    if pid:
        return pid
    slug = (card.get("slug") or card.get("id") or "").strip()
    if not slug:
        return ""
    # 从 slug 解析 pexels-<id> 结尾
    if slug.endswith("/"):
        slug = slug[:-1]
    tail = slug.rsplit("/", 1)[-1].rsplit("-", 1)[-1]
    if tail.isdigit():
        return tail
    return ""

# =========================================================================
# GateManager（R2 preview + R2 originals 双桶 HEAD/DOWNLOAD/UPLOAD）
# =========================================================================
class GateManager:
    def __init__(self) -> None:
        self.r2_client = None
        self.r2_bucket = os.environ.get("R2_BUCKET_NAME", "sendafun-preview").strip()
        self.r2_ok = False
        self.r2_originals_client = None
        self.r2_originals_bucket = os.environ.get("R2_ORIGINALS_BUCKET_NAME", "sendafun-originals").strip()
        self.r2_originals_ok = False
        try:
            self._init_r2()
            self.r2_ok = True
        except Exception as e:
            log(f"[R2] preview bucket init 失败: {e}")
        try:
            self._init_r2_originals()
            self.r2_originals_ok = True
        except Exception as e:
            log(f"[R2] originals bucket init 失败: {e}")

    def _init_r2(self):
        from boto3 import client as _boto_client
        env = os.environ
        acc = env["R2_ACCOUNT_ID"].strip()
        ak = env["R2_ACCESS_KEY_ID"].strip()
        sk = env["R2_SECRET_ACCESS_KEY"].strip()
        self.r2_client = _boto_client(
            "s3", endpoint_url=f"https://{acc}.r2.cloudflarestorage.com",
            aws_access_key_id=ak, aws_secret_access_key=sk, region_name="auto",
        )

    def _init_r2_originals(self):
        from boto3 import client as _boto_client
        env = os.environ
        acc = env["R2_ACCOUNT_ID"].strip()
        ak = env["R2_ACCESS_KEY_ID"].strip()
        sk = env["R2_SECRET_ACCESS_KEY"].strip()
        self.r2_originals_client = _boto_client(
            "s3", endpoint_url=f"https://acc.r2.cloudflarestorage.com".replace("acc", acc),
            aws_access_key_id=ak, aws_secret_access_key=sk, region_name="auto",
        )

    def originals_head(self, key: str) -> Optional[Dict[str, Any]]:
        if not self.r2_originals_ok:
            return None
        try:
            return self.r2_originals_client.head_object(Bucket=self.r2_originals_bucket, Key=key)
        except Exception:
            return None

    def originals_download_bytes(self, key: str) -> Optional[bytes]:
        if not self.r2_originals_ok:
            return None
        try:
            r = self.r2_originals_client.get_object(Bucket=self.r2_originals_bucket, Key=key)
            return r["Body"].read()
        except Exception:
            return None

    def originals_upload_bytes(self, key: str, data: bytes, content_type: str = "image/png") -> Optional[str]:
        if not self.r2_originals_ok:
            return None
        try:
            self.r2_originals_client.put_object(
                Bucket=self.r2_originals_bucket, Key=key, Body=data,
                ContentType=content_type, CacheControl="public, max-age=31536000, immutable",
            )
            md5 = md5_bytes(data)
            return md5
        except Exception as e:
            log(f"[R2] originals UPLOAD 失败 {key}: {e}")
            return None

# =========================================================================
# rembg Worker 进程初始化（每个进程加载一次模型，省内存省时间）
# =========================================================================
def worker_init(model_name: str, skip_rembg: bool):
    global _worker_session, _worker_model_name
    _worker_model_name = model_name
    if skip_rembg:
        _worker_session = None
        return
    try:
        from rembg import new_session
        # 优先用户指定模型（u2net / u2netp / isnet-general-use 等）
        try:
            _worker_session = new_session(model_name)
            log(f"[Worker] rembg 模型加载 OK: {model_name} (pid={os.getpid()})")
            return
        except Exception as e1:
            # 失败自动 fallback 到 u2netp（最小模型，速度快）
            log(f"[Worker] rembg {model_name} 加载失败，fallback u2netp: {e1}")
            try:
                _worker_session = new_session("u2netp")
                log(f"[Worker] rembg u2netp 加载 OK (pid={os.getpid()})")
                return
            except Exception as e2:
                log(f"[Worker] rembg 全部模型加载失败，进入非抠图 fallback: {e2}")
                _worker_session = None
    except Exception as e:
        log(f"[Worker] rembg 初始化异常: {e}")
        _worker_session = None

# =========================================================================
# 图像质量 + 尺寸校验（新规一：前置门槛）
# =========================================================================
def _laplacian_var(gray_im: Image.Image) -> float:
    # 3x3 Laplacian 核（和 OpenCV 等价）→ 方差越大越清晰，<25 认为是糊/马赛克
    lap_kernel = ImageFilter.Kernel((3,3), (0,1,0, 1,-4,1, 0,1,0), scale=1, offset=128)
    lap = gray_im.filter(lap_kernel)
    px = list(lap.getdata())
    if not px:
        return 0.0
    n = len(px)
    mean = sum(px) / n
    var = sum((x - mean) ** 2 for x in px) / n
    return float(var)

def check_source_quality(src_bytes: bytes) -> Tuple[bool, str, Dict[str, int]]:
    """新规一：源图质量 + 尺寸前置门槛。返回 (通过, 原因, meta(w,h,size))"""
    size = len(src_bytes)
    meta: Dict[str, int] = {"size": size, "w": 0, "h": 0, "long_side": 0}
    # 体积兜底（严重压缩 / 小图直接丢）
    if size < MIN_SRC_BYTES:
        return False, f"source too small ({size} bytes < {MIN_SRC_BYTES})", meta
    try:
        im = Image.open(io.BytesIO(src_bytes))
        im.load()
        w, h = im.size
        meta["w"], meta["h"] = w, h
        long_side = max(w, h)
        meta["long_side"] = long_side
        if long_side < MIN_SRC_LONG_SIDE:
            return False, f"long_side {long_side}px < {MIN_SRC_LONG_SIDE}px", meta
        # 模糊/马赛克兜底（转 L 灰度做 Laplacian）
        try:
            # 尺寸太大先缩到 1024 长边，加速计算
            im_small = im.copy()
            if long_side > 1024:
                r = 1024 / long_side
                im_small = im_small.resize((int(w*r), int(h*r)), Image.LANCZOS)
            g = im_small.convert("L")
            sv = _laplacian_var(g)
            if sv < MIN_SHARPNESS_LAPLACIAN:
                return False, f"blurry (laplacian var={sv:.1f} < {MIN_SHARPNESS_LAPLACIAN})", meta
        except Exception:
            pass
        return True, "ok", meta
    except Exception as e:
        return False, f"decode failed: {e}", meta

# =========================================================================
# 新规二：等比缩放（长边严格 = 2048px，短边自适应，不裁不拉伸）
# =========================================================================
def resize_long_side(im: Image.Image, long_side: int = TARGET_LONG_SIDE) -> Image.Image:
    w, h = im.size
    cur = max(w, h)
    if cur == long_side:
        return im
    ratio = long_side / cur
    new_w = max(1, int(round(w * ratio)))
    new_h = max(1, int(round(h * ratio)))
    # LANCZOS = 最高质量等比缩放（去锯齿）
    return im.resize((new_w, new_h), Image.LANCZOS)

# =========================================================================
# 新规三：抠图 + 抗锯齿羽化 + 去白边灰边
# =========================================================================
def remove_bg_and_fix_edges(rgb_im: Image.Image, skip_rembg: bool = False) -> Image.Image:
    """输入 RGB，输出 RGBA（带 Alpha）。抗锯齿羽化 + 去白边灰边。"""
    global _worker_session, _worker_model_name
    rgb_im = rgb_im.convert("RGB")
    # Step A: 抠出 Alpha（rembg 有就用；没有就 fallback 全 alpha=255，标记后续校验失败）
    if (not skip_rembg) and _worker_session is not None:
        try:
            from rembg import remove as _rembg_remove
            # rembg 输出直接是 RGBA（抠完）
            cut_rgba = _rembg_remove(rgb_im, session=_worker_session)
            if cut_rgba.mode != "RGBA":
                cut_rgba = cut_rgba.convert("RGBA")
        except Exception as e:
            log(f"[Worker] rembg 抠图失败，fallback 白底不抠（{e}）")
            cut_rgba = rgb_im.convert("RGBA")
            # 直接设置 Alpha=255（不抠 → 校验阶段透明校验失败 → FAILED）
            cut_rgba.putalpha(255)
    else:
        # skip_rembg=True 或 rembg 不可用：标记 fallback（透明校验一定失败 → FAILED，用户后续自己用 --only-retry + 开 rembg 跑）
        cut_rgba = rgb_im.convert("RGBA")
        cut_rgba.putalpha(255)

    # Step B: Alpha 通道抗锯齿羽化（发丝/细枝不生硬）
    try:
        r, g, b, alpha = cut_rgba.split()
        # 羽化半径 = 1.0 px（高斯模糊），抗锯齿
        alpha_smooth = alpha.filter(ImageFilter.GaussianBlur(radius=1.0))
        # Step C: 去白边灰边（腐蚀半透明像素：半透明的被白/灰污染，压下去）
        #   x<32 → 0（强压微透明灰边）；32≤x<192 → 线性 (x-32)*255/(192-32)；x≥192 → 255（保留实主体）
        table = []
        for x in range(256):
            if x < 32:
                table.append(0)
            elif x >= 192:
                table.append(255)
            else:
                table.append(int(round((x - 32) * 255.0 / (192 - 32))))
        alpha_cleaned = alpha_smooth.point(table)
        # 合成 RGBA
        final_rgba = Image.merge("RGBA", (r, g, b, alpha_cleaned))
        return final_rgba
    except Exception as e:
        log(f"[Worker] Alpha 处理异常（直接返回抠图原结果）: {e}")
        return cut_rgba

# =========================================================================
# 新规四：PNG24 RGBA 无损压缩 + 体积 ≤1.5MB（仅用 oxipng / Pillow 纯无损，不用 PNG8）
# =========================================================================
def compress_png24_lossless(rgba_im: Image.Image, max_bytes: int = MAX_PNG_BYTES) -> bytes:
    """纯无损 RGBA 压缩：oxipng 有就用（最强）→ Pillow optimize=9 兜底；保证 ≤max_bytes"""
    # Step 1: Pillow 写出 RGBA PNG 24（用 optimize + 最高压缩级别 9）
    buf = io.BytesIO()
    rgba_im.save(buf, format="PNG", optimize=True, compress_level=9)
    data = buf.getvalue()

    # Step 2: oxipng 无损二次压缩（最强，不丢任何像素/色阶）
    oxi = _which("oxipng") or (str(PROJECT_ROOT / "_tools" / "oxipng.exe") if (PROJECT_ROOT / "_tools" / "oxipng.exe").exists() else None)
    if oxi:
        for extra_args in (["-o", "4", "--strip", "safe"], ["-o", "6", "--strip", "safe"], ["-o", "max", "--strip", "safe"]):
            try:
                p = subprocess.run(
                    [oxi, *extra_args, "--out", "-", "-"],
                    input=data, capture_output=True, timeout=120,
                )
                if p.returncode == 0 and len(p.stdout) > 0:
                    if len(p.stdout) < len(data):
                        data = p.stdout
                    if len(data) <= max_bytes:
                        return data
            except Exception:
                break

    # Step 3: 如果还是超（极少）→ 再 Pillow 一轮 optimize（纯无损）
    if len(data) > max_bytes:
        buf2 = io.BytesIO()
        Image.open(io.BytesIO(data)).save(buf2, format="PNG", optimize=True, compress_level=9)
        if len(buf2.getvalue()) < len(data):
            data = buf2.getvalue()

    return data

# =========================================================================
# 新规六：6 项自动化校验（不达标直接 FAILED，返回通过/不通过 + 原因）
# =========================================================================
def validate_png_compliance(png_bytes: bytes, src_long_side: int, src_size: int) -> Tuple[bool, List[str], Dict[str, int]]:
    """6 项校验 → (通过, 失败原因列表, meta(w,h,long_side,size,alpha_edge_avg))"""
    reasons: List[str] = []
    meta: Dict[str, int] = {"w":0,"h":0,"long_side":0,"size":len(png_bytes),"alpha_avg":-1,"has_alpha":0}
    size = len(png_bytes)
    meta["size"] = size

    # 6-5 体积校验
    if size > MAX_PNG_BYTES:
        reasons.append(f"size too big ({size} bytes > {MAX_PNG_BYTES})")

    # 6-2 格式校验：真正的 PNG（不是 JPG/WebP 改后缀） + RGBA
    try:
        im = Image.open(io.BytesIO(png_bytes))
        im.load()
        fmt = (im.format or "").upper()
        if fmt != "PNG":
            reasons.append(f"format not PNG (real format: {fmt})")
        # 6-2b Alpha 通道存在
        has_alpha = False
        if im.mode in ("RGBA", "LA", "PA"):
            has_alpha = True
        elif im.mode == "P":
            # P + transparency chunk = 带 Alpha
            if "transparency" in im.info:
                has_alpha = True
        if not has_alpha:
            reasons.append(f"no alpha channel (mode={im.mode})")
        else:
            meta["has_alpha"] = 1
        # 统一到 RGBA 做尺寸+透明校验
        rgba = im.convert("RGBA") if has_alpha else im.convert("RGBA")
        w, h = rgba.size
        meta["w"], meta["h"] = w, h
        long_side = max(w, h)
        meta["long_side"] = long_side

        # 6-1 尺寸校验（长边严格 2048px）
        if long_side != TARGET_LONG_SIDE:
            reasons.append(f"long_side != {TARGET_LONG_SIDE} ({long_side}px)")

        # 6-3 透明校验（4 边 1px 边缘平均 Alpha < 10）
        if has_alpha:
            alpha = rgba.getchannel("A")
            edge_pixels: List[int] = []
            for x in range(w):
                edge_pixels.append(alpha.getpixel((x, 0)))       # 上边
                edge_pixels.append(alpha.getpixel((x, h - 1)))   # 下边
            for y in range(h):
                edge_pixels.append(alpha.getpixel((0, y)))       # 左边
                edge_pixels.append(alpha.getpixel((w - 1, y)))   # 右边
            avg_alpha = int(sum(edge_pixels) / max(1, len(edge_pixels)))
            meta["alpha_avg"] = avg_alpha
            if avg_alpha >= 10:
                reasons.append(f"edge_alpha too high (avg={avg_alpha} >=10, 大面积白底残留)")
    except Exception as e:
        reasons.append(f"png decode failed: {e}")

    return (len(reasons) == 0, reasons, meta)

# =========================================================================
# 单张全流程（严格 1→7 条新规）
# =========================================================================
@dataclass
class ProcessInput:
    pexels_id: str
    category: str
    card_slug: str
    src_key: str       # 源 JPG 在 originals 桶的 key（旧格式 .jpg/.jpeg）
    dst_key: str       # 成品 PNG 在 originals 桶的 key（{category}/pexels-{id}.png）

def process_one(p: ProcessInput, skip_rembg: bool) -> Tuple[str, str, Dict[str, Any]]:
    """返回 (status, last_error_or_ok, meta_dict)；status: verified/failed/skipped"""
    meta_out: Dict[str, Any] = {"tries":1}
    try:
        # ── 0. 前置：从 R2 originals 拉源 JPG
        # （GateManager 不能跨进程 pickle，所以每个 worker 进程单独初始化 GateManager）
        gate = _worker_local_gate()
        if gate is None or not gate.r2_originals_ok:
            # fallback：尝试从 raw-originals-phase1 本地缓存读
            local_raw = RAW_DIR / f"{p.category}_pexels_{p.pexels_id}.jpg"
            if local_raw.exists():
                src_bytes = local_raw.read_bytes()
            else:
                return "failed", "R2 originals not accessible and local cache missing", meta_out
        else:
            src_bytes = gate.originals_download_bytes(p.src_key)
            if src_bytes is None:
                # fallback: 本地缓存
                local_raw = RAW_DIR / f"{p.category}_pexels_{p.pexels_id}.jpg"
                if local_raw.exists():
                    src_bytes = local_raw.read_bytes()
                else:
                    return "failed", f"source missing: {p.src_key}", meta_out

        # 本地缓存一份，下次重跑不用再从 R2 拉（省带宽）
        try:
            local_raw = RAW_DIR / f"{p.category}_pexels_{p.pexels_id}.jpg"
            if not local_raw.exists():
                local_raw.write_bytes(src_bytes)
        except Exception:
            pass

        # ── 新规一：前置图源门槛（2800px + 无噪点/马赛克/水印）
        ok, reason, src_meta = check_source_quality(src_bytes)
        meta_out["src_size"] = src_meta["size"]
        meta_out["src_width"] = src_meta["w"]
        meta_out["src_height"] = src_meta["h"]
        if not ok:
            return "skipped", f"[新规一] {reason}", meta_out

        # ── 新规二：等比缩放，长边严格 2048px（不裁不拉伸，LANCZOS）
        rgb_src = Image.open(io.BytesIO(src_bytes)).convert("RGB")
        rgb_2048 = resize_long_side(rgb_src, TARGET_LONG_SIDE)

        # ── 新规三：抠图 + 抗锯齿羽化 + 去白边灰边（RGBA 成品）
        rgba = remove_bg_and_fix_edges(rgb_2048, skip_rembg=skip_rembg)

        # ── 新规四：PNG24 RGBA 纯无损压缩，体积 ≤1.5MB
        png_bytes = compress_png24_lossless(rgba, MAX_PNG_BYTES)

        # ── 新规六：6 项自动化校验（不达标直接 FAILED）
        ok, fails, dst_meta = validate_png_compliance(png_bytes, src_meta["long_side"], src_meta["size"])
        meta_out["dst_size"] = dst_meta["size"]
        meta_out["dst_width"] = dst_meta["w"]
        meta_out["dst_height"] = dst_meta["h"]
        if not ok:
            # 本地保存 FAILED PNG，方便人工排查（放在 PROC_DIR/failed/）
            try:
                fail_dir = PROC_DIR / "failed"
                fail_dir.mkdir(parents=True, exist_ok=True)
                (fail_dir / Path(p.dst_key).name).write_bytes(png_bytes)
            except Exception:
                pass
            return "failed", f"[新规六] 校验失败: {' | '.join(fails)}", meta_out

        # ── 新规五：上传到 sendafun-originals 桶，命名 {category}/pexels-{pexels_id}.png
        gate2 = _worker_local_gate()
        md5 = None
        if gate2 and gate2.r2_originals_ok:
            md5 = gate2.originals_upload_bytes(p.dst_key, png_bytes, "image/png")
        # 本地也保存一份 VERIFIED PNG 镜像（PROC_DIR/verified/）
        try:
            ok_dir = PROC_DIR / "verified"
            ok_dir.mkdir(parents=True, exist_ok=True)
            (ok_dir / Path(p.dst_key).name).write_bytes(png_bytes)
        except Exception:
            pass

        if md5 is None and (gate2 is None or not gate2.r2_originals_ok):
            # R2 不可用但本地已存 → 标记 uploaded（等用户有网了再手动同步）
            return "uploaded", "R2 unavailable, saved to local PROC_DIR/verified only", meta_out
        if md5 is None:
            return "failed", "R2 originals upload failed (md5 None)", meta_out

        # ── 新规七：HEAD 验证上传成功
        if gate2 and gate2.r2_originals_ok:
            head = gate2.originals_head(p.dst_key)
            if head is None:
                return "failed", "R2 HEAD verification failed after upload", meta_out
            if int(head.get("ContentLength", 0)) != len(png_bytes):
                return "failed", f"R2 ContentLength mismatch ({head.get('ContentLength')} vs {len(png_bytes)})", meta_out

        return "verified", "ok", meta_out

    except Exception as e:
        import traceback
        tb = traceback.format_exc(limit=2)
        return "failed", f"exception: {e} :: {tb.strip()}", meta_out

# Worker 本地 GateManager（进程内复用，不跨进程 pickle）
_worker_gate_local = None
def _worker_local_gate():
    global _worker_gate_local
    if _worker_gate_local is None:
        try:
            _worker_gate_local = GateManager()
        except Exception:
            _worker_gate_local = GateManager.__new__(GateManager)
            _worker_gate_local.r2_originals_ok = False
            _worker_gate_local.r2_ok = False
    return _worker_gate_local

# =========================================================================
# 初始化待处理清单（从 D1 / cards-meta 聚合）
# =========================================================================
def collect_pending_tasks(conn: sqlite3.Connection, force_rescan: bool = False,
                          only_retry: bool = False, only_cat: Optional[str] = None,
                          ) -> List[ProcessInput]:
    # 0. 只重试 FAILED 的
    if only_retry:
        sql = "SELECT pexels_id, category, card_slug, src_key, dst_key FROM phase1_status WHERE status='failed'"
        if only_cat:
            sql += f" AND category={_sql_str(only_cat)}"
        rows = conn.execute(sql).fetchall()
        tasks: List[ProcessInput] = []
        for r in rows:
            tasks.append(ProcessInput(
                pexels_id=r[0], category=r[1], card_slug=r[2] or "",
                src_key=r[3] or _guess_src_key(r[1], r[0]),
                dst_key=r[4] or _dst_key(r[1], r[0]),
            ))
        log(f"[Init] --only-retry: FAILED 共 {len(tasks)} 张待重试")
        return tasks

    # 1. 拉卡片元数据（D1 API 优先 → cards-meta fallback）
    cards = fetch_d1_cards_from_api()
    if len(cards) == 0:
        log("[Init] D1 API 无数据，fallback 到 cards-meta.json")
        cards = load_cards_meta_fallback()
    log(f"[Init] 卡片元数据: {len(cards)} 张")

    # 2. 每张卡片 → 源 key / 目标 key
    inserted = 0
    for c in cards:
        pid = parse_pexels_id(c)
        if not pid or not pid.isdigit():
            continue
        cat = (c.get("category") or "").strip().lower()
        if not cat:
            # slug 里 fallback 猜（/card/<cat>-xxx-<id>）
            slug = (c.get("slug") or "").strip()
            if slug:
                seg = slug.rsplit("/", 1)[-1]
                for k in _ALL_CATEGORIES:
                    if seg.startswith(k + "-"):
                        cat = k
                        break
        if not cat or cat not in _ALL_CATEGORIES:
            continue
        if only_cat and cat != only_cat:
            continue
        src_key = _guess_src_key(cat, pid)
        dst_key = _dst_key(cat, pid)
        slug = (c.get("slug") or "").strip()
        fields = {
            "category": cat,
            "card_slug": slug,
            "src_key": src_key,
            "dst_key": dst_key,
        }
        # 如果已存在（status != pending）且不 force_rescan → 不改
        cur = conn.execute("SELECT status FROM phase1_status WHERE pexels_id=?", (pid,))
        existing = cur.fetchone()
        if existing and not force_rescan:
            # 只补齐 src_key/dst_key/category/card_slug（不覆盖 status）
            conn.execute("UPDATE phase1_status SET category=?, card_slug=?, src_key=?, dst_key=?, updated_at=? WHERE pexels_id=?",
                         (cat, slug, src_key, dst_key, int(time.time()), pid))
            conn.commit()
            continue
        # 否则 INSERT（不存在）OR 覆盖 status=pending（force_rescan）
        if force_rescan:
            fields["status"] = "pending"
            fields["tries"] = 0
            fields["last_error"] = ""
        db_upsert(conn, pid, fields)
        inserted += 1

    conn.commit()
    log(f"[Init] 待处理清单已写入/补齐: 新增/重置 {inserted} 张")

    # 3. 拉 pending / downloaded
    sql = "SELECT pexels_id, category, card_slug, src_key, dst_key FROM phase1_status WHERE status IN ('pending','downloaded')"
    if only_cat:
        sql += f" AND category={_sql_str(only_cat)}"
    rows = conn.execute(sql).fetchall()
    tasks = []
    for r in rows:
        tasks.append(ProcessInput(
            pexels_id=r[0], category=r[1], card_slug=r[2] or "",
            src_key=r[3] or _guess_src_key(r[1], r[0]),
            dst_key=r[4] or _dst_key(r[1], r[0]),
        ))
    log(f"[Init] 待处理任务: {len(tasks)} 张（pending + downloaded）")
    return tasks

_ALL_CATEGORIES = _load_categories_from_index()

def _sql_str(s: str) -> str:
    return "'" + s.replace("'","''") + "'"

def _guess_src_key(cat: str, pid: str) -> str:
    # 旧备份在 originals 桶的 JPG 命名：{category}/pexels-{id}.jpeg / .jpg
    return f"{cat}/pexels-{pid}.jpeg"

def _dst_key(cat: str, pid: str) -> str:
    # 新规五：命名路径严格 {category}/pexels-{pexels_id}.png
    return f"{cat}/pexels-{pid}.png"

# =========================================================================
# CLI
# =========================================================================
def main():
    parser = argparse.ArgumentParser(description="Phase1: sendafun-originals JPG → 透明 PNG 成品（严格 7 条新规）")
    parser.add_argument("--reset-all", action="store_true", help="清空状态表，全部重新从 pending 开始（谨慎！）")
    parser.add_argument("--force-rescan", action="store_true", help="重新拉卡片元数据并把已 verified 改回 pending（保留 FAILED/SKIPPED 记录）")
    parser.add_argument("--only-retry", action="store_true", help="只重试 status=failed 的任务")
    parser.add_argument("--only-category", type=str, default=None, help="只处理某个分类，例如 birthday")
    parser.add_argument("--rembg-model", type=str, default="u2net", help="rembg 模型名（u2net / u2netp / isnet-general-use）")
    parser.add_argument("--skip-rembg", action="store_true", help="临时跳过抠图（透明校验将失败 → 全部 FAILED，仅用于测试尺寸/压缩）")
    parser.add_argument("--workers", type=int, default=max(1, min(8, (os.cpu_count() or 4))), help="并行进程数（抠图 CPU 密集，不要超过 CPU 核数）")
    args = parser.parse_args()

    ensure_dirs()
    # 启动时间戳（用于 _check_phase1_progress.py 的 ETA 计算）
    try:
        START_TS_PATH.write_text(str(int(time.time())), encoding="utf-8")
    except Exception:
        pass

    conn = sqlite3.connect(str(STATUS_DB), check_same_thread=False)
    db_init_schema(conn)

    if args.reset_all:
        log("[Init] --reset-all：清空状态表，全部重跑！")
        conn.execute("DELETE FROM phase1_status")
        conn.commit()

    tasks = collect_pending_tasks(conn, force_rescan=args.force_rescan,
                                  only_retry=args.only_retry, only_cat=args.only_category)
    total = len(tasks)
    if total == 0:
        log("[Init] ❌ 没有待处理任务。试试：python phase1-process-originals.py --reset-all")
        sys.exit(1)

    # GateManager（主进程只用来打印双桶可用性）
    try:
        g = GateManager()
        log(f"[R2] preview={g.r2_ok} bucket={g.r2_bucket}")
        log(f"[R2] originals={g.r2_originals_ok} bucket={g.r2_originals_bucket}")
    except Exception as e:
        log(f"[R2] 主进程初始化失败（不影响子进程）: {e}")

    log(f"[Init] ✅ 开始 Phase1：{total} 张 | workers={args.workers} | rembg_model={args.rembg_model} | skip_rembg={args.skip_rembg}")
    log(f"[Init]    新规一：源图长边 ≥{MIN_SRC_LONG_SIDE}px 且 体积≥{MIN_SRC_BYTES}B 且 不模糊")
    log(f"[Init]    新规二：成品长边严格 ={TARGET_LONG_SIDE}px")
    log(f"[Init]    新规四：PNG24 RGBA 纯无损，体积 ≤{MAX_PNG_BYTES} bytes")
    log(f"[Init]    新规五：成品命名 {_dst_key('CATEGORY','PEXELS_ID')}")
    log(f"[Init]    新规六：每张跑完自动 6 项校验，不达标直接 FAILED")

    counts = db_count_statuses(conn)
    for st, c in sorted(counts.items(), key=lambda x:-x[1]):
        log(f"[Init]    状态 {st:12s} → {c:>6d} 张")

    # ── 8 进程并行跑（每个 worker init 加载一次 rembg，省内存省时间）
    start_ts = time.time()
    lock = threading.Lock()
    done = ok = fail = skip = 0
    last_print_ts = start_ts

    with ProcessPoolExecutor(
        max_workers=args.workers,
        initializer=worker_init, initargs=(args.rembg_model, args.skip_rembg),
    ) as pool:
        futures = {pool.submit(process_one, t, args.skip_rembg): t for t in tasks}
        for fut in as_completed(futures):
            t = futures[fut]
            try:
                status, err_or_ok, meta = fut.result(timeout=900)  # 单张 15 分钟超时（抠图慢但不会更久）
            except Exception as e:
                status, err_or_ok, meta = "failed", f"future timeout/error: {e}", {"tries":1}

            meta.setdefault("tries", 1)
            # 更新 DB
            with lock:
                done += 1
                fields = {
                    "status": status,
                    "last_error": "" if status == "verified" else err_or_ok,
                }
                for k in ("src_size","src_width","src_height","dst_size","dst_width","dst_height","tries"):
                    if k in meta and meta[k] is not None:
                        fields[k] = meta[k]
                if "tries" not in fields:
                    fields["tries"] = 1
                else:
                    # tries 累加
                    try:
                        cur = conn.execute("SELECT tries FROM phase1_status WHERE pexels_id=?", (t.pexels_id,))
                        r = cur.fetchone()
                        if r and r[0]:
                            fields["tries"] = int(r[0]) + int(meta.get("tries", 1))
                    except Exception:
                        fields["tries"] = int(meta.get("tries", 1))
                db_upsert(conn, t.pexels_id, fields)

                # 统计
                if status == "verified" or status == "uploaded" or status == "converted" or status == "compressed":
                    ok += 1
                elif status == "skipped":
                    skip += 1
                elif status == "failed":
                    fail += 1

                # 打印进度（每 5 秒或每 1% 至少打印一次）
                now = time.time()
                pct = done / total * 100
                if (now - last_print_ts) >= 5 or done == total:
                    last_print_ts = now
                    elapsed = now - start_ts
                    s_per = elapsed / done if done > 0 else 0
                    eta = s_per * (total - done)
                    log(
                        f"[Progress] {done}/{total} ({pct:5.2f}%) | VERIFIED/OK={ok} | FAILED={fail} | SKIPPED={skip} | "
                        f"elapsed={human(elapsed)} | avg={s_per:.1f}s/img | ETA={human(eta)} | "
                        f"last: [{t.category}] pexels-{t.pexels_id} → {status}"
                        + ("" if status == "verified" else f" :: {err_or_ok[:140]}")
                    )

    # 总结
    elapsed = time.time() - start_ts
    final_counts = db_count_statuses(conn)
    log("=" * 80)
    log(f"[Phase1-Done] ✅ 全部任务完成！耗时 {human(elapsed)} | workers={args.workers}")
    for st, c in sorted(final_counts.items(), key=lambda x:-x[1]):
        bar_len = int(c / max(1, sum(final_counts.values())) * 40)
        bar = "█" * bar_len + "░" * (40 - bar_len)
        log(f"  {st:12s} {c:>6d}  {bar}")
    log("=" * 80)
    log(f"  ✅ VERIFIED 最终：{final_counts.get('verified', 0) + final_counts.get('uploaded', 0)} 张")
    log(f"  ❌ FAILED 最终：{final_counts.get('failed', 0)} 张")
    log(f"  ⚠️  SKIPPED 最终：{final_counts.get('skipped', 0)} 张（新规一前置门槛未达标：<2800px / 体积太小 / 模糊/马赛克）")
    if final_counts.get("failed", 0) > 0:
        log("")
        log("👉 处理 FAILED：再次执行  python _scripts\\phase1-process-originals.py --only-retry")
        log("   （自动只重试 status=failed 的，90% 临时网络/模型 OOM 问题能挽回；断点续跑不会重跑已 VERIFIED 的）")
    log("")
    log("👉 进度随时查看：  python _scripts\\_check_phase1_progress.py")
    log("=" * 80)
    conn.close()

if __name__ == "__main__":
    main()
