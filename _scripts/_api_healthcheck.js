// Quick HTTP API healthcheck against PRODUCTION sendafun.com Worker
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const RESULTS = [];
const LOG = [];
function log(s) { LOG.push(s); process.stdout.write(s + "\n"); }
function assert(cond, msg) { if (!cond) throw new Error(msg || "assert"); }

function httpsJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        method: opts.method || "GET",
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        headers: Object.assign(
          { "User-Agent": "SendAFun-SelfTest/1.0", Accept: "application/json" },
          opts.headers || {}
        ),
        timeout: opts.timeout || 20000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c.toString()));
        res.on("end", () => {
          let json = null;
          try { if (data && /json/.test(res.headers["content-type"] || "")) json = JSON.parse(data); } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: data, json });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(new Error("timeout")); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function test(cat, name, fn) {
  const t0 = Date.now();
  return Promise.resolve()
    .then(fn)
    .then((detail) => {
      const r = { cat, name, ok: true, ms: Date.now() - t0, detail: typeof detail === "string" ? detail : "" };
      RESULTS.push(r);
      log(`[PASS] ${cat} :: ${name} (${r.ms}ms) ${r.detail}`);
      return true;
    })
    .catch((e) => {
      const r = { cat, name, ok: false, ms: Date.now() - t0, detail: String((e && e.message) || e).slice(0, 400) };
      RESULTS.push(r);
      log(`[FAIL] ${cat} :: ${name} (${r.ms}ms) -- ${r.detail}`);
      return false;
    });
}

const PROD = "https://sendafun.com";

(async () => {
  log("=== SendAFun Production API Self-Check (remote) ===");
  log("Target: " + PROD);

  // ------- 1. Static + sitemap/robots -------
  await test("Static", "GET / (SPA shell)", async () => {
    const r = await httpsJson(PROD + "/");
    assert(r.status === 200, "status " + r.status);
    assert(r.body.includes('<div id="app"></div>') || r.body.includes("<title"), "not an HTML shell");
    return "bytes=" + Buffer.byteLength(r.body);
  });
  await test("Static", "GET /styles.css", async () => {
    const r = await httpsJson(PROD + "/styles.css");
    assert(r.status === 200, "status " + r.status);
    assert(Buffer.byteLength(r.body) > 10000, "CSS too small (" + Buffer.byteLength(r.body) + "B)");
    return "bytes=" + Buffer.byteLength(r.body);
  });
  await test("Static", "GET /app.js", async () => {
    const r = await httpsJson(PROD + "/app.js");
    assert(r.status === 200, "status " + r.status);
    assert(Buffer.byteLength(r.body) > 100000, "app.js too small");
    return "bytes=" + Buffer.byteLength(r.body);
  });
  await test("Static", "GET /products.json", async () => {
    const r = await httpsJson(PROD + "/products.json");
    assert(r.status === 200, "status " + r.status);
    assert(r.json && Array.isArray(r.json.products), "missing products[]");
    const gp = r.json.products.find(p => p.id === "sendafun_group_pass");
    assert(gp && gp.creem_product_id && !gp.creem_product_id.includes("TODO"), "group_pass product_id still TODO placeholder: " + (gp && gp.creem_product_id));
    return "products=" + r.json.products.length + "; group_pass.creem_product_id=" + gp.creem_product_id;
  });

  // ------- 2. Sitemaps + robots -------
  await test("Sitemap", "GET /sitemap.xml (index)", async () => {
    const r = await httpsJson(PROD + "/sitemap.xml");
    assert(r.status === 200, "status " + r.status);
    assert(r.body.includes("<sitemapindex") || r.body.includes("<urlset"), "not sitemap XML");
    return "";
  });
  for (const lang of ["en", "es", "fr", "pt"]) {
    await test("Sitemap", `GET /sitemap-${lang}.xml (4-language per §218)`, async () => {
      const r = await httpsJson(PROD + `/sitemap-${lang}.xml`);
      assert(r.status === 200, "status " + r.status);
      assert(r.body.includes("<urlset"), "missing <urlset>");
      const urls = (r.body.match(/<loc>/g) || []).length;
      assert(urls >= 8, "too few <loc>: " + urls);
      return "urls=" + urls;
    });
  }
  await test("Sitemap", "GET /sitemap-cards.xml", async () => {
    const r = await httpsJson(PROD + "/sitemap-cards.xml");
    assert(r.status === 200, "status " + r.status);
    const cardCount = (r.body.match(/<loc>/g) || []).length;
    assert(cardCount >= 20, "card sitemap < 20 urls");
    return "cards=" + cardCount;
  });
  await test("Sitemap", "GET /robots.txt", async () => {
    const r = await httpsJson(PROD + "/robots.txt");
    assert(r.status === 200, "status " + r.status);
    assert(r.body.includes("Sitemap:"), "missing Sitemap: directive");
    return "";
  });

  // ------- 3. Core APIs -------
  await test("API", "GET /api/health", async () => {
    const r = await httpsJson(PROD + "/api/health");
    assert(r.status === 200, "status " + r.status);
    assert(r.json && r.json.ok, "/api/health !ok");
    return "db=" + !!r.json.dbBound + " creem=" + !!r.json.creemConfigured + " resend=" + !!r.json.resendConfigured;
  });
  await test("API", "GET /api/geo/context", async () => {
    const r = await httpsJson(PROD + "/api/geo/context?force_country=FR&force_tz=Europe/Paris");
    assert(r.status === 200, "status " + r.status);
    assert(r.json && r.json.ok, "geo ctx !ok");
    assert(r.json.country === "FR", "country mismatch: " + r.json.country);
    assert(r.json.language && r.json.language.effective === "fr", "lang auto-detect FR -> fr failed: " + JSON.stringify(r.json.language));
    return "effective_lang=" + r.json.language.effective + "; currency=" + r.json.currency;
  });
  await test("API", "GET /api/cards?limit=12", async () => {
    const r = await httpsJson(PROD + "/api/cards?limit=12");
    assert(r.status === 200, "status " + r.status);
    assert(r.json && Array.isArray(r.json.cards) && r.json.cards.length > 0, "no cards");
    const first = r.json.cards[0];
    assert(first.slug, "card missing slug");
    assert(first.bgImageWatermark || first.bgImage, "card missing image");
    assert(!(first.bgImageWatermark || "").includes("undefined") && !(first.bgImageWatermark || "").includes("TODO"), "invalid bgImageWatermark: " + first.bgImageWatermark);
    return "count=" + r.json.cards.length + "; total=" + r.json.total + "; first.slug=" + first.slug;
  });
  await test("API", "GET /api/search/cards?q=birthday", async () => {
    const r = await httpsJson(PROD + "/api/search/cards?q=birthday&limit=10");
    assert(r.status === 200, "status " + r.status);
    assert(r.json && Array.isArray(r.json.cards), "no search results");
    return "hits=" + r.json.cards.length;
  });
  // also test /api/cards/search alias
  await test("API", "GET /api/cards/search?q=love (alias route)", async () => {
    const r = await httpsJson(PROD + "/api/cards/search?q=love&limit=5");
    assert(r.status === 200, "status " + r.status);
    return "hits=" + (r.json ? (r.json.cards || []).length : "n/a");
  });

  // ------- 4.  Card detail + R2 image -------
  let sampleSlug = null;
  await test("API", "GET /api/cards/:slug (detail page)", async () => {
    const list = await httpsJson(PROD + "/api/cards?limit=1");
    assert(list.json && list.json.cards[0], "no card to sample");
    sampleSlug = list.json.cards[0].slug;
    const r = await httpsJson(PROD + "/api/cards/" + encodeURIComponent(sampleSlug));
    assert(r.status === 200, "status " + r.status);
    assert(r.json && r.json.card && r.json.card.slug === sampleSlug, "detail slug mismatch");
    return "slug=" + sampleSlug + "; title_len=" + (r.json.card.title || "").length;
  });
  await test("API", "GET /api/r2-image?url=<card preview URL>", async () => {
    const list = await httpsJson(PROD + "/api/cards?limit=1");
    const c = list.json.cards[0];
    const imgUrl = c.bgImageWatermark || c.bgImage;
    assert(imgUrl, "no image URL on card");
    const apiUrl = PROD + "/api/r2-image?url=" + encodeURIComponent(imgUrl);
    const r = await httpsJson(apiUrl, { timeout: 30000 });
    assert(r.status === 200, "r2-image status " + r.status + " url=" + apiUrl);
    const ct = (r.headers || {})["content-type"] || "";
    assert(/image\/(webp|png|jpeg)/.test(ct), "bad content-type: " + ct);
    const bytes = Buffer.byteLength(r.body, "latin1");
    assert(bytes > 5000, "image too small: " + bytes + " bytes");
    return "status=200; ct=" + ct + "; bytes=" + bytes;
  });

  // ------- 5.  Static pages: pricing/about/contact/terms/privacy/cookies + hreflang -------
  for (const p of ["/pricing", "/about", "/contact", "/terms", "/privacy", "/cookies", "/payment-success", "/payment-cancel"]) {
    await test("StaticPage", `GET ${p} (hreflang injected)`, async () => {
      const r = await httpsJson(PROD + p);
      assert(r.status === 200, "status " + r.status);
      assert(r.body.includes("</head>"), "not HTML");
      const hreflangCount = (r.body.match(/rel="alternate" hreflang=/g) || r.body.match(/hreflang=/g) || []).length;
      const jsonLdCount = (r.body.match(/application\/ld\+json/g) || []).length;
      return `hreflang_matches=${hreflangCount}; jsonld_matches=${jsonLdCount}`;
    });
  }

  // ------- 6.  Language-prefixed static pages -------
  for (const lang of ["en", "es", "fr", "pt"]) {
    await test("LangStatic", `GET /${lang}/pricing (worker strips lang + injects hreflang)`, async () => {
      const r = await httpsJson(PROD + `/${lang}/pricing`);
      assert(r.status === 200, "status " + r.status);
      assert(r.body.toLowerCase().includes("<!doctype html") || r.body.includes("<title"), "not html");
      return "";
    });
  }

  // ------- 7.  SPA routes (/discover /create /trending etc) return SPA shell -------
  for (const p of ["/discover", "/create", "/trending", "/latest", "/holidays", "/message-generator"]) {
    await test("SPA", `GET ${p} -> returns shell (no 404)`, async () => {
      const r = await httpsJson(PROD + p);
      assert(r.status === 200, "status " + r.status);
      assert(r.body.includes('<div id="app"></div>') || r.body.includes("/app.js"), "not SPA shell");
      return "";
    });
  }

  // ------- 8.  Contact form dry run (no real email sent if no resend key; server returns queued:true OK) -------
  await test("API", "POST /api/contact (valid payload, non-brittle)", async () => {
    const payload = JSON.stringify({
      name: "SelfTest Bot",
      email: "selftest+dontreply@sendafun.com",
      topic: "bug",
      message: "This is a self-test message generated by automated QA script. Please ignore. Timestamp: " + new Date().toISOString(),
      sentAt: new Date().toISOString(),
    });
    const r = await httpsJson(PROD + "/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      timeout: 30000,
    });
    assert(r.status === 200 || r.status === 202, "status " + r.status + " body=" + r.body.slice(0, 300));
    assert(r.json && r.json.ok, "contact !ok: " + r.body.slice(0, 300));
    return "sent=" + !!r.json.sent + "; queued=" + !!r.json.queued + (r.json.resendId ? "; resendId=" + r.json.resendId.slice(0, 10) + "..." : "");
  });

  // ------- 9.  /api/group/:token/status 404 path should 404 NOT 500, correct 404 for unknown -------
  await test("API", "GET /api/group/DEADBEEFNOTEXIST123/status -> 404 (new route)", async () => {
    const r = await httpsJson(PROD + "/api/group/DEADBEEFNOTEXIST123/status");
    assert(r.status === 404, "expected 404 got " + r.status);
    assert(r.json && r.json.error, "missing error payload");
    return "";
  });

  // ------- Report -------
  const passed = RESULTS.filter(r => r.ok).length;
  const failed = RESULTS.filter(r => !r.ok).length;
  const total = RESULTS.length;
  log("\n========== SUMMARY ==========");
  log(`Total: ${total}   Passed: ${passed}   Failed: ${failed}   Rate: ${((passed/total)*100).toFixed(1)}%`);
  if (failed > 0) {
    log("\nFailed tests:");
    for (const f of RESULTS.filter(r => !r.ok)) log(`  - [${f.cat}] ${f.name} :: ${f.detail}`);
  }

  const cats = {};
  for (const r of RESULTS) { cats[r.cat] = cats[r.cat] || { p:0, f:0 }; if (r.ok) cats[r.cat].p++; else cats[r.cat].f++; }
  log("\nBy category:");
  for (const [c,v] of Object.entries(cats)) log(`  ${c}: ${v.p} pass, ${v.f} fail`);

  const outDir = path.join(__dirname, "..", "_logs");
  try { fs.mkdirSync(outDir, { recursive: true }); } catch(_) {}
  const outFile = path.join(outDir, "_api_healthcheck_result.json");
  fs.writeFileSync(outFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    target: PROD,
    summary: { total, passed, failed, passRate: +((passed/total)*100).toFixed(2) },
    byCategory: cats,
    results: RESULTS,
    log: LOG,
  }, null, 2));
  log("\nFull JSON report -> " + outFile);
  process.exit(failed > 0 ? 1 : 0);
})();
