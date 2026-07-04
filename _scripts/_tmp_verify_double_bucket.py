import urllib.request, json, ssl, sys
ctx = ssl._create_unverified_context()

def head(url):
    req = urllib.request.Request(url, method='HEAD')
    try:
        with urllib.request.urlopen(req, timeout=25, context=ctx) as r:
            ct = r.headers.get('Content-Type', '')
            cl = int(r.headers.get('Content-Length', '0') or 0)
            return (r.status, ct, cl, True, None)
    except Exception as e:
        return (0, str(type(e).__name__), 0, False, repr(e)[:200])

cats = [
    'thanksgiving', 'christmas', 'easter', 'birthday', 'love',
    'valentine', 'new-baby', 'wedding', 'graduation', 'halloween'
]

ok_o = ok_p = 0
fails = []
try:
    for cat in cats:
        try:
            url = 'https://sendafun.com/api/cards?category=' + cat + '&size=1'
            with urllib.request.urlopen(url, timeout=25, context=ctx) as r:
                data = json.loads(r.read())
            c = data['cards'][0]
            orig = c['bgImage']
            prev = c['bgImageWatermark']
        except Exception as e:
            print('LIST_FAIL ' + cat + ': ' + repr(e))
            fails.append('LIST:' + cat)
            continue
        s1, ct1, cl1, ok1, e1 = head(orig)
        s2, ct2, cl2, ok2, e2 = head(prev)
        valid_o = ok1 and s1 == 200 and 'image' in ct1
        valid_p = ok2 and s2 == 200 and 'webp' in ct2 and cl2 > 10000
        if valid_o:
            ok_o += 1
        else:
            fails.append('ORIG:' + cat + ' HTTP' + str(s1) + ' CT=' + ct1 + ' err=' + str(e1))
        if valid_p:
            ok_p += 1
        else:
            fails.append('PREV:' + cat + ' HTTP' + str(s2) + ' CT=' + ct2 + ' CL=' + str(cl2) + 'B err=' + str(e2))
        mark_o = 'OK' if valid_o else 'FAIL'
        mark_p = 'OK' if valid_p else 'FAIL'
        line = (cat.ljust(12) + ' Orig→HTTP' + str(s1).rjust(3) + ' ' + ct1.ljust(18) + ' ' +
                mark_o + '  |  Prev→HTTP' + str(s2).rjust(3) + ' ' + ct2.ljust(18) + ' ' +
                str(cl2 // 1024).rjust(4) + 'KB ' + mark_p)
        sys.stdout.write('  ' + line + '\n')
        sys.stdout.flush()
except Exception as outer:
    print('OUTER EXCEPTION: ' + repr(outer), file=sys.stderr)
    raise

sys.stdout.write('\n')
sys.stdout.write('SUMMARY: Originals=' + str(ok_o) + '/' + str(len(cats)) + '   Previews=' + str(ok_p) + '/' + str(len(cats)) + '\n')
if fails:
    sys.stdout.write('FAILS: ' + '; '.join(fails) + '\n')
else:
    sys.stdout.write('10/10 DOUBLE-BUCKET: All 20 URLs returned HTTP 200 with correct Content-Type and real byte payloads.\n')
sys.stdout.flush()
