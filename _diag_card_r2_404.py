import requests, json, time, urllib.parse as up

API = "https://sendafun.com/api/cards?limit=40&page=1"
R2_BASE = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/"

print("=== Step 1: Fetch 40 cards from D1 ===")
r = requests.get(API, timeout=30)
print("GET", API, "->", r.status_code, r.headers.get("Content-Type"))
data = r.json()
cards = data.get("cards", [])
print("cards len:", len(cards), "total:", data.get("total"))

def safe_head(u, timeout=15, retries=2):
    for _ in range(retries):
        try:
            r = requests.head(u, timeout=timeout, allow_redirects=True)
            return r.status_code, r.headers.get("Content-Type",""), r.headers.get("Content-Length","0")
        except Exception as e:
            time.sleep(0.5)
            continue
    return 0, type(e).__name__ if 'e' in dir() else "UnknownErr", ""

stats = {"wm_ok":0,"wm_404":0,"wm_other":0,"bg_ok":0,"bg_404":0,"bg_other":0,"wm_is_R2":0,"bg_is_R2":0,"both_404":0,"wm_default_match":0}
samples_wm_404 = []
samples_bg_ok_wm_404 = []
for idx, c in enumerate(cards):
    wm = c.get("bgImageWatermark") or ""
    bg = c.get("bgImage") or ""
    if wm.startswith(R2_BASE): stats["wm_is_R2"] += 1
    if bg.startswith(R2_BASE): stats["bg_is_R2"] += 1
    wm_s = safe_head(wm) if wm else (None, None, None)
    bg_s = safe_head(bg) if bg else (None, None, None)
    if wm_s[0] is not None:
        if wm_s[0] == 200: stats["wm_ok"] += 1
        elif wm_s[0] == 404:
            stats["wm_404"] += 1
            if len(samples_wm_404) < 8:
                samples_wm_404.append((idx, c.get("slug","")[:60], wm.replace(R2_BASE,""), bg_s[0]))
        else: stats["wm_other"] += 1
    if bg_s[0] is not None:
        if bg_s[0] == 200: stats["bg_ok"] += 1
        elif bg_s[0] == 404: stats["bg_404"] += 1
        else: stats["bg_other"] += 1
    if wm_s[0] == 404 and bg_s[0] == 404: stats["both_404"] += 1
    if wm_s[0] == 404 and bg_s[0] == 200:
        if len(samples_bg_ok_wm_404) < 8:
            samples_bg_ok_wm_404.append((idx, c.get("category"), c.get("slug","")[:40], wm.replace(R2_BASE,""), bg.replace(R2_BASE,"")))
    # compare wm vs bg
    wm_k = wm.replace(R2_BASE,"")
    if wm_k.endswith("-vertical.webp") and len(samples_wm_404) < 3 and wm_s[0]==404:
        # try alternatives
        alt = wm_k.replace("-vertical.webp","-vertical.jpg")  # maybe jpg
        alt2 = wm_k.replace("-vertical.webp","-vertical.png")  # maybe png
        alt3 = wm_k.replace("-v2-","-")                         # maybe v2 marker
        print(f"  [{idx}] probing alts for missing {wm_k}:")
        for a in (alt, alt2, alt3, wm_k.replace(".webp",".jpg").replace("-v2-","-")):
            s = safe_head(R2_BASE + a, retries=1)
            print(f"    .../{a[:65]:65s} -> {s[0]} CT={s[1][:20]}")
    time.sleep(0.05)

print()
print("=== STATISTICS of 40 sampled cards ===")
for k,v in stats.items(): print(f"  {k:22s}: {v}")
print()
print("=== SAMPLE bgImageWatermark 404 (8/40) ===")
for s in samples_wm_404:
    print(f"  [{s[0]:2d}] slug={s[1]:55s}  bg_s={s[3]}  key={s[2]}")
print()
print("=== SAMPLE bgOK + wm404 (fallback candidate) ===")
for s in samples_bg_ok_wm_404:
    print(f"  [{s[0]:2d}] cat={s[1]:12s} slug={s[2]:40s}")
    print(f"        wm_key={s[3]}")
    print(f"        bg_key={s[4]}")
