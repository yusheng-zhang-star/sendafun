"""Retry the 2 transient SSL failures"""
import urllib.request, time
urls = [
    "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/fathers-day/fathers-day-pexels-28589300-v2-vertical.webp",
    "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/sorry/sorry-pexels-6633040-v2-vertical.webp"
]
for attempt in range(1, 5):
    print(f"\n--- Attempt {attempt} ---")
    for u in urls:
        try:
            req = urllib.request.Request(u, method="HEAD", headers={"User-Agent":"Mozilla/5.0 retry"})
            with urllib.request.urlopen(req, timeout=20) as r:
                print(f"  status={r.status}  bytes={r.headers.get('Content-Length','?')}  type={r.headers.get('Content-Type','?')}  OK: {u.rsplit('/',1)[-1]}")
        except Exception as e:
            print(f"  FAIL: {type(e).__name__}: {e}")
    time.sleep(1)
print("\nDone")
