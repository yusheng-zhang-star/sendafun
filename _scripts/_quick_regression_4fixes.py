import requests, re, time, json, sys
BASE = 'https://sendafun.com'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
s = requests.Session()
s.headers.update({'User-Agent': UA, 'Cache-Control':'no-store'})
t = str(int(time.time()))
results = []
def chk(name, ok, detail):
    mark = '✅' if ok else '❌'
    results.append((name, ok, detail))
    print(f'{mark} {name}: {detail}')

print('QUICK REGRESSION — bug fix confirmations')
for p in ['/app.js', '/styles.css']:
    try:
        r = s.get(BASE + p, timeout=20, params={'_t': t})
        ok = r.status_code == 200 and len(r.content) > 1000
        chk(f'static {p}', ok, f'HTTP {r.status_code} bytes={len(r.content)} ct={r.headers.get("Content-Type","?")[:40]}')
    except Exception as e:
        chk(f'static {p}', False, str(e)[:60])

for p in ['/payment-success', '/payment-cancel', '/payment-success.html', '/payment-cancel.html']:
    try:
        r = s.get(BASE + p, timeout=20, params={'_t': t})
        hl = len(re.findall(r'hreflang', r.text, re.I))
        has_content = len(r.content) > 1000
        ok = (r.status_code == 200 and has_content)
        chk(f'page {p}', ok, f'HTTP {r.status_code} sz={len(r.content)} hreflang={hl}')
    except Exception as e:
        chk(f'page {p}', False, str(e)[:60])

try:
    r = s.get(f'{BASE}/api/cards?limit=5', timeout=25)
    j = r.json()
    cards = j.get('cards', [])
    r2_url = None
    for c in cards:
        if isinstance(c, dict) and isinstance(c.get('bgImageWatermark'), str) and 'r2.dev' in c.get('bgImageWatermark',''):
            r2_url = c['bgImageWatermark']; break
    if r2_url:
        print(f'  (DEBUG: r2_url = {r2_url[:90]})')
        r2 = s.get(f'{BASE}/api/r2-image', params={'url': r2_url, '_t': t}, timeout=25)
        if r2.status_code != 200:
            print(f'  (DEBUG R2 response snippet: {r2.text[:150]})')
        ok = r2.status_code == 200 and (int(r2.headers.get('Content-Length','0') or 0) > 1000 or len(r2.content) > 1000)
        chk(f'R2 ?url= full-url key', ok, f'HTTP {r2.status_code} ct={r2.headers.get("Content-Type","?")[:30]} len={r2.headers.get("Content-Length","?") or len(r2.content)}')
    else:
        chk('R2 SKIP (no r2.dev keys)', True, 'cards have no r2.dev full URL format keys; skipped')
except Exception as e:
    import traceback; traceback.print_exc()
    chk('R2 FAIL', False, str(e)[:70])

print()
passn = sum(1 for _,ok,_ in results if ok)
print(f'Result: {passn}/{len(results)} passed')
for name,ok,det in results:
    if not ok: print(f'  ❌ FAIL {name}: {det}')
sys.exit(0 if passn == len(results) else 1)
