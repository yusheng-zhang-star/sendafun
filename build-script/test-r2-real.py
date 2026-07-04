#!/usr/bin/env python3
"""Test real image upload to R2"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib.machinery import SourceFileLoader
mod = SourceFileLoader("upload_to_r2", os.path.join(os.path.dirname(__file__), "upload-to-r2.py")).load_module()

result = mod.upload_file(
    r"E:\网站项目\sendafun\source\images\birthday\birthday-pexels-10165858-square.webp",
    mod.PREVIEW_BUCKET,
    "birthday/birthday-pexels-10165858-square.webp",
    "image/webp"
)
print("Upload result:", "SUCCESS" if result else "FAILED")
