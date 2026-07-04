import requests, re, sys, time
BASE = 'https://sendafun.com'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
s = requests.Session()
s.headers.update({'User-Agent': UA, 'Cache-Control':'no-store','Pragma':'no-cache'})

print('='*80)
print('  FINAL VALIDATION after SPA source URL fix')
print('='*80)
routes = [
  ('/', 'Root SPA'),
  ('/create', 'Create SPA'),
  ('/discover', 'Discover SPA'),
  ('/en/create', 'EN Create SPA'),
  ('/fr/card/preview/sample', 'FR Card SPA'),
  ('/pricing', 'Pricing static (should redirect to /en/pricing)'),
  ('/en/pricing', 'EN Pricing static'),
  ('/es/about', 'ES About static'),
]

all_ok = True
for path, label in routes:
    try:
        r = s.get(BASE + path, timeout=25, allow_redirects=True, params={'_t': str(int(time.time()))})
        hreflang_count = len(re.findall(r'hreflang', r.text, re.I))
        has_jsonld = 'application/ld+json' in r.text
        has_saf = ('safLangPicker' in r.text or 'saf_lang_override' in r.text)
        langs = re.findall(r'hreflang\s*=\s*["\']([^"\']+)["\']', r.text, re.I)
        xdefault = 'x-default' in langs
        size = len(r.content)
        ok = (hreflang_count >= 5 and has_jsonld and has_saf and xdefault)
        mark = '✅' if ok else '⚠️'
        if not ok: all_ok = False
        print(f"{mark} [{label:25s}] HTTP {r.status_code}  size={size:>5d}  hreflang={hreflang_count}  JSON-LD={'Y' if has_jsonld else 'N'}  §169_switch={'Y' if has_saf else 'N'}  langs={sorted(langs)}")
    except Exception as e:
        all_ok = False
        print(f"❌ [{label:25s}] ERROR: {str(e)[:80]}")

print()
print('FINAL:', '✅ ALL ROUTES HEALTHY' if all_ok else '⚠️  CHECK MANUALLY')
sys.exit(0 if all_ok else 1)
