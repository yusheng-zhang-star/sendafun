import requests, re, sys
BASE = 'https://sendafun.com'
s = requests.Session()
s.headers.update({'Cache-Control':'no-cache','Pragma':'no-cache'})

print('='*70)
print('  Pages post-redeploy validation (§169 lang switch + hreflang health)')
print('='*70)

r = s.get(BASE + '/index.html', timeout=25)
print(f'GET /index.html HTTP {r.status_code} | size {len(r.content)} bytes')
lang_patterns = [
  (r'lang[_\-]switch', 'lang-switch class'),
  (r'language[_\-]select', 'language-select class'),
  (r'saf_lang_override', 'saf_lang_override cookie ref'),
  (r'onchange.*setLang|setLang\(', 'setLang() handler'),
  (r'<select', '<select> element'),
  (r'EN.*ES.*FR.*PT|dropdown-menu', '4-lang dropdown text'),
]
for pat, name in lang_patterns:
  m = bool(re.search(pat, r.text, re.I))
  print(f'  {"✅" if m else "❌"} {name}: {m}')

r2 = s.get(BASE + '/en/pricing', timeout=25)
print()
print(f'GET /en/pricing HTTP {r2.status_code}')
hreflang_count = len(re.findall(r'hreflang', r2.text, re.I))
jsonld = bool(re.search(r'application/ld\+json', r2.text, re.I))
area = 'areaServed' in r2.text
core7 = sum(1 for cc in ['US','GB','CA','FR','ES','MX','BR'] if re.search(r'["\']' + cc + r'["\']', r2.text))
hreflangs = re.findall(r'hreflang\s*=\s*["\']([^"\']+)["\']', r2.text, re.I)
xdefault = 'x-default' in hreflangs
print(f'  hreflang tags ×{hreflang_count}: {sorted(hreflangs)}')
print(f'  JSON-LD present: {jsonld} | areaServed present: {area} | core7countries: {core7}/7 | x-default present: {xdefault}')

healthy = (hreflang_count >= 5 and jsonld and area and core7 >= 5 and xdefault)
print()
print(f'  RESULT: {"✅ HEALTHY" if healthy else "❌ NEEDS ATTENTION"}')
sys.exit(0 if healthy else 2)
