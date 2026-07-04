#!/usr/bin/env python3
"""expand-materials.py 秒级进度查询（直接读日志/目录/JSON，不依赖截断终端）。"""
import sys, os, json, re, time
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
MATERIAL_DIR = ROOT / "_material-library"
LOGS_DIR = MATERIAL_DIR / "logs"
RAW_DIR = ROOT / "raw-originals"
PROC_DIR = ROOT / "processed"
CARDS_META = ROOT / "public" / "cards-meta.json"
CKPT = MATERIAL_DIR / "progress-checkpoint.json"

def human(sec):
    sec = int(sec)
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    if h: return f"{h}h{m:02d}m{s:02d}s"
    if m: return f"{m}m{s:02d}s"
    return f"{s}s"

def main():
    print("=" * 70)
    print(f"📊 Expand 素材进度快照 · {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # 1) 最新日志
    logs = sorted(LOGS_DIR.glob("expand-*.log")) if LOGS_DIR.exists() else []
    log_txt = ""
    if logs:
        latest_log = logs[-1]
        try:
            log_txt = latest_log.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            log_txt = ""
        print(f"📄 日志: .../{latest_log.name}  大小: {latest_log.stat().st_size//1024} KB")
        mtime = latest_log.stat().st_mtime
        print(f"⏱️  日志最后更新: {datetime.fromtimestamp(mtime).strftime('%H:%M:%S')}  ({human(time.time()-mtime)} 前)")
    else:
        print("⚠️  暂无 expand-*.log（脚本还没启动？）")
    print("-" * 70)

    # 2) 目录文件数
    raw_cnt = len(list(RAW_DIR.glob("*"))) if RAW_DIR.exists() else 0
    proc_cnt = len(list(PROC_DIR.glob("*"))) if PROC_DIR.exists() else 0
    print(f"📁 raw-originals 已下载原图:  {raw_cnt}  张（本地）")
    print(f"📁 processed 已处理中间产物:  {proc_cnt}  项（本地）")

    # 3) cards-meta.json 总卡片数
    baseline = 0
    cards_now = 0
    if CARDS_META.exists():
        try:
            d = json.loads(CARDS_META.read_text(encoding="utf-8"))
            cards_now = len(d.get("cards", []))
            baseline = 0
        except Exception:
            cards_now = -1
    print(f"💾 cards-meta.json 卡片数:   {cards_now}（脚本跑完会自动追加）")

    # 4) checkpoint
    ckpt = {}
    if CKPT.exists():
        try:
            ckpt = json.loads(CKPT.read_text(encoding="utf-8"))
        except Exception:
            ckpt = {}
    if ckpt:
        start_ts = ckpt.get("started_at") or ckpt.get("last_updated_at")
        if start_ts:
            print(f"⏱️  启动/更新时间:          {datetime.fromtimestamp(start_ts).strftime('%Y-%m-%d %H:%M:%S')}")
        keys_show = ["phase", "pending_sources", "download_ok", "download_fail",
                     "process_ok", "upload_ok", "cards_generated"]
        for k in keys_show:
            if k in ckpt: print(f"   {k}: {ckpt[k]}")

    # 5) 关键日志解析
    if log_txt:
        def grab(pat, default="-"):
            mm = re.findall(pat, log_txt, re.I)
            return mm[-1] if mm else default
        weekly = grab(r"Args:.*--weekly[= ]+(\d+)")
        pending_sources = grab(r"\[Sources\] Collected (\d+) unique pending images")
        dl_ok = grab(r"\[Download\] OK=(\d+) ")
        dl_fail = grab(r"\[Download\] OK=\d+ Fail/Dupe-Skip=(\d+)")
        size_skip = len(re.findall(r"\[SizeFilter\] SKIP", log_txt, re.I))
        proc_pend = grab(r"\[Process\] Pending: (\d+) images")
        proc_ok = grab(r"\[Process\] OK: (\d+) processed bundles")
        up_pend = grab(r"\[Upload\] Pending objects: (\d+)")
        up_ok = grab(r"\[Upload\] R2 OK=(\d+)")
        up_fail = grab(r"\[Upload\] R2 OK=\d+ Fail=(\d+)")
        d1_ins = grab(r"\[D1\] Summary: inserted=(\d+)")
        d1_fail = grab(r"\[D1\] Summary: inserted=\d+ skipped\(duplicate\)=\d+ failed=(\d+)")
        cards_gen = grab(r"\[CardsMeta\] Generated (\d+) new card entries")
        print("-" * 70)
        print("📦 关键阶段（从解析日志）:")
        if weekly!="-":           print(f"   --weekly 候选图量:      {weekly}")
        if pending_sources!="-":  print(f"   🧭 候选素材 (去重前):   {pending_sources}")
        if dl_ok!="-":            print(f"   🌐 下载成功:            {dl_ok}")
        if dl_fail!="-":          print(f"   🌐 下载失败/去重跳过:   {dl_fail}")
        if size_skip>0:           print(f"   🚫 尺寸<2048px被过滤:   {size_skip}  张 ✅ (过滤生效)")
        if proc_pend!="-":        print(f"   ⚙️  处理 (Workbuffy++): {proc_ok or 0} / {proc_pend}")
        if up_pend!="-":          print(f"   ☁️  R2上传 preview:     {up_ok or 0} / {up_pend} (失败={up_fail or 0})")
        if d1_ins!="-":           print(f"   💾 D1插入:              inserted={d1_ins}, failed={d1_fail}")
        if cards_gen!="-":        print(f"   🎴 新卡片条目生成:      {cards_gen}")
        # 下载通过率估算
        if dl_ok!="-" and weekly!="-":
            try:
                pct = int(dl_ok)/int(weekly)*100
                print(f"   📈 候选→下载通过率:     {pct:.1f}%  ({dl_ok}/{weekly})")
            except Exception:
                pass
    print("=" * 70)
    # 脚本还在跑吗？最后一行日志
    if log_txt:
        lines = [l for l in log_txt.splitlines() if l.strip()]
        if lines:
            last = lines[-1][:110]
            print(f"🧭 最新日志最后一行: {last}")
            # 判断是否跑完了
            if "Pipeline End" in log_txt or "Expand pipeline complete" in log_txt:
                print("🎉 脚本已全部跑完！")
    else:
        print("ℹ️  进度查询提示：每 10 分钟来一句「查进度」1 秒出结果。")

if __name__ == "__main__":
    main()
