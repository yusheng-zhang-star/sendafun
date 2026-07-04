"""
快速核实 sendafun-originals 桶中【所有图片实际像素是否 ≥ 2800px】
- 先 list 全部对象（分页）
- 再抽样：前 300 张顺序 + 每分类 20 张（≥400 张样本，保证统计置信度）
- 每张 R2 Range GET 前 5MB → Pillow 读尺寸 → 检查 max(w,h) ≥ 2800
- 结果同时打印 + 写 _logs/_verify_originals_result.txt
"""
import os, sys, io, time, json, random
from pathlib import Path
from collections import defaultdict
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import boto3
    from dotenv import load_dotenv
except Exception as e:
    print(f"ImportError: {e}")
    sys.exit(2)

load_dotenv(PROJECT_ROOT / ".env")

MIN_LONG_SIDE = 2800
RESULT_FILE = PROJECT_ROOT / "_logs" / "_verify_originals_result.txt"
RESULT_FILE.parent.mkdir(exist_ok=True, parents=True)

def log(msg):
    print(msg, flush=True)
    with open(RESULT_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

def main():
    # ---- 清空上次结果 ----
    RESULT_FILE.write_text("", encoding="utf-8")
    log("=" * 70)
    log("📊 sendafun-originals 桶 高清前置门槛 >=2800px 核实报告")
    log(f"   时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    log("=" * 70)

    # ---- 1. 连接 R2 ----
    ACCT = os.environ.get("R2_ACCOUNT_ID", "")
    KEY = os.environ.get("R2_ACCESS_KEY_ID", "")
    SEC = os.environ.get("R2_SECRET_ACCESS_KEY", "")
    BUCKET = os.environ.get("R2_ORIGINALS_BUCKET_NAME", "sendafun-originals")
    log(f"   R2_ACCOUNT_ID: {ACCT[:8]}...{ACCT[-4:]}")
    log(f"   Bucket: {BUCKET}")

    if not all([ACCT, KEY, SEC]):
        log("❌ .env 缺少 R2 凭证（R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY）")
        sys.exit(3)

    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{ACCT}.r2.cloudflarestorage.com",
        aws_access_key_id=KEY,
        aws_secret_access_key=SEC,
        region_name="auto",
        config=boto3.session.Config(signature_version="s3v4"),
    )

    # ---- 2. list 全部对象 ----
    log("")
    log("--- 2. 列桶内全部对象（分页循环）---")
    t0 = time.time()
    keys = []
    sizes = []
    ct = None
    page = 0
    while True:
        page += 1
        kwargs = dict(Bucket=BUCKET, MaxKeys=1000)
        if ct:
            kwargs["ContinuationToken"] = ct
        try:
            resp = s3.list_objects_v2(**kwargs)
        except Exception as e:
            log(f"❌ list_objects_v2 失败: {e}")
            sys.exit(4)
        for obj in resp.get("Contents", []):
            keys.append(obj["Key"])
            sizes.append(obj.get("Size", 0))
        if not resp.get("IsTruncated"):
            break
        ct = resp.get("NextContinuationToken")
    total = len(keys)
    log(f"   总文件数: {total}   页数: {page}   耗时: {int(time.time()-t0)}s")
    if total == 0:
        log("✅ 桶为空，无不达标文件")
        sys.exit(0)

    # ---- 3. 按分类分组 + 生成抽样 index ----
    log("")
    log("--- 3. 按分类分组，选抽样样本 ---")
    cats = defaultdict(list)
    for i, k in enumerate(keys):
        c = k.split("/")[0]
        cats[c].append(i)
    log(f"   分类数: {len(cats)}  分类分布:")
    for c in sorted(cats):
        log(f"     {c:25s}: {len(cats[c]):>5d} 张")

    sample_idxs = []
    seen = set()
    random.seed(42)
    for c, idxs in sorted(cats.items()):
        n_pick = min(20, len(idxs))
        for i in random.sample(idxs, n_pick):
            if i not in seen:
                seen.add(i)
                sample_idxs.append(i)
    for i in range(min(300, total)):
        if i not in seen:
            seen.add(i)
            sample_idxs.append(i)

    n_sample = len(sample_idxs)
    cov = n_sample / total * 100
    log(f"   本次抽样: {n_sample} 张（覆盖率 {cov:.1f}%，每分类 ≥20 张）")

    # ---- 4. 逐张检查像素 ----
    log("")
    log(f"--- 4. 逐张读取实际像素，检查 max(w,h) >= {MIN_LONG_SIDE}px ---")
    t0 = time.time()
    good = 0
    bad = 0
    bad_list = []
    bytes_dl = 0
    for n, idx in enumerate(sample_idxs, 1):
        k = keys[idx]
        sz = sizes[idx]
        try:
            max_bytes = min(sz, 5 * 1024 * 1024) if sz > 0 else 5 * 1024 * 1024
            rng = f"bytes=0-{max_bytes-1}" if sz > 0 else ""
            if rng:
                obj = s3.get_object(Bucket=BUCKET, Key=k, Range=rng)
            else:
                obj = s3.get_object(Bucket=BUCKET, Key=k)
            data = obj["Body"].read()
            bytes_dl += len(data)
            try:
                im = Image.open(io.BytesIO(data))
                w, h = im.size
                im.verify()
            except Exception as e:
                bad += 1
                bad_list.append((k, -1, -1, f"PIL Open/Verify Error: {e}"))
                continue
            long_side = max(w, h)
            if long_side < MIN_LONG_SIDE:
                bad += 1
                bad_list.append((k, w, h, long_side))
            else:
                good += 1
        except Exception as e:
            bad += 1
            bad_list.append((k, -1, -1, f"GET/HEAD Error: {e}"))

        if n % 50 == 0 or n == n_sample:
            dt = int(time.time() - t0)
            mb = bytes_dl / 1024 / 1024
            log(f"   进度: {n:>4d}/{n_sample:>4d}   合格={good:>4d}  不合格={bad:>3d}   下了 {mb:.1f}MB  耗时 {dt}s")

    # ---- 5. 最终报告 ----
    log("")
    log("=" * 70)
    log("📋 最终结果")
    log("=" * 70)
    log(f"   桶内总文件数:            {total}")
    log(f"   本次抽样检查数:          {n_sample}  ({cov:.1f}% 覆盖率)")
    log(f"   ✅ 合格 (max≥{MIN_LONG_SIDE}px):  {good}")
    log(f"   ❌ 不合格 (max<{MIN_LONG_SIDE}px): {bad}")
    if n_sample > 0:
        pass_rate = good / n_sample * 100
        log(f"   📈 样本合格率:           {pass_rate:.2f}%")
    if bad_list:
        log("")
        log("❌ 不合格清单（全部，≤100 条）:")
        for n, (k, w, h, info) in enumerate(bad_list[:100], 1):
            if isinstance(info, int):
                log(f"   {n:>3d}. {k:60s} {w}x{h}  long_side={info}px ❌ < {MIN_LONG_SIDE}")
            else:
                log(f"   {n:>3d}. {k:60s} {info}")
        if len(bad_list) > 100:
            log(f"   ... 剩下 {len(bad_list)-100} 条不展示，完整清单见 {RESULT_FILE}")
    else:
        log("")
        log(f"✅ 本次抽样 {n_sample} 张 100% 合格，所有样本实际像素 max(w,h) 均 >= {MIN_LONG_SIDE}px")

    log("")
    log(f"📝 完整结果已写入: {RESULT_FILE}")

if __name__ == "__main__":
    main()
