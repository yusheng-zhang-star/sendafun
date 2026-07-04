$ProgressPreference='SilentlyContinue'
$token='cUC8inVAmbKuWhwORFvyM5J3lzskNEtS'
$headers=@{
  'Authorization'="Bearer $token"
  'Content-Type'='application/json'
  'User-Agent'='AdminFTSRebuild/1.0 (progress-monitor)'
}
$body='{}'
Write-Host "=== POST /api/db/_rebuild_fts ===" -ForegroundColor Cyan
Write-Host ("Token length: {0} chars" -f $token.Length)
try {
  $t0=Get-Date
  $r=Invoke-WebRequest -Uri 'https://sendafun.com/api/db/_rebuild_fts' -Method Post -Headers $headers -Body $body -TimeoutSec 900 -UseBasicParsing
  $dt=(Get-Date)-$t0
  Write-Host ("HTTP {0} in {1:mm\:ss\.fff} ({2}ms total)" -f $r.StatusCode,$dt,$dt.TotalMilliseconds)
  Write-Host "Content-Type: $($r.Headers['Content-Type'])"
  Write-Host ""
  try {
    $resp=$r.Content | ConvertFrom-Json
    Write-Host ($resp | ConvertTo-Json -Depth 10)
  } catch {
    Write-Host "RAW BODY:"
    Write-Host $r.Content
  }
} catch {
  Write-Host "❌ EXCEPTION:" -ForegroundColor Red
  $ex=$_.Exception
  Write-Host ("  Msg: "+$ex.Message)
  if($ex.Response) {
    try { $sc=[int]$ex.Response.StatusCode; Write-Host ("  HTTP Status: $sc") } catch {}
    try {
      $stream=$ex.Response.GetResponseStream()
      $sr=New-Object System.IO.StreamReader($stream)
      $body=$sr.ReadToEnd()
      Write-Host ("  Response body ("+$body.Length+" chars):")
      Write-Host $body
    } catch {}
  }
  break
}
Write-Host ""
Write-Host "=== Done. Now try GET /api/search?q=birthday to verify hits. ===" -ForegroundColor Cyan
