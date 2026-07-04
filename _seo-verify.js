const http = require("http");
const tests = [
  "/",
  "/birthday",
  "/christmas",
  "/anniversary",
  "/love",
  "/thank-you",
  "/wedding",
  "/fathers-day",
  "/mothers-day",
  "/valentine",
  "/discover",
  "/discover?cat=birthday&tone=warm",
  "/trending",
  "/latest",
  "/holidays",
  "/message-generator",
  "/pricing",
  "/card/anniversary-happy-anniversary-card-celebrate-your-love-romantic-for-her-11368673",
  "/sitemap.xml",
  "/sitemap-cards.xml",
  "/sitemap-pages.xml",
  "/robots.txt"
];
let pass = 0, fail = 0;
async function main() {
  for (const p of tests) {
    const status = await new Promise(r => {
      http.get({ host: "127.0.0.1", port: 3000, path: p, timeout: 10000 }, res => {
        let body = "";
        res.on("data", c => { if (body.length < 500) body += c.toString(); });
        res.on("end", () => {
          const hasSEO = /og:title|<meta name="description|canonicalLink|ld-org|<title>/.test(body);
          r({ code: res.statusCode, bytes: body.length, seo: hasSEO });
        });
      }).on("error", () => r({ code: 0 }));
    });
    const ok = status.code === 200;
    if (ok) pass++; else fail++;
    const mark = ok ? "✅" : "❌";
    console.log(mark + " " + status.code + " " + p + " (" + status.bytes + "b seo=" + status.seo + ")");
  }
  console.log("\n--- RESULTS: PASS=" + pass + " / FAIL=" + fail + " ---");
}
main();
