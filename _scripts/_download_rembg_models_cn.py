"""
绕过 GitHub SSL EOF 的 rembg 模型下载（国内代理 ghproxy / gh-api）
直接把模型 onnx 文件下载到 ~/.u2net/，rembg 会直接跳过下载环节。
"""
import os
import sys
import time
from pathlib import Path

U2NET_HOME = Path(os.environ.get("U2NET_HOME") or (Path.home() / ".u2net"))
U2NET_HOME.mkdir(parents=True, exist_ok=True)
print("模型目录:", U2NET_HOME)

MODELS = [
    {
        "name": "u2netp",
        "fn": "u2netp.onnx",
        "size": 75_859_253,
        "github": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
    },
    {
        "name": "u2net",
        "fn": "u2net.onnx",
        "size": 176_386_929,
        "github": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx",
    },
]

PROXIES = [
    lambda u: "https://mirror.ghproxy.com/" + u,
    lambda u: "https://gh.api.99988866.xyz/" + u,
    lambda u: "https://gh-proxy.com/" + u,
    lambda u: u,  # 直连 GitHub（最后兜底）
]

def dl(url: str, dst: Path, timeout=120, retries_per_proxy=3):
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    import shutil

    for proxy_i, proxy_fn in enumerate(PROXIES):
        real_url = proxy_fn(url)
        for attempt in range(1, retries_per_proxy + 1):
            tmp = dst.with_suffix(dst.suffix + ".part")
            resume = tmp.stat().st_size if tmp.exists() else 0
            print(f"  🔗 代理{proxy_i+1}/{len(PROXIES)} attempt {attempt}/{retries_per_proxy}: {real_url[:90]}...")
            s = requests.Session()
            ret = Retry(total=2, backoff_factor=1,
                        status_forcelist=[429, 500, 502, 503, 504],
                        allowed_methods=["GET", "HEAD"])
            s.mount("https://", HTTPAdapter(max_retries=ret))
            headers = {"User-Agent": "Mozilla/5.0"}
            if resume > 0:
                print(f"    ⏯  断点续传：已下 {resume / 1024 / 1024:.1f}MB")
                headers["Range"] = f"bytes={resume}-"
            try:
                r = s.get(real_url, headers=headers, stream=True, timeout=timeout, verify=False)
                total = int(r.headers.get("Content-Length", "0"))
                if r.status_code not in (200, 206):
                    print(f"    ❌ HTTP {r.status_code}")
                    r.close()
                    time.sleep(2 * attempt)
                    continue
                mode = "ab" if resume and r.status_code == 206 else "wb"
                downloaded = resume if mode == "ab" else 0
                last_ts = time.time()
                last_bytes = downloaded
                with open(tmp, mode) as f:
                    for chunk in r.iter_content(1024 * 1024):
                        if not chunk:
                            continue
                        f.write(chunk)
                        downloaded += len(chunk)
                        now = time.time()
                        if now - last_ts >= 2.0:
                            spd = (downloaded - last_bytes) / (now - last_ts) / 1024 / 1024
                            pct = f"{downloaded / total * 100:.1f}%" if total else f"{downloaded / 1024 / 1024:.1f}MB"
                            print(f"    ⏳ {pct}  速度 {spd:.2f}MB/s", end="\r")
                            last_ts, last_bytes = now, downloaded
                r.close()
                print()
                # 校验：文件大小 >= 目标 * 0.95
                final_sz = tmp.stat().st_size
                if final_sz >= int(MODELS[i]["size"] * 0.9):
                    if dst.exists():
                        dst.unlink()
                    shutil.move(str(tmp), str(dst))
                    print(f"    ✅ 下载完成！ {final_sz / 1024 / 1024:.1f}MB  → {dst}")
                    return True
                else:
                    print(f"    ⚠️  文件太小（{final_sz} < 目标的 90%），换代理")
            except Exception as e:
                print(f"    ❌ 代理{proxy_i+1} attempt {attempt} 异常: {e}")
                time.sleep(3 * attempt)
        print(f"  ⏭  代理{proxy_i+1} 所有重试失败，尝试下一个")
    return False


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["u2net", "u2netp"], default="")
    args = ap.parse_args()
    import urllib3
    urllib3.disable_warnings()  # 关 verify=False 警告

    ok = 0
    for i, m in enumerate(MODELS):
        if args.only and m["name"] != args.only:
            continue
        dst = U2NET_HOME / m["fn"]
        if dst.exists() and dst.stat().st_size >= int(m["size"] * 0.95):
            print(f"⏭  [{m['name']}] 已存在 {dst.stat().st_size/1024/1024:.1f}MB，跳过")
            ok += 1
            continue
        print(f"\n📦 下载 [{m['name']}] {m['fn']}（目标 {m['size']/1024/1024:.0f}MB）")
        if dl(m["github"], dst):
            ok += 1
    print(f"\n📊 完成：{ok}/{len(MODELS) if not args.only else 1} 个模型")
    if ok == (len(MODELS) if not args.only else 1):
        print("🎉 全部下载完成！下一步：跑 dry-run 测试")
        sys.exit(0)
    else:
        print("⚠️  未完全下载，再跑一次脚本继续（断点续传）")
        sys.exit(2)
