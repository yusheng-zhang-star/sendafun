import requests
urls = [
  "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/sorry/sorry-pexels-6935080-v2-vertical.webp",
  "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/congratulations/congratulations-pexels-10477179-vertical.webp",
  "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/encouragement/encouragement-pexels-11561039-vertical.webp",
  "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/love/love-pixabay-10067260-vertical.webp",
  "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-10165858-vertical.webp",
  "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/thank-you/thank-you-pexels-10287392-vertical.webp",
  "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/get-well/get-well-pexels-10521321-vertical.webp"
]
print("[Hypo B/C: Direct r2.dev HEAD probes — 3 cols: noReferer / Referer=localhost / Referer=sendafun.com]")
ua_none = {}
ua_local = {"Referer":"http://localhost:3000/"}
ua_prod = {"Referer":"https://sendafun.com/"}
for u in urls:
    name = u.rsplit("/",1)[-1]
    try:
        s = []
        for hdrs in (ua_none, ua_local, ua_prod):
            try:
                r = requests.head(u, timeout=20, allow_redirects=True, headers=hdrs)
                s.append(str(r.status_code))
                ct = r.headers.get("Content-Type","")
                cl = r.headers.get("Content-Length","0")
            except Exception as e:
                s.append("X:"+type(e).__name__[:8])
        print(f"  {'/'.join(s):18s}  CT={ct[:25]:25s} CL={cl:>10s}  {name}")
    except Exception as e:
        print(f"  OUTER ERR {type(e).__name__}: {e}")

print()
print("[Hypo D: Worker /api/r2-image proxy via path encoding]")
for u in urls[:4]:
    key = u.split("r2.dev/",1)[1] if "r2.dev/" in u else ""
    pu = f"https://sendafun.com/api/r2-image/{key}"
    try:
        r = requests.head(pu, timeout=20, allow_redirects=True)
        ct = r.headers.get("Content-Type","")
        cl = r.headers.get("Content-Length","?")
        print(f"  {r.status_code}  CT={ct[:35]:35s} CL={str(cl):>10s}  -> .../{key.rsplit('/',1)[-1]}")
    except Exception as e:
        print(f"  ERR {type(e).__name__}: {e}")

print()
print("[Hypo D2: Worker /api/r2-image proxy via ?url=fullURL encoding]")
for u in urls[:4]:
    import urllib.parse as up
    pu = "https://sendafun.com/api/r2-image?url=" + up.quote(u, safe="")
    try:
        r = requests.head(pu, timeout=20, allow_redirects=True)
        ct = r.headers.get("Content-Type","")
        cl = r.headers.get("Content-Length","?")
        print(f"  {r.status_code}  CT={ct[:35]:35s} CL={str(cl):>10s}  name={u.rsplit('/',1)[-1]}")
    except Exception as e:
        print(f"  ERR {type(e).__name__}: {e}")

print()
print("[Hypo D3: Worker /api/r2-image proxy via ?k=key encoding]")
for u in urls[:4]:
    key = u.split("r2.dev/",1)[1] if "r2.dev/" in u else ""
    pu = "https://sendafun.com/api/r2-image?k=" + key
    try:
        r = requests.head(pu, timeout=20, allow_redirects=True)
        ct = r.headers.get("Content-Type","")
        cl = r.headers.get("Content-Length","?")
        print(f"  {r.status_code}  CT={ct[:35]:35s} CL={str(cl):>10s}  name={key.rsplit('/',1)[-1]}")
    except Exception as e:
        print(f"  ERR {type(e).__name__}: {e}")
