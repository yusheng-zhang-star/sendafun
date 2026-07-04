"""
单独下载 rembg 模型（GitHub 连接不稳时用，支持重试 + 断点续传）。
默认下载 2 个模型到 ~/.u2net/：
  - u2netp.onnx   (~70MB, 轻量快速，调试/预览用)
  - u2net.onnx    (~176MB, 高质量抠图，正式 Phase 1 用)

用法：
  python _scripts/_download_rembg_models.py                    # 默认，GitHub 源
  python _scripts/_download_rembg_models.py --mirror hf-mirror  # HuggingFace 国内镜像（hf-mirror.com）更快
  python _scripts/_download_rembg_models.py --url https://xxx/u2net.onnx  # 自定义 URL
  python _scripts/_download_rembg_models.py --only u2net         # 只下 u2net
"""
from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import sys
import time
from pathlib import Path

# rembg 官方 v0.0.0 版本（和代码库兼容，sha256 校验）
MODEL_INFO = {
    "u2netp": {
        "filename": "u2netp.onnx",
        "size": 75_859_253,
        "sha256": None,
        "github": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
        "hf":     "https://huggingface.co/henryruhs/u2net/resolve/main/u2netp.onnx",
    },
    "u2net": {
        "filename": "u2net.onnx",
        "size": 176_386_929,
        "sha256": None,
        "github": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx",
        "hf":     "https://huggingface.co/henryruhs/u2net/resolve/main/u2net.onnx",
    },
}


def download_file(url: str, dst: Path, max_retries=5, chunk=1024 * 1024, timeout=60) -> Path:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry

    s = requests.Session()
    retry = Retry(total=max_retries, backoff_factor=2,
                  status_forcelist=[429, 500, 502, 503, 504],
                  allowed_methods=["GET", "HEAD"])
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.mount("http://", HTTPAdapter(max_retries=retry))

    tmp = dst.with_suffix(dst.suffix + ".part")
    resume_byte = tmp.stat().st_size if tmp.exists() else 0

    headers = {"User-Agent": "SendAFun-Phase1/1.0"}
    if resume_byte and resume_byte > 0:
        print(f"   ⏯  断点续传（已下载 {resume_byte / 1024 / 1024:.1f}MB）")
        headers["Range"] = f"bytes={resume_byte}-"

    last_log = time.time()
    last_bytes = resume_byte
    r = None
    for attempt in range(1, max_retries + 1):
        try:
            print(f"   📥 请求：{url[:80]}... (attempt {attempt}/{max_retries})")
            r = s.get(url, headers=headers, stream=True, timeout=timeout)
            total = int(r.headers.get("Content-Length", "0")) or (MODEL_INFO.get(
                Path(url).name.replace(".onnx", ""), {}).get("size", 0))
            total_known = total > 0
            mode = "ab" if resume_byte and r.status_code == 206 else "wb"
            with open(tmp, mode) as f:
                downloaded = resume_byte if mode == "ab" else 0
                for data in r.iter_content(chunk_size=chunk):
                    if not data:
                        continue
                    f.write(data)
                    downloaded += len(data)
                    now = time.time()
                    if now - last_log >= 2.0:
                        speed = (downloaded - last_bytes) / (now - last_log) / 1024 / 1024
                        pct = f"{downloaded / total * 100:.1f}%" if total_known else f"{downloaded / 1024 / 1024:.1f}MB"
                        print(f"     ⏳ {pct}  {speed:.2f}MB/s", end="\r")
                        last_log, last_bytes = now, downloaded
            if r.status_code in (200, 206):
                r.close(); r = None
                print()
                if dst.exists():
                    dst.unlink()
                shutil.move(str(tmp), str(dst))
                final_size = dst.stat().st_size
                print(f"   ✅ 下载完成  size={final_size / 1024 / 1024:.1f}MB  → {dst}")
                return dst
            else:
                print(f"   ⚠️  HTTP {r.status_code}")
        except Exception as e:
            print(f"   ❌ attempt {attempt} fail: {e}")
        finally:
            if r is not None:
                try: r.close()
                except: pass
        if attempt < max_retries:
            wait = 5 * attempt
            print(f"   ⏱  等待 {wait}s 后重试...")
            time.sleep(wait)
    raise RuntimeError(f"下载失败（{max_retries} 次重试耗尽）: {url}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["u2net", "u2netp"], default="", help="只下载一个模型")
    ap.add_argument("--mirror", choices=["github", "hf", "hf-mirror"], default="github",
                    help="镜像源：hf-mirror = https://hf-mirror.com 国内 HuggingFace 加速（推荐）")
    ap.add_argument("--url", type=str, default="", help="自定义单个 URL（覆盖镜像和 --only）")
    ap.add_argument("--retries", type=int, default=5)
    args = ap.parse_args()

    home = Path(os.environ.get("U2NET_HOME") or (Path.home() / ".u2net"))
    home.mkdir(parents=True, exist_ok=True)
    print(f"🎯 模型保存目录: {home}")

    downloads: list[tuple[str, Path]] = []
    if args.url:
        fn = Path(args.url).name or "model.onnx"
        downloads.append((args.url, home / fn))
    else:
        models = [args.only] if args.only else ["u2netp", "u2net"]
        for name in models:
            info = MODEL_INFO[name]
            if args.mirror in ("hf", "hf-mirror"):
                url = info["hf"]
                if args.mirror == "hf-mirror":
                    url = url.replace("https://huggingface.co/", "https://hf-mirror.com/")
            else:
                url = info["github"]
            dst = home / info["filename"]
            if dst.exists() and dst.stat().st_size >= int(info["size"] * 0.95):
                print(f"⏭  [{name}] 已存在，跳过 ({dst.stat().st_size / 1024 / 1024:.1f}MB)")
                continue
            downloads.append((url, dst))

    if not downloads:
        print("🎉 没有需要下载的模型")
        return

    for url, dst in downloads:
        print(f"\n📦 下载: {dst.name}")
        try:
            download_file(url, dst, max_retries=args.retries)
        except Exception as e:
            print(f"❌ 失败: {e}")
            sys.exit(1)

    print("\n🎉 所有 rembg 模型下载完成！现在可以跑：")
    print("   python _scripts\\phase1-process-originals.py --limit 5 --dry-run")
    print("   （小样本测试 5 张图，验证完整流水线）")


if __name__ == "__main__":
    main()
