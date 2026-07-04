"""Post-fix verification: /api/cards URLs → 100% valid 200 OK in R2 Preview bucket"""
import json, urllib.request, urllib.parse, sys
from collections import Counter

KNOWN_GOOD = {
  "anniversary": [5705991,5706029,5725879,8014883,8014934,8014935,8015238,8015616,33629667,33629668],
  "birthday": [8014697,8014703,8014709,8014713,8014829,8014830,8014831,8014837,8014874,8014876],
  "christmas": [10226187,14543391,14545423,14681480,19208322,19551026,19551029,29666240,32795870,35217786],
  "congratulations": [4439442,5478209,5705959,5706039,7723812,7723816,7842828,8177957,28461106,37845926],
  "easter": [6990553,6990555,6990620,6990621,6990622,6990626,6990627,6990672,6990733,6990735],
  "encouragement": [4466104,5420988,5981366,5993294,6532589,8015243,8361432,8383666,12268292,19652318],
  "fathers-day": [4260097,8015532,17385395,18296227,28589300,33428408,33769345,35281486,37936229,38165283],
  "friendship": [4207550,5477588,5478209,5491834,5706029,5706039,5706056,5713665,7679771,14545423],
  "get-well": [5706031,8015505,8015517,8015529,8015532,8015576,8015637,18028975,18456265,37182441],
  "good-luck": [7661289,13817351,15104338,18684950,25949528,27259375,30125650,30125651,30191155,37513752],
  "graduation": [9829305,9829309,9829315,9829319,9829478,9829489,9829490,9829492,17778852,23490155],
  "halloween": [5689143,9966403,9966421,9966441,9966446,9966450,9966468,9966471,9966478,34880804],
  "love": [7679697,7679698,7679701,7679760,7679771,7680031,11133249,13786308,20122621,30269722],
  "missing-you": [5706039,5713665,6633082,8015505,8015521,8015616,8015637,13817351,19582311,32170901],
  "mothers-day": [7763899,7763933,7763964,7764024,7764074,7764415,7764419,7764510,7764526,8015521],
  "new-baby": [5420895,7701430,8015568,28925003,32341323,32838207,34291551,34625449,35245312,37182441],
  "new-year": [5473343,5485043,14543391,19287466,19287471,29878372,29997004,32718648,34539522,34654310],
  "retirement": [4207550,4464371,4466052,4668380,5478230,5705991,8015568,16598003,27196519,33428408],
  "sorry": [4207550,5478209,5706039,6633016,6633040,6633047,6633050,8015505,8015568,8015616],
  "sympathy": [8015513,8015516,8015522,8015574,8015626,8015627,8015629,8015633,8015637,8015642],
  "thank-you": [4386503,4386516,6432585,7661213,7661629,8014830,8015521,8058870,19582311,29494716],
  "thanksgiving": [14238943,18852526,18852529,18852537,18852539,18852541,18939831,18939833,29021636,31638765],
  "thinking-of-you": [4207550,5420902,5478209,5706029,7291601,8015505,8015568,8361431,10202989,19582311],
  "valentine": [7679697,7679698,7679701,7679771,7679911,7680024,7680031,13786308,20122621,30269722],
  "wedding": [8015507,8015516,8015568,8015574,8015616,8015629,8015632,8059957,14794078,30191213]
}
import re
WM_RE = re.compile(r"/([^/]+)/\1-pexels-(\d+)-v2-vertical\.webp$")

url = "https://sendafun.com/api/cards?size=96"
req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0 post-fix verify 1.0", "Accept":"application/json"})
with urllib.request.urlopen(req, timeout=30) as r:
    data = json.loads(r.read().decode("utf-8"))
cards = data.get("cards") or data.get("data") or data
print(f"Total cards returned: {len(cards)}")
in_pool = 0; not_in_pool = 0; heads_ok = 0; heads_bad = 0; bad_examples = []
cat_counts = Counter()
for idx, c in enumerate(cards):
    wm = c.get("bgImageWatermark") or ""
    m = WM_RE.search(wm)
    cat = c.get("category") or ""
    cat_counts[cat] += 1
    if m:
        folder, pid = m.group(1), int(m.group(2))
        pool = KNOWN_GOOD.get(folder)
        if pool and pid in pool:
            in_pool += 1
        else:
            not_in_pool += 1
            if len(bad_examples) < 5:
                bad_examples.append({"cat":cat,"folder":folder,"pid":pid,"url":wm})
    else:
        not_in_pool += 1
        if len(bad_examples) < 5:
            bad_examples.append({"cat":cat,"folder":None,"pid":None,"url":wm})
    # HEAD request
    if wm:
        try:
            hreq = urllib.request.Request(wm, method="HEAD", headers={"User-Agent":"Mozilla/5.0 verify"})
            with urllib.request.urlopen(hreq, timeout=10) as hr:
                if 200 <= hr.status < 300:
                    heads_ok += 1
                else:
                    heads_bad += 1
        except Exception as e:
            heads_bad += 1
print(f"\n--- URL Pattern Match vs KNOWN_GOOD pool ---")
print(f"In pool (valid ID): {in_pool} / {len(cards)} ({100.0*in_pool/len(cards):.1f}%)")
print(f"Not in pool (bad): {not_in_pool} / {len(cards)} ({100.0*not_in_pool/len(cards):.1f}%)")
if bad_examples:
    print("Bad examples:", json.dumps(bad_examples, indent=2, ensure_ascii=False))
print(f"\n--- HEAD HTTP 200 check on bgImageWatermark URLs ---")
print(f"2xx OK: {heads_ok} / {heads_ok+heads_bad} ({100.0*heads_ok/(heads_ok+heads_bad) if heads_ok+heads_bad else 0:.1f}%)")
print(f"Failed: {heads_bad}")
print(f"\nCategory distribution (top 15):")
for k,v in cat_counts.most_common(15):
    print(f"  {k}: {v}")
sys.exit(0 if (not_in_pool == 0 and heads_bad == 0) else 1)
