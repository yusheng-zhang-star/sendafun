import re
h = open("E:\\网站项目\\sendafun\\templates\\card-template.html", encoding="utf-8").read()

checks = {
    "DOCTYPE": "<!DOCTYPE html>",
    "html_start": "<html",
    "html_end": "</html>",
    "head_start": "<head>",
    "head_end": "</head>",
    "body_start": "<body>",
    "body_end": "</body>",
    "style_block": "<style>",
    "script_block": "<script>",
    "main_canvas": "id=\"cardCanvas\"",
    "qr_canvas": "id=\"qrCanvas\"",
    "header": "<header",
    "customize_panel": "customize-panel",
    "modal_payment": "id=\"modalPayment\"",
    "modal_delivery": "id=\"modalDelivery\"",
    "modal_gift": "id=\"modalGift\"",
    "modal_reminder": "id=\"modalReminder\"",
    "toast_container": "id=\"toastContainer\"",
    "qr_popup": "id=\"qrPopup\"",
    "community_carousel": "id=\"communityCarousel\"",
    "related_grid": "id=\"relatedGrid\"",
    "ad_banner": "id=\"adBanner\"",
    "pricing_cards": "data-plan=",
    "delivery_cards": "data-delivery=",
    "email_ident": "id=\"identEmail\"",
    "presets": "Make them cry",
    "toolbar_font": "Playfair Display",
    "toolbar_color": "id=\"colorRow\"",
    "toolbar_pos": "id=\"posRow\"",
    "toolbar_filter": "id=\"filterRow\"",
    "toolbar_size": "id=\"sizeRow\"",
    "api_identify": "/api/lookup-user",
    "api_send": "/api/send-card",
    "api_gift": "/api/gift-free-card",
    "api_reminder": "/api/set-reminder",
    "render_function": "function render()",
    "undo_function": "function undo()",
    "localStorage_save": "localStorage.setItem",
    "localStorage_load": "localStorage.getItem",
    "debounce": "scheduleRender",
    "save_state": "function saveState",
    "load_state": "function loadState",
    "push_history": "function pushHistory",
    "apply_warm": "function applyWarm",
    "apply_cool": "function applyCool",
    "apply_bw": "function applyBW",
    "apply_vintage": "function applyVintage",
    "wrap_text": "function wrapText",
    "show_toast": "function showToast",
    "open_modal": "function openModal",
    "close_modal": "function closeModal",
    "send_card": "function sendCard",
    "download_card": "function downloadCard",
    "set_reminder": "function setReminder",
    "identify_user": "function identifyUser",
    "simulate_payment": "function simulatePaymentThenDelivery",
    "draw_qr": "function drawQR",
    "payment_transition": "be redirected to",
}

all_ok = True
for k, chk in checks.items():
    ok = chk in h
    if not ok:
        all_ok = False
        print(f"[FAIL] {k}: missing '{chk}'")
    else:
        print(f"[OK]   {k}")

print(f"\nAll checks passed: {all_ok}")
print(f"File size: {len(h.encode('utf-8'))} bytes")
print(f"Total lines: {h.count(chr(10))}")

# Check placeholders
phs = set(re.findall(r"__[A-Z_]+__", h))
print(f"Placeholders ({len(phs)}): {sorted(phs)}")
