import requests, re, sys, time
BASE = 'https://sendafun.com'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
s = requests.Session()
s.headers.update({'User-Agent': UA, 'Cache-Control':'no-store','Pragma':'no-cache'})

time.sleep(8)
print('='*90)
print('  FINAL VERIFICATION — Worker v3 (88 routes incl. catch-all) + Pages main branch')
print('='*90)

checks = []
def chk(name, ok, detail=''):
    mark = '✅' if ok else '❌'
    checks.append((name, ok, detail))
    print(f'{mark} {name}  {detail}')

# ============================================================
# 1. Worker core routes (API, robots, sitemaps)
# ============================================================
try:
    r = s.get(BASE + '/api/geo/context?force_country=BR', timeout=20)
    j = r.json()
    chk('1a. /api/geo/context force_country=BR → BRL currency',
        r.status_code == 200 and j.get('currency') == 'BRL',
        f'HTTP {r.status_code} country={j.get("country")} currency={j.get("currency")}')
    chk('1b. Geo compliance region BR → LGPD-BR',
        j.get('complianceRegion') == 'LGPD-BR',
        f'complianceRegion={j.get("complianceRegion")}')
except Exception as e:
    chk('1a/1b FAIL', False, str(e)[:60])

for p in ['/robots.txt','/sitemap.xml','/sitemap-cards.xml']:
    try:
        r = s.get(BASE + p, timeout=20)
        chk(f'2. {p}', r.status_code == 200 and len(r.content) > 100,
            f'HTTP {r.status_code} len={len(r.content)}')
    except Exception as e:
        chk(f'2. {p}', False, str(e)[:60])

# ============================================================
# 3. Static marketing pages → should have hreflang + JSON-LD + §169 picker
# ============================================================
static_pages = [
    ('/en/pricing',   'pricing'),
    ('/es/about',     'about'),
    ('/fr/contact',   'contact'),
    ('/pt/terms',     'terms'),
    ('/en/privacy',   'privacy'),
    ('/es/cookies',   'cookies'),
]
for path, name in static_pages:
    try:
        r = s.get(BASE + path, timeout=25, allow_redirects=True, params={'_t': time.time().__int__()})
        hl = len(re.findall(r'hreflang', r.text, re.I))
        ld = 'application/ld+json' in r.text
        s169 = 'safLangPicker' in r.text
        xd = 'x-default' in r.text
        area = 'areaServed' in r.text
        ok = (r.status_code == 200 and hl >= 5 and ld and s169 and xd and area)
        langs = sorted(set(re.findall(r'hreflang\s*=\s*["\']([^"\']+)["\']', r.text, re.I)))
        chk(f'3. static {name}', ok,
            f'HTTP {r.status_code} sz={len(r.content)} hl={hl} ld={ld} §169={s169} langs={langs}')
    except Exception as e:
        chk(f'3. static {name}', False, str(e)[:60])

# ============================================================
# 4. SPA routes (/create, /discover, /en/create etc.)
# ============================================================
spa_paths = [
    '/',
    '/create',
    '/discover',
    '/en/create',
    '/fr/discover',
    '/pt/trending',
    '/es/latest',
    '/en/holidays',
    '/card/preview/sample-card',
    '/group/join/abc123',
    '/redeem/GIFT-CODE',
    '/en/card/template-holiday-birthday',
]
for p in spa_paths:
    try:
        r = s.get(BASE + p, timeout=25, allow_redirects=True, params={'_t': time.time().__int__()})
        hl = len(re.findall(r'hreflang', r.text, re.I))
        ld = 'application/ld+json' in r.text
        s169 = 'safLangPicker' in r.text
        ok = (r.status_code == 200 and hl >= 5 and ld and s169)
        chk(f'4. SPA {p}', ok,
            f'HTTP {r.status_code} sz={len(r.content)} hl={hl} ld={ld} §169={s169}')
    except Exception as e:
        chk(f'4. SPA {p}', False, str(e)[:60])

# ============================================================
# 5. FTS search, R2 image, Sitemap count sanity
# ============================================================
try:
    r = s.get(BASE + '/api/search/cards?q=fun&limit=5&offset=0', timeout=25)
    j = r.json()
    chk('5. Search cards?q=fun → >=3 results',
        r.status_code == 200 and isinstance(j.get('cards'), list) and len(j['cards']) >= 3,
        f'HTTP {r.status_code} n={len(j.get("cards",[]))} fallback={j.get("fallback",{}).get("used")}')
except Exception as e:
    chk('5. Search FAIL', False, str(e)[:60])

# Search nonexistent term → LIKE fallback
try:
    r = s.get(BASE + '/api/search/cards?q=zzzzz_nonexistent_zzzzz&limit=3', timeout=25)
    j = r.json()
    ok = r.status_code == 200 and j.get('fallback', {}).get('used') == True
    chk('6. Search nonexistent → fallback LIKE', ok,
        f'HTTP {r.status_code} fallback.used={j.get("fallback",{}).get("used")} n_cards={len(j.get("cards",[]))}')
except Exception as e:
    chk('6. Search fallback FAIL', False, str(e)[:60])

# Sitemap language count check
try:
    for l in ['en','es','fr','pt']:
        r = s.get(BASE + f'/sitemap-{l}.xml', timeout=20)
        ok = r.status_code == 200 and '<urlset' in r.text and r.text.count('<loc>') > 10
        chk(f'7. sitemap-{l}.xml 10+ URLs', ok,
            f'HTTP {r.status_code} <loc>×{r.text.count("<loc>")}')
except Exception as e:
    chk('7. sitemap-xx FAIL', False, str(e)[:60])

# Summary
passn = sum(1 for _,ok,_ in checks if ok)
total = len(checks)
print('\n' + '='*90)
print(f'  FINAL RESULT: {passn}/{total} CHECKS PASSED')
print('='*90)
for name, ok, det in checks:
    if not ok:
        print(f'  ❌ FAILED: {name}  {det}')
sys.exit(0 if passn == total else 1)
