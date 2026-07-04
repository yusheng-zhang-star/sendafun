import os, sys, warnings
warnings.filterwarnings("ignore")
os.environ.setdefault("U2NET_HOME", os.path.expanduser("~/.u2net"))
print("模型目录:", os.environ["U2NET_HOME"])
print("开始：rembg 内置 pooch 下载 u2netp（70MB，自动断点+重试+哈希校验）...")
sys.stdout.flush()
try:
    from rembg import new_session, remove
    sess = new_session("u2netp", providers=["CPUExecutionProvider"])
    print("✅ u2netp 下载+初始化完成")
    from PIL import Image
    import io
    img = Image.new("RGB", (500, 500), (255, 255, 255))
    for y in range(500):
        for x in range(500):
            if ((x - 250) ** 2 + (y - 250) ** 2) < 180 ** 2:
                img.putpixel((x, y), (255, 120, 80))
    b = io.BytesIO(); img.save(b, format="PNG")
    out = remove(b.getvalue(), session=sess)
    oimg = Image.open(io.BytesIO(out))
    has_a = "A" in oimg.getbands()
    print("✅ 抠图正常 输出 size=%s mode=%s alpha=%s" % (oimg.size, oimg.mode, has_a))
    sys.exit(0)
except Exception as e:
    print("❌ 失败: %s: %s" % (type(e).__name__, e))
    import traceback; traceback.print_exc(limit=5)
    sys.exit(1)
