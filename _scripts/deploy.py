#!/usr/bin/env python3
"""
===========================================================================
SendAFun 统一部署脚本 — 固化 workbuffy 踩过的 2 个坑：
  PIT-1 认证冲突:  .env 里 CF_API_TOKEN 权限不足(code 10000)会抢占 OAuth
                   → 子进程 env 强制 unset + 临时 rename .env 双保险
  PIT-2 Pages 大文件: wrangler pages deploy CLI 模式不读 .pagesignore
                    cards-meta.json(36MB) + _category_index.json 超 Pages 25MB
                   → 每次部署前自动从 public/ 幂等同步到干净目录
===========================================================================
用法:
  python _scripts/deploy.py pages            # 只部署 Pages(前端)
  python _scripts/deploy.py worker           # 只部署 Worker(API+D1绑定)
  python _scripts/deploy.py both             # 先 Pages 后 Worker（推荐顺序）
  python _scripts/deploy.py pages --dry-run  # 只打印，不动手
  python _scripts/deploy.py both --no-post   # 跳过 post-deploy 自检
  python _scripts/deploy.py both --no-swap-env  # 不 rename .env（纯 unset env var）
===========================================================================
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / "public"
DEPLOY_TMP_DIR = ROOT / ".pages_deploy_tmp"
ENV_FILE = ROOT / ".env"
ENV_SWAP_FILE = ROOT / ".env.__deploy_swap__"
PACKAGE_JSON = ROOT / "package.json"
WRANGLER_TOML = ROOT / "wrangler.toml"
POST_DEPLOY_SCRIPT = ROOT / "_scripts" / "run-post-deploy.py"

PAGES_IGNORE_RULES: Tuple[str, ...] = (
    # 官方 .pagesignore 的规则，deploy.py 手动实现（因为 wrangler CLI 不读）
    "cards-meta.json",
    "_category_index.json",
    ".pagesignore",  # 等一下手动复制，避免被上面匹配到
)
PAGES_IGNORE_SUFFIX: Tuple[str, ...] = (
    ".pyc", ".pyo", ".log",
)
PAGES_IGNORE_DIRS: Tuple[str, ...] = (
    "node_modules", ".git", ".idea", ".vscode", "__pycache__",
)
PAGES_PRESERVE_DOTFILES = (".pagesignore", ".nojekyll", "_headers", "_redirects", "_routes.json")

PAGES_SOFT_LIMIT_MB = 24  # 比官方 25MB 留 1MB 安全余量


# ======================================================================
# PIT-2: public -> .pages_deploy_tmp 干净目录同步（幂等）
# ======================================================================
def _should_copy(src_path: Path, rel_name: str) -> bool:
    name = src_path.name
    if src_path.is_dir():
        return name not in PAGES_IGNORE_DIRS
    if name in PAGES_PRESERVE_DOTFILES:
        return True
    if name in PAGES_IGNORE_RULES:
        return False
    if name.endswith(PAGES_IGNORE_SUFFIX):
        return False
    if name.startswith(".") and name not in PAGES_PRESERVE_DOTFILES:
        return False
    return True


def sync_public_to_deploy_tmp(dry_run: bool = False) -> Tuple[int, int]:
    """
    从 PUBLIC_DIR 同步到 DEPLOY_TMP_DIR。
    幂等 = 先清空 DEPLOY_TMP_DIR（除了 .git 这种）再复制。
    返回 (复制文件数, 总大小MB整数)
    """
    if not PUBLIC_DIR.is_dir():
        raise RuntimeError(f"[PIT-2 FATAL] public目录不存在: {PUBLIC_DIR}")

    # 1. 先清空目标（保留必要元信息目录）
    if DEPLOY_TMP_DIR.exists():
        for entry in DEPLOY_TMP_DIR.iterdir():
            if entry.name == ".git":
                continue
            if dry_run:
                print(f"[dry-run] [PIT-2] 清理 {entry.name}")
                continue
            if entry.is_dir():
                shutil.rmtree(entry, ignore_errors=True)
            else:
                try:
                    entry.unlink()
                except FileNotFoundError:
                    pass
    else:
        if not dry_run:
            DEPLOY_TMP_DIR.mkdir(parents=True, exist_ok=True)
        print(f"[PIT-2] 创建部署目录 {DEPLOY_TMP_DIR.name}/")

    # 2. 复制文件，手动实现 .pagesignore
    copied_files: List[Path] = []
    total_bytes = 0

    def _walk(src_dir: Path, dst_dir: Path):
        nonlocal copied_files, total_bytes
        for src in sorted(src_dir.iterdir()):
            rel = src.relative_to(PUBLIC_DIR)
            if not _should_copy(src, str(rel)):
                if dry_run:
                    print(f"[dry-run] [PIT-2] 跳过 (匹配ignore规则): {rel}")
                continue
            dst = dst_dir / src.name
            if src.is_dir():
                if not dry_run:
                    dst.mkdir(parents=True, exist_ok=True)
                _walk(src, dst)
            else:
                size = src.stat().st_size
                copied_files.append(src)
                total_bytes += size
                if not dry_run:
                    shutil.copy2(src, dst)

    if dry_run:
        _walk(PUBLIC_DIR, Path("__dry_run_dst__"))
    else:
        _walk(PUBLIC_DIR, DEPLOY_TMP_DIR)
        # 手动复制一份 .pagesignore 到目标（虽然 CLI 不读，但留档+防止未来Git集成回归）
        src_dotignore = PUBLIC_DIR / ".pagesignore"
        if src_dotignore.is_file():
            shutil.copy2(src_dotignore, DEPLOY_TMP_DIR / ".pagesignore")

    total_mb = round(total_bytes / (1024 * 1024), 2)
    oversize = total_mb > PAGES_SOFT_LIMIT_MB

    print(f"\n[PIT-2] 同步报告:")
    print(f"  复制文件数: {len(copied_files)}")
    print(f"  总大小: {total_mb} MB  (官方<25MB, 本脚本告警阈值={PAGES_SOFT_LIMIT_MB}MB)")
    if oversize:
        print(f"  ⚠️  [PIT-2] WARN: 总大小 {total_mb}MB 超 {PAGES_SOFT_LIMIT_MB}MB 安全线！")
        # 列前 3 大文件
        sorted_by_size = sorted(copied_files, key=lambda p: p.stat().st_size, reverse=True)
        for i, p in enumerate(sorted_by_size[:5]):
            mb = p.stat().st_size / (1024 * 1024)
            print(f"     大文件#{i+1}: {p.relative_to(PUBLIC_DIR)} = {mb:.2f} MB")
    else:
        print(f"  ✅ [PIT-2] 大小 OK")
    print(f"  排除的关键文件: cards-meta.json, _category_index.json")
    return len(copied_files), total_mb


# ======================================================================
# PIT-1: 移除 wrangler 鉴权冲突源（双保险）
# ======================================================================
# wrangler 4.x 的鉴权优先级（坑的根因）：
#   1. CLOUDFLARE_API_TOKEN env var  <-- .env 里 CF_API_TOKEN 会覆盖这个同名
#   2. CF_API_TOKEN env var          <-- 这个也会被读到！
#   3. OAuth 缓存 (~/.wrangler/config)  <-- 我们想用这个，gpszxtzys@gmail.com
#   4. CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL
#   5. wrangler.toml 里的 profile
CONFLICT_ENV_VARS = (
    "CLOUDFLARE_API_TOKEN",
    "CF_API_TOKEN",
    "CLOUDFLARE_API_KEY",
    "CLOUDFLARE_EMAIL",
)


def _build_sanitized_env() -> Dict[str, str]:
    """返回去掉冲突变量的 env dict"""
    env = os.environ.copy()
    removed: List[str] = []
    for k in CONFLICT_ENV_VARS:
        if k in env:
            removed.append(f"{k}={env[k][:6]}***")
            del env[k]
    # 某些 dotenv loader 会从 .env 读，我们在外面 rename .env 双重保险
    if removed:
        print(f"[PIT-1] 子进程强制移除 {len(removed)} 个冲突鉴权 env var: {', '.join(removed)}")
    else:
        print(f"[PIT-1] 子进程 env 无冲突鉴权变量 (OAuth 缓存将生效)")
    return env


class EnvSwapGuard:
    """with 语句：进入时把 .env rename 成 .env.__deploy_swap__，退出时还原。
    即使 wrangler 还有内部 dotenv loader，也读不到 .env 里的 CF_API_TOKEN。"""

    def __init__(self, enabled: bool = True):
        self.enabled = enabled and ENV_FILE.is_file()
        self._swapped = False

    def __enter__(self):
        if not self.enabled:
            print(f"[PIT-1] .env swap: 跳过 (--no-swap-env 或 .env 不存在)")
            return self
        try:
            if ENV_SWAP_FILE.exists():
                # 上次崩溃遗留，先强制恢复一次
                ENV_SWAP_FILE.replace(ENV_FILE)
                print(f"[PIT-1] .env swap: 检测到遗留 swap 文件已自动恢复")
            ENV_FILE.replace(ENV_SWAP_FILE)
            self._swapped = True
            print(f"[PIT-1] .env swap: .env → .env.__deploy_swap__ (wrangler 读不到 CF_API_TOKEN)")
        except Exception as exc:
            print(f"[PIT-1] .env swap: WARN rename 失败({exc})，仅靠 unset env var 单保险")
            self._swapped = False
        return self

    def __exit__(self, exc_type, exc, tb):
        if not self._swapped:
            return
        try:
            ENV_SWAP_FILE.replace(ENV_FILE)
            print(f"[PIT-1] .env swap: 已还原 .env")
        except Exception as exc:
            print(f"[PIT-1] .env swap: FATAL 还原失败！请手动执行: ")
            print(f"         mv {ENV_SWAP_FILE.name} .env")
            print(f"         错误: {exc}")


# ======================================================================
# wrangler 调用器
# ======================================================================
def _run_wrangler(args: List[str], *, swap_env: bool = True) -> int:
    cmd = ["npx", "wrangler", *args]
    env = _build_sanitized_env()
    print(f"\n{'='*60}")
    print(f"[wrangler] $ {' '.join(cmd)}")
    print(f"{'='*60}")
    with EnvSwapGuard(enabled=swap_env):
        result = subprocess.run(
            cmd,
            cwd=str(ROOT),
            env=env,
            shell=False,
        )
    if result.returncode != 0:
        print(f"\n❌ [wrangler] exit code = {result.returncode}")
    else:
        print(f"\n✅ [wrangler] 完成")
    return result.returncode


def deploy_pages(*, dry_run: bool = False, swap_env: bool = True) -> int:
    print("\n" + "=" * 60)
    print("STEP 1/2 Pages: 干净目录同步 + 部署")
    print("=" * 60)
    sync_public_to_deploy_tmp(dry_run=dry_run)
    if dry_run:
        print("[dry-run] 跳过: npx wrangler pages deploy .pages_deploy_tmp --project-name=sendafun")
        return 0
    return _run_wrangler(
        ["pages", "deploy", str(DEPLOY_TMP_DIR), "--project-name=sendafun"],
        swap_env=swap_env,
    )


def deploy_worker(*, dry_run: bool = False, swap_env: bool = True) -> int:
    print("\n" + "=" * 60)
    print("STEP 2/2 Worker: 脚本上传 + D1/R2/KV绑定")
    print("=" * 60)
    if dry_run:
        print("[dry-run] 跳过: npx wrangler deploy -c wrangler.toml")
        return 0
    return _run_wrangler(["deploy", "-c", "wrangler.toml"], swap_env=swap_env)


def run_post_deploy(*, dry_run: bool = False) -> int:
    print("\n" + "=" * 60)
    print("POST-DEPLOY: 运行 run-post-deploy.py 自检")
    print("=" * 60)
    if dry_run:
        print(f"[dry-run] 跳过: python {POST_DEPLOY_SCRIPT}")
        return 0
    if not POST_DEPLOY_SCRIPT.is_file():
        print(f"[post-deploy] 脚本不存在，跳过: {POST_DEPLOY_SCRIPT}")
        return 0
    result = subprocess.run(
        [sys.executable, str(POST_DEPLOY_SCRIPT)],
        cwd=str(ROOT),
    )
    if result.returncode != 0:
        print(f"⚠️  [post-deploy] 非致命 exit code = {result.returncode}（可能是网络原因）")
    return result.returncode


# ======================================================================
# main
# ======================================================================
def main() -> int:
    ap = argparse.ArgumentParser(
        description="SendAFun 统一部署脚本（自动处理 PIT-1 env冲突 + PIT-2 Pages大文件）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("target", choices=["pages", "worker", "both"],
                    help="pages=只前端, worker=只API/Worker, both=先pages后worker")
    ap.add_argument("--dry-run", action="store_true",
                    help="只打印不动手（同步报告 + 打印 wrangler 命令）")
    ap.add_argument("--no-post", action="store_true",
                    help="跳过 post-deploy 自检脚本")
    ap.add_argument("--no-swap-env", action="store_true",
                    help="不 rename .env（仅 unset env var，适合 .env 里没 CF_API_TOKEN 的环境）")
    args = ap.parse_args()

    # 前置校验
    missing: List[str] = []
    if not WRANGLER_TOML.is_file():
        missing.append(f"wrangler.toml not found at {WRANGLER_TOML}")
    if not PACKAGE_JSON.is_file():
        missing.append(f"package.json not found at {PACKAGE_JSON}")
    if args.target in ("pages", "both") and not PUBLIC_DIR.is_dir():
        missing.append(f"public/ dir not found at {PUBLIC_DIR}")
    if missing:
        for m in missing:
            print(f"[FATAL] {m}", file=sys.stderr)
        return 2

    print(f"[deploy] target={args.target}  dry_run={args.dry_run}  swap_env={not args.no_swap_env}")

    rc = 0
    if args.target in ("pages", "both"):
        rc = max(rc, deploy_pages(dry_run=args.dry_run, swap_env=not args.no_swap_env))
        if rc != 0 and args.target == "both":
            print(f"\n⚠️  Pages 部署失败({rc})，是否继续 Worker？(y/N)：", end="")
            try:
                ans = input().strip().lower()
            except EOFError:
                ans = "n"
            if ans != "y":
                return rc

    if args.target in ("worker", "both"):
        rc = max(rc, deploy_worker(dry_run=args.dry_run, swap_env=not args.no_swap_env))

    if not args.no_post and not args.dry_run and rc == 0:
        post_rc = run_post_deploy(dry_run=False)
        # post 失败不影响主流程的成功（非致命）
        _ = post_rc

    print("\n" + "=" * 60)
    if rc == 0:
        print("✅ deploy 全部完成！")
        if args.target in ("pages", "both"):
            print(f"   - Pages 干净目录: .pages_deploy_tmp/ （不含 cards-meta.json, _category_index.json）")
        if args.target in ("worker", "both"):
            print(f"   - Worker: src/index.js 已上传 (API + D1/R2/KV 绑定保持 wrangler.toml 定义)")
        print(f"   - .env swap: 已还原（OAuth 缓存账号: gpszxtzys@gmail.com）")
    else:
        print(f"❌ deploy 异常，exit code = {rc}")
    print("=" * 60)
    return rc


if __name__ == "__main__":
    sys.exit(main())
