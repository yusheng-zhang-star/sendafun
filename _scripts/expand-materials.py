#!/usr/bin/env python3
from __future__ import annotations

import sys
import os
import io
import csv
import json
import hashlib
import time
import shutil
import random
import argparse
import subprocess
import mimetypes
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any, Tuple, Set

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from tqdm import tqdm
from dotenv import load_dotenv
from PIL import Image, ImageOps, ImageFilter, ImageDraw
import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT_DIR / "public"
MATERIAL_DIR = ROOT_DIR / "_material-library"
LOGS_DIR = MATERIAL_DIR / "logs"
BACKUPS_DIR = MATERIAL_DIR / "backups"
RAW_DIR = ROOT_DIR / "raw-originals"
PROC_DIR = ROOT_DIR / "processed"
CHECKPOINT_PATH = MATERIAL_DIR / "progress-checkpoint.json"
MATERIALS_CSV = MATERIAL_DIR / "materials-used.csv"
DUPLICATES_LOG = MATERIAL_DIR / "duplicates-log.txt"
CARDS_META_JSON = PUBLIC_DIR / "cards-meta.json"
CARDS_META_CSV_FIELDS = [
    "pexels_id", "original_md5", "original_sha256", "category",
    "processed_count", "uploaded_objects", "added_at"
]

R2_BASE = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev"
MIN_ORIGINAL_LONG_SIDE = 2800
PNG_TARGET_LONG_SIDE = 2048
_CATEGORY_INDEX_PATH = PUBLIC_DIR / "_category_index.json"

_FALLBACK_CATEGORY_LABELS = {
    "anniversary": "Anniversary", "birthday": "Birthday", "christmas": "Christmas",
    "congratulations": "Congratulations", "easter": "Easter", "encouragement": "Encouragement",
    "fathers-day": "Father's Day", "friendship": "Friendship", "get-well": "Get Well",
    "good-luck": "Good Luck", "graduation": "Graduation", "halloween": "Halloween",
    "love": "Love & Romance", "missing-you": "Missing You", "mothers-day": "Mother's Day",
    "new-baby": "New Baby", "new-year": "New Year", "retirement": "Retirement",
    "sorry": "Apology", "sympathy": "Sympathy", "thank-you": "Thank You",
    "thanksgiving": "Thanksgiving", "thinking-of-you": "Thinking of You",
    "valentine": "Valentine", "wedding": "Wedding"
}

def _category_label_from_key(key: str) -> str:
    if key in _FALLBACK_CATEGORY_LABELS:
        return _FALLBACK_CATEGORY_LABELS[key]
    words = key.replace("_", "-").split("-")
    titled = " ".join(w[:1].upper() + w[1:] for w in words if w)
    return titled or key

def load_category_labels_from_index() -> Dict[str, str]:
    idx_path = _CATEGORY_INDEX_PATH
    if not idx_path.is_file():
        return dict(_FALLBACK_CATEGORY_LABELS)
    try:
        data = json.loads(idx_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[WARN] 读取 {idx_path} 失败，回退硬编码分类: {exc}", file=sys.stderr)
        return dict(_FALLBACK_CATEGORY_LABELS)
    keys = []
    if isinstance(data.get("category_keys"), list) and data["category_keys"]:
        keys = list(data["category_keys"])
    elif isinstance(data.get("by_category"), dict):
        keys = sorted(data["by_category"].keys())
    if not keys:
        return dict(_FALLBACK_CATEGORY_LABELS)
    merged: Dict[str, str] = {}
    for k in keys:
        merged[k] = _category_label_from_key(k)
    return merged

CATEGORY_LABELS: Dict[str, str] = load_category_labels_from_index()
ALL_CATEGORIES: List[str] = list(CATEGORY_LABELS.keys())
RECIPIENT_MULT = [
    ("friend", "Best Friend", "Warm"),
    ("mom", "My Mom", "Heartfelt"),
    ("dad", "My Dad", "Playful"),
]
STYLES = ["warm", "heartfelt", "playful", "elegant", "funny", "romantic"]
RECIPIENT_SLUG_LABEL = {
    "friend": "for Best Friend", "mom": "for Mom", "dad": "for Dad",
    "partner": "for Partner", "boss": "for Boss", "teacher": "for Teacher",
    "colleague": "for Coworker", "grandma": "for Grandma", "grandpa": "for Grandpa",
    "sibling": "for Brother or Sister", "kids": "for Kid", "me": "for Myself"
}

_tls = threading.local()


def _log_init() -> Path:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d-%H%M%S")
    f = LOGS_DIR / f"expand-{ts}.log"
    with open(f, "w", encoding="utf-8") as fp:
        fp.write(f"# SendAFun Material Expand Log - {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    return f


def _log(msg: str, level: str = "INFO") -> None:
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [{level}] {msg}"
    print(line)
    if getattr(_tls, "logfile", None):
        try:
            with open(_tls.logfile, "a", encoding="utf-8") as fp:
                fp.write(line + "\n")
        except Exception:
            pass


def _init_logger(logfile: Path) -> None:
    _tls.logfile = str(logfile)


def retry_session(retries: int = 5, backoff: float = 1.5,
                  status_forcelist: Tuple[int, ...] = (429, 500, 502, 503, 504, 408)) -> requests.Session:
    s = requests.Session()
    retry = Retry(
        total=retries,
        read=retries,
        connect=retries,
        backoff_factor=backoff,
        status_forcelist=status_forcelist,
        allowed_methods=["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=64, pool_maxsize=128)
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    s.headers.update({"User-Agent": "SendAFun-MaterialPipeline/1.0 (+https://sendafun.com)"})
    return s


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def md5_file(p: Path) -> str:
    h = hashlib.md5()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def ensure_dirs() -> None:
    for d in (RAW_DIR, PROC_DIR, LOGS_DIR, BACKUPS_DIR, MATERIAL_DIR):
        d.mkdir(parents=True, exist_ok=True)
    if not MATERIALS_CSV.exists():
        with open(MATERIALS_CSV, "w", encoding="utf-8", newline="") as f:
            csv.writer(f).writerow(CARDS_META_CSV_FIELDS)
    if not DUPLICATES_LOG.exists():
        with open(DUPLICATES_LOG, "w", encoding="utf-8") as f:
            f.write("# SendAFun Dedupe Intercept Log\n")


def load_checkpoint() -> Dict[str, Any]:
    if CHECKPOINT_PATH.exists():
        try:
            return json.loads(CHECKPOINT_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_checkpoint(data: Dict[str, Any]) -> None:
    CHECKPOINT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def clear_checkpoint() -> None:
    if CHECKPOINT_PATH.exists():
        try:
            CHECKPOINT_PATH.unlink()
        except Exception:
            pass


def append_dupe_log(gate: str, kind: str, value: str, reason: str) -> None:
    line = f"{time.strftime('%Y-%m-%dT%H:%M:%SZ')} | Gate{gate} | {kind} | {value} | {reason}\n"
    with open(DUPLICATES_LOG, "a", encoding="utf-8") as f:
        f.write(line)


def _guess_mime(k: str, p=None) -> str:
    import mimetypes as _mt
    g = _mt.guess_type(k)[0]
    if g: return g
    if p is not None:
        try:
            suf = str(p.suffix).lower() if hasattr(p, 'suffix') else ''
            if suf in ('.jpg', '.jpeg'): return 'image/jpeg'
            if suf == '.png': return 'image/png'
            if suf == '.webp': return 'image/webp'
        except Exception:
            pass
    return 'application/octet-stream'


@dataclass
class MaterialRow:
    pexels_id: str
    original_md5: str
    original_sha256: str
    category: str
    processed_count: int
    uploaded_objects: str
    added_at: str


class GateManager:
    def __init__(self) -> None:
        self.pexels_ids: Set[str] = set()
        self.original_md5s: Set[str] = set()
        self.original_sha256s: Set[str] = set()
        self.uploaded_objects: Set[str] = set()
        self._load()
        self._r2_client = None
        self._r2_ok = False
        self._r2_originals_client = None
        self._r2_originals_bucket = None
        self._r2_originals_ok = False
        try:
            self._init_r2_client()
            self._r2_ok = True
        except Exception as e:
            _log(f"[WARN] R2 preview client init skipped: {e}", "WARN")
            self._r2_ok = False
        try:
            self._init_r2_originals_client()
        except Exception as e:
            _log(f"[INFO] R2 originals skipped (optional bucket): {e}", "INFO")
            self._r2_originals_ok = False

    def _load(self) -> None:
        with open(MATERIALS_CSV, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                self.pexels_ids.add(row["pexels_id"].strip())
                if row.get("original_md5"):
                    self.original_md5s.add(row["original_md5"].strip())
                if row.get("original_sha256"):
                    self.original_sha256s.add(row["original_sha256"].strip())
                if row.get("uploaded_objects"):
                    for key in row["uploaded_objects"].split(","):
                        key = key.strip()
                        if key:
                            self.uploaded_objects.add(key)
        _log(f"[Gate] Loaded dedupe sets: ids={len(self.pexels_ids)} md5={len(self.original_md5s)} "
             f"sha256={len(self.original_sha256s)} r2_objs={len(self.uploaded_objects)}")

    def append_row(self, row: MaterialRow) -> None:
        with open(MATERIALS_CSV, "a", encoding="utf-8", newline="") as f:
            csv.writer(f).writerow([
                row.pexels_id, row.original_md5, row.original_sha256,
                row.category, row.processed_count, row.uploaded_objects, row.added_at
            ])
        self.pexels_ids.add(row.pexels_id)
        if row.original_md5:
            self.original_md5s.add(row.original_md5)
        if row.original_sha256:
            self.original_sha256s.add(row.original_sha256)
        for k in row.uploaded_objects.split(","):
            k = k.strip()
            if k:
                self.uploaded_objects.add(k)

    def gate1_pexels_id(self, pid: str) -> bool:
        if pid in self.pexels_ids:
            append_dupe_log("1", "pexels_id", pid, "ID already in materials-used.csv")
            return True
        return False

    def gate2_original_hash(self, md5: str, sha256: str, pid: str = "unknown") -> bool:
        hit = False
        if md5 and md5 in self.original_md5s:
            append_dupe_log("2", "md5", md5, f"MD5 exists (pid={pid})")
            hit = True
        if sha256 and sha256 in self.original_sha256s:
            append_dupe_log("2", "sha256", sha256, f"SHA256 exists (pid={pid})")
            hit = True
        return hit

    def _init_r2_client(self) -> None:
        from boto3 import client
        env = os.environ
        acc = env.get("R2_ACCOUNT_ID", "").strip()
        ak = env.get("R2_ACCESS_KEY_ID", "").strip()
        sk = env.get("R2_SECRET_ACCESS_KEY", "").strip()
        bn = env.get("R2_BUCKET_NAME", "").strip()
        if not (acc and ak and sk and bn):
            raise ValueError("Missing R2 env vars (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME)")
        self._r2_bucket = bn
        self._r2_client = client(
            "s3",
            endpoint_url=f"https://{acc}.r2.cloudflarestorage.com",
            aws_access_key_id=ak,
            aws_secret_access_key=sk,
            region_name="auto",
        )

    def _init_r2_originals_client(self) -> None:
        from boto3 import client
        env = os.environ
        acc = env.get("R2_ACCOUNT_ID", "").strip()
        ak = env.get("R2_ACCESS_KEY_ID", "").strip()
        sk = env.get("R2_SECRET_ACCESS_KEY", "").strip()
        bn = env.get("R2_ORIGINALS_BUCKET_NAME", "").strip()
        if not (acc and ak and sk and bn):
            raise ValueError("Missing R2 originals optional config: R2_ORIGINALS_BUCKET_NAME")
        self._r2_originals_bucket = bn
        self._r2_originals_client = client(
            "s3",
            endpoint_url=f"https://{acc}.r2.cloudflarestorage.com",
            aws_access_key_id=ak,
            aws_secret_access_key=sk,
            region_name="auto",
        )
        self._r2_originals_ok = True

    def r2_originals_find_key(self, category: str, pid_guess: str, slug: str = "") -> Optional[str]:
        if not self._r2_originals_ok or not self._r2_originals_client:
            return None
        pid = pid_guess or ""
        slug_clean = (slug or "").strip("/")
        cat = category or ""
        ext_guess = ["jpg", "jpeg", "png", "webp"]
        candidates = []
        for ext in ext_guess:
            if pid:
                candidates.append(f"{cat}/pexels-{pid}.{ext}")
                candidates.append(f"{cat}/pexels-{pid}-original.{ext}")
                candidates.append(f"{cat}/{cat}-pexels-{pid}-original.{ext}")
                candidates.append(f"{cat}/{pid}.{ext}")
                candidates.append(f"{cat}/{cat}-pexels-{pid}.{ext}")
                candidates.append(f"originals/{cat}/pexels-{pid}-original.{ext}")
            if slug_clean:
                candidates.append(f"{cat}/{slug_clean}.{ext}")
                candidates.append(f"{cat}/{slug_clean}-original.{ext}")
        for c_key in candidates:
            try:
                self._r2_originals_client.head_object(Bucket=self._r2_originals_bucket, Key=c_key)
                return c_key
            except Exception:
                continue
        return None

    def r2_originals_download_to_bytes(self, key: str) -> Optional[bytes]:
        if not self._r2_originals_ok or not self._r2_originals_client: return None
        try:
            r = self._r2_originals_client.get_object(Bucket=self._r2_originals_bucket, Key=key)
            return r["Body"].read()
        except Exception as e:
            _log(f"[R2Originals] Download FAILED key={key} err={e}", "ERROR")
            return None

    def r2_originals_upload_file(self, obj_key: str, local_file) -> bool:
        if not self._r2_originals_ok or not self._r2_originals_client:
            return False
        if not local_file.exists():
            return False
        try:
            ct = _guess_mime(obj_key, local_file)
            with open(local_file, "rb") as f:
                self._r2_originals_client.put_object(
                    Bucket=self._r2_originals_bucket,
                    Key=obj_key,
                    Body=f.read(),
                    ContentType=ct,
                )
            return True
        except Exception as e:
            _log(f"[R2Originals] Upload FAILED key={obj_key} err={e}", "WARN")
            return False

    def gate3_r2_object(self, obj_key: str) -> bool:
        if obj_key in self.uploaded_objects:
            append_dupe_log("3", "r2_path_local_set", obj_key, "Path in local uploaded_objects set")
            return True
        if self._r2_ok and self._r2_client:
            try:
                self._r2_client.head_object(Bucket=self._r2_bucket, Key=obj_key)
                append_dupe_log("3", "r2_path_head_200", obj_key, "HEAD 200 on R2, object already exists")
                self.uploaded_objects.add(obj_key)
                return True
            except Exception:
                return False
        return False

    def r2_upload_bytes(self, obj_key: str, data: bytes, content_type: Optional[str] = None) -> bool:
        if not self._r2_ok or not self._r2_client:
            _log(f"[R2] Skip upload (R2 not configured) key={obj_key}", "WARN")
            return False
        ct = content_type or mimetypes.guess_type(obj_key)[0] or "application/octet-stream"
        try:
            self._r2_client.put_object(
                Bucket=self._r2_bucket,
                Key=obj_key,
                Body=data,
                ContentType=ct,
                CacheControl="public, max-age=31536000, immutable"
            )
            self.uploaded_objects.add(obj_key)
            return True
        except Exception as e:
            _log(f"[R2] Upload FAILED key={obj_key} err={e}", "ERROR")
            return False

    def r2_obj_public_url(self, obj_key: str) -> str:
        base = os.environ.get("R2_PUBLIC_BASE_URL", R2_BASE).rstrip("/")
        return f"{base}/{obj_key}"


def _apply_workbuffyy_pp(img: Image.Image, is_original: bool) -> Dict[str, Image.Image]:
    w, h = img.size
    img = img.convert("RGB")
    border = random.randint(40, 60)
    angle = random.uniform(-0.8, 0.8)
    canvas = Image.new("RGB", (w + 2 * border, h + 2 * border), (0, 0, 0))
    try:
        blur = img.filter(ImageFilter.GaussianBlur(radius=max(2, border // 10)))
        bg = blur.resize((w + 2 * border, h + 2 * border))
    except Exception:
        bg = canvas
    canvas.paste(bg, (0, 0))
    canvas.paste(img, (border, border))
    canvas = canvas.rotate(angle, resample=Image.BICUBIC, fillcolor=(255, 255, 255))
    cw, ch = canvas.size
    left = (cw - w) // 2 + random.randint(-5, 5)
    top = (ch - h) // 2 + random.randint(-5, 5)
    img0 = canvas.crop((left, top, left + w, top + h))

    if not is_original:
        hue_shift = random.randint(-22, 22)
        sat_mult = random.uniform(0.88, 1.22)
        val_mult = random.uniform(0.90, 1.10)
        hsv = img0.convert("HSV")
        a = np.array(hsv).astype(np.int32)
        a[..., 0] = (a[..., 0].astype(np.int32) + hue_shift) % 256
        a[..., 1] = np.clip(a[..., 1].astype(np.float32) * sat_mult, 0, 255).astype(np.uint8)
        a[..., 2] = np.clip(a[..., 2].astype(np.float32) * val_mult, 0, 255).astype(np.uint8)
        img0 = Image.fromarray(a.astype(np.uint8), mode="HSV").convert("RGB")

    size_specs = [
        ("horizontal", (1920, 1080)),
        ("square", (1080, 1080)),
        ("vertical", (1080, 1920)),
    ]
    out: Dict[str, Image.Image] = {}
    for name, (tw, th) in size_specs:
        iw, ih = img0.size
        src_ratio = iw / ih
        dst_ratio = tw / th
        if src_ratio > dst_ratio:
            new_h = th
            new_w = int(round(th * src_ratio))
        else:
            new_w = tw
            new_h = int(round(tw / src_ratio))
        resized = img0.resize((new_w, new_h), Image.LANCZOS)
        off_x = (new_w - tw) // 2 + random.randint(-200, 200)
        off_y = (new_h - th) // 2 + random.randint(-200, 200)
        off_x = max(0, min(new_w - tw, off_x))
        off_y = max(0, min(new_h - th, off_y))
        cropped = resized.crop((off_x, off_y, off_x + tw, off_y + th))
        arr = np.array(cropped).astype(np.float32)
        gh, gw = arr.shape[:2]
        yy, xx = np.mgrid[0:gh, 0:gw]
        cy, cx = gh / 2.0, gw / 2.0
        dy = (yy - cy) / (gh / 2.0)
        dx = (xx - cx) / (gw / 2.0)
        dist = np.sqrt(dx * dx + dy * dy)
        vig = np.clip(1.0 - (dist ** 2) * 0.06, 0.92, 1.0)
        arr = np.clip(arr * vig[..., None], 0, 255)
        noise = np.random.normal(0, 0.8 * 2.55, arr.shape).astype(np.float32)
        arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
        out[name] = Image.fromarray(arr, mode="RGB")
    return out


def encode_webp(img: Image.Image, quality_range: Tuple[int, int] = (78, 85)) -> bytes:
    q = random.randint(*quality_range)
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=q, method=6)
    return buf.getvalue()


def make_watermark(processed: Dict[str, Image.Image]) -> Dict[str, bytes]:
    out: Dict[str, bytes] = {}
    for name, img in processed.items():
        iw, ih = img.size
        wm_img = img.copy()
        draw = ImageDraw.Draw(wm_img, "RGBA")
        text = "SendAFun.com"
        font_size = max(16, int(ih * 0.022))
        try:
            from PIL import ImageFont
            try:
                font = ImageFont.truetype("arial.ttf", font_size)
            except Exception:
                font = ImageFont.load_default()
        except Exception:
            font = None
        if font:
            bbox = draw.textbbox((0, 0), text, font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
        else:
            tw, th = len(text) * font_size, font_size
        margin_x = int(iw * 0.04) + random.randint(-12, 12)
        margin_y = int(ih * 0.04) + random.randint(-12, 12)
        x = iw - tw - margin_x
        y = ih - th - margin_y
        draw.text((x, y), text, fill=(255, 255, 255, int(255 * 0.15)), font=font)
        out[name] = encode_webp(wm_img)
    return out


def make_og(vertical_img: Image.Image) -> bytes:
    iw, ih = vertical_img.size
    target_w, target_h = 1200, 630
    src_ratio = iw / ih
    dst_ratio = target_w / target_h
    if src_ratio > dst_ratio:
        new_h = target_h
        new_w = int(round(target_h * src_ratio))
    else:
        new_w = target_w
        new_h = int(round(target_w / src_ratio))
    resized = vertical_img.resize((new_w, new_h), Image.LANCZOS)
    off_x = (new_w - target_w) // 2
    off_y = (new_h - target_h) // 2
    cropped = resized.crop((off_x, off_y, off_x + target_w, off_y + target_h))
    return encode_webp(cropped)


@dataclass
class SourceImage:
    source: str
    id: str
    category: str
    original_url: str
    local_path: Optional[Path] = None
    original_md5: str = ""
    original_sha256: str = ""
    dedupe_skipped: bool = False
    original_r2_key: str = ""
    pid_guess: str = ""
    error: Optional[str] = None


def _pexels_search(session: requests.Session, api_key: str, category: str, per_page: int,
                   page: int) -> List[Dict[str, Any]]:
    cat_label = CATEGORY_LABELS.get(category, category)
    q = f"{cat_label} greeting card background"
    try:
        r = session.get(
            "https://api.pexels.com/v1/search",
            headers={"Authorization": api_key},
            params={"query": q, "per_page": min(80, max(1, per_page)), "page": max(1, page), "orientation": "portrait"},
            timeout=30
        )
        if r.status_code == 429:
            _log("[Pexels] 429 rate limit, sleep 60s", "WARN")
            time.sleep(60)
            return []
        r.raise_for_status()
        return r.json().get("photos", []) or []
    except Exception as e:
        _log(f"[Pexels] Search err cat={category} page={page}: {e}", "ERROR")
        return []


def _pixabay_search(session: requests.Session, api_key: str, category: str, per_page: int,
                    page: int) -> List[Dict[str, Any]]:
    cat_label = CATEGORY_LABELS.get(category, category)
    q = f"{cat_label} greeting card background"
    try:
        r = session.get(
            "https://pixabay.com/api/",
            params={
                "key": api_key, "q": q,
                "per_page": min(200, max(3, per_page)),
                "page": max(1, page),
                "orientation": "vertical",
                "image_type": "photo",
                "safesearch": "true",
            },
            timeout=30
        )
        if r.status_code == 429:
            _log("[Pixabay] 429 rate limit, sleep 60s", "WARN")
            time.sleep(60)
            return []
        r.raise_for_status()
        return r.json().get("hits", []) or []
    except Exception as e:
        _log(f"[Pixabay] Search err cat={category} page={page}: {e}", "ERROR")
        return []


def collect_sources(gate: GateManager, session: requests.Session, weekly_n: int,
                    focus_categories: List[str]) -> List[SourceImage]:
    pexels_key = os.environ.get("PEXELS_API_KEY", "").strip()
    pixabay_key = os.environ.get("PIXABAY_API_KEY", "").strip()
    if not (pexels_key or pixabay_key):
        raise ValueError("Missing both PEXELS_API_KEY and PIXABAY_API_KEY in .env")
    cats = focus_categories or list(CATEGORY_LABELS.keys())
    random.shuffle(cats)
    out: List[SourceImage] = []
    out_ids: Set[str] = set()
    per_cat = max(1, int(weekly_n / max(1, len(cats))) + 2)
    page = 1
    pbar = tqdm(total=weekly_n, desc="Collect sources")
    while len(out) < weekly_n and page <= 20:
        for cat in cats:
            if len(out) >= weekly_n:
                break
            results: List[Dict[str, Any]] = []
            if pexels_key:
                results.extend(_pexels_search(session, pexels_key, cat, per_cat, page))
            if pixabay_key and len(results) < per_cat:
                results.extend(_pixabay_search(session, pixabay_key, cat, per_cat, page))
            random.shuffle(results)
            for ph in results:
                if len(out) >= weekly_n:
                    break
                pid = str(ph.get("id") or ph.get("photo_id") or "")
                if not pid:
                    continue
                uid = f"{cat}__{pid}"
                if uid in out_ids:
                    continue
                if gate.gate1_pexels_id(pid):
                    continue
                orig_url = ""
                src_name = "pexels"
                if "src" in ph and isinstance(ph["src"], dict):
                    orig_url = ph["src"].get("original") or ph["src"].get("large2x") or ph["src"].get("large") or ""
                elif "largeImageURL" in ph:
                    orig_url = ph["largeImageURL"]
                    src_name = "pixabay"
                if not orig_url:
                    continue
                out.append(SourceImage(source=src_name, id=pid, category=cat, original_url=orig_url))
                out_ids.add(uid)
                gate.pexels_ids.add(pid)
                pbar.update(1)
        page += 1
    pbar.close()
    _log(f"[Sources] Collected {len(out)} unique pending images")
    return out


def download_source(src: SourceImage, session: requests.Session, gate=None) -> SourceImage:
    if src.dedupe_skipped or src.error:
        return src
    ext = os.path.splitext(src.original_url.split("?")[0])[1].lower() or ".jpg"
    target = RAW_DIR / f"{src.category}_pexels_{src.id}{ext}"
    if target.exists() and target.stat().st_size > 10_000:
        src.local_path = target
    else:
        try:
            r = session.get(src.original_url, timeout=120, stream=True)
            r.raise_for_status()
            tmp = target.with_suffix(".tmp")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1024 * 1024):
                    if chunk:
                        f.write(chunk)
            tmp.replace(target)
            src.local_path = target
        except Exception as e:
            src.error = f"Download failed: {e}"
            return src
    try:
        src.original_md5 = md5_file(src.local_path)
        src.original_sha256 = sha256_file(src.local_path)
    except Exception as e:
        src.error = f"Hash failed: {e}"

    if (not src.error) and src.local_path and src.local_path.exists():
        try:
            with Image.open(src.local_path) as _im:
                w, h = _im.size
                long_side = max(w, h)
            if long_side < MIN_ORIGINAL_LONG_SIDE:
                src.error = f"size_too_small: long_side={long_side}px < {MIN_ORIGINAL_LONG_SIDE}px (PNG前置门槛)"
                _log(f"[SizeFilter] SKIP id={src.id} cat={src.category} {w}x{h} (long={long_side}px) — 低于 {MIN_ORIGINAL_LONG_SIDE}px (PNG转换前置门槛，丢弃不进入后续)")
        except Exception as _e:
            _log(f"[SizeFilter] WARN 读取尺寸失败 id={src.id}: {_e}", "WARN")

    if (not src.error) and src.local_path and src.local_path.exists() and (gate is not None):
        if gate._r2_originals_ok:
            try:
                ext = src.local_path.suffix.lstrip(".") or "jpg"
                keys_to_try = [f"{src.category}/pexels-{src.id}.{ext}",
                               f"{src.category}/{src.category}-pexels-{src.id}-original.{ext}",
                               f"{src.category}/pexels-{src.id}-original.{ext}"]
                for k in keys_to_try:
                    if gate.r2_originals_upload_file(k, src.local_path):
                        src.original_r2_key = k
                        _log(f"[R2Originals] OK backup originals: {k}")
                        break
                else:
                    _log(f"[R2Originals] WARN backup failed (all keys) id={src.id}", "WARN")
            except Exception as e:
                _log(f"[R2Originals] backup exc (skip main flow): {e}", "WARN")

    return src


def collect_existing_v2_sources(gate: GateManager, reuse_categories: Optional[List[str]] = None) -> List[SourceImage]:
    if not CARDS_META_JSON.exists():
        raise FileNotFoundError(CARDS_META_JSON)
    data = json.loads(CARDS_META_JSON.read_text(encoding="utf-8"))
    cards = data.get("cards", [])
    out: List[SourceImage] = []
    seen: Set[str] = set()
    for c in tqdm(cards, desc="Scan existing cards"):
        cat = c.get("category") or "birthday"
        if reuse_categories and cat not in reuse_categories:
            continue
        bg = c.get("bgImage") or ""
        if not bg.startswith("http"):
            continue
        slug = c.get("slug") or ""
        pid_guess = slug.rsplit("-", 1)[-1] if "-" in slug else slug
        if not pid_guess.isdigit():
            pid_guess = f"v2gen{abs(hash(bg)) % 10000000:07d}"
        uid = f"{cat}__v2orig__{pid_guess}"
        if uid in seen:
            continue
        seen.add(uid)
        r2_orig_key = gate.r2_originals_find_key(cat, pid_guess, slug) if gate._r2_originals_ok else None
        if r2_orig_key:
            src = SourceImage(source="r2originals", id=pid_guess, category=cat, original_url=bg,
                              original_r2_key=r2_orig_key, pid_guess=pid_guess)
            _log(f"[Reuse] OK originals HD found: {r2_orig_key}")
        else:
            src = SourceImage(source="r2existing", id=pid_guess, category=cat, original_url=bg, pid_guess=pid_guess)
        out.append(src)
    _log(f"[Reuse] Pending existing R2 images: {len(out)} (will regenerate v2 variants)")
    return out


def _process_one(args: Tuple[SourceImage, bool]) -> Optional[Dict[str, Any]]:
    src, dry_run = args
    if src.error:
        return None
    if not src.local_path and src.source not in ("r2existing", "r2originals"):
        return None
    try:
        if src.source == "r2existing":
            with retry_session() as s2:
                r = s2.get(src.original_url, timeout=120)
                r.raise_for_status()
                im = Image.open(io.BytesIO(r.content)).convert("RGB")
                b = io.BytesIO(r.content)
                b.seek(0)
                md5 = hashlib.md5(b.read()).hexdigest()
                b.seek(0)
                sha = hashlib.sha256(b.read()).hexdigest()
            src.original_md5 = md5
            src.original_sha256 = sha
        else:
            im = Image.open(src.local_path).convert("RGB")
        w, h = im.size
        long_side = max(w, h)
        if long_side < MIN_ORIGINAL_LONG_SIDE:
            _log(f"[SizeFilter] SKIP (process) src={src.source}:{src.id} cat={src.category} {w}x{h} long={long_side}px < {MIN_ORIGINAL_LONG_SIDE}px (PNG转换前置门槛，丢弃)")
            return None
        proc = _apply_workbuffyy_pp(im, is_original=False)
        result = {
            "src": src,
            "variants": {},
            "watermarks": {},
            "og_bytes": b"",
        }
        wm = make_watermark(proc)
        for name, b in wm.items():
            key = f"{src.category}/{src.category}-pexels-{src.id}-v2-{name}.webp"
            result["watermarks"][key + "::wm"] = b
        v = proc["vertical"]
        result["og_bytes"] = make_og(v)
        result["og_key"] = f"{src.category}-{slugify(src.category)}-pexels-{src.id}-v2-og.webp"
        if dry_run:
            return result
        return result
    except Exception as e:
        _log(f"[Process] FAILED src={src.source}:{src.id} err={e}", "ERROR")
        return None


def slugify(text: str) -> str:
    import re
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower())
    return re.sub(r"-+", "-", s).strip("-")


def _slug_for_card(cat: str, recipient_slug: str, title_label: str, pid: str, style: str) -> str:
    cat_label = CATEGORY_LABELS.get(cat, cat).lower()
    rlabel = (RECIPIENT_SLUG_LABEL.get(recipient_slug, recipient_slug)).lower()
    base = f"{cat_label}-{slugify(title_label)}-{rlabel}-{style}-{pid}"
    return slugify(base) + f"-v2-{abs(hash(pid+style+recipient_slug)) % 10000:04d}"


def generate_card_entries(src: SourceImage, vertical_v2_url: str, vertical_v2_wm_url: str,
                          og_url: str, recipient_mult: int) -> List[Dict[str, Any]]:
    cat = src.category
    cat_label = CATEGORY_LABELS.get(cat, cat)
    pid = src.id
    out: List[Dict[str, Any]] = []
    mults = RECIPIENT_MULT[:max(1, min(len(RECIPIENT_MULT), recipient_mult))]
    title_templates = [
        "Happy {cat} Card — Celebrate With Love · {style_noun} · {rlabel}",
        "Personalized {cat} E-Card · Online in 60 Seconds · {style_noun} · {rlabel}",
        "{cat} Wishes — Custom Digital Greeting Card · {style_noun} · {rlabel}",
        "Beautiful {cat} Card — Free Preview · Send Instantly · {style_noun} · {rlabel}",
    ]
    desc_base = (
        "Browse and personalize this {cat} e-card template for {rlabel}. "
        "Add your own message, choose fonts and colors, invite friends to co-sign, "
        "preview for free, then send beautifully animated digital cards from $1.99."
    )
    msg_base = (
        "Dear {rname},\n\nJust wanted to send you a little joy today. "
        "Thinking of you and sending all my love on this {cat}! "
        "You deserve every happiness — hope this card makes you smile. 💕\n\nWith love,\nMe"
    )
    intro = (
        "Looking for the perfect {cat} card for {rname}? You just found it. "
        "This premium template pairs a gorgeous, hand-edited {style_adj} photo background "
        "with fully customizable text, 6 beautiful fonts, unlimited colors, "
        "stickers, emoji animations, and group mode so 50+ friends can add their signatures "
        "for a truly unforgettable gift. Preview everything 100% free — only pay when you're ready to send, "
        "starting at just $1.99 per card or $6.99/month for unlimited sends and full access to our "
        "entire 27,000+ template library.\n\nHow it works: 1. Personalize your message with fonts & colors. "
        "2. Drop stickers, emoji and animations. 3. Optional: switch on group mode to collect signatures. "
        "4. Preview the final animated card, schedule delivery, and send instantly to any inbox."
    )
    for idx, (rslug, rname, style_label) in enumerate(mults):
        style = STYLES[(idx + hash(pid) % len(STYLES)) % len(STYLES)]
        style_noun = style.capitalize()
        style_adj = style
        rlabel = RECIPIENT_SLUG_LABEL.get(rslug, f"for {rname}")
        title = random.choice(title_templates).format(
            cat=cat_label, style_noun=style_noun, rlabel=rlabel
        )
        desc = desc_base.format(cat=cat_label.lower(), rlabel=rname)
        msg = msg_base.format(rname=rname, cat=cat_label.lower())
        intro_text = intro.format(cat=cat_label.lower(), rname=rname, style_adj=style_adj)
        slug = _slug_for_card(cat, rslug, title, pid, style)
        keywords = [
            f"{cat_label.lower()} card", f"{cat_label.lower()} ecard",
            f"{cat_label.lower()} card {rlabel}", f"personalized {cat_label.lower()} greeting",
            f"send {cat_label.lower()} card online", f"custom {cat_label.lower()} ecard",
        ]
        entry = {
            "slug": slug,
            "title": title,
            "category": cat,
            "tags": [cat_label.lower(), style, rslug, "sendafun-v2", "premium"],
            "style": style,
            "bgImage": vertical_v2_url,
            "bgImageWatermark": vertical_v2_wm_url,
            "defaultText": msg,
            "defaultFont": "'Inter', sans-serif",
            "defaultColor": "#1a1a1a",
            "defaultFilter": "classic",
            "aspectRatio": "3/4",
            "ogImage": og_url,
            "seo": {
                "title": title + " · SendAFun",
                "description": desc,
                "h1": f"{cat_label} Card {rlabel.capitalize()} — {style_noun} Custom Greeting",
                "keywords": keywords,
                "intro_text": intro_text,
                "og_image": og_url.split("/")[-1],
            }
        }
        out.append(entry)
    return out


def bulk_upsert_to_d1(new_cards: List[Dict[str, Any]], d1_base: str, token: str, batch_size: int = 100) -> Tuple[int, int, int]:
    """Returns (inserted, skipped, failed). Safe to retry: INSERT OR IGNORE on DB side."""
    from tqdm import tqdm as _tqdm
    if not new_cards:
        return 0, 0, 0
    endpoint = d1_base.rstrip("/") + "/api/cards/_bulk"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    sess = retry_session()
    inserted = 0
    skipped = 0
    failed = 0
    for i in _tqdm(range(0, len(new_cards), batch_size), desc="D1 bulk upsert"):
        batch = new_cards[i:i + batch_size]
        try:
            r = sess.post(endpoint, headers=headers, json={"cards": batch}, timeout=120)
            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
            j = r.json()
            inserted += int(j.get("inserted", 0))
            skipped += int(j.get("skipped", 0))
        except Exception as e:
            _log(f"[D1] Batch {i // batch_size} failed: {e}", "ERROR")
            failed += len(batch)
    _log(f"[D1] Summary: inserted={inserted} skipped(duplicate)={skipped} failed={failed}")
    return inserted, skipped, failed


def append_cards_meta(new_cards: List[Dict[str, Any]]) -> Path:
    if not CARDS_META_JSON.exists():
        raise FileNotFoundError(CARDS_META_JSON)
    ts = time.strftime("%Y%m%d-%H%M%S")
    backup = BACKUPS_DIR / f"cards-meta-{ts}.json.bak"
    shutil.copy2(CARDS_META_JSON, backup)
    _log(f"[CardsMeta] Backup saved: {backup.name}")
    data = json.loads(CARDS_META_JSON.read_text(encoding="utf-8"))
    existing_slugs: Set[str] = set()
    for c in data.get("cards", []):
        if isinstance(c, dict) and c.get("slug"):
            existing_slugs.add(c["slug"])
    added: List[Dict[str, Any]] = []
    for c in new_cards:
        base_slug = c.get("slug", "")
        if not base_slug:
            continue
        final_slug = base_slug
        i = 1
        while final_slug in existing_slugs:
            final_slug = f"{base_slug}-{i}"
            i += 1
        if final_slug != base_slug:
            c["slug"] = final_slug
            if "seo" in c and isinstance(c["seo"], dict):
                c["seo"]["og_image"] = final_slug + "-og.webp"
        data["cards"].append(c)
        existing_slugs.add(final_slug)
        added.append(c)
    CARDS_META_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    _log(f"[CardsMeta] Appended {len(added)} new cards. Total now: {len(data['cards'])}")
    return backup


def run_node(cmd_args: List[str]) -> int:
    try:
        r = subprocess.run(["node"] + cmd_args, cwd=str(ROOT_DIR), capture_output=True, text=True)
        if r.stdout:
            print(r.stdout)
        if r.stderr:
            print(r.stderr, file=sys.stderr)
        return r.returncode
    except Exception as e:
        _log(f"[Node] Failed to run node {cmd_args}: {e}", "ERROR")
        return 1


def git_commit_push() -> bool:
    if os.environ.get("GIT_AUTO_COMMIT", "true").lower() == "false":
        _log("[Git] GIT_AUTO_COMMIT=false, skip")
        return False
    cmds = [
        ["git", "pull", "--rebase"],
        ["git", "add", "_material-library/materials-used.csv", "_material-library/duplicates-log.txt",
         "public/cards-meta.json", "public/sitemap.xml", "public/sitemap-cards.xml", "public/sitemap-pages.xml", "public/robots.txt"],
        ["git", "commit", "-m", f"feat(materials): weekly expand {time.strftime('%Y-%m-%d')}"],
        ["git", "push"],
    ]
    for cmd in cmds:
        try:
            r = subprocess.run(cmd, cwd=str(ROOT_DIR), capture_output=True, text=True)
            if r.returncode != 0 and cmd[1] != "commit":
                _log(f"[Git] {cmd[1]} FAILED: {r.stderr}", "ERROR")
                return False
            if cmd[1] == "commit" and "nothing to commit" in (r.stdout + r.stderr):
                _log("[Git] Nothing new to commit")
                return True
        except Exception as e:
            _log(f"[Git] {cmd[1]} EXCEPTION: {e}", "ERROR")
            return False
    _log("[Git] commit + push OK")
    return True


def purge_cloudflare_cache(new_card_slugs: List[str]) -> bool:
    zone_id = os.environ.get("CF_ZONE_ID", "").strip()
    tok = os.environ.get("CF_API_TOKEN", "").strip()
    domain = os.environ.get("CLOUDFLARE_DOMAIN", "sendafun.com").strip()
    if not (zone_id and tok):
        _log("=" * 72)
        _log("[CF] ⚠️  自动清缓存跳过：.env 缺少 CF_ZONE_ID / CF_API_TOKEN")
        _log("[CF]    → 请手动按下面 4 步清 Cloudflare 缓存（1 分钟搞定）：")
        _log("[CF]    1) 打开 https://dash.cloudflare.com/ → 点 sendafun.com 域名")
        _log("[CF]    2) 左侧菜单选 🔄 Caching → Configuration")
        _log("[CF]    3) 找到 Purge Cache → 点右边 【Purge Everything】蓝色按钮")
        _log("[CF]    4) 弹窗里再次点 【Purge Everything】确认 → 30 秒缓存全清")
        _log("[CF]    💡 精确清（可选，只清受影响的 URL，速度快）：")
        _log(f"[CF]      → Purge by URL 里粘贴：sitemap.xml sitemap-cards.xml sitemap-pages.xml /discover /latest /trending /api/cards /api/cards/search")
        if new_card_slugs:
            sample = ", ".join([f"/card/{s}" for s in new_card_slugs[:5]])
            _log(f"[CF]      → 再加前 5 张新卡片：{sample} ...")
        _log(f"[CF]    ℹ️  注意：Sitemap 现在是 Worker 从 D1 实时生成，不再需要跑 _generate-sitemap.js 生成静态文件")
        _log(f"[CF]    🔑 配置自动清缓存的方法（下次不用手动）：")
        _log(f"[CF]      → 打开 .env，填 CF_ZONE_ID + CF_API_TOKEN（参考 .env.example 注释）")
        _log("=" * 72)
        return False
    files = [
        f"https://{domain}/sitemap.xml",
        f"https://{domain}/sitemap-cards.xml",
        f"https://{domain}/sitemap-pages.xml",
        f"https://{domain}/discover",
        f"https://{domain}/latest",
        f"https://{domain}/trending",
        f"https://{domain}/api/cards",
        f"https://{domain}/api/cards/search",
    ]
    for s in new_card_slugs[:22]:
        files.append(f"https://{domain}/card/{s}")
    try:
        with retry_session() as s:
            r = s.post(
                f"https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache",
                headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                json={"files": files},
                timeout=30,
            )
            r.raise_for_status()
        _log(f"[CF] ✅ 自动清缓存成功，共清理 {len(files)} 个 URL")
        _log(f"[CF]   → 已包含 sitemap×3 + Discover/Trending/Latest + 前 {min(22, len(new_card_slugs))} 张新卡片页")
        return True
    except Exception as e:
        _log(f"[CF] ❌ 自动清缓存失败：{e}", "ERROR")
        _log(f"[CF]   → 请按上述「Purge Everything」手动步骤清缓存即可")
        return False


def _backup_material_lib_r2(gate: GateManager) -> None:
    if not gate._r2_ok or not gate._r2_client:
        return
    ts = time.strftime("%Y%m%d-%H%M%S")
    for f in (MATERIALS_CSV, DUPLICATES_LOG):
        try:
            data = f.read_bytes()
            key = f"_material-library-backup/{ts}/{f.name}"
            gate.r2_upload_bytes(key, data, "text/csv" if f.suffix == ".csv" else "text/plain")
        except Exception as e:
            _log(f"[R2Backup] {f.name} FAILED: {e}", "WARN")


def main() -> int:
    parser = argparse.ArgumentParser(description="SendAFun Material Expand Pipeline (Workbuffy++)")
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--weekly", type=int, help="Weekly new mode: number of NEW Pexels/Pixabay images to download")
    g.add_argument("--reuse-existing-first", action="store_true", help="Mode A: re-process existing R2 images (no new downloads)")
    parser.add_argument("--focus-categories", type=str, default="", help="Comma-separated categories to focus, e.g. wedding,baby-shower,pet")
    parser.add_argument("--reuse-categories", type=str, default="", help="Comma-separated categories for --reuse-existing-first (default all)")
    parser.add_argument("--recipient-multiply", type=int, default=3, help="How many recipient variants per image (1-6, default 3)")
    parser.add_argument("--max-images", type=int, default=0, help="Cap number of images processed (for dry-run testing)")
    parser.add_argument("--dry-run", action="store_true", help="Skip upload to R2 + skip git push + no append to cards-meta")
    parser.add_argument("--upload-only", action="store_true", help="Only download → dedupe → process → upload to R2. Skip cards-meta/sitemap/git (use Workbuffy for bindings)")
    parser.add_argument("--no-git", action="store_true", help="Disable git commit/push even if GIT_AUTO_COMMIT=true")
    parser.add_argument("--skip-d1", action="store_true", help="Skip Cloudflare D1 bulk upsert (fallback: keep only local cards-meta update)")
    parser.add_argument("--d1-api-base-url", type=str, default="", help="D1 Worker API base, e.g. http://localhost:8787 or https://sendafun.com (default $D1_API_BASE_URL env)")
    parser.add_argument("--d1-batch-size", type=int, default=100, help="How many cards per POST to /api/cards/_bulk (default 100)")
    args = parser.parse_args()

    load_dotenv(ROOT_DIR / ".env")
    if args.no_git or args.upload_only:
        os.environ["GIT_AUTO_COMMIT"] = "false"

    ensure_dirs()
    logfile = _log_init()
    _init_logger(logfile)
    _log("====== SendAFun Material Expand Pipeline Start ======")
    _log(f"Args: {vars(args)}")

    session = retry_session()
    gate = GateManager()
    cp = load_checkpoint()

    focus_cats = [s.strip() for s in args.focus_categories.split(",") if s.strip()]
    reuse_cats = [s.strip() for s in args.reuse_categories.split(",") if s.strip()]

    sources: List[SourceImage] = []
    if args.reuse_existing_first:
        sources = collect_existing_v2_sources(gate, reuse_cats or None)
    else:
        sources = collect_sources(gate, session, args.weekly, focus_cats)

    if args.max_images and args.max_images > 0:
        sources = sources[:args.max_images]
        _log(f"[Cap] --max-images={args.max_images}, truncating sources list")

    if not sources:
        _log("No sources to process. Exit.", "WARN")
        return 0

    pending_downloads: List[SourceImage] = [s for s in sources if s.source not in ("r2existing",)]
    pending_r2originals = [s for s in sources if s.source == "r2originals" and s.original_r2_key]
    if pending_r2originals:
        _log(f"[Download] R2 Originals Pending: {len(pending_r2originals)} HD images (from sendafun-originals private bucket)")
        n_ro = min(16, max(2, (os.cpu_count() or 4)))
        with ThreadPoolExecutor(max_workers=n_ro * 2) as pool:
            def dl_ro(src_i):
                try:
                    raw = gate.r2_originals_download_to_bytes(src_i.original_r2_key)
                    if not raw:
                        src_i.error = f"Originals download empty key={src_i.original_r2_key}"
                        return src_i
                    ext_hint = ""
                    kl = src_i.original_r2_key.lower()
                    for e in (".jpg", ".jpeg", ".png", ".webp"):
                        if kl.endswith(e): ext_hint = e; break
                    if not ext_hint:
                        import imghdr
                        ext_hint = "." + (imghdr.what(None, h=raw[:32]) or "jpg")
                    target_ro = RAW_DIR / f"{src_i.category}_orig_pexels_{src_i.id}{ext_hint}"
                    with open(target_ro, "wb") as fo: fo.write(raw)
                    src_i.local_path = target_ro
                    src_i.original_md5 = md5_file(target_ro)
                    src_i.original_sha256 = sha256_file(target_ro)
                except Exception as e2:
                    src_i.error = f"Originals download failed: {e2}"
                return src_i
            futs_ro = [pool.submit(dl_ro, s) for s in pending_r2originals]
            ro_ok = 0
            ro_fail = 0
            for f_ro in tqdm(as_completed(futs_ro), total=len(futs_ro), desc="Download Originals HD"):
                s_ro = f_ro.result()
                if s_ro.error or not s_ro.local_path:
                    ro_fail += 1
                    s_ro.source = "r2existing"
                    _log(f"[Download] Originals failed for id={s_ro.id}, fallback to public bgImage", "WARN")
                else:
                    if not gate.gate2_original_hash(s_ro.original_md5, s_ro.original_sha256, s_ro.id):
                        ro_ok += 1
                    else:
                        s_ro.dedupe_skipped = True
                        try: s_ro.local_path.unlink(missing_ok=True)
                        except Exception: pass
            _log(f"[Download] Originals OK={ro_ok} Fail/Dupe-Skip={ro_fail + len([x for x in pending_r2originals if x.dedupe_skipped])}")

    if pending_downloads:
        _log(f"[Download] Pending: {len(pending_downloads)} images")
        n_cpu = min(16, max(2, (os.cpu_count() or 4)))
        with ThreadPoolExecutor(max_workers=n_cpu * 2) as pool:
            futures = [pool.submit(download_source, s, session, gate) for s in pending_downloads]
            dl_ok = 0
            dl_fail = 0
            for f in tqdm(as_completed(futures), total=len(futures), desc="Download images"):
                s = f.result()
                if s.error or not s.local_path:
                    dl_fail += 1
                else:
                    if not gate.gate2_original_hash(s.original_md5, s.original_sha256, s.id):
                        dl_ok += 1
                    else:
                        s.dedupe_skipped = True
                        try:
                            s.local_path.unlink(missing_ok=True)
                        except Exception:
                            pass
            _log(f"[Download] OK={dl_ok} Fail/Dupe-Skip={dl_fail + len([x for x in pending_downloads if x.dedupe_skipped])}")

    processable: List[SourceImage] = [s for s in sources if not s.dedupe_skipped and not s.error and (s.source == "r2existing" or s.local_path)]
    _log(f"[Process] Pending: {len(processable)} images (skipped dedupe/error: {len(sources) - len(processable)})")
    if not processable:
        _log("Nothing to process after dedupe. Exit.", "WARN")
        return 0

    n_proc = max(1, min(4, (os.cpu_count() or 2)))
    _log(f"[Process] Using ProcessPool with {n_proc} workers (reduced from 8 to avoid Windows OOM process kill)")
    process_args: List[Tuple[SourceImage, bool]] = [(s, args.dry_run) for s in processable]
    processed_results: List[Dict[str, Any]] = []
    try:
        with ProcessPoolExecutor(max_workers=n_proc) as pool:
            for res in tqdm(pool.map(_process_one, process_args, chunksize=4), total=len(process_args), desc="Process Workbuffy++"):
                if res is not None:
                    processed_results.append(res)
                    src = res["src"]
                    n_v = len(res["variants"])
                    n_w = len(res["watermarks"])
                    n_og = 1 if res.get("og_bytes") else 0
                    _log(
                        f"[Process] OK: {src.category}-pexels-{src.id} → "
                        f"variants={n_v}, watermarks={n_w}, og={n_og} | "
                        f"filename prefix: {src.category}/{src.category}-pexels-{src.id}-* "
                        f"(e.g. ...-v2-vertical.webp / ...-v2-og.webp)"
                    )
    except Exception as e:
        _log(f"[Process] Pool exception: {e}", "ERROR")
        _log("[Process] Fallback to sequential processing...", "WARN")
        for a in tqdm(process_args, desc="Fallback process"):
            res = _process_one(a)
            if res:
                processed_results.append(res)
                src = res["src"]
                n_v = len(res["variants"])
                n_w = len(res["watermarks"])
                n_og = 1 if res.get("og_bytes") else 0
                _log(
                    f"[Process] OK: {src.category}-pexels-{src.id} → "
                    f"variants={n_v}, watermarks={n_w}, og={n_og} | "
                    f"filename prefix: {src.category}/{src.category}-pexels-{src.id}-* "
                    f"(e.g. ...-00-horizontal.webp / ...-v2-vertical.webp)"
                )

    _log(f"[Process] OK: {len(processed_results)} processed bundles")
    if not processed_results:
        return 0

    uploaded_keys: List[str] = []
    public_urls_for_cards: List[Tuple[SourceImage, str, str, str]] = []
    if args.dry_run or not gate._r2_ok:
        _log("[Upload] Skip R2 upload (dry_run or R2 not configured). Will still generate card entries.")
        for r in processed_results:
            src = r["src"]
            cat = src.category
            pid = src.id
            v_key = f"{cat}/{cat}-pexels-{pid}-v2-vertical.webp"
            wm_key = v_key
            og_k = r["og_key"]
            v_url = gate.r2_obj_public_url(v_key)
            w_url = gate.r2_obj_public_url(wm_key)
            og_url = gate.r2_obj_public_url(og_k)
            public_urls_for_cards.append((src, v_url, w_url, og_url))
    else:
        upload_items: List[Tuple[str, bytes]] = []
        for r in processed_results:
            for tagged_key, data in r["watermarks"].items():
                key = tagged_key.split("::")[0]
                upload_items.append((key, data))
            if r.get("og_key") and r.get("og_bytes"):
                upload_items.append((r["og_key"], r["og_bytes"]))
        _log(f"[Upload] Pending objects: {len(upload_items)}")
        up_ok = 0
        up_fail = 0
        with ThreadPoolExecutor(max_workers=min(32, max(4, (os.cpu_count() or 4) * 4))) as pool:
            futs = []
            for key, data in upload_items:
                if gate.gate3_r2_object(key):
                    uploaded_keys.append(key)
                    continue
                futs.append(pool.submit(gate.r2_upload_bytes, key, data))
            for f in tqdm(as_completed(futs), total=len(futs), desc="Upload R2"):
                if f.result():
                    up_ok += 1
                else:
                    up_fail += 1
        _log(f"[Upload] R2 OK={up_ok} Fail={up_fail}")
        for r in processed_results:
            src = r["src"]
            cat = src.category
            pid = src.id
            v_key = f"{cat}/{cat}-pexels-{pid}-v2-vertical.webp"
            v_url = gate.r2_obj_public_url(v_key)
            w_url = v_url
            og_url = gate.r2_obj_public_url(r["og_key"]) if r.get("og_key") else v_url
            public_urls_for_cards.append((src, v_url, w_url, og_url))

    if args.upload_only and not args.dry_run:
        import csv
        ts = time.strftime("%Y%m%d-%H%M%S")
        csv_path = MATERIAL_LIB_DIR / f"upload-batch-{ts}.csv"
        rows_out: List[List[str]] = []

        def _sz(k: str) -> str:
            b = k.rsplit("/", 1)[-1].replace(".webp", "")
            if b.endswith("-horizontal"):
                return "horizontal"
            if b.endswith("-square"):
                return "square"
            if b.endswith("-vertical"):
                return "vertical"
            if b.endswith("-og"):
                return "og"
            return "unknown"

        for r in processed_results:
            src = r["src"]
            cat = src.category
            pid = src.id
            for tagged_key in r.get("variants", {}).keys():
                key = tagged_key.split("::")[0]
                rows_out.append([pid, cat, "variant", _sz(key), key, gate.r2_obj_public_url(key)])
            for tagged_key in r.get("watermarks", {}).keys():
                key = tagged_key.split("::")[0]
                rows_out.append([pid, cat, "watermark", _sz(key), key, gate.r2_obj_public_url(key)])
            if r.get("og_key") and r.get("og_bytes"):
                key = r["og_key"]
                rows_out.append([pid, cat, "og", "og", key, gate.r2_obj_public_url(key)])

        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(["pexels_id", "category", "file_type", "size_label", "r2_object_key", "public_url"])
            w.writerows(rows_out)
        _log(f"[Upload-Only] Batch CSV saved: {csv_path} ({len(rows_out)} rows — feed directly to Workbuffy)")

    new_cards: List[Dict[str, Any]] = []
    recipient_n = max(1, min(len(RECIPIENT_MULT), args.recipient_multiply))
    if not args.upload_only:
        for src, v_url, w_url, og_url in public_urls_for_cards:
            entries = generate_card_entries(src, v_url, w_url, og_url, recipient_n)
            new_cards.extend(entries)
        _log(f"[CardsMeta] Generated {len(new_cards)} new card entries ({recipient_n} recipient variants each)")
    else:
        _log("[Upload-Only Mode] Skip cards-meta entries generation (use Workbuffy for bindings)")

    added_rows_count = 0
    backup_path = None
    if not args.dry_run:
        if not args.upload_only:
            d1_base = args.d1_api_base_url or os.environ.get("D1_API_BASE_URL", "http://localhost:8787")
            d1_token = os.environ.get("CARDS_BULK_API_TOKEN", "").strip()
            use_d1 = (not args.skip_d1 and bool(d1_token))
            if use_d1:
                _log(f"[D1] Upserting {len(new_cards)} new cards → {d1_base} (batch size: {args.d1_batch_size})")
                try:
                    d1_ins, d1_skip, d1_fail = bulk_upsert_to_d1(
                        new_cards, d1_base, d1_token, args.d1_batch_size
                    )
                    added_rows_count = max(added_rows_count, d1_ins)
                    if d1_fail > 0:
                        _log(f"[D1] ⚠️ FAILED {d1_fail} cards — re-run script to retry (idempotent safe)", "WARN")
                except Exception as e:
                    _log(f"[D1] ❌ Fatal during upsert: {e}", "ERROR")
                    raise
            else:
                if args.skip_d1:
                    _log("[D1] --skip-d1 set, skip D1 upsert")
                elif not d1_token:
                    _log("[D1] ⚠️ CARDS_BULK_API_TOKEN not set in .env — skip D1 upsert (fallback: local cards-meta.json only)", "WARN")
            backup_path = append_cards_meta(new_cards)
            added_rows_count = max(added_rows_count, len(new_cards))
        for r in processed_results:
            src = r["src"]
            uploaded_for_row = ""
            if r.get("variants"):
                keys = [k.split("::")[0] for k in r["variants"].keys()]
                if r.get("og_key"):
                    keys.append(r["og_key"])
                uploaded_for_row = ",".join(keys)
            row = MaterialRow(
                pexels_id=src.id,
                original_md5=src.original_md5,
                original_sha256=src.original_sha256,
                category=src.category,
                processed_count=len(r.get("variants", {})) + len(r.get("watermarks", {})) + (1 if r.get("og_bytes") else 0),
                uploaded_objects=uploaded_for_row,
                added_at=time.strftime("%Y-%m-%dT%H:%M:%SZ")
            )
            gate.append_row(row)

        if gate._r2_ok:
            _backup_material_lib_r2(gate)

        if not args.upload_only:
            _log("[Sitemap] ℹ️  不再生成静态 sitemap 文件 → Worker 从 D1 实时生成（/sitemap.xml, /sitemap-cards.xml, /sitemap-pages.xml）")
            _log("[Sitemap] ✅ 新卡已写入 D1，sitemap 自动同步，刷新即可看到最新 URL")

            slugs_for_purge = [c["slug"] for c in new_cards[:30]]
            purge_cloudflare_cache(slugs_for_purge)

            git_commit_push()
        else:
            _log("[Upload-Only Mode] Skip sitemap + CF cache purge + git commit (use Workbuffy for bindings)")

    clear_checkpoint()
    _log(f"====== Pipeline FINISHED ======")
    _log(f"  Mode: {'Upload-Only (no cards/sitemap/git)' if args.upload_only else 'Full pipeline'}")
    _log(f"  New sources processed: {len(processed_results)}")
    _log(f"  New card entries generated: {len(new_cards)}")
    _log(f"  Appended to cards-meta.json: {added_rows_count} (dry_run={args.dry_run})")
    if args.upload_only and not args.dry_run:
        _log(f"  ➡️  Upload batch CSV (for Workbuffy): look in _material-library/upload-batch-*.csv (latest by mod time)")
    _log(f"  Full log: {logfile}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        _log("Interrupted by user, checkpoint saved", "WARN")
        try:
            save_checkpoint({"interrupted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")})
        except Exception:
            pass
        sys.exit(130)
    except Exception as e:
        _log(f"FATAL ERROR: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        sys.exit(2)
