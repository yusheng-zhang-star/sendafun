import requests, re
BASE = 'https://sendafun.com'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
s = requests.Session()
s.headers.update({'User-Agent': UA, 'Cache-Control':'no-store'})

# Doc: check 3 categories
# A - KNOWN WORKER-ONLY (from earlier test)
cat_a = [
  '/api/geo/context?force_country=FR',
  '/robots.txt',
  '/sitemap.xml',
]
# B - exact-match wrangler.toml declared routes (HTML)
cat_b = [
  '/',
  '/index.html',
  '/create',
  '/create/',
  '/discover',
  '/trending',
  '/latest',
  '/pricing',
  '/pricing/',
  '/about',
  '/contact',
]
# C - language-prefix wrangler.toml declared routes (HTML, added 57 batch)
cat_c = [
  '/en/pricing',
  '/en/pricing/',
  '/es/about',
  '/fr/contact',
  '/pt/create',
  '/en/card',
  '/fr/card/test-slug',
]

def test(name, paths):
    print(f'\n## {name} ##')
    for p in paths:
        p0 = p.split('?')[0]
        try:
            r = s.get(BASE + p, timeout=20, allow_redirects=False)
            via = r.headers.get('CF-Ray')
            sr = r.headers.get('Server','?')
            hreflang_count = len(re.findall(r'hreflang', r.text, re.I))
            has_saf = 'safLangPicker' in r.text
            # Look for Worker injection signature or Pages signature
            size = len(r.content)
            is_html = 'text/html' in (r.headers.get('Content-Type') or '')
            if is_html:
                is_worker_inject = hreflang_count >= 2
                marker = 'WORKER' if is_worker_inject else 'PAGES-FALLBACK'
            else:
                marker = 'WORKER' if (size > 100 and 'api/' in p) else '-'
            status = str(r.status_code)
            loc = r.headers.get('Location','')
            if loc: status += f' ->{loc[:70]}'
            hl = f'×{hreflang_count}' if hreflang_count else '×0'
            print(f'  {marker:16s} {p0:30s} HTTP {status:12s} size={size:>7d} hreflang={hl:4s} §169={has_saf and is_html}')
        except Exception as e:
            print(f'  ??? {p0:30s} ERROR: {str(e)[:60]}')

test('CATEGORY A: Known Worker routes (api/* / robots / sitemap)', cat_a)
test('CATEGORY B: wrangler.toml exact-match HTML routes', cat_b)
test('CATEGORY C: 57 language-prefix route batch', cat_c)
