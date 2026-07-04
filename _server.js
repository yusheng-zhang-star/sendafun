// Local preview server for SendAFun 2.0 (Windows / localhost:3000)
// NOTE: frontend app.js auto-switches API calls to https://sendafun.com
// when running on localhost, so no local /api proxy is needed here.
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const R2_UPSTREAM = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev";

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");

const GEO_4_LANGS = ["en", "es", "fr", "pt"];
const GEO_DEFAULT_LANG = "en";
const GEO_LANG_OVERRIDE_COOKIE = "saf_lang_override";

function getCookie(cookieHeader, name) {
  if (!cookieHeader) return "";
  const re = new RegExp("(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)");
  const m = re.exec(String(cookieHeader));
  return m ? decodeURIComponent(m[1].trim()) : "";
}

function _langFromCountry(cc) {
  const c = String(cc || "").toUpperCase();
  if (!c) return GEO_DEFAULT_LANG;
  if (["ES", "AR", "MX", "CL", "CO", "PE", "VE", "UY", "PY", "BO", "EC", "SV", "GT", "HN", "NI", "CR", "PA", "DO", "CU", "PR", "GQ"].includes(c)) return "es";
  if (["FR", "BE", "CH", "CA", "LU", "MC", "CD", "CG", "CI", "SN", "ML", "BF", "NE", "TD", "DJ", "RW", "BI", "GA", "GQ", "CG", "CM", "MA", "TN", "DZ", "HT"].includes(c)) return "fr";
  if (["PT", "BR", "AO", "MZ", "CV", "GW", "ST", "TL", "GQ"].includes(c)) return "pt";
  return "en";
}

function _effectiveLangFromRequest(req, urlPath) {
  const cookieHeader = req?.headers?.cookie || "";
  const fromCookie = getCookie(cookieHeader, GEO_LANG_OVERRIDE_COOKIE);
  if (fromCookie && GEO_4_LANGS.includes(String(fromCookie).toLowerCase())) {
    return String(fromCookie).toLowerCase();
  }
  const m = String(urlPath || "/").match(/^\/(en|es|fr|pt)(?:\/|$)/i);
  if (m) return m[1].toLowerCase();
  return GEO_DEFAULT_LANG;
}

function _injectLangContextIntoHtml(htmlText, lang) {
  if (!htmlText) return htmlText;
  const lg = GEO_4_LANGS.includes(String(lang || "").toLowerCase()) ? String(lang).toLowerCase() : GEO_DEFAULT_LANG;
  let out = htmlText;
  if (/<html[^>]*\slang\s*=\s*["'][^"']+["']/i.test(out)) {
    out = out.replace(/(<html[^>]*\s)lang\s*=\s*["'][^"']+["']/i, `$1lang="${lg}"`);
  } else {
    out = out.replace(/<html/i, `<html lang="${lg}"`);
  }
  if (!/data-saf-lang["']?\s*=/i.test(out)) {
    const block = `  <script data-saf-lang="${lg}">window.__SAF_EFFECTIVE_LANG__ = ${JSON.stringify(lg)};</script>\n`;
    const idx = out.lastIndexOf("</head>");
    if (idx >= 0) {
      out = out.slice(0, idx) + block + "</head>" + out.slice(idx + "</head>".length);
    } else {
      const j = out.search(/<script[^>]+src\s*=\s*["'][^"']*app\.js/i) || out.search(/<body/i) || -1;
      if (j >= 0) out = out.slice(0, j) + block + out.slice(j);
    }
  }
  return out;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm":  "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".map":  "application/json; charset=utf-8",
  ".txt":  "text/plain; charset=utf-8",
  ".xml":  "application/xml; charset=utf-8",
};

function sendFile(res, filePath, status = 200, injectLang = null) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const ct = MIME[ext] || "application/octet-stream";
    let body = data;
    if (injectLang && (ext === ".html" || ext === ".htm")) {
      try { body = Buffer.from(_injectLangContextIntoHtml(data.toString("utf8"), injectLang), "utf8"); }
      catch (_) {}
    }
    res.writeHead(status, {
      "Content-Type": ct,
      "Cache-Control": ext === ".html" || ext === ".htm"
        ? "no-store, no-cache, must-revalidate"
        : "public, max-age=0, must-revalidate",
    });
    res.end(body);
  });
}

function sendJson(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

const HOSTS = [
  { dir: ROOT, prefixes: ["/cards-images", "/editor", "/css", "/fonts", "/libs", "/svg", "/js", "/images", "/sitemap-images", "/thumbnails"] },
  { dir: PUBLIC_DIR, prefixes: [] },
];

function resolveStatic(urlPath) {
  // strip query
  const idx = urlPath.indexOf("?");
  if (idx !== -1) urlPath = urlPath.substring(0, idx);
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  for (const h of HOSTS) {
    const inMyDir = h.prefixes.length === 0 || h.prefixes.some(p => urlPath.startsWith(p));
    if (!inMyDir) continue;
    const candidate = path.normalize(path.join(h.dir, urlPath));
    if (!candidate.startsWith(h.dir)) continue;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch (_) {}
  }
  return null;
}

function sendIndexSPA(res, injectLang = "en") {
  const idx = path.join(PUBLIC_DIR, "index.html");
  if (fs.existsSync(idx)) return sendFile(res, idx, 200, injectLang);
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404: index.html not found");
}

const server = http.createServer((req, res) => {
  const method = (req.method || "GET").toUpperCase();
  const raw = req.url || "/";
  const qidx = raw.indexOf("?");
  const queryStr = qidx === -1 ? "" : raw.substring(qidx + 1);
  const urlPath = decodeURIComponent(qidx === -1 ? raw : raw.substring(0, qidx));

  const effLang = _effectiveLangFromRequest(req, urlPath);

  // CORS preflight (for local testing against production API origin)
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }

  // ---- /r2-proxy/* → Cloudflare R2 bucket (bypasses browser ORB/CORS for local img loads) ----
  if ((method === "GET" || method === "HEAD") && urlPath.startsWith("/r2-proxy")) {
    console.log("[PROXY] hit: method=" + method + " urlPath=" + urlPath);
    const target = R2_UPSTREAM + "/" + urlPath.replace(/^\/r2-proxy\/?/, "") + (qidx >= 0 ? "?" + queryStr : "");
    try {
      const upstream = new URL(target);
      const hrReq = https.request({
        method: "GET",
        hostname: upstream.hostname,
        port: 443,
        path: upstream.pathname + upstream.search,
        headers: {
          "User-Agent": "SendAFun-LocalProxy/1.0",
          "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
          "Referer": R2_UPSTREAM + "/"
        },
        timeout: 20000
      }, hrRes => {
        const ct = hrRes.headers["content-type"] || "application/octet-stream";
        const cl = hrRes.headers["content-length"];
        const cc = hrRes.headers["cache-control"] || "public, max-age=3600";
        const resHdrs = {
          "Content-Type": ct,
          "Cache-Control": cc,
          "Access-Control-Allow-Origin": "*",
          "X-R2-Proxy-Status": hrRes.statusCode
        };
        if (cl) resHdrs["Content-Length"] = cl;
        res.writeHead(hrRes.statusCode || 200, resHdrs);
        hrRes.pipe(res);
      });
      hrReq.on("timeout", () => { try { hrReq.destroy(new Error("upstream timeout")); } catch(_){} });
      hrReq.on("error", (e) => {
        try {
          res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("502 R2 proxy failed: " + String(e && e.message || e));
        } catch(_){}
      });
      hrReq.end();
      return;
    } catch (pErr) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("500 R2 proxy error: " + String(pErr && pErr.message || pErr));
    }
  }

  // ---- DOC §169 language override API (mirrors Worker _handleSetLangApi) ----
  if (method === "GET" && urlPath === "/api/lang/set") {
    const qp = new Map();
    (queryStr || "").split("&").forEach(kv => {
      if (!kv) return;
      const [k, ...rest] = kv.split("=");
      qp.set(decodeURIComponent(k), decodeURIComponent(rest.join("=") || ""));
    });
    let lang = (qp.get("lang") || GEO_DEFAULT_LANG).toLowerCase().slice(0, 2);
    if (!GEO_4_LANGS.includes(lang)) lang = GEO_DEFAULT_LANG;
    const referrer = req.headers.referer || "/";
    const safe = /^https?:\/\//i.test(referrer) ? referrer : (referrer.startsWith("/") ? referrer : "/");
    const cookieVal = `${GEO_LANG_OVERRIDE_COOKIE}=${lang}; Path=/; SameSite=Lax; Max-Age=2592000`;
    res.writeHead(302, {
      Location: safe,
      "Set-Cookie": cookieVal
    });
    return res.end();
  }

  // Other API paths are NOT served by this local server.
  // Frontend (app.js) auto-routes API calls to https://sendafun.com when hostname === localhost.
  if (urlPath.startsWith("/api/") || urlPath === "/api") {
    return sendJson(res, {
      ok: false,
      error: "Local server does not emulate D1/KV/R2 APIs. Frontend auto-uses https://sendafun.com/api origin for API calls on localhost."
    }, 501);
  }

  // favicon shortcut
  if (urlPath === "/favicon.ico") {
    const ico = resolveStatic("/favicon.ico");
    if (ico) return sendFile(res, ico);
    res.writeHead(204); return res.end();
  }

  // Static files (with extension) always first:
  const lastSeg = urlPath.split("/").pop() || "";
  if (lastSeg.includes(".")) {
    const f = resolveStatic(urlPath);
    if (f) return sendFile(res, f, 200, effLang);
    // .html files that don't exist → fall through to SPA index (so /en/pricing.html → index.html SPA shell)
    // Only 404 for non-HTML asset extensions
    if (!/\.html?$/i.test(lastSeg)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404 Not Found: " + urlPath);
    }
  }

  // Static HTML by exact path (e.g., /pricing → pricing.html in public)
  const htmlPath = urlPath.endsWith(".html") ? urlPath : (urlPath === "/" ? "/index.html" : urlPath + ".html");
  const hf = resolveStatic(htmlPath);
  if (hf) return sendFile(res, hf, 200, effLang);

  // fallback: SPA index (Discover/Editor routes etc)
  return sendIndexSPA(res, effLang);
});

server.listen(PORT, () => {
  console.log("🚀 SendAFun 2.0 预览服务器: http://localhost:" + PORT + "  (API由前端直接直连 sendafun.com 跨域请求)");
  console.log("🌐 支持语言切换: EN / ES / FR / PT  (选择器→/api/lang/set→cookie→HTML注入)");
});
