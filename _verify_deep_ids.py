"""Deep-dive: check every ID in fathers-day / sorry / friendship (the 3 cats in sample)"""
import urllib.request, sys

KNOWN_GOOD = {
  "fathers-day": [4260097,8015532,17385395,18296227,28589300,33428408,33769345,35281486,37936229,38165283],
  "sorry": [4207550,5478209,5706039,6633016,6633040,6633047,6633050,8015505,8015568,8015616],
  "friendship": [4207550,5477588,5478209,5491834,5706029,5706039,5706056,5713665,7679771,14545423]
}
BASE = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev"
total = 0; ok = 0; bad_list = []
for cat, ids in KNOWN_GOOD.items():
    for pid in ids:
        url = f"{BASE}/{cat}/{cat}-pexels-{pid}-v2-vertical.webp"
        total += 1
        try:
            req = urllib.request.Request(url, method="HEAD", headers={"User-Agent":"Mozilla/5.0 deep-check", "Cache-Control":"no-cache"})
            with urllib.request.urlopen(req, timeout=15) as r:
                if 200 <= r.status < 300:
                    ok += 1
                    print(f"  OK {cat}/{pid}")
                else:
                    bad_list.append((cat, pid, r.status, url))
                    print(f"ERR {cat}/{pid} status={r.status}")
        except Exception as e:
            bad_list.append((cat, pid, type(e).__name__+":"+str(e), url))
            print(f"EXC {cat}/{pid}: {type(e).__name__}: {e}")
print(f"\nTotal: {total}   OK: {ok}   BAD: {len(bad_list)}")
for b in bad_list:
    print("BAD:", b)
sys.exit(0 if not bad_list else 1)
