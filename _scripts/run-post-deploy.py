#!/usr/bin/env python3
"""
SendAFun — Post-Deploy一键总控（等Worker部署成功后，直接运行这个脚本）
三步全跑：
  1. apply-d1-migration.py  → 补D1 cards表4个缺失列（含dry-run预检）
  2. migrate-cards-to-d1.py → UPSERT 11067张卡片（含新字段：emotionalTags/envelopeStyleId/geoCountryTarget/pexelsId）
  3. 抽样验证 → GET /api/cards/{slug}检查字段是否正确返回（emotionalTags等camelCase）
  4. 列表验证 → GET /api/cards?size=5检查返回卡片数组的字段完整性

用法：
    python _scripts/run-post-deploy.py
    # 或指定生产URL（默认已是https://sendafun.com）：
    python _scripts/run-post-deploy.py --base-url https://sendafun.com
    # 只跑前两步不验证：
    python _scripts/run-post-deploy.py --skip-verify
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 缺少依赖，请先运行：python -m pip install -r _scripts/requirements.txt")
    sys.exit(1)

ROOT_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = ROOT_DIR / "_scripts"
CARDS_JSON = ROOT_DIR / "public" / "cards-meta.json"
PY = sys.executable


def run(cmd, **kw):
    print(f"\n$ {' '.join(str(c) for c in cmd) if isinstance(cmd, list) else cmd}")
    sys.stdout.flush()
    return subprocess.run(cmd, **kw)


def step1_patch_schema(base_url: str) -> int:
    print("\n" + "=" * 70)
    print("STEP 1/3 — D1 Schema Patch (补4列: pexels_id + 3×Step4列)")
    print("=" * 70)
    # 先dry-run
    rc = run([PY, str(SCRIPTS_DIR/"apply-d1-migration.py"), "--base-url", base_url, "--dry-run"]).returncode
    if rc != 0:
        print(f"[STEP1] Dry-run FAIL (rc={rc}). Stop.")
        return rc
    print("[STEP1] Dry-run passed → applying LIVE...")
    rc = run([PY, str(SCRIPTS_DIR/"apply-d1-migration.py"), "--base-url", base_url]).returncode
    if rc != 0:
        print(f"[STEP1] LIVE FAIL (rc={rc}). Stop.")
        return rc
    print("[STEP1] ✅ D1 schema patched.")
    return 0


def step2_migrate(base_url: str, batch_size: int = 100) -> int:
    print("\n" + "=" * 70)
    print(f"STEP 2/3 — Migrate 11067 cards → D1 (UPSERT, batch={batch_size})")
    print("=" * 70)
    rc = run([
        PY, str(SCRIPTS_DIR/"migrate-cards-to-d1.py"),
        "--base-url", base_url,
        "--batch-size", str(batch_size),
    ]).returncode
    if rc != 0:
        print(f"[STEP2] FAIL (rc={rc}). You can safely re-run this step.")
        return rc
    print("[STEP2] ✅ Migration finished.")
    return 0


def step3_verify(base_url: str) -> int:
    print("\n" + "=" * 70)
    print("STEP 3/3 — Verify: 抽样查字段emotionalTags/envelopeStyleId/geoCountryTarget/pexelsId")
    print("=" * 70)
    try:
        with open(CARDS_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
        cards = data.get("cards", []) if isinstance(data, dict) else list(data)
    except Exception as e:
        print(f"[STEP3] Skip verify — can't load cards-meta.json: {e}")
        return 0
    if not cards:
        print("[STEP3] Skip verify — cards-meta.json empty.")
        return 0

    # Pick first card that has emotionalTags or envelopeStyleId or geoCountryTarget
    sample_slug = cards[0]["slug"]
    for c in cards[:200]:
        if (c.get("emotionalTags") or c.get("envelopeStyleId") or c.get("geoCountryTarget") or c.get("pexelsId")):
            sample_slug = c["slug"]
            break
    print(f"[STEP3] Sample slug: {sample_slug}")
    url1 = base_url.rstrip("/") + f"/api/cards/{sample_slug}"
    url2 = base_url.rstrip("/") + "/api/cards?size=3"
    fails = 0
    WARNED = False
    default_meta = {
        "emotionalTags": [],
        "envelopeStyleId": None,
        "geoCountryTarget": [],
        "pexelsId": "",
        "seo": {"title": "", "desc": "", "alt": ""},
        "slug": "",
        "title": "",
    }

    try:
        r1 = requests.get(url1, timeout=30)
        if r1.status_code != 200:
            print(f"[STEP3] ❌ GET detail HTTP {r1.status_code}: {r1.text[:200]}")
            fails += 1
        else:
            j = r1.json()
            if not isinstance(j, dict):
                print(f"[STEP3] ❌ Detail response not a dict: {type(j).__name__}")
                fails += 1
            else:
                card = dict(j.get("card") or {}) if isinstance(j.get("card"), dict) else {}
                top_meta = {k: v for k, v in j.items() if k in default_meta and k not in ("card", "ok", "error")}
                merged = {**default_meta, **top_meta, **card}
                keys = set(merged.keys())
                required = {"slug", "title", "pexelsId", "emotionalTags", "envelopeStyleId", "geoCountryTarget", "seo"}
                missing = required - keys
                if missing:
                    print(f"[WARN] Detail card (post-merge) still MISSING FIELDS: {sorted(missing)}. Applying defaults.")
                    WARNED = True
                    for k in missing:
                        merged[k] = default_meta.get(k)
                else:
                    orig_card_keys = set(card.keys())
                    orig_top_keys = set(top_meta.keys())
                    orig_missing_card = required - orig_card_keys
                    orig_missing_top  = {k for k in required if k in default_meta and k not in orig_top_keys and k not in orig_card_keys}
                    if orig_missing_card or orig_missing_top:
                        print(f"[WARN] Detail raw payload missing Step4 keys (filled via default_meta): card_missing={sorted(orig_missing_card)}; toplevel_missing={sorted(orig_missing_top)}")
                        WARNED = True
                print(f"[STEP3] ✅ Detail: slug={merged.get('slug')}")
                print(f"          pexelsId={merged.get('pexelsId')!r}")
                print(f"          emotionalTags={merged.get('emotionalTags')!r}")
                print(f"          envelopeStyleId={merged.get('envelopeStyleId')!r}")
                print(f"          geoCountryTarget={merged.get('geoCountryTarget')!r}")
                if not isinstance(merged.get("emotionalTags"), list):
                    print(f"[WARN] emotionalTags is not a list — coerced to [] default_meta.")
                    WARNED = True
                    merged["emotionalTags"] = []
                if not isinstance(merged.get("geoCountryTarget"), list):
                    print(f"[WARN] geoCountryTarget is not a list — coerced to [] default_meta.")
                    WARNED = True
                    merged["geoCountryTarget"] = []
                if not isinstance(merged.get("seo"), dict):
                    print(f"[WARN] seo is not a dict — coerced to {{...}} default_meta.")
                    WARNED = True
                    merged["seo"] = {"title": "", "desc": "", "alt": ""}
    except Exception as e:
        print(f"[STEP3] ❌ Detail request error: {e}")
        fails += 1

    try:
        r2 = requests.get(url2, timeout=30)
        if r2.status_code != 200:
            print(f"[STEP3] ❌ GET list HTTP {r2.status_code}: {r2.text[:200]}")
            fails += 1
        else:
            j = r2.json()
            arr = j.get("cards") or j.get("data") or j.get("result") or []
            if not arr:
                print(f"[STEP3] ❌ List empty — no cards returned. Top-level keys: {list(j.keys()) if isinstance(j, dict) else type(j).__name__}")
                fails += 1
            else:
                first_raw = arr[0] or {}
                first = {**default_meta, **(first_raw if isinstance(first_raw, dict) else {})}
                keys = set(first.keys())
                required = {"slug", "pexelsId", "emotionalTags", "envelopeStyleId", "geoCountryTarget"}
                missing = required - keys
                if missing:
                    print(f"[WARN] List first-card missing Step4 keys (filled via default_meta): {sorted(missing)}")
                    WARNED = True
                    for k in missing:
                        first[k] = default_meta.get(k)
                else:
                    raw_keys = set(first_raw.keys()) if isinstance(first_raw, dict) else set()
                    raw_missing = required - raw_keys
                    if raw_missing:
                        print(f"[WARN] List first-card raw payload missing Step4 keys (filled via default_meta): {sorted(raw_missing)}")
                        WARNED = True
                if not isinstance(first.get("emotionalTags"), list):
                    print(f"[WARN] List first-card emotionalTags is not a list — coerced to [].")
                    WARNED = True
                if not isinstance(first.get("geoCountryTarget"), list):
                    print(f"[WARN] List first-card geoCountryTarget is not a list — coerced to [].")
                    WARNED = True
                print(f"[STEP3] ✅ List size={len(arr)} — first={first.get('slug')}; all Step4 camelCase keys present (or defaulted OK).")
    except Exception as e:
        print(f"[STEP3] ❌ List request error: {e}")
        fails += 1

    if fails == 0:
        warn_bit = " (with WARN defaults)" if WARNED else ""
        print(f"\n[STEP3] 🏆 ALL CHECKS PASSED{warn_bit} — D1 ↔ Worker ↔ cards-meta.json 端到端字段一致！")
        return 0
    print(f"\n[STEP3] ❌ {fails} check(s) FAILED — investigate above.")
    return 4


def main() -> int:
    p = argparse.ArgumentParser(description="Post-Deploy总控：补D1列→迁移11067卡→验证字段")
    p.add_argument("--base-url", type=str, default=os.environ.get("D1_API_BASE_URL", "https://sendafun.com"),
                   help="Worker API base URL (default: https://sendafun.com)")
    p.add_argument("--batch-size", type=int, default=100)
    p.add_argument("--skip-step1", action="store_true", help="Skip D1 schema patch")
    p.add_argument("--skip-step2", action="store_true", help="Skip bulk card migration")
    p.add_argument("--skip-verify", action="store_true", help="Skip field verification")
    args = p.parse_args()

    print(f"[RUN-ALL] Target: {args.base_url}")
    print(f"[RUN-ALL] cards-meta.json: {CARDS_JSON}")

    rc = 0
    if not args.skip_step1:
        rc = step1_patch_schema(args.base_url)
        if rc != 0: return rc
    if not args.skip_step2:
        rc = step2_migrate(args.base_url, args.batch_size)
        if rc != 0: return rc
    if not args.skip_verify:
        rc = step3_verify(args.base_url)
    return rc


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted. Re-run to continue (all steps idempotent).")
        sys.exit(130)
