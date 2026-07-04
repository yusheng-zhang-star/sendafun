import requests, json, time, sys

API = "https://sendafun.com/api/cards"
R2_BASE = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/"

def safe_head(u, timeout=12, retries=2):
    for _ in range(retries):
        try:
            r = requests.head(u, timeout=timeout, allow_redirects=True)
            return r.status_code, r.headers.get("Content-Type",""), r.headers.get("Content-Length","0")
        except Exception as e:
            time.sleep(0.3)
            continue
    return 0, type(e).__name__ if 'e' in dir() else "UnknownErr", ""

pages = [1,2,3,5,10,20,50,99]
per_page = 24
all_cards = []
print(f"=== Fetch {len(pages)} pages of {per_page} cards ===")
for p in pages:
    r = requests.get(API, params={"page":p,"size":per_page}, timeout=30)
    d = r.json()
    cs = d.get("cards",[])
    all_cards.extend(cs)
    print(f"  page {p:3d}: got {len(cs)} cards total_now={len(all_cards)}")

print(f"Total cards sampled: {len(all_cards)}")

stats = {"wm_ok":0,"wm_404":0,"wm_other":0,"bg_ok":0,"bg_404":0,"bg_other":0,"both_404":0,"wm_only_404":0,"bg_only_404":0,"wm_same_as_bg":0,"both_ok":0}
wm_ext_count = {}
wm_ext_404 = {}
by_category = {}
broken_examples = []  # (idx, cat, slug, wm_key, wm_s, bg_key, bg_s, ext)
# Also check: do suffixes like -vertical or -v2 exist?
bad_keys = {"patterns":{}}
for idx, c in enumerate(all_cards):
    wm = c.get("bgImageWatermark") or ""
    bg = c.get("bgImage") or ""
    wm_k = wm.replace(R2_BASE,"")
    bg_k = bg.replace(R2_BASE,"")
    cat = c.get("category") or "?"
    if cat not in by_category: by_category[cat] = {"n":0,"wm_bad":0}
    by_category[cat]["n"] += 1
    # extension
    ext = "unknown"
    if "." in wm_k: ext = wm_k.rsplit(".",1)[-1].lower()
    wm_ext_count[ext] = wm_ext_count.get(ext,0)+1
    wm_s = safe_head(wm) if wm else (None,None,None)
    bg_s = safe_head(bg) if bg else (None,None,None)
    if wm_s[0] is not None:
        if wm_s[0] == 200: stats["wm_ok"] += 1
        elif wm_s[0] == 404:
            stats["wm_404"] += 1
            wm_ext_404[ext] = wm_ext_404.get(ext,0)+1
            by_category[cat]["wm_bad"] += 1
            bad_keys["patterns"].setdefault(ext,0); bad_keys["patterns"][ext]+=1
        else: stats["wm_other"] += 1
    if bg_s[0] is not None:
        if bg_s[0] == 200: stats["bg_ok"] += 1
        elif bg_s[0] == 404: stats["bg_404"] += 1
        else: stats["bg_other"] += 1
    if wm_s[0] == 404 and bg_s[0] == 404:
        stats["both_404"] += 1
        if len(broken_examples) < 15:
            broken_examples.append((idx,cat,(c.get("slug") or "")[:50],wm_k,wm_s[0],bg_k,bg_s[0],ext))
    elif wm_s[0] == 404: stats["wm_only_404"] += 1
    elif bg_s[0] == 404: stats["bg_only_404"] += 1
    elif wm_s[0] == 200 and bg_s[0] == 200: stats["both_ok"] += 1
    if wm == bg: stats["wm_same_as_bg"] += 1
    if idx % 20 == 0:
        sys.stderr.write(f"  progress {idx}/{len(all_cards)} ... wm_404={stats['wm_404']} both_404={stats['both_404']}\n")
    time.sleep(0.02)

wm_404_rate = 100.0 * stats["wm_404"] / max(1,len(all_cards))
both_404_rate = 100.0 * stats["both_404"] / max(1,len(all_cards))

print()
print("=========== SUMMARY ===========")
print(f"Total sampled: {len(all_cards)} (from pages {pages})")
print("By existence:")
for k in ("wm_ok","wm_404","wm_other","bg_ok","bg_404","bg_other","both_ok","both_404","wm_only_404","bg_only_404","wm_same_as_bg"):
    print(f"  {k:20s}: {stats[k]:5d}")
print(f"  wm_404 rate    : {wm_404_rate:.1f}%")
print(f"  both_404 rate  : {both_404_rate:.1f}%")
print()
print("Watermark file extension breakdown:")
for ext,n in sorted(wm_ext_count.items(),key=lambda x:-x[1]):
    c4 = wm_ext_404.get(ext,0)
    print(f"  .{ext:8s}: {n:5d} total, 404 = {c4:5d}  ({100.0*c4/max(1,n):.1f}%)")
print()
print("By category (wm_bad > 0):")
rows = [(c,d["n"],d["wm_bad"],100.0*d["wm_bad"]/max(1,d["n"])) for c,d in by_category.items() if d["wm_bad"]>0]
rows.sort(key=lambda x:-x[2])
for c,n,b,r in rows[:15]:
    print(f"  {c:25s}: {n:5d} cards, wm_bad={b:4d} ({r:.1f}%)")
print()
print(f"BROKEN examples ({len(broken_examples)}): both wm+bg 404 on Preview R2 bucket")
for e in broken_examples:
    print(f"  [{e[0]:3d}] cat={e[1]:20s} slug={e[2]}")
    print(f"        wm_key [{e[7]:5s}] 404? {e[4]} -> {e[3]}")
    print(f"        bg_key         404? {e[6]} -> {e[5]}")
print()
print("Probe existing good key patterns from bucket: take a GOOD (wm_ok=200) key to compare format vs BROKEN:")
# find a good key:
good_key = None
for c in all_cards:
    wm = c.get("bgImageWatermark") or ""
    if not wm: continue
    wk = wm.replace(R2_BASE,"")
    h = safe_head(wm, retries=1)
    if h[0] == 200: good_key = wk; break
print(f"  GOOD KEY sample: {good_key}")
if broken_examples:
    print(f"  BAD KEY sample : {broken_examples[0][3]}")
    # Maybe different prefix? Check: does bucket perhaps have them without category folder?
    bad_key = broken_examples[0][3]
    # guess: key = filename only
    guesses = [
        bad_key.split("/")[-1],
        bad_key.replace("-v2-","-").replace("-v1-","-"),
        bad_key.replace("-vertical",""),
        bad_key.replace("-horizontal",""),
        bad_key.replace("sorry/",""),  # remove category prefix
        bad_key.rsplit(".",1)[0] + ".jpg",
        bad_key.rsplit(".",1)[0] + ".png",
    ]
    print()
    print(f"  Probing 7 guesses for the bad key:")
    for g in guesses:
        s = safe_head(R2_BASE + g, timeout=10, retries=1)
        print(f"    {s[0]:3d} CT={s[1][:28]:28s}  -> {g[:80]}")
