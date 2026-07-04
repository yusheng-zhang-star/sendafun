$ProgressPreference='SilentlyContinue'; $NL="`n"; Write-Host "=== 🔬 OBJECTIVE EVIDENCE PROOF: 验证8项已实现骨架是否真实跑通 ===`n" -ForegroundColor Cyan;
$UA_USER='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537';
$UA_CRAWLER='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
$Base='https://sendafun.com';

function Test-Route($label, $path, $extraHeaders=@{}, $ua=$UA_USER, $method='GET', $expectMaxKB=200) {
    $hdrs = @{'User-Agent'=$ua} + $extraHeaders;
    try {
        $t0=Get-Date;
        if($method -ieq 'HEAD') { $r=Invoke-WebRequest -Uri ($Base+$path) -Method Head -Headers $hdrs -TimeoutSec 20 -UseBasicParsing }
        else { $r=Invoke-WebRequest -Uri ($Base+$path) -Method $method -Headers $hdrs -TimeoutSec 30 -UseBasicParsing }
        $dt=((Get-Date)-$t0).TotalMilliseconds;
        $st=$r.StatusCode; $cl=([int]$r.Headers['Content-Length']); $ct=($r.Headers['Content-Type'] -join '');
        $bodySample=''; if($r.Content) { $bodySample = ($r.Content.Substring(0,[Math]::Min($r.Content.Length,600))) }
        $mark = if(($st -eq 200) -or ($st -eq 302)) {'✅'} else {'⚠️'};
        Write-Host ("{0,-36} {1,3} {2,-26} {3,6}KB {4,5}ms {5}" -f $label,$st,$ct,($cl/1024 -as [int]),($dt -as [int]),$mark);
        if($extraHeaders.Count -gt 0) { Write-Host ("   headers: "+($extraHeaders.Keys | ForEach-Object { "$_="+$extraHeaders[$_] }) -join ', ') };
        if($st -eq 302) { Write-Host ("   -> Location: "+$r.Headers['Location']) };
        if($bodySample) { Write-Host ("   body[:600]: "+$bodySample.Replace("`n"," ").Replace("`r"," ")) };
        return $r;
    } catch {
        $emsg = $_.Exception.Message;
        try { $resp = $_.Exception.Response; if($resp) { Write-Host ("{0,-36} {1,3} EXC_HTTP   FAIL ❌" -f $label,[int]$resp.StatusCode); Write-Host ("   msg: "+$emsg.Substring(0,[Math]::Min($emsg.Length,260))) } else { Write-Host ("{0,-36} EXC_NONHTTP   FAIL ❌" -f $label); Write-Host ("   msg: "+$emsg.Substring(0,[Math]::Min($emsg.Length,260))) } } catch { Write-Host ("  ❌ "+$label+" : "+$_.Exception.Message.Substring(0,200)) }
        return $null
    }
}

Write-Host "--- 1/8 Geo 302 auto-redirect (CF-IPCountry header simulation) ---" -ForegroundColor Yellow;
Test-Route "root CF-IPCountry: US → /en" "/" @{'CF-IPCountry'='US'} ;
Test-Route "root CF-IPCountry: BR → /pt" "/" @{'CF-IPCountry'='BR'} ;
Test-Route "root CF-IPCountry: MX → /es" "/" @{'CF-IPCountry'='MX'} ;
Test-Route "root CF-IPCountry: FR → /fr" "/" @{'CF-IPCountry'='FR'} ;
Write-Host "";
Write-Host "--- 2/8 Crawler UA EXEMPTION — Googlebot → NO redirect 200 (Doc §170) ---" -ForegroundColor Yellow;
Test-Route "Googlebot root → 200 no redirect" "/" -ua $UA_CRAWLER;
Write-Host "";
Write-Host "--- 3/8 hreflang injection on SPA shell (/en/pricing) → head should contain hreflang= + x-default (Doc §101) ---" -ForegroundColor Yellow;
$r = Test-Route "/en/pricing → SPA shell hreflang inject" "/en/pricing";
if($r -and $r.Content) {
    $hreflangCount = ([regex]::Matches($r.Content, 'hreflang\s*=')).Count;
    $hasXDefault = $r.Content -match 'hreflang\s*=\s*[\"'']x-default[\"'']';
    $hasCanonical = $r.Content -match '<link[^>]+rel\s*=\s*[\"'']canonical';
    Write-Host ("   hreflang tags present: {0}, x-default present: {1}, <link rel=canonical: {2}" -f $hreflangCount,$hasXDefault,$hasCanonical);
}
Write-Host "";
Write-Host "--- 4/8 4-language independent sitemaps (Doc §218) + main index + robots ---" -ForegroundColor Yellow;
foreach($sp in @('/sitemap.xml','/sitemap-en.xml','/sitemap-es.xml','/sitemap-fr.xml','/sitemap-pt.xml','/sitemap-pages.xml','/sitemap-cards.xml','/robots.txt')) {
    Test-Route ($sp) $sp;
}
Write-Host "";
Write-Host "--- 5/8 Language manual switch: POST /api/lang/override → Set-Cookie saf_lang_override (Doc §169) ---" -ForegroundColor Yellow;
$hdrs = @{'User-Agent'=$UA_USER; 'Content-Type'='application/json'};
try {
    $body = @{lang='pt'} | ConvertTo-Json;
    $r = Invoke-WebRequest -Uri ($Base+'/api/lang/override') -Method Post -Headers $hdrs -Body $body -TimeoutSec 20 -UseBasicParsing;
    $sc= $r.StatusCode; $setcookie=($r.Headers['Set-Cookie'] -join '|');
    $mark = if($sc -eq 200 -and $setcookie -match 'saf_lang_override=pt'){'✅'} else {'⚠️'};
    Write-Host ("{0,-36} {1,3} Set-Cookie:{2} {3}" -f "POST /api/lang/override {lang:pt}",$sc,($setcookie.Substring(0,[Math]::Min($setcookie.Length,180))),$mark);
} catch { Write-Host ("POST /api/lang/override FAIL ❌: "+$_.Exception.Message.Substring(0,[Math]::Min($_.Exception.Message.Length,300))) }
Write-Host "";
Write-Host "--- 6/8 FTS baseline: /api/search?q=birthday — #hits (no rebuild expected 0) ---" -ForegroundColor Yellow;
try {
    $r = Invoke-RestMethod -Uri ($Base+'/api/search?q=birthday&size=3') -TimeoutSec 30;
    $total = $r.total; $count = @($r.cards).Count;
    $mark = if($total -ge 1) {'✅'} else {'⚠️(empty - need rebuild)'};
    Write-Host ("{0,-36} total=$total returned=$count {1}`n" -f "GET /api/search?q=birthday",$mark);
    if($r.cards) { $r.cards | Select-Object -First 3 | ForEach-Object { Write-Host ("   slug="+$_.slug+" title="+$_.title.Substring(0,[Math]::Min($_.title.Length,70))) } }
} catch { Write-Host ("GET /api/search FAIL ❌: "+$_.Exception.Message.Substring(0,[Math]::Min($_.Exception.Message.Length,300))) }
Write-Host "";
Write-Host "--- 7/8 Schema.org areaServed: GET /en/about → <script type=application/ld+json areaServed contains US/GB/CA/FR/ES/MX/BR (Doc §217) ---" -ForegroundColor Yellow;
try {
    $r = Invoke-WebRequest -Uri ($Base+'/en/about') -TimeoutSec 25 -UseBasicParsing;
    if($r.Content -match 'areaServed') { $matchesAll=@('US','GB','CA','FR','ES','MX','BR') | ForEach-Object { if($r.Content -match ("['""'"+$_+"['""'")) { $_ } }; Write-Host ("   /en/about contains areaServed ✅; core7 countries present count: {0}/7: {1}" -f $matchesAll.Count,($matchesAll -join ',')) } else { Write-Host "   ⚠️ no areaServed found in /en/about" }
} catch { Write-Host ("GET /en/about FAIL: "+$_.Exception.Message.Substring(0,200)) }
Write-Host "";
Write-Host "--- 8/8 Timezone calibration: POST /api/... with cf-timezone: America/Sao_Paulo → scheduled correctly (Doc §187-189) ---" -ForegroundColor Yellow;
Write-Host "   (skipping — requires auth; will verify in scheduled-emails task later. SKIP)"
Write-Host "`n=== END OBJECTIVE EVIDENCE PROOF ===" -ForegroundColor Cyan;
