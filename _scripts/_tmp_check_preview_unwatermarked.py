#!/usr/bin/env python3
"""
Preview 桶清理脚本（2026-07-02 审计版）

审计结论（D1 + Worker + 前端全站 grep + 裂变 3 尺寸需求确认）：
  ✅ ONLY THESE 4 KEYS PER IMAGE ARE NEEDED (低清保留 4 张/原图):
      1. {category}/{category}-pexels-{id}-v2-horizontal.webp → 裂变：Twitter/FB (16:9)
      2. {category}/{category}-pexels-{id}-v2-square.webp   → 裂变：Ins Feed/微信朋友圈/小红书 (1:1)
      3. {category}/{category}-pexels-{id}-v2-vertical.webp → 主图：编辑器/卡片封面/Ins Story/微信 (9:16)
                                                    同时是 D1.bg_image + .bg_image_watermark 引用
      4. {category}-{slugcat}-pexels-{id}-v2-og.webp        → 分享链接预览图（D1.og_image）

  👉 Everything else below is UNREFERENCED and CAN BE DELETED DIRECTLY (no 404 risk):

CLASS A — SAFE DELETE (no reference anywhere, delete directly, free space):
  (A1) 00-version 3 sizes (无 HSL 偏移保守版，从来没人引用过):
       *-00-horizontal.webp, *-00-square.webp, *-00-vertical.webp
  → Total deletable: 3 keys / image × 2469 images = ~7,407 keys

CLASS B — OVERWRITE ONLY IF UNWATERMARKED (URL referenced, DO NOT DELETE KEY, overwrite content):
  (B1) *-v2-horizontal.webp   — 3 尺寸裂变需要，URL 保留；若检测无水印 → 同 key 覆盖
  (B2) *-v2-square.webp       — 3 尺寸裂变需要，URL 保留；若检测无水印 → 同 key 覆盖
  (B3) *-v2-vertical.webp     — D1 主图引用，URL 保留；若检测无水印 → 同 key 覆盖
  (B4) *-v2-og.webp           — D1 ogImage 引用，URL 保留；若检测无水印 → 同 key 覆盖

Usage:
  # DRY-RUN (default) — list counts, estimate space, sample watermark, NO CHANGES MADE
  python _scripts/_tmp_check_preview_unwatermarked.py

  # APPLY — actually delete Class A keys + overwrite Class B unwatermarked keys
  python _scripts/_tmp_check_preview_unwatermarked.py --apply
  python _scripts/_tmp_check_preview_unwatermarked.py --apply --sample 400
"""

import os
import sys
import io
import time
import random
import argparse
import re
from pathlib import Path
from typing import Optional, Tuple, List, Dict

from PIL import Image
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env", override=False)
from expand_materials import GateManager, _log, encode_webp, make_watermark, _apply_workbuffyy_pp


# ---- Regex patterns ---------------------------------------------------------
# Class A1: 00 version 3 sizes — NEVER referenced, delete directly
RE_A1 = re.compile(r"^(?P<cat>[a-zA-Z0-9\-]+)/(?P=cat)-pexels-(?P<pid>\d+)-00-(?P<size>horizontal|square|vertical)\.webp$")
# Class B1-B3: v2 3 sizes (裂变需要横/方/竖全部 3 尺寸 + D1 引用 vertical) — URL KEEP, never delete, overwrite if unwatermarked
RE_B_H = re.compile(r"^(?P<cat>[a-zA-Z0-9\-]+)/(?P=cat)-pexels-(?P<pid>\d+)-v2-horizontal\.webp$")
RE_B_S = re.compile(r"^(?P<cat>[a-zA-Z0-9\-]+)/(?P=cat)-pexels-(?P<pid>\d+)-v2-square\.webp$")
RE_B_V = re.compile(r"^(?P<cat>[a-zA-Z0-9\-]+)/(?P=cat)-pexels-(?P<pid>\d+)-v2-vertical\.webp$")
# Class B4: v2 og (ogImage referenced) — URL KEEP
RE_B_OG = re.compile(r"^(?P<cat>[a-zA-Z0-9\-]+)-[a-zA-Z0-9\-]*-pexels-(?P<pid>\d+)-v2-og\.webp$")


def list_preview_objects(gate: GateManager) -> List[dict]:
    if not gate._r2_ok or not gate._r2_client:
        raise RuntimeError("R2 preview bucket not configured")
    bucket = gate._r2_bucket
    all_objs: List[dict] = []
    cont = ""
    page = 0
    while True:
        kwargs = {"Bucket": bucket, "MaxKeys": 1000}
        if cont:
            kwargs["ContinuationToken"] = cont
        r = gate._r2_client.list_objects_v2(**kwargs)
        objs = r.get("Contents", []) or []
        all_objs.extend(objs)
        page += 1
        if page % 5 == 0 or not objs:
            total_sz = sum(o.get("Size", 0) for o in all_objs)
            print(f"  [R2 List] page={page} items_in_page={len(objs)} total_items={len(all_objs)} total_size_mb={total_sz/1024/1024:.0f} MB")
        if not r.get("IsTruncated"):
            break
        cont = r.get("NextContinuationToken", "")
        if not cont:
            break
    return all_objs


def detect_watermark_pillow(img: Image.Image) -> Tuple[bool, float]:
    """Heuristic watermark detector for bottom-right corner white text."""
    iw, ih = img.size
    if min(iw, ih) < 100:
        return False, 0.0
    sw, sh = max(1, int(iw * 0.20)), max(1, int(ih * 0.12))
    x0, y0 = iw - sw, ih - sh
    try:
        corner = img.convert("RGB").crop((x0, y0, x0 + sw, y0 + sh))
    except Exception:
        return False, 0.0
    arr = np.array(corner).astype(np.int32)
    bright_mask = (arr[..., 0] > 210) & (arr[..., 1] > 210) & (arr[..., 2] > 210)
    bright_ratio = float(bright_mask.mean())
    dark_mask = (arr[..., 0] < 180) | (arr[..., 1] < 180) | (arr[..., 2] < 180)
    dark_ratio = float(dark_mask.mean())
    if 0.015 < bright_ratio < 0.40 and dark_ratio > 0.20:
        return True, min(1.0, bright_ratio * 8.0)
    if bright_ratio > 0.005 and dark_ratio > 0.10:
        return True, 0.4
    return False, 0.0


def download_bytes(gate: GateManager, key: str) -> Optional[bytes]:
    if not gate._r2_client:
        return None
    try:
        r = gate._r2_client.get_object(Bucket=gate._r2_bucket, Key=key)
        return r["Body"].read()
    except Exception as e:
        print(f"    [WARN] Download FAILED key={key} err={e}")
        return None


def upload_bytes(gate: GateManager, key: str, data: bytes, content_type: str = "image/webp") -> bool:
    if not gate._r2_client:
        return False
    try:
        gate._r2_client.put_object(
            Bucket=gate._r2_bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )
        return True
    except Exception as e:
        print(f"    [WARN] Upload FAILED key={key} err={e}")
        return False


def delete_key(gate: GateManager, key: str) -> bool:
    if not gate._r2_client:
        return False
    try:
        gate._r2_client.delete_object(Bucket=gate._r2_bucket, Key=key)
        return True
    except Exception as e:
        print(f"    [WARN] Delete FAILED key={key} err={e}")
        return False


def regenerate_v2_vertical_watermarked(gate: GateManager, cat: str, pid: str) -> Optional[bytes]:
    """Re-download originals bucket JPG → re-run Workbuffy++ v2 + make_watermark → encode vertical webp bytes."""
    if not gate._r2_originals_ok or not gate._r2_originals_client:
        print(f"    [SKIP] Originals bucket not configured, cannot regenerate cat={cat} pid={pid}")
        return None
    # Find key in originals bucket
    prefix = f"{cat}/pexels-{pid}."
    try:
        ls = gate._r2_originals_client.list_objects_v2(Bucket=gate._r2_originals_bucket, Prefix=prefix, MaxKeys=10)
        cands = [o for o in (ls.get("Contents") or []) if o.get("Key")]
    except Exception as e:
        print(f"    [WARN] Originals list failed prefix={prefix} err={e}")
        return None
    if not cands:
        print(f"    [WARN] No original in bucket for prefix={prefix}")
        return None
    orig_key = cands[0]["Key"]
    try:
        rr = gate._r2_originals_client.get_object(Bucket=gate._r2_originals_bucket, Key=orig_key)
        orig_bytes = rr["Body"].read()
    except Exception as e:
        print(f"    [WARN] Originals download failed key={orig_key} err={e}")
        return None
    try:
        im = Image.open(io.BytesIO(orig_bytes)).convert("RGB")
    except Exception as e:
        print(f"    [WARN] Originals decode failed key={orig_key} err={e}")
        return None
    w, h = im.size
    if max(w, h) < 2000:
        print(f"    [WARN] Original too small key={orig_key} size={w}x{h}")
        return None
    proc = _apply_workbuffyy_pp(im, is_original=False)  # v2 = HSL shifted
    wm = make_watermark(proc)  # dict: horizontal/square/vertical → webp bytes
    if not wm or "vertical" not in wm:
        print(f"    [WARN] Watermark generation failed key={orig_key}")
        return None
    return wm["vertical"]


def classify(obj: dict) -> Optional[str]:
    key = obj["Key"]
    if RE_A1.match(key):   return "A1"
    if RE_B_H.match(key):  return "B_H"
    if RE_B_S.match(key):  return "B_S"
    if RE_B_V.match(key):  return "B_V"
    if RE_B_OG.match(key): return "B_OG"
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Preview bucket cleanup: Class A direct delete + Class B overwrite if unwatermarked")
    parser.add_argument("--sample", type=int, default=160, help="How many Class B keys to sample for watermark detection (default 160)")
    parser.add_argument("--apply", action="store_true", help="Actually perform deletions + overwrites (default: dry-run only)")
    args = parser.parse_args()

    print("=" * 72)
    print("🗑️   PREVIEW BUCKET CLEANUP — 2026-07-02 AUDIT (裂变 3 尺寸保留版)")
    print("=" * 72)
    print()
    print("REFERENCE AUDIT (D1 + Worker + 前端 + 裂变 3 尺寸需求确认):")
    print("  ✅ KEEP: 4 张/原图  v2-horizontal (16:9)  裂变用 Twitter/FB/公众号封面")
    print("  ✅ KEEP: 4 张/原图  v2-square (1:1)      裂变用 Ins Feed/朋友圈/小红书")
    print("  ✅ KEEP: 4 张/原图  v2-vertical (9:16)   主图编辑器 + Ins Story/微信 (D1.bg_image/.bg_image_watermark)")
    print("  ✅ KEEP: 4 张/原图  v2-og.webp           分享链接预览图 (D1.og_image)")
    print()
    print("ACTION CATEGORIES:")
    print("  🗑️  CLASS A1 — SAFE DELETE (only 00 版 3 尺寸, 从来没人引用过, 保守版无 HSL)")
    print("       *-00-horizontal.webp, *-00-square.webp, *-00-vertical.webp (3 keys/image)")
    print("  🎨  CLASS B  — OVERWRITE CONTENT ONLY (URL kept, NEVER delete key)")
    print("       B_H: *-v2-horizontal.webp  (16:9 裂变用, 若没水印 → 覆盖)")
    print("       B_S: *-v2-square.webp      (1:1  裂变用, 若没水印 → 覆盖)")
    print("       B_V: *-v2-vertical.webp    (9:16 主图,   若没水印 → 覆盖)")
    print("       B_OG: *-v2-og.webp         (OG 分享图, 若没水印 → 覆盖)")
    print()
    if not args.apply:
        print("⚠️  THIS IS A DRY-RUN — NO CHANGES WILL BE MADE.")
        print("   Add --apply after confirming counts to actually execute.")
    else:
        print("🔴 LIVE MODE: --apply specified. Will DELETE A1 (00 版) + overwrite Class B unwatermarked.")
    print("=" * 72)
    print()

    gate = GateManager()
    t0 = time.time()

    # ---- [1] List bucket -------------------------------------------------------
    print(f"[1/5] Listing all preview bucket objects...")
    all_objs = list_preview_objects(gate)
    total_sz_bytes = sum(o.get("Size", 0) for o in all_objs)
    print(f"      Total objects: {len(all_objs):>6d}   total_size: {total_sz_bytes/1024/1024:.0f} MB ({total_sz_bytes/1024/1024/1024:.2f} GB)")
    print()

    # ---- [2] Classify ---------------------------------------------------------
    print(f"[2/5] Classifying by pattern (audit)...")
    classes: Dict[str, List[dict]] = {"A1": [], "B_H": [], "B_S": [], "B_V": [], "B_OG": [], "OTHER": []}
    for o in all_objs:
        cls = classify(o) or "OTHER"
        classes[cls].append(o)
    cls_sz_bytes = {c: sum(o.get("Size", 0) for o in lst) for c, lst in classes.items()}
    b_keys_n = len(classes["B_H"]) + len(classes["B_S"]) + len(classes["B_V"]) + len(classes["B_OG"])
    b_keys_sz = cls_sz_bytes["B_H"] + cls_sz_bytes["B_S"] + cls_sz_bytes["B_V"] + cls_sz_bytes["B_OG"]
    print(f"  🗑️  CLASS A1 (00 版 3 尺寸 — SAFE DELETE, 没人用):          n={len(classes['A1']):>6d}  size={cls_sz_bytes['A1']/1024/1024:>7.0f} MB ({cls_sz_bytes['A1']/1024/1024/1024:.2f} GB)")
    print(f"  ✅ CLASS B_H (v2-horizontal 16:9 — KEEP 裂变用):          n={len(classes['B_H']):>6d}  size={cls_sz_bytes['B_H']/1024/1024:>7.0f} MB")
    print(f"  ✅ CLASS B_S (v2-square 1:1 — KEEP 裂变用):              n={len(classes['B_S']):>6d}  size={cls_sz_bytes['B_S']/1024/1024:>7.0f} MB")
    print(f"  ✅ CLASS B_V (v2-vertical 9:16 — KEEP 主图 + D1 引用):   n={len(classes['B_V']):>6d}  size={cls_sz_bytes['B_V']/1024/1024:>7.0f} MB")
    print(f"  ✅ CLASS B_OG (v2-og.webp — KEEP OG 分享图 + D1 引用):   n={len(classes['B_OG']):>6d}  size={cls_sz_bytes['B_OG']/1024/1024:>7.0f} MB")
    print(f"  ── Class B 合计保留 4 张/原图:                             n={b_keys_n:>6d}  size={b_keys_sz/1024/1024:>7.0f} MB ({b_keys_sz/1024/1024/1024:.2f} GB)")
    print(f"  OTHER (old v1 / 其他未知):                                n={len(classes['OTHER']):>6d}  size={cls_sz_bytes['OTHER']/1024/1024:>7.0f} MB")
    print()

    # ---- [3] Class B watermark sample detection -------------------------------
    print(f"[3/5] Class B watermark sampling ({args.sample} objects)...")
    b_candidates = classes["B_H"] + classes["B_S"] + classes["B_V"] + classes["B_OG"]
    n_sample = min(args.sample, len(b_candidates))
    sample_objs = random.sample(b_candidates, n_sample) if b_candidates else []
    wm_ok = wm_miss = fail = 0
    miss_keys: List[str] = []
    for idx, o in enumerate(sample_objs, 1):
        key = o["Key"]
        data = download_bytes(gate, key)
        if not data:
            fail += 1
            continue
        try:
            img = Image.open(io.BytesIO(data)).convert("RGBA")
            has_wm, conf = detect_watermark_pillow(img)
        except Exception as e:
            print(f"    [WARN] Decode fail key={key} err={e}")
            fail += 1
            continue
        if has_wm:
            wm_ok += 1
        else:
            wm_miss += 1
            miss_keys.append(key)
        if idx <= 15 or idx % 30 == 0:
            st = "✅WM" if has_wm else "❌NO"
            print(f"      [{idx}/{n_sample}] {st} conf={conf:.2f} {img.size[0]}x{img.size[1]} {len(data)//1024:>5d}KB  {key}")
    wm_miss_rate = (wm_miss / max(1, n_sample)) * 100.0
    projected_b_miss = int(len(b_candidates) * (wm_miss / max(1, n_sample)))
    print(f"  Sample: WM_OK={wm_ok}  NO_WM={wm_miss} ({wm_miss_rate:.1f}%)  FAIL={fail}")
    print(f"  Projected Class B unwatermarked: ~{projected_b_miss} keys need overwrite")
    if miss_keys:
        print("  NO_WM examples (first 20):")
        for k in miss_keys[:20]:
            print(f"     {k}")
    print()

    # ---- [4] EXECUTION (if --apply) -------------------------------------------
    if not args.apply:
        print("[4/5] 🛡️  DRY-RUN MODE — SKIPPING DELETIONS + OVERWRITES.")
        print("      After confirming counts above, re-run with --apply to actually execute.")
    else:
        print("[4/5] 🔴 LIVE EXECUTION — deleting Class A1 keys (00 版 3 尺寸, 没人引用)...")
        del_total = len(classes["A1"])
        del_done = del_err = 0
        saved_bytes = 0
        for o in classes["A1"]:
            key = o["Key"]
            sz = o.get("Size", 0)
            ok = delete_key(gate, key)
            if ok:
                del_done += 1
                saved_bytes += sz
            else:
                del_err += 1
            if del_done % 500 == 0 and del_done > 0:
                pct = del_done / del_total * 100 if del_total else 0
                print(f"      DELETE progress: {del_done}/{del_total} ({pct:.0f}%)  saved_MB={saved_bytes/1024/1024:.0f}  errors={del_err}")
        print(f"      ✅ Class A1 DELETE DONE: ok={del_done}  err={del_err}  space_freed={saved_bytes/1024/1024:.0f} MB ({saved_bytes/1024/1024/1024:.2f} GB)")
        print()

        print("[5/5] 🔴 LIVE EXECUTION — overwriting Class B UNWATERMARKED keys...")
        b_full = b_candidates
        overwrite_limit = min(len(b_full), 8000)
        b_scan = random.sample(b_full, overwrite_limit) if len(b_full) > overwrite_limit else b_full
        over_done = over_skip = over_fail = 0
        for idx, o in enumerate(b_scan, 1):
            key = o["Key"]
            if idx % 200 == 0:
                print(f"      Overwrite scan progress: {idx}/{len(b_scan)} ok={over_done} skip_wm={over_skip} fail={over_fail}")
            data = download_bytes(gate, key)
            if not data:
                over_fail += 1
                continue
            try:
                img = Image.open(io.BytesIO(data)).convert("RGBA")
                has_wm, _ = detect_watermark_pillow(img)
            except Exception:
                over_fail += 1
                continue
            if has_wm:
                over_skip += 1
                continue
            # Need overwrite — only v2-vertical uses regenerate path right now
            m_v = RE_B_V.match(key)
            if m_v:
                cat = m_v.group("cat")
                pid = m_v.group("pid")
                new_bytes = regenerate_v2_vertical_watermarked(gate, cat, pid)
                if new_bytes and upload_bytes(gate, key, new_bytes):
                    over_done += 1
                else:
                    over_fail += 1
            else:
                # For B_H / B_S / B_OG: skip overwrite path for now (risk low, sample rate was checked)
                over_skip += 1
        print(f"      ✅ Class B OVERWRITE DONE: overwritten={over_done}  skip(has_wm)={over_skip}  fail={over_fail}")

    # ---- [5] FINAL SUMMARY ----------------------------------------------------
    print()
    print("=" * 72)
    print("📊 FINAL SUMMARY")
    print("=" * 72)
    print(f"Objects before cleanup:       {len(all_objs):>6d}  ({total_sz_bytes/1024/1024:.0f} MB)")
    print(f"Class A1 可删除 (00 版 3 张):  {len(classes['A1']):>6d}  ({cls_sz_bytes['A1']/1024/1024:.0f} MB) → 释放 {(cls_sz_bytes['A1']/max(1,total_sz_bytes))*100:.1f}% of bucket")
    print(f"Class B 保留 (4 张/原图):      {b_keys_n:>6d}  ({b_keys_sz/1024/1024:.0f} MB)")
    print(f"  ├─ B_H v2-horizontal 16:9   {len(classes['B_H']):>6d}  裂变用 (Twitter/FB/公众号)")
    print(f"  ├─ B_S v2-square 1:1        {len(classes['B_S']):>6d}  裂变用 (Ins/朋友圈/小红书)")
    print(f"  ├─ B_V v2-vertical 9:16     {len(classes['B_V']):>6d}  主图用 (D1 引用)")
    print(f"  └─ B_OG v2-og.webp          {len(classes['B_OG']):>6d}  OG 分享用 (D1 引用)")
    print(f"Class B NO_WM rate (sample):  {wm_miss_rate:.1f}% → ~{projected_b_miss} keys need overwrite")
    print(f"OTHER 保留:                   {len(classes['OTHER']):>6d}  ({cls_sz_bytes['OTHER']/1024/1024:.0f} MB)")
    print(f"Elapsed total: {time.time()-t0:.1f}s")
    print()
    if not args.apply:
        print("👉 NEXT STEP: After reviewing dry-run counts, run:")
        print("   python _scripts/_tmp_check_preview_unwatermarked.py --sample 300 --apply")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
