import requests, re, time, sys
BASE = 'https://sendafun.com'
s = requests.Session()
s.headers.update({'Cache-Control':'no-store','Pragma':'no-cache'})
r = s.get(BASE + '/index.html', params={'t':'q3_2026_' + str(int(time.time()))}, timeout=30)
print(f'HTTP {r.status_code} size {len(r.content)} bytes')
m1 = 'safLangPicker' in r.text
m2 = ('<option value="en"' in r.text and '<option value="pt">' in r.text)
m3 = 'saf_lang_override' in r.text
m4 = 'Choose language' in r.text
m5 = '/api/lang/set' in r.text
print(f'✅ safLangPicker id DOM present = {m1}')
print(f'✅ 4-lang <option> (EN+PT present) = {m2}')
print(f'✅ saf_lang_override cookie ref = {m3}')
print(f'✅ Choose language aria-label = {m4}')
print(f'✅ /api/lang/set onchange action = {m5}')
ok = (m1 and m2 and m4 and m5)
print()
print('FINAL Pages deploy §169 check:', '✅ SUCCESS' if ok else '⚠️ CHECK MANUALLY')
print()
print('--- Relevant segment (index.html lines) ---')
lines = r.text.split('\n')
found = False
for i in range(max(0,40), min(len(lines), 85)):
    line = lines[i].strip()
    if 'lang' in line.lower() or 'option' in line or 'picker' in line.lower():
        found = True
        print(f'  L{i+1:3d}: {line[:180]}')
if not found:
    print('  (no language lines found in 40-85 range; printing whole HTML snippet...)')
    print(r.text[:2000])
sys.exit(0 if ok else 1)
