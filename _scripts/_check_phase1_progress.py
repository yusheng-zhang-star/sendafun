"""Phase 1 进度快速查看 → 直接读 SQLite 状态 DB（100% 准确，不依赖终端日志）
用法：python _scripts/_check_phase1_progress.py
"""
import sys, os, json, time, sqlite3
from pathlib import Path
from datetime import datetime, timedelta

SCRIPT_DIR = Path(__file__).resolve().parent
STATUS_DB = SCRIPT_DIR / "_phase1_status.sqlite3"
START_TS_PATH = SCRIPT_DIR / "_logs" / "_phase1_startts.txt"  # 启动时间戳（脚本启动时会写）

def human(sec: float) -> str:
    if sec is None or sec <= 0:
        return "—"
    sec = int(sec)
    h = sec // 3600
    m = (sec % 3600) // 60
    s = sec % 60
    if h > 0:
        return f"{h}h{m:02d}m{s:02d}s"
    if m > 0:
        return f"{m}m{s:02d}s"
    return f"{s}s"

def main():
    if not STATUS_DB.exists():
        print(f"❌ 状态 DB 不存在: {STATUS_DB}\n   先跑 phase1-process-originals.py --reset-all")
        sys.exit(2)
    conn = sqlite3.connect(str(STATUS_DB))
    try:
        cur = conn.cursor()
        # 各状态数量
        cur.execute("SELECT status, COUNT(*) FROM phase1_status GROUP BY status")
        rows = cur.fetchall()
        counts = {r[0]: int(r[1]) for r in rows}
        total = sum(counts.values())
        done = counts.get("verified", 0) + counts.get("uploaded", 0) + counts.get("converted", 0) + counts.get("compressed", 0) + counts.get("skipped", 0)
        ok = counts.get("verified", 0) + counts.get("converted", 0)
        fail = counts.get("failed", 0)
        skip = counts.get("skipped", 0)
        pend = counts.get("pending", 0) + counts.get("downloaded", 0)
        # 启动时间
        start_ts = None
        if START_TS_PATH.exists():
            try:
                start_ts = int(START_TS_PATH.read_text().strip())
            except Exception:
                pass
        # 若没保存启动时间，用 DB 里 status!='pending' 最小 updated_at 估算
        if not start_ts:
            cur.execute("SELECT MIN(updated_at) FROM phase1_status WHERE status <> 'pending'")
            r = cur.fetchone()
            start_ts = r[0] if r and r[0] else int(time.time())
        elapsed = int(time.time()) - start_ts
        # 速度 + ETA
        s_per_img = (elapsed / done) if done > 0 and elapsed > 0 else 0
        remain_imgs = total - done
        eta_sec = s_per_img * remain_imgs
        pct = (done / total * 100) if total > 0 else 0
        # 头部
        sep = "=" * 70
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(sep)
        print(f"📊 Phase 1 进度快照 · {now}")
        print(sep)
        print(f"  📦 总卡片数:        {total}")
        print(f"  ✅ VERIFIED/CONVERTED:  {ok}   ({pct:5.2f}%)")
        print(f"  ❌ FAILED:             {fail}   (失败率 {(fail/total*100 if total else 0):.2f}%)")
        print(f"  ⚠️  SKIPPED:            {skip}")
        print(f"  ⏳ PENDING + 处理中:    {pend}")
        print(f"  ⏱️  已耗时:             {human(elapsed)}")
        print(f"  🚀 平均速度:           {s_per_img:.1f} 秒 / 张" if s_per_img>0 else "  🚀 平均速度:           —")
        print(f"  🔮 预计剩余:           {human(eta_sec)}" if eta_sec>0 else "  🔮 预计剩余:           刚启动，请等 1~2 张完成后再看")
        print(sep)
        # 状态细分
        print("状态明细:")
        for st, c in sorted(counts.items(), key=lambda x: -x[1]):
            bar_len = int(c / total * 40) if total else 0
            bar = "█" * bar_len + "░" * (40 - bar_len)
            print(f"  {st:12s} {c:>5d}  {bar}")
        print(sep)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
