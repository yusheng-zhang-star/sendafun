import requests, re, sys
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
s = requests.Session()
s.headers.update({'User-Agent': UA, 'Cache-Control':'no-store','Pragma':'no-cache'})
urls = [
  ('Pages alias (production.sendafun.pages.dev)', 'https://production.sendafun.pages.dev/index.html'),
  ('SendAFun.com /index.html',     'https://sendafun.com/index.html'),
  ('SendAFun.com SPA / (root)',    'https://sendafun.com/'),
  ('SendAFun.com /en/create SPA',  'https://sendafun.com/en/create'),
  ('SendAFun.com /create SPA',     'https://sendafun.com/create'),
]
print('='*80)
print('  §169 lang-switch presence diagnostic across deployment sources')
print('='*80)
for label, url in urls:
    try:
        r = s.get(url, timeout=25, allow_redirects=True, params={'_t': __import__('time').time().__int__()})
        has_169 = 'safLangPicker' in r.text or 'saf_lang_override' in r.text
        has_hreflang = len(re.findall(r'hreflang', r.text, re.I))
        has_jsonld = 'application/ld+json' in r.text
        size = len(r.content)
        print(f"\n[{label}]\n  URL: {r.url[:100]}\n  HTTP {r.status_code} size={size}")
        print(f"  §169 safLangPicker present: {'✅ YES' if has_169 else '❌ NO'}")
        print(f"  hreflang tags: {has_hreflang} | JSON-LD: {'✅' if has_jsonld else '❌'}")
        if not has_169 and size <= 6000:
            # print first 2000 chars to identify the page content
            snippet = r.text[:1500].replace('\n','\\n')
            print(f"  snippet: {snippet}")
    except Exception as e:
        print(f"  [{label}] ERROR: {str(e)[:80]}")
sys.exit(0)
