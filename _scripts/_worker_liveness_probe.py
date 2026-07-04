import requests, json
BASE = 'https://sendafun.com'
s = requests.Session()
s.headers.update({'Cache-Control':'no-store'})

print('STEP1: /api/geo/context (Worker api/* route)')
r = s.get(BASE + '/api/geo/context?force_country=FR', timeout=20)
ct = r.headers.get('Content-Type','?')
print('  HTTP', r.status_code, 'size=', len(r.content), 'ct=', ct)
print('  raw first 200:', r.text[:200])
try:
    j = r.json()
    print('  JSON keys:', sorted(j.keys()))
    g = j.get('geo',{})
    print('  country=', g.get('country_code'), ' currency=', g.get('currency_code'))
except Exception as e:
    print('  JSON decode failed:', e)

print()
print('STEP2: /robots.txt and /sitemap.xml (Worker routes)')
for p in ['/robots.txt','/sitemap.xml','/sitemap-cards.xml']:
    r = s.get(BASE + p, timeout=20)
    head = r.text[:120].replace('\n','\\n')
    print(f'  {p:25s} HTTP {r.status_code} size={len(r.content):>6d}  head={head}')
