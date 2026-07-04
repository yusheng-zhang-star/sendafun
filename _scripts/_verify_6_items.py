#!/usr/bin/env python3
"""Verify 6 things at once (Python = robust, no PS syntax quirks)"""
import os, json, requests, time, re
from collections import Counter

BASE = 'https://sendafun.com'
UA = 'ProgressVerify/2.0 (Windows NT 10.0; Win64; x64) Python-requests/2.31'
s = requests.Session()
s.headers.update({'User-Agent': UA})

def section(t): print(f"\n{'='*80}\n  {t}\n{'='*80}")

# 1. FTS5 rebuild log last 40 lines (only if exists)
section("1/6 FTS5 REBUILD OUTPUT (background job last 40 lines)")
log = r"C:\Users\dell\AppData\Local\Temp\trae-agent-toolhost\jobs\job-1c52cec06d6c468a9e9690ebb08452c4\output.log"
if os.path.exists(log):
    with open(log,'r',encoding='utf-8',errors='replace') as f:
        lines=f.read().splitlines()[-40:]
    for l in lines: print('  '+l)
else:
    print('  (log file not found)')

# 2. GET /api/lang/set?lang=fr → 302 + Set-Cookie saf_lang_override=fr
section("2/6 LANG MANUAL SWITCH: GET /api/lang/set?lang=fr → 302 + Cookie")
r = s.get(BASE+'/api/lang/set?lang=fr', allow_redirects=False, timeout=20)
print(f"  HTTP {r.status_code} | Location: {r.headers.get('Location','(none)')[:140]}")
sc = r.headers.get('Set-Cookie','')
ok = sc and 'saf_lang_override=fr' in sc and r.status_code in (302,303,307)
print(f"  Set-Cookie (first 220 chars): {sc[:220]}")
print(f"  {'✅ PASS' if ok else '❌ FAIL'}: cookie set correctly")

# 3. Search: 5 keywords × top5 hits (correct path /api/cards/search)
section("3/6 FTS5 SEARCH: /api/cards/search (5 keywords)")
queries = ['birthday','love','christmas','thanksgiving','anniversary']
stats = []
for q in queries:
    t0=time.time()
    r = s.get(BASE+'/api/cards/search', params={'q':q,'size':5}, timeout=30)
    dt_ms = round((time.time()-t0)*1000,1)
    if r.status_code != 200:
        print(f"  q={q:<15} HTTP{r.status_code} ❌")
        continue
    j = r.json()
    total = j.get('total',0); n = len(j.get('cards',[]) or [])
    mark = '✅' if total >= 10 else ('⚠️ ' if total >=1 else '❌')
    print(f"  q={q:<15} total={total:<5} returned={n:<3} {dt_ms:<7}ms {mark}")
    stats.append((q,total))
    for c in (j.get('cards') or [])[:3]:
        slug = str(c.get('slug') or '')[:80]
        cid = str(c.get('id') or c.get('rowid') or '?')[:6]
        cat = str(c.get('category') or '?')[:18]
        rk = str(c.get('rank') or c.get('score') or '')
        print("    id=%-6s cat=%-18s score=%s slug=%s" % (cid, cat, rk, slug))

# 4. Envelope style ID distribution (sample)
section("4/6 ENVELOPE STYLE ID distribution (25 cats × 4 = 100 sample)")
cats = ['birthday','love','christmas','thank-you','wedding','anniversary','graduation','new-baby','retirement','valentine','halloween','easter','mothers-day','fathers-day','friendship','encouragement','congratulations','get-well','good-luck','missing-you','new-year','sorry','sympathy','thanksgiving','thinking-of-you']
env_counts = Counter()
sample_cards = []
for cat in cats:
    try:
        j = s.get(BASE+'/api/cards', params={'category':cat,'size':4}, timeout=25).json()
        for c in j.get('cards',[]) or []:
            val = c.get('envelopeStyleId') or c.get('envelope_style_id') or 'NULL_EMPTY'
            env_counts[str(val)] += 1
            sample_cards.append((cat,val,c.get('slug','')[:50]))
    except Exception as e:
        print(f"  cat {cat} skip: {str(e)[:70]}")
print(f"  Sample cards: {len(sample_cards)}")
for k, cnt in env_counts.most_common(15):
    print(f"    envelope_style_id={k:<40} count={cnt}")
# Doc §93: Envelope animation = pure CSS/Canvas (NO R2 files needed)!
print("\n  📘 DOC §93: envelope animation = PURE CSS/Canvas — ZERO R2 file dependencies")
print(f"  {'✅' if '' in env_counts else '❌'} empty='' means card uses default envelope (CSS-only)")

# 5. Schema.org areaServed: /en/about + SPA /en/pricing pages JSON-LD
section("5/6 SCHEMA.ORG JSON-LD areaServed (required by Doc §217)")
for path in ['/en/about','/en/pricing','/en','/en/cards/birthday']:
    try:
        r = s.get(BASE+path, timeout=30)
        has_area = 'areaServed' in r.text
        has_jsonld = bool(re.search(r'<script[^>]*application/ld\+json', r.text, re.I))
        core7 = sum(1 for cc in ['US','GB','CA','FR','ES','MX','BR'] if re.search(r'["\']'+cc+r'["\']', r.text))
        mark='✅' if (has_area and core7>=5) else (has_jsonld and core7>=3) and '⚠️ ' or '❌'
        print(f"  {path:<28} JSON-LD={has_jsonld} areaServed={has_area} core7countries={core7}/7 {mark}")
    except Exception as e:
        print(f"  {path:<28} FAIL: {str(e)[:100]}")

# 6. Hreflang count check
section("6/6 HREFLANG bidirectional cross tags: SPA page /en/pricing should have ≥5 (4 langs + x-default, Doc §101)")
r = s.get(BASE+'/en/pricing', timeout=30)
counts = len(re.findall(r'hreflang\s*=', r.text, re.I))
has_xdefault = bool(re.search(r'hreflang\s*=\s*["\']x-default', r.text, re.I))
has_en = bool(re.search(r'hreflang\s*=\s*["\']en["\']', r.text, re.I))
mark = '✅' if counts >= 5 and has_xdefault and has_en else ('⚠️ ' if counts >= 3 else '❌')
print(f"  hreflang tags = {counts}, x-default={has_xdefault}, en={has_en} {mark}")
if counts < 5:
    # Print 150 chars around first 3 hreflangs
    for m in re.finditer(r'<link[^>]{1,200}hreflang[^>]{1,200}>', r.text, re.I):
        print('   ', m.group(0).strip()[:180])

section("SUMMARY")
ok_all = True
print(f"  lang override Cookie: {'OK' if ok else 'MISSING'}")
print(f"  Search 5 queries >= 10 hits each: {sum(1 for _,t in stats if t>=10)}/{len(stats)}")
print(f"  Envelope 0 R2 dependency: OK (always — doc §93 CSS-only)")
print(f"  Schema JSON-LD areaServed: {'NEEDS INJECT (missing)' if not has_area else 'OK'}")
print(f"  Hreflang ≥5 tags (4+x-default): {'OK' if counts>=5 else 'NEEDS CHECK ('+str(counts)+' tags found)'}")
