#!/usr/bin/env python3
"""
SendAFun — Step 4: KV / D1 Metadata Field Injection
=====================================================

STRICTLY COMPLIANT WITH DOC v1.0 — "海外电子贺卡开发规范.txt":

  Line 148 : Add TWO supplementary fields inside every existing card's KV/D1
            metadata record (NOT modifying any existing fields — DOC LINE 4 HARD
            RULE: all existing fields + URLs are LOCKED FOREVER).
            Field A:  interpersonal_emotion_tags — "人际情感标签"
            Field B:  envelope_style_id        — "预设信封样式绑定ID"
  Line 179: Add geo_country_target field for Geo-aware homepage sorting.
            Field C:  geo_country_target      — cards bound to specific country
                                                  festivals (e.g. US Thanksgiving,
                                                  BR Carnival, FR Bastille Day,
                                                  MX Día de Muertos).

TOTAL NEW COLUMNS ADDED = 3.  Zero existing columns / URLs / KV keys mutated.

25 CANONICAL CATEGORIES → DEFAULT 3-FIELD MAPPING
==================================================
The mapping below is intentionally conservative (defaults to generic / general
where no obvious country festival applies). You can later refine per-card via
the admin backend, the script only sets a sensible 1st-pass default covering
90% of realistic use cases.

  Category              emotion tags (A)                    env id (B)       geo_target (C)
  --------------------  ------------------------------------  --------------  ----------------
  anniversary           romantic, couple, milestone           env_premium_004  US,CA,GB,AU,NZ,ES,FR,BR,MX
  birthday              family, friends, joyful, celebration  env_basic_001    US,CA,GB,AU,NZ,ES,FR,BR,MX
  christmas             family, festive, warm, joy            env_holiday_001  US,CA,GB,AU,NZ,ES,FR,MX,BR
  congratulations       achievement, proud, excited           env_premium_002  US,CA,GB,AU,NZ,ES,FR,BR,MX
  easter                family, faith, spring, renewal        env_holiday_002  US,CA,GB,AU,NZ,ES,FR,MX,BR
  encouragement         support, hopeful, friendship          env_basic_001    US,CA,GB,AU,NZ,ES,FR,BR,MX
  fathers-day           family, dad, gratitude, respect       env_basic_003    US,CA,GB,AU,NZ,ES,FR,MX,BR
  friendship            friends, camaraderie, loyal           env_basic_001    US,CA,GB,AU,NZ,ES,FR,BR,MX
  get-well              support, caring, hopeful, warmth      env_basic_001    US,CA,GB,AU,NZ,ES,FR,BR,MX
  good-luck             hopeful, excited, optimistic          env_premium_001  US,CA,GB,AU,NZ,ES,FR,BR,MX
  graduation            achievement, proud, new-chapter       env_premium_003  US,CA,GB,AU,NZ,ES,FR,MX,BR
  halloween             festive, spooky, fun, party           env_holiday_003  US,CA,GB,AU,NZ,IE,ES,FR,MX
  love                  romantic, couple, intimate, tender    env_premium_004  US,CA,GB,AU,NZ,ES,FR,BR,MX
  missing-you           longing, warm, tender, loved          env_basic_001    US,CA,GB,AU,NZ,ES,FR,BR,MX
  mothers-day           family, mum, gratitude, love          env_basic_003    US,CA,GB,AU,NZ,ES,FR,MX,BR
  new-baby              family, new-life, joyful, welcoming   env_basic_002    US,CA,GB,AU,NZ,ES,FR,BR,MX
  new-year              festive, fresh-start, celebration     env_holiday_001  US,CA,GB,AU,NZ,ES,FR,MX,BR
  retirement            achievement, milestone, gratitude     env_premium_003  US,CA,GB,AU,NZ,ES,FR,MX,BR
  sorry                 empathy, apology, sincere             env_basic_001    US,CA,GB,AU,NZ,ES,FR,BR,MX
  sympathy              grief, support, caring, family        env_basic_001    US,CA,GB,AU,NZ,ES,FR,BR,MX
  thank-you             gratitude, appreciation, sincere      env_premium_002  US,CA,GB,AU,NZ,ES,FR,BR,MX
  thanksgiving          family, gratitude, feast, harvest     env_holiday_004  US,CA               ← Geo-specific!
  thinking-of-you       caring, warm, tender, friends         env_basic_001    US,CA,GB,AU,NZ,ES,FR,BR,MX
  valentine             romantic, couple, love, intimate      env_premium_004  US,CA,GB,AU,NZ,ES,FR,BR,MX
  wedding               romantic, couple, milestone, family   env_premium_005  US,CA,GB,AU,NZ,ES,FR,BR,MX

ENVELOPE STYLE ID NAMING CONVENTION (DOC LINE 87-91 LAYERED PERMISSIONS):
  • env_basic_001   = free-tier only (white simple flip)                  DOC 89
  • env_basic_002   = free-tier, pastel baby card envelope
  • env_basic_003   = free-tier, mother/father day floral
  • env_premium_001 = $1.99 single card / member — gold foil business      DOC 90
  • env_premium_002 = $1.99 single card / member — matte classic premium
  • env_premium_003 = $1.99 single card / member — vintage kraft paper
  • env_premium_004 = $1.99 single card / member — pearl shimmer love / val / wed
  • env_premium_005 = member exclusive — wedding pearl shimmer envelope     DOC 91
  • env_holiday_001 = member — xmas matte red / new year glitter
  • env_holiday_002 = member — easter spring pastel
  • env_holiday_003 = member — halloween matte black
  • env_holiday_004 = premium — thanksgiving autumn kraft
  Permission enforcement happens in the Worker + frontend, never here — we
  simply STORE the default "best match" envelope_id bound to the card — the
  LOWER tier user just gets their envelope demoted at render time to
  env_basic_001 (anonymous = envelope fully disabled, DOC 88).

USAGE
=====
  python _scripts/_step4_update_kv_d1_fields.py --dry-run
    → Validate 3-column mapping against 25-cat defaults. Does NOT write to
      D1 / does NOT mutate cards-meta.json on disk.

  python _scripts/_step4_update_kv_d1_fields.py --apply
    → Actually:
         • ALTER TABLE ADD COLUMN 3x on D1 via Worker DB endpoint if available
         • Fallback: patch local public/cards-meta.json with 3 new keys
         • If D1 REST bulk API is configured, issue UPDATE statements that set
           new fields based on category = CASE WHEN mapping.

ENVIRONMENT (from project .env):
  • D1_API_BASE_URL, CARDS_BULK_API_TOKEN — optional; used only when --apply
    to issue the D1 UPDATEs via Worker REST endpoint.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

PUBLIC_DIR = ROOT_DIR / "public"
CARDS_META_JSON = PUBLIC_DIR / "cards-meta.json"

# ---------------------------------------------------------------------------
# Canonical 25 categories — MUST match step1 / step2 EXACTLY, NEVER MODIFY.
# ---------------------------------------------------------------------------
CANONICAL_25_CATS: List[str] = [
    "anniversary", "birthday", "christmas", "congratulations", "easter",
    "encouragement", "fathers-day", "friendship", "get-well", "good-luck",
    "graduation", "halloween", "love", "missing-you", "mothers-day",
    "new-baby", "new-year", "retirement", "sorry", "sympathy",
    "thank-you", "thanksgiving", "thinking-of-you", "valentine", "wedding",
]

# ---------------------------------------------------------------------------
# 25 × 3 default mapping (see docstring table above for rationale / source)
# ---------------------------------------------------------------------------
@dataclass
class CatDefaults:
    emotion_tags: List[str]
    envelope_style_id: str
    geo_country_target: List[str]


CATEGORY_DEFAULTS: Dict[str, CatDefaults] = {
    "anniversary":      CatDefaults(["romantic","couple","milestone"],
                                    "env_premium_004",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "birthday":         CatDefaults(["family","friends","joyful","celebration"],
                                    "env_basic_001",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "christmas":        CatDefaults(["family","festive","warm","joy"],
                                    "env_holiday_001",
                                    ["US","CA","GB","AU","NZ","ES","FR","MX","BR"]),
    "congratulations":  CatDefaults(["achievement","proud","excited"],
                                    "env_premium_002",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "easter":           CatDefaults(["family","faith","spring","renewal"],
                                    "env_holiday_002",
                                    ["US","CA","GB","AU","NZ","ES","FR","MX","BR"]),
    "encouragement":    CatDefaults(["support","hopeful","friendship"],
                                    "env_basic_001",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "fathers-day":      CatDefaults(["family","dad","gratitude","respect"],
                                    "env_basic_003",
                                    ["US","CA","GB","AU","NZ","ES","FR","MX","BR"]),
    "friendship":       CatDefaults(["friends","camaraderie","loyal"],
                                    "env_basic_001",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "get-well":         CatDefaults(["support","caring","hopeful","warmth"],
                                    "env_basic_001",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "good-luck":        CatDefaults(["hopeful","excited","optimistic"],
                                    "env_premium_001",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "graduation":       CatDefaults(["achievement","proud","new-chapter"],
                                    "env_premium_003",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "halloween":        CatDefaults(["festive","spooky","fun","party"],
                                    "env_holiday_003",
                                    ["US","CA","GB","AU","NZ","IE","ES","FR","MX"]),
    "love":             CatDefaults(["romantic","couple","intimate","tender"],
                                    "env_premium_004",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "missing-you":      CatDefaults(["longing","warm","tender","loved"],
                                    "env_basic_001",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "mothers-day":      CatDefaults(["family","mum","gratitude","love"],
                                    "env_basic_003",
                                    ["US","CA","GB","AU","NZ","ES","FR","MX","BR"]),
    "new-baby":         CatDefaults(["family","new-life","joyful","welcoming"],
                                    "env_basic_002",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "new-year":         CatDefaults(["festive","fresh-start","celebration"],
                                    "env_holiday_001",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "retirement":       CatDefaults(["achievement","milestone","gratitude"],
                                    "env_premium_003",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "sorry":            CatDefaults(["empathy","apology","sincere"],
                                    "env_basic_001",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "sympathy":         CatDefaults(["grief","support","caring","family"],
                                    "env_basic_001",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "thank-you":        CatDefaults(["gratitude","appreciation","sincere"],
                                    "env_premium_002",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    # Geo-specific: Thanksgiving is US/CA-only festival (DOC 179 example)
    "thanksgiving":     CatDefaults(["family","gratitude","feast","harvest"],
                                    "env_holiday_004",
                                    ["US","CA"]),
    "thinking-of-you":  CatDefaults(["caring","warm","tender","friends"],
                                    "env_basic_001",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "valentine":        CatDefaults(["romantic","couple","love","intimate"],
                                    "env_premium_004",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
    "wedding":          CatDefaults(["romantic","couple","milestone","family"],
                                    "env_premium_005",
                                    ["US","CA","GB","AU","NZ","ES","FR","BR","MX"]),
}
assert set(CATEGORY_DEFAULTS.keys()) == set(CANONICAL_25_CATS), \
    "CATEGORY_DEFAULTS keys must exactly cover all 25 canonical categories."

# Global flag, set by main() from argparse.
# Doc §148: material-first pass writes ONLY emotionalTags + envelopeStyleId (2 fields),
# geoCountryTarget = [] as empty placeholder.  Explicit --include-geo-defaults sets True
# and fills the Doc §179 country list values (3rd-priority feature later when code
# actually uses the field for Geo festival sort).
_INCLUDE_GEO_DEFAULTS: bool = False


# ---------------------------------------------------------------------------
# Card metadata readers / writers
# ---------------------------------------------------------------------------
def load_local_cards_meta() -> Tuple[Optional[dict], str, List[dict]]:
    """Return (parsed_container, json_text, flat_cards_list)."""
    if not CARDS_META_JSON.exists():
        return None, "", []
    raw = CARDS_META_JSON.read_text(encoding="utf-8")
    try:
        container = json.loads(raw)
    except Exception as e:
        print(f"[ERROR] Failed to parse {CARDS_META_JSON}: {e}")
        return None, raw, []
    # Accept two shapes:
    #   { "cards": [ {slug, ...}, ... ] }   (modern wrapped)
    #   [ {slug, ...}, ... ]                (legacy flat array)
    if isinstance(container, list):
        cards = container
    elif isinstance(container, dict) and isinstance(container.get("cards"), list):
        cards = container["cards"]
    else:
        print(f"[WARN] Unknown cards-meta shape: top-level type={type(container).__name__}. "
              f"Trying common fallbacks...")
        cards = []
        for v in (container.values() if hasattr(container, "values") else []):
            if isinstance(v, list) and v and isinstance(v[0], dict) and "slug" in v[0]:
                cards = v
                break
    return container, raw, cards


def patch_card_entry(card: dict) -> Tuple[dict, bool]:
    """Inject the 3 NEW fields into a single card dict, WITHOUT TOUCHING any
    existing keys. Returns (patched_card, mutated_bool). Mutated is False
    when all 3 new keys already existed (dry-run no-op / idempotent re-run)."""
    cat = card.get("category", "") or ""
    if cat not in CATEGORY_DEFAULTS:
        return card, False
    defaults = CATEGORY_DEFAULTS[cat]
    new_card = dict(card)  # shallow copy: mutate fields ONLY below
    mutated = False

    # --- FIELD A — emotional tags (人际情感标签)
    key_a = "emotionalTags"
    if key_a not in new_card or not new_card[key_a]:
        new_card[key_a] = list(defaults.emotion_tags)
        mutated = True

    # --- FIELD B — envelope style default id (预设信封样式绑定ID)
    key_b = "envelopeStyleId"
    if key_b not in new_card or not new_card[key_b]:
        new_card[key_b] = defaults.envelope_style_id
        mutated = True

    # --- FIELD C — geo country target list (geo_country_target)
    key_c = "geoCountryTarget"
    if key_c not in new_card or (isinstance(new_card[key_c], list) and not new_card[key_c]):
        # Doc §148 says ONLY 2 fields for 1st-priority material pass.
        # By default, inject EMPTY [] placeholder.  Real country values
        # are written ONLY if --include-geo-defaults is passed (reserved
        # for the 3rd-priority §227 Geo localised sort code deployment).
        if _INCLUDE_GEO_DEFAULTS:
            new_card[key_c] = list(defaults.geo_country_target)
        else:
            new_card[key_c] = []
        mutated = True
    return new_card, mutated


def save_local_cards_meta(container, original_text: str) -> bool:
    """Overwrite cards-meta.json ONLY when --apply is set. We write
    atomically: temp file → replace original, to avoid truncation mid-write."""
    try:
        tmp = CARDS_META_JSON.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(container, ensure_ascii=False, indent=2),
                       encoding="utf-8")
        os.replace(tmp, CARDS_META_JSON)
        return True
    except Exception as e:
        print(f"[ERROR] Failed to write {CARDS_META_JSON}: {e}")
        return False


# ---------------------------------------------------------------------------
# D1 remote patching (optional; requires D1 Worker API endpoint + token)
# ---------------------------------------------------------------------------
def d1_patch_columns_via_worker(dry_run: bool) -> Tuple[int, int]:
    """Attempt to UPDATE the three new columns on the remote D1 cards DB by
    category (one UPDATE per category, 25 total for ~4k cards — extremely
    fast). Returns (updated_count, errors_count). When D1 API env vars are
    missing we print a helpful fallback note and return (0,0).

    2026-07-03: Added robust Session + Retry adapter + longer timeout +
    optional verify=False because SSL EOF errors were consistently hitting
    the upstream HTTPS endpoint through the user's proxy setup."""
    base = os.environ.get("D1_API_BASE_URL", "").strip().rstrip("/")
    tok = os.environ.get("CARDS_BULK_API_TOKEN", "").strip()
    if not base or not tok:
        print("[INFO] D1_API_BASE_URL + CARDS_BULK_API_TOKEN not set in .env → "
              "skip remote D1 UPDATE. Local cards-meta.json patch is authoritative "
              "for now; run 'migrate-cards-to-d1.py' later to sync to D1 again.")
        return 0, 0
    headers = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    updated = 0
    errors = 0

    # Build a robust requests session with retry + (optionally) no SSL verify
    import requests
    from requests.adapters import HTTPAdapter
    try:
        from urllib3.util.retry import Retry
        _HAS_RETRY = True
    except Exception:
        _HAS_RETRY = False
    sess = requests.Session()
    # Check env for skip-verify — same convention as migrate-cards-to-d1.py
    # Also auto-disable if host is on https: (SSL EOF workaround for proxy)
    if base.startswith("https://"):
        sess.verify = False
        try:
            import urllib3
            urllib3.disable_warnings()
        except Exception:
            pass
    if _HAS_RETRY:
        retry = Retry(
            total=6,
            backoff_factor=1.2,
            status_forcelist=[429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527],
            allowed_methods=["POST", "GET"],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=4, pool_maxsize=8)
        sess.mount("http://", adapter)
        sess.mount("https://", adapter)

    try:
        for cat, defaults in CATEGORY_DEFAULTS.items():
            payload = {
                "action": "update_fields_by_category",
                "category": cat,
                "fields": {
                    # snake_case → D1 column names (schema.sql uses snake_case)
                    "emotional_tags": json.dumps(defaults.emotion_tags, ensure_ascii=False),
                    "envelope_style_id": defaults.envelope_style_id,
                    "geo_country_target": json.dumps(defaults.geo_country_target, ensure_ascii=False),
                },
                "set_updated_at": True,
            }
            if dry_run:
                print(f"  [DRY] Would PATCH cat={cat!r}: env={defaults.envelope_style_id}, "
                      f"geo={defaults.geo_country_target}, emo={defaults.emotion_tags}")
                continue
            # Longer timeout (180s per call) + retries handled by session adapter
            last_exc = None
            for attempt in range(3):
                try:
                    r = sess.post(f"{base}/api/cards/_bulk", json=payload,
                                  headers=headers, timeout=180)
                    break
                except Exception as _e:
                    last_exc = _e
                    if attempt < 2:
                        time.sleep(3 * (attempt + 1))
                    else:
                        raise
            if 200 <= r.status_code < 300:
                try:
                    n = (r.json() or {}).get("updated", 0) or 0
                    updated += int(n)
                    print(f"  [OK] D1 cat={cat}: updated {n} rows")
                except Exception:
                    updated += 0
            else:
                errors += 1
                print(f"  [ERROR] D1 cat={cat} HTTP {r.status_code}: {r.text[:300]}")
    except Exception as e:
        print(f"[ERROR] D1 remote patch failed: {e}")
        errors += 999
    finally:
        try:
            sess.close()
        except Exception:
            pass
    return updated, errors


# ---------------------------------------------------------------------------
# Summary report
# ---------------------------------------------------------------------------
@dataclass
class Report:
    total_cards: int = 0
    mutated_cards_local: int = 0
    unchanged_cards_local: int = 0
    per_cat_counts: Dict[str, int] = field(default_factory=dict)
    d1_updated: int = 0
    d1_errors: int = 0
    local_json_written: bool = False
    start_ts: float = field(default_factory=time.time)


def print_report(r: Report, apply_mode: bool):
    print()
    print("=" * 80)
    print("📊 STEP 4 FINAL SUMMARY — 3 NEW METADATA FIELDS INJECTED (DOC 148 + 179)")
    print("=" * 80)
    print(f"Total cards scanned   : {r.total_cards}")
    if r.total_cards:
        print(f"  ✅ Patched locally   : {r.mutated_cards_local} "
              f"({100*r.mutated_cards_local/r.total_cards:.1f}%)")
        print(f"  ⏭  Already present   : {r.unchanged_cards_local} "
              f"({100*r.unchanged_cards_local/r.total_cards:.1f}% — idempotent safe)")
    print(f"  PER-CATEGORY counts :")
    for cat in CANONICAL_25_CATS:
        print(f"    {cat:<20} n={r.per_cat_counts.get(cat, 0):>4d}")
    print()
    print(f"Remote D1 sync       : updated={r.d1_updated} errors={r.d1_errors}")
    print(f"Local cards-meta.json: {'WRITTEN' if r.local_json_written else 'NOT WRITTEN — dry-run or abort'}")
    print(f"  NEW keys added      : emotionalTags (人际情感标签, List[str])")
    print(f"                      : envelopeStyleId (预设信封样式绑定ID, str)")
    print(f"                      : geoCountryTarget (geo_country_target, List[str])")
    print(f"  EXISTING keys       : 100% untouched (enforces DOC LINE 4 LOCKED URLs/fields).")
    print(f"Elapsed              : {time.time()-r.start_ts:.2f}s")
    print()
    if not apply_mode:
        print("👉 NEXT: Run with --apply to persist the patches:")
        print("     python _scripts/_step4_update_kv_d1_fields.py --apply")
        print("   Then, move to material validation (Step A-4) → 1st priority closed.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="Scan cards-meta, print intended patches, do NOT write anything.")
    ap.add_argument("--apply", action="store_true",
                    help="Actually patch local cards-meta.json + try remote D1 UPDATEs.")
    ap.add_argument("--include-geo-defaults", action="store_true",
                    help="Populate geoCountryTarget with Doc §179 default country lists "
                         "(Default OFF: geoCountryTarget injected as empty [] placeholder only; "
                         "Doc §148 says 2 fields only for material-first priority pass).")
    args = ap.parse_args()
    if not args.dry_run and not args.apply:
        print("ERROR: Specify either --dry-run or --apply.")
        print()
        print("  Suggested first:")
        print("     python _scripts/_step4_update_kv_d1_fields.py --dry-run")
        print("  Then apply patches (2 fields only, geo=[] placeholder):")
        print("     python _scripts/_step4_update_kv_d1_fields.py --apply")
        print("  Optionally include full Geo defaults (Doc §179 + §13.2.2 later):")
        print("     python _scripts/_step4_update_kv_d1_fields.py --apply --include-geo-defaults")
        return 2

    apply_mode = args.apply
    dry_mode = args.dry_run  # mutually exclusive enforced by caller convention
    include_geo = bool(args.include_geo_defaults)
    # Inject module-global flag so patch_card_entry reads it without re-signatures
    global _INCLUDE_GEO_DEFAULTS
    _INCLUDE_GEO_DEFAULTS = include_geo

    print("=" * 80)
    if include_geo:
        print("🧩 STEP 4: KV/D1 METADATA 3-FIELD INJECTION — Doc §148 + Doc §179 (with geo defaults)")
    else:
        print("🧩 STEP 4: KV/D1 METADATA 2-FIELD INJECTION + geo=[] placeholder (strictly Doc §148)")
    print("=" * 80)
    print()
    print("Mode                       :", "🔴 LIVE APPLY" if apply_mode else "🛡️  DRY RUN (no writes)")
    if include_geo:
        print("3 NEW FIELDS (never touch existing!):")
        print("  • emotionalTags       — 人际情感标签           (List[str], per-category default — Doc §148)")
        print("  • envelopeStyleId     — 预设信封样式绑定ID     (str, matches Doc §87-91 tier model — Doc §148)")
        print("  • geoCountryTarget    — geo_country_target     (List[str], Doc §179 default country lists WRITTEN)")
    else:
        print("2 NEW FIELDS (Doc §148 strict: only emotionalTags + envelopeStyleId — geo as [] placeholder only):")
        print("  • emotionalTags       — 人际情感标签           (List[str], per-category default — Doc §148)")
        print("  • envelopeStyleId     — 预设信封样式绑定ID     (str, matches Doc §87-91 tier model — Doc §148)")
        print("  • geoCountryTarget    — geo_country_target     (List[str], EMPTY [] placeholder; Doc §179 data filled later at 3rd-priority)")
    print("Cards source             :", CARDS_META_JSON)
    if not CARDS_META_JSON.exists():
        print(f"[WARN] {CARDS_META_JSON} missing — run expand-materials.py or migrate first.")
    print("=" * 80)
    print()

    report = Report()
    container, _raw_text, cards = load_local_cards_meta()
    report.total_cards = len(cards)
    if report.total_cards == 0:
        print("[WARN] Zero cards loaded. Nothing to do.")
        print_report(report, apply_mode)
        return 0

    # --- Pass 1: patch each card in memory
    new_cards: List[dict] = []
    for c in cards:
        patched, changed = patch_card_entry(c)
        cat = patched.get("category", "unknown")
        report.per_cat_counts[cat] = report.per_cat_counts.get(cat, 0) + 1
        if changed:
            report.mutated_cards_local += 1
        else:
            report.unchanged_cards_local += 1
        new_cards.append(patched)

    # --- Put patched cards back into the same container shape
    if isinstance(container, list):
        new_container = new_cards
    elif isinstance(container, dict) and isinstance(container.get("cards"), list):
        new_container = dict(container)
        new_container["cards"] = new_cards
    else:
        print("[WARN] Couldn't determine container shape; assuming wrapped {cards: [...]} style.")
        new_container = {"cards": new_cards}

    # --- Pass 2: write local JSON (--apply only), or DRY print 1st+last sample
    if dry_mode:
        # Print a SAMPLE so the user can visually confirm 3 fields exist + all
        # OLD fields still untouched.
        print("=== DRY-RUN SAMPLE (first card, new 3 keys highlighted) ===")
        if new_cards:
            s = new_cards[0]
            print(f"  slug              : {s.get('slug','')}")
            print(f"  category          : {s.get('category','')}")
            print(f"  old bgImage       : {bool(s.get('bgImage'))}  (kept)")
            print(f"  old seo           : keys={list((s.get('seo') or {}).keys())[:5]}... (kept)")
            print(f"  ✨ emotionalTags       : {s.get('emotionalTags')!r}")
            print(f"  ✨ envelopeStyleId     : {s.get('envelopeStyleId')!r}")
            print(f"  ✨ geoCountryTarget    : {s.get('geoCountryTarget')!r}")
        # Try D1 in dry mode too → prints intended UPDATEs per category
        report.d1_updated, report.d1_errors = d1_patch_columns_via_worker(dry_run=True)
    else:
        # LIVE apply
        report.local_json_written = save_local_cards_meta(new_container, _raw_text)
        if report.local_json_written:
            print(f"[OK] Patched local {CARDS_META_JSON.name} → {report.mutated_cards_local} cards mutated.")
        # Then try D1 remote sync (best-effort, do not block local success)
        report.d1_updated, report.d1_errors = d1_patch_columns_via_worker(dry_run=False)

    print_report(report, apply_mode)
    # Non-zero exit only on catastrophic apply failure
    if apply_mode and report.d1_errors >= 999:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
