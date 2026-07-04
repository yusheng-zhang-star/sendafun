#!/usr/bin/env python3
"""Build card-template.html from segments."""
import os

OUT = r"E:\网站项目\sendafun\templates\card-template.html"
SEGMENTS_DIR = r"E:\网站项目\sendafun\templates\segments"

def s(path):
    """Read a segment file."""
    with open(os.path.join(SEGMENTS_DIR, path), 'r', encoding='utf-8') as f:
        return f.read()

def main():
    parts = [
        s("head.html"),      # <head> with CSS
        s("header.html"),    # header
        s("canvas.html"),    # canvas section
        s("overlay.html"),   # panel overlay
        s("panel.html"),     # customize panel
        s("community.html"), # cards made by others
        s("related.html"),   # related section
        s("modals.html"),    # all modals
        s("qr.html"),        # QR popup
        s("toast.html"),     # toast container
        s("foot.html"),      # </body></html>
        s("script.html"),    # all JS
        s("end.html"),       # </html>
    ]

    with open(OUT, 'w', encoding='utf-8') as f:
        for p in parts:
            f.write(p)
            f.write('\n')

    size = os.path.getsize(OUT)
    print(f"Written {size} bytes to {OUT}")

if __name__ == '__main__':
    main()
