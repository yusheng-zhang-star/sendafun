import os, sys, warnings
warnings.filterwarnings("ignore")
os.environ.setdefault("U2NET_HOME", os.path.expanduser("~/.u2net"))
print("模型目录:", os.environ["U2NET_HOME"])
print("开始下载高质量 u2net 模型（~176MB，正式 Phase 1 抠图用，pooch 自动断点+校验）")
sys.stdout.flush()
try:
    from rembg import new_session
    sess = new_session("u2net", providers=["CPUExecutionProvider"])
    print("✅ u2net 高质量模型下载+初始化完成！Phase 1 可以随时跑了")
    sys.exit(0)
except Exception as e:
    print("❌ 失败: %s: %s" % (type(e).__name__, e))
    import traceback; traceback.print_exc(limit=5)
    sys.exit(1)
