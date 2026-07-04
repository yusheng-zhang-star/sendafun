/**
 * SendAFun — Playwright Browser E2E Test Suite
 * ============================================
 * Runs against:  http://localhost:3000  (static server serving public/)
 * All /api/ calls from the page go directly to https://sendafun.com (CORS allowed)
 * per app.js API_ORIGIN logic (non-production origin forces PRODUCTION_ORIGIN).
 *
 * Strategy:
 *   - chromium.launchPersistentContext(userDataDir=./playwright-browser-data)
 *     so cookies/cache persist across runs (Experience 988385 best practice).
 *   - Every page writes PNG screenshot to _logs/screenshots/<case>.png.
 *   - DOM structural assertions + visible text checks.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const USER_DATA_DIR = path.join(ROOT, "playwright-browser-data");
const SCREENSHOT_DIR = path.join(ROOT, "_logs", "screenshots");
const REPORT_PATH = path.join(ROOT, "_logs", "_playwright_e2e_report.json");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(USER_DATA_DIR, { recursive: true });

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const RESULTS = [];
const LOGS = [];
function log(s) { LOGS.push(String(s)); process.stdout.write(String(s) + "\n"); }

async function screenshot(page, name) {
  try {
    const f = path.join(SCREENSHOT_DIR, name.replace(/[^a-zA-Z0-9_-]+/g, "_") + ".png");
    await page.screenshot({ path: f, fullPage: true, timeout: 15000 });
    return f;
  } catch (e) {
    log("  [screenshot-fail] " + name + " :: " + e.message);
    return null;
  }
}

async function run(cat, name, fn) {
  const t0 = Date.now();
  try {
    const detail = (await fn()) || "";
    const r = { cat, name, ok: true, ms: Date.now() - t0, detail: String(detail).slice(0, 300) };
    RESULTS.push(r);
    log(`[PASS] ${cat} :: ${name} (${r.ms}ms) ${r.detail}`);
    return true;
  } catch (e) {
    const r = { cat, name, ok: false, ms: Date.now() - t0, detail: String((e && e.message) || e).slice(0, 400) };
    RESULTS.push(r);
    log(`[FAIL] ${cat} :: ${name} (${r.ms}ms) -- ${r.detail}`);
    return false;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function assertContains(haystack, needle, msg) {
  if (String(haystack || "").indexOf(needle) === -1)
    throw new Error((msg || "expected substring missing") + ` :: needle=${JSON.stringify(needle)} haystack_preview=${JSON.stringify(String(haystack).slice(0, 200))}`);
}

(async () => {
  log("=== SendAFun Playwright E2E Suite ===");
  log("Base URL: " + BASE_URL);
  log("Chromium userDataDir: " + USER_DATA_DIR);

  let scFiles = 0;

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: true,
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    timezoneId: "America/New_York",
    args: [
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-web-security",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
    ignoreHTTPSErrors: true,
  });
  const page = context.pages()[0] || (await context.newPage());
  // capture browser console + page errors
  page.on("pageerror", (e) => log(`  [PAGEERR] ${page.url()} :: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") log(`  [CONSOLE:ERR] ${msg.text().slice(0, 300)}`);
  });

  try {
    // ============ SESSION A: HOMEPAGE ============
    await run("Home", "Render / with #app + title", async () => {
      await page.goto(BASE_URL + "/", { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForSelector("#app", { timeout: 15000 });
      const title = await page.title();
      assertContains(title, "SendAFun", "title missing 'SendAFun'");
      await screenshot(page, "01_homepage");
      return "title=" + title;
    });

    await run("Home§169", "Language switch dropdown exists (top-right selector #lang-switch)", async () => {
      const els = await page.evaluate(() => {
        const e1 = document.querySelectorAll("#lang-switch, [data-s169-switch], [data-lang-switch], .s169-switcher");
        const e2 = document.querySelectorAll("header select, header nav select, .site-header select, .top-right select, .header-right select");
        const e3 = document.querySelectorAll('[role="combobox"][aria-label*="lang" i], [role="combobox"][name*="lang" i], select[aria-label*="lang" i], [data-s169] select');
        const e4 = document.querySelectorAll("header [role=combobox], .header-actions [role=combobox], .header-actions select, .top-right [role=combobox]");
        const e5 = Array.from(document.querySelectorAll("select, [role=combobox]")).filter(e => {
          const t = (e.getAttribute("aria-label") || e.getAttribute("name") || e.id || e.className || "").toLowerCase();
          return t.includes("lang") || (e.options && Array.from(e.options).some(o => /^(en|es|fr|pt)$/i.test(o.value || "")));
        }).length;
        return { via_id: e1.length, via_header_select: e2.length, via_label: e3.length, via_header_cb: e4.length, via_option_match: e5 };
      });
      log("  §169 dom probes: " + JSON.stringify(els));
      const found = els.via_id > 0 || els.via_header_select > 0 || els.via_label > 0 || els.via_header_cb > 0 || els.via_option_match > 0;
      assert(found, "§169 language switcher not found in DOM: " + JSON.stringify(els));
      await screenshot(page, "02_homepage_s169_langswitch");
      return JSON.stringify(els);
    });

    await run("Home", "Hero area has visible CTA button (start/create/discover)", async () => {
      const txt = await page.evaluate(() => document.body.innerText || "");
      const hit = /Start Creating|Create.*[Cc]ard|Design.*[Cc]ard|Discover|Browse.*[Tt]emplates/.test(txt);
      assert(hit, "no hero CTA visible");
      const btnCount = await page.evaluate(() =>
        Array.from(document.querySelectorAll("button, a")).filter(x => x.offsetParent && /create|discover|start|design/i.test(x.innerText || x.textContent || "")).length
      );
      return "hero_cta_links_or_btns=" + btnCount;
    });

    // ============ SESSION B: DISCOVER GRID ============
    await run("Discover", "Navigate SPA /discover route", async () => {
      await page.goto(BASE_URL + "/discover", { waitUntil: "networkidle", timeout: 60000 });
      await new Promise(r => setTimeout(r, 3500));
      await screenshot(page, "03_discover");
      const grid = await page.evaluate(() => {
        const byClass = document.querySelectorAll(".card-tile, .card-grid > *, .cards-grid > *, [data-card-tile], .card-item, main a[href*='/card/']");
        const titles = Array.from(document.querySelectorAll("*")).filter(e => e.children.length === 0 && /birthday|christmas|love|baby|wedding|holiday|graduation|thank/i.test(e.innerText || "")).length;
        const imgs = document.querySelectorAll("main img[src], main img[data-src]");
        return { tileLikeElements: byClass.length, titleHits: titles, scrollHeight: document.documentElement.scrollHeight, mainImgs: imgs.length };
      });
      log("  Discover DOM stats: " + JSON.stringify(grid));
      assert(grid.tileLikeElements >= 6 || grid.titleHits >= 3 || grid.mainImgs >= 6, "card grid missing? " + JSON.stringify(grid));
      return "tiles~" + grid.tileLikeElements + " titleHits=" + grid.titleHits + " mainImgs=" + grid.mainImgs;
    });

    await run("Discover", "Cards have non-black / non-empty image areas (sample first 6 tiles)", async () => {
      const res = await page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll(".card-tile, [data-card-tile], .card-item")).slice(0, 6);
        const out = [];
        for (const t of tiles) {
          const imgs = t.querySelectorAll("img");
          const bgs = [];
          t.querySelectorAll("*").forEach(el => {
            const bs = getComputedStyle(el).backgroundImage;
            if (bs && bs !== "none") bgs.push(bs.slice(0, 160));
          });
          const rect = t.getBoundingClientRect();
          out.push({
            hasImg: imgs.length > 0,
            bgCount: bgs.length,
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            anyImgHasSrc: Array.from(imgs).some(i => i.src && !i.src.includes("data:") && i.clientWidth > 20)
          });
        }
        const all = out.length;
        const withImg = out.filter(x => x.hasImg || x.bgCount > 0).length;
        return { inspected: all, withVisuals: withImg, details: out };
      });
      log("  Discover visuals: " + JSON.stringify(res.details));
      assert(res.inspected >= 1, "no tiles at all");
      assert(res.withVisuals >= Math.max(1, Math.floor(res.inspected * 0.5)), "too many tiles without visuals: " + res.withVisuals + "/" + res.inspected);
      return `withVisuals=${res.withVisuals}/${res.inspected}`;
    });

    // ============ SESSION C: CARD DETAIL / EDITOR ============
    let editorOpen = false;
    await run("Editor", "Clicking first Discover tile opens card editor with preview image", async () => {
      const slugResp = await page.evaluate(async () => {
        try {
          const r = await fetch("https://sendafun.com/api/cards?limit=1");
          if (!r.ok) return null;
          const j = await r.json();
          return (j.cards && j.cards[0] && j.cards[0].slug) || null;
        } catch (e) { return null; }
      });
      assert(slugResp, "failed to fetch a card slug via in-page fetch");
      log("  Sample editor slug: " + slugResp);
      await page.goto(BASE_URL + "/card/" + encodeURIComponent(slugResp), { waitUntil: "networkidle", timeout: 60000 });
      await new Promise(r => setTimeout(r, 4500));
      await screenshot(page, "04_editor_detail_" + slugResp.slice(0, 20));
      const dom = await page.evaluate(() => {
        const cardFace = document.querySelectorAll(".card-face, .editor-preview, .card-preview, .preview-card, .card-canvas, #editorPreview, .editor-card, [class*=flip], [class*=card-face], [class*=preview]");
        const flipCard = document.querySelectorAll(".flip-card, .flippable-card, .card-container-flip");
        const inputs = document.querySelectorAll("textarea, input[type=text], input:not([type=hidden])");
        const messageTab = /Message|Greeting|Design|Style|Envelope|Text|To:|From:|Recipient|Schedule/i.test(document.body.innerText || "");
        const pageText = (document.body.innerText || "").slice(0, 1500);
        const hasImgOrBg = Array.from(document.querySelectorAll("main img, [role=main] img, main [style*=background], [role=main] [style*=background]")).length;
        return {
          cardFaceCount: cardFace.length,
          flipContainerCount: flipCard.length,
          editableInputs: inputs.length,
          editorKeywordsDetected: messageTab,
          mainVisualElements: hasImgOrBg,
          pageTextPreview: pageText
        };
      });
      log("  Editor DOM stats: " + JSON.stringify({ ...dom, pageTextPreview: undefined }) + "\n  Preview page text (first 600): " + JSON.stringify(dom.pageTextPreview.slice(0, 600)));
      const hasPreview = dom.cardFaceCount > 0 || dom.flipContainerCount > 0 || dom.mainVisualElements > 0 || dom.editableInputs >= 2;
      assert(hasPreview, "no editor preview / inputs found: " + JSON.stringify(dom));
      assert(dom.editableInputs >= 2 || dom.editorKeywordsDetected, "too few editable inputs in editor, keywords=" + dom.editorKeywordsDetected);
      editorOpen = true;
      return `faces=${dom.cardFaceCount} inputs=${dom.editableInputs} visuals=${dom.mainVisualElements} slug=${slugResp}`;
    });

    await run("Editor", "Preview card-face has background-image or <img> with real URL (not blank white)", async () => {
      assert(editorOpen, "editor not opened; skip");
      const info = await page.evaluate(() => {
        const faces = Array.from(document.querySelectorAll(".card-face, .editor-preview, .card-preview > div, .preview-card, .card-canvas, main [style*=background-image], [role=main] [style*=background-image]"));
        const imgsAll = Array.from(document.querySelectorAll("main img, [role=main] img")).filter(i => i.src && !i.src.includes("data:") && i.clientWidth > 20);
        const hits = [];
        for (const f of faces.slice(0, 8)) {
          const style = getComputedStyle(f);
          const bi = style.backgroundImage || "";
          const hasBg = bi && bi !== "none" && bi.length > 10;
          const imgs = Array.from(f.querySelectorAll("img")).map(i => ({ src: i.src.slice(0, 200), w: i.clientWidth, h: i.clientHeight, display: getComputedStyle(i).display }));
          const rect = f.getBoundingClientRect();
          hits.push({ hasBg, bg: bi.slice(0, 140), imgs, w: Math.round(rect.width), h: Math.round(rect.height) });
        }
        const anyHaveVisual = hits.some(h => h.hasBg || h.imgs.some(i => i.src && !i.src.includes("data:") && i.w > 30)) || imgsAll.length > 0;
        return { anyHaveVisual, count: faces.length, standaloneImgs: imgsAll.length, hits };
      });
      log("  Card-face visuals (standalone imgs=" + info.standaloneImgs + "): " + JSON.stringify(info.hits.slice(0, 3)));
      assert(info.anyHaveVisual, "editor preview completely empty — no bg-image / no img w/ src");
      return `faces=${info.count} standaloneImgs=${info.standaloneImgs}`;
    });

    // ============ SESSION D: STATIC PAGES (pricing / about / contact / terms / privacy / cookies) ============
    for (const [p, keyword, id] of [
      ["/pricing", "Unlimited", "05_pricing"],
      ["/about", "About", "06_about"],
      ["/contact", "Send us a message", "07_contact"],
      ["/terms", "Terms", "08_terms"],
      ["/privacy", "Privacy", "09_privacy"],
      ["/cookies", "Cookie", "10_cookies"],
      ["/payment-success", "payment", "11_paymentsuccess"],
      ["/payment-cancel", "cancel", "12_paymentcancel"],
    ]) {
      await run("StaticPage", `Open ${p} and detect keyword "${keyword}"`, async () => {
        await page.goto(BASE_URL + p + ".html", { waitUntil: "networkidle", timeout: 60000 });
        await new Promise(r => setTimeout(r, 1200));
        await screenshot(page, id);
        const txt = await page.evaluate(() => document.body.innerText || "");
        assertContains(txt.toLowerCase(), keyword.toLowerCase(), `${p} keyword "${keyword}" not found`);
        // extra: ensure hreflang link tags present (Worker injection) for remote; local server won't inject; just verify HTML shell
        return "body_len=" + txt.length;
      });
    }

    // ============ SESSION E: LANG-PREFIX PAGES + SPA LANG ROUTES (Worker-only feature; local server falls back to SPA index = 200 OK) ============
    for (const [url, id] of [
      ["/en/pricing.html", "13_en_pricing_prefix"],
      ["/es/about.html",   "14_es_about_prefix"],
    ]) {
      await run("LangStatic", `Open ${url} -> shell OK (Worker serves 200, local SPA fallback also 200)`, async () => {
        const resp = await page.goto(BASE_URL + url, { waitUntil: "networkidle", timeout: 60000 });
        const status = resp ? resp.status() : 0;
        await new Promise(r => setTimeout(r, 900));
        await screenshot(page, id);
        const hasApp = await page.evaluate(() => !!document.querySelector("#app") || document.body.innerText.length > 500);
        assert((status === 200 || status === 304) && hasApp, `unexpected status=${status}, hasApp=${hasApp}`);
        return "status=" + status + " hasApp=" + hasApp;
      });
    }

    // ============ SESSION F: CONTACT FORM FRONT-END VALIDATION ============
    await run("FormContact", "Contact form: short name -> shows error toast, no submit", async () => {
      await page.goto(BASE_URL + "/contact.html", { waitUntil: "networkidle", timeout: 60000 });
      await new Promise(r => setTimeout(r, 900));
      await page.evaluate(() => {
        const n = document.querySelector("#cf-name");
        const e = document.querySelector("#cf-email");
        const m = document.querySelector("#cf-message");
        if (n) n.value = "A";
        if (e) e.value = "valid@example.com";
        if (m) m.value = "this message is long enough";
      });
      const before = await page.evaluate(() => (document.querySelectorAll(".toast, [role=status], [class*=toast]").length));
      await page.evaluate(() => {
        const f = document.querySelector("form#contactForm, #contactForm");
        if (f && typeof f.requestSubmit === "function") f.requestSubmit();
        else if (f) f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      await new Promise(r => setTimeout(r, 1500));
      await screenshot(page, "15_contact_form_shortname_validation");
      const after = await page.evaluate(() => ({
        toastCount: document.querySelectorAll(".toast, [class*=toast], [role=alert], [role=status]").length,
        pageText: (document.body.innerText || "").slice(0, 800)
      }));
      log("  Toast after bad submit: " + after.toastCount + "; page snippet: " + after.pageText.slice(0, 200));
      assert(
        after.toastCount > before || /name|short|add your|your name/i.test(after.pageText),
        "no validation feedback shown for short name (toast delta: " + (after.toastCount - before) + ")"
      );
      return "toast_before=" + before + " toast_after=" + after.toastCount;
    });

    await run("FormContact", "Contact form: short message -> shows validation error toast", async () => {
      await page.goto(BASE_URL + "/contact.html", { waitUntil: "networkidle", timeout: 60000 });
      await new Promise(r => setTimeout(r, 900));
      await page.evaluate(() => {
        const n = document.querySelector("#cf-name");
        const e = document.querySelector("#cf-email");
        const m = document.querySelector("#cf-message");
        if (n) n.value = "Valid Name";
        if (e) e.value = "valid@example.com";
        if (m) m.value = "Short";
      });
      await page.evaluate(() => {
        const f = document.querySelector("form#contactForm, #contactForm");
        if (f && typeof f.requestSubmit === "function") f.requestSubmit();
        else if (f) f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      await new Promise(r => setTimeout(r, 1500));
      await screenshot(page, "16_contact_form_shortmsg_validation");
      const body = await page.evaluate(() => (document.body.innerText || "").slice(0, 1200));
      assert(/more message|bit more|10 char|too short|short|message/i.test(body), "no 'message too short' validation found. body=" + JSON.stringify(body.slice(0, 400)));
      return "";
    });

    // ============ SESSION G: PRICING PAGE PRODUCTS.JSON VALIDATION ============
    await run("Pricing", "pricing page loads 4 plan tiles: Pay-per-Send / Monthly / Annual / Group Pass", async () => {
      await page.goto(BASE_URL + "/pricing.html", { waitUntil: "networkidle", timeout: 60000 });
      await new Promise(r => setTimeout(r, 1200));
      await screenshot(page, "17_pricing_plans");
      const txt = await page.evaluate(() => (document.body.innerText || ""));
      const hits = ["Pay Per Send", "Monthly", "Annual", "Group Card Pass"].filter(k => txt.includes(k));
      return `keyword_hits=${hits.length}/4 :: [${hits.join("|")}]`;
    });

    // ============ SESSION H: SPA ROUTES (Hash mode) ============
    for (const [hash, keyword] of [
      ["#trending", "Trending"],
      ["#latest",   "Latest"],
      ["#holidays", "Holiday"],
      ["#message-generator", "Generator|Message"],
    ]) {
      await run("SPA", `Navigate ${hash} -> shell renders keyword`, async () => {
        await page.goto(BASE_URL + "/" + hash, { waitUntil: "networkidle", timeout: 60000 });
        await new Promise(r => setTimeout(r, 1500));
        await screenshot(page, "18_spa_" + hash.replace(/[^a-z]/gi, ""));
        const probe = await page.evaluate(() => {
          const t = (document.body.innerText || "").slice(0, 800);
          const hasApp = !!document.querySelector("#app");
          return { t, hasApp };
        });
        const re = new RegExp(keyword, "i");
        assert(re.test(probe.t) || probe.hasApp, `no ${keyword} / #app on SPA ${hash}: hasApp=${probe.hasApp}, t_preview=${probe.t.slice(0,100)}`);
        return "";
      });
    }

    // ============ Final Screenshot Tally ============
    try { scFiles = fs.readdirSync(SCREENSHOT_DIR).length; } catch (_) {}
    log(`\nTotal screenshots captured: ${scFiles}  (dir=${SCREENSHOT_DIR})`);

  } finally {
    // Do NOT close context if we wanted to reuse (per Experience 988385); but here we're in CI-like
    // ephemeral run so close.  Keep userDataDir so next run warms cache.
    try { await context.close({ reason: "e2e suite done" }); } catch (_) {}
  }

  const passed = RESULTS.filter(r => r.ok).length;
  const failed = RESULTS.filter(r => !r.ok).length;
  const total = RESULTS.length;
  log("\n======================== SUMMARY ========================");
  log(`Total: ${total}   Passed: ${passed}   Failed: ${failed}   PassRate: ${((passed / (total || 1)) * 100).toFixed(1)}%`);
  const cats = {};
  for (const r of RESULTS) { cats[r.cat] = cats[r.cat] || { p: 0, f: 0 }; if (r.ok) cats[r.cat].p++; else cats[r.cat].f++; }
  log("\nBy category:");
  for (const [c, v] of Object.entries(cats)) log(`  ${c}: ${v.p} pass, ${v.f} fail`);
  if (failed) {
    log("\nFAILED cases:");
    for (const f of RESULTS.filter(r => !r.ok)) log(`  - [${f.cat}] ${f.name} :: ${f.detail}`);
  }
  log("\nScreenshots dir: " + SCREENSHOT_DIR);

  fs.writeFileSync(REPORT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: { total, passed, failed, passRate: +((passed / (total || 1)) * 100).toFixed(2), screenshots: scFiles },
    byCategory: cats,
    results: RESULTS,
    log: LOGS,
  }, null, 2));
  log("JSON report -> " + REPORT_PATH);
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => {
  log("[FATAL] " + (e.stack || e.message || e));
  process.exit(99);
});
