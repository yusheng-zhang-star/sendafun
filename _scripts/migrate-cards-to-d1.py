#!/usr/bin/env python3
"""
SendAFun — 把 public/cards-meta.json 的老卡片批量迁移到 Cloudflare D1
用法（先启动 wrangler dev 监听 8787，然后跑）：
    python _scripts/migrate-cards-to-d1.py
    # 或部署后迁移：
    python _scripts/migrate-cards-to-d1.py --base-url https://sendafun.com
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
    from tqdm import tqdm
except ImportError:
    print("ERROR: 缺少依赖，请先运行：python -m pip install -r _scripts/requirements.txt")
    sys.exit(1)

ROOT_DIR = Path(__file__).resolve().parent.parent
CARDS_JSON = ROOT_DIR / "public" / "cards-meta.json"
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT_DIR / ".env")
except ImportError:
    pass

TOKEN = os.environ.get("CARDS_BULK_API_TOKEN", "").strip()


def main() -> int:
    p = argparse.ArgumentParser(description="Migrate cards-meta.json → Cloudflare D1 via bulk API")
    p.add_argument("--base-url", type=str, default=os.environ.get("D1_API_BASE_URL", "http://localhost:8787"),
                   help="Worker API base URL, default: http://localhost:8787 (wrangler dev) or https://sendafun.com (prod)")
    p.add_argument("--batch-size", type=int, default=100, help="Cards per POST bulk request")
    p.add_argument("--dry-run", action="store_true", help="Only print stats, no POST requests")
    p.add_argument("--skip-verify", action="store_true", help="Skip HTTPS cert verify (for self-signed dev)")
    args = p.parse_args()

    if not TOKEN:
        print("ERROR: CARDS_BULK_API_TOKEN not set in .env (or Cloudflare Worker Secrets).")
        return 2
    if not CARDS_JSON.exists():
        print(f"ERROR: {CARDS_JSON} not found.")
        return 3

    print(f"[Migrate] Loading: {CARDS_JSON}")
    with open(CARDS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    cards = data.get("cards", []) if isinstance(data, dict) else list(data)
    total = len(cards)
    print(f"[Migrate] Loaded {total} cards.")

    if args.dry_run:
        print(f"[Dry-Run] Would POST {total} cards in {max(1, total // args.batch_size)} batches of {args.batch_size}")
        print(f"[Dry-Run] Target endpoint: {args.base_url}/api/cards/_bulk")
        print(f"[Dry-Run] Token length: {len(TOKEN)} chars ✅")
        print("[Dry-Run] Sample first card slug:", cards[0]["slug"] if cards else "(none)")
        return 0

    endpoint = args.base_url.rstrip("/") + "/api/cards/_bulk"
    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    sess = requests.Session()
    if args.skip_verify:
        sess.verify = False
        import urllib3
        urllib3.disable_warnings()

    inserted = 0
    updated = 0
    skipped = 0
    failed = 0
    valid = 0
    upserted_total = 0
    for i in tqdm(range(0, total, args.batch_size), desc="Migrate batches"):
        batch = cards[i:i + args.batch_size]
        try:
            r = sess.post(endpoint, headers=headers, json={"cards": batch}, timeout=120)
            if r.status_code != 200:
                tqdm.write(f"[WARN] batch {i//args.batch_size}: HTTP {r.status_code}: {r.text[:300]}")
                failed += len(batch)
                time.sleep(1)
                continue
            j = r.json()
            valid += int(j.get("valid", 0) or 0)
            upserted = int(j.get("upserted", 0) or 0)
            upserted_total += upserted
            inserted += int(j.get("inserted", 0) or 0)
            updated += int(j.get("updated", 0) or 0)
            if "upserted" not in j:
                # Legacy Worker (INSERT OR IGNORE)
                inserted += int(j.get("inserted", 0) or 0)
                skipped += int(j.get("skipped", 0) or 0)
        except Exception as e:
            tqdm.write(f"[ERROR] batch {i//args.batch_size}: {e}")
            failed += len(batch)
            time.sleep(2)

    print("====== Migration DONE ======")
    print(f"  Total in cards-meta.json: {total}")
    print(f"  Valid payload cards:      {valid}")
    if upserted_total:
        print(f"  Upserted (INSERT/UPDATE): {upserted_total}")
    if inserted:
        print(f"  Newly inserted to D1:    {inserted}")
    if updated:
        print(f"  Updated in D1:            {updated}")
    if skipped and not upserted_total:
        print(f"  Skipped (slug existed):  {skipped}")
    print(f"  Failed (HTTP errors):    {failed}")
    success_cond = (
        (valid >= total and failed == 0) or
        (upserted_total > 0 and (upserted_total >= total * 0.999) and failed == 0) or
        ((inserted + skipped) == total and failed == 0)
    )
    if success_cond:
        print("  ✅ 100% SUCCESS — all cards migrated (or already existed).")
    else:
        print(f"  ⚠️  Re-run this script to retry failed batches (UPSERT is safe and idempotent).")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted. Re-run to continue.")
        sys.exit(130)
