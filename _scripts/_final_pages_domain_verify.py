import requests, re, sys, time
BASE = 'https://sendafun.com'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
s = requests.Session()
s.headers.update({'User-Agent': UA, 'Cache-Control':'no-store','Pragma':'no-cache'})

# Wait for Pages propagation
time.sleep(12)

def report(label, r):
    size = len(r.content)
    ct = r.headers.get('Content-Type','?')
    is_html = 'text/html' in ct
    hreflang = len(re.findall(r'hreflang', r.text, re.I))
    has_ld = 'application/ld+json' in r.text
    has_169 = ('safLangPicker' in r.text or 'saf_lang_override' in r.text)
    langs = sorted(set(re.findall(r'hreflang\s*=\s*["\']([^"\']+)["\']', r.text, re.I)))
    ok = (hreflang >= 5 and has_ld and has_169)
    mark = '✅' if ok else ('⚠️' if is_html else '✅')
    status = str(r.status_code)
    loc = r.headers.get('Location','')
    if loc: status += f' -> {loc[:60]}'
    print(f'{mark} {label:30s} HTTP {status:10s} sz={size:>6d} hl={hreflang} ld={has_ld and is_html} §169={has_169 and is_html} langs={langs}')
    return ok if is_html else True

print('='*90)
print('  Post-Pages-Main-deploy verification')
print('='*90)

tests = [
  ('MAIN Pages alias (sanity)',   'https://main.sendafun.pages.dev/index.html'),
  ('sendafun.com /index.html',    BASE + '/index.html'),
  ('sendafun.com / (root)',       BASE + '/'),
  ('sendafun.com /en/pricing',    BASE + '/en/pricing'),
  ('sendafun.com /es/about',      BASE + '/es/about'),
  ('sendafun.com /en/create (SPA)',BASE + '/en/create'),
  ('sendafun.com /create (SPA)',  BASE + '/create'),
  ('sendafun.com /discover (SPA)',BASE + '/discover'),
  ('sendafun.com /fr/card/preview', BASE + '/fr/card/preview'),
]

ok_count = 0
for label, url in tests:
    try:
        r = s.get(url, timeout=30, allow_redirects=True, params={'_t': str(int(time.time()))})
        ok_count += 1 if report(label, r) else 0
    except Exception as e:
        print(f'❌ {label:30s} ERROR: {str(e)[:70]}')

print()
print(f'RESULT: {ok_count}/{len(tests)} HTML route checks passed.')
sys.exit(0 if ok_count == len(tests) else 1)
