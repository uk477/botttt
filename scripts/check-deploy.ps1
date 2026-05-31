# Run on the Windows server after npm run build + server restart.
$domain = $env:DEPLOY_DOMAIN
if (-not $domain) { $domain = "https://www.fanvueverify.space" }

Write-Host "Local dist index.html:"
Select-String -Path "dist\index.html" -Pattern "fv-build|/assets/index-" | ForEach-Object { $_.Line.Trim() }

Write-Host "`nLive site:"
try {
  $html = Invoke-WebRequest -Uri "$domain/" -UseBasicParsing -TimeoutSec 15
  $html.Content -split "`n" | Select-String -Pattern "fv-build|/assets/index-"
} catch {
  Write-Host "FAIL: $_"
}

try {
  $ver = Invoke-RestMethod -Uri "$domain/api/version" -TimeoutSec 15
  Write-Host "`n/api/version:" ($ver | ConvertTo-Json -Compress)
} catch {
  Write-Host "`n/api/version FAIL (old server or wrong proxy): $_"
}

$js = (Invoke-WebRequest -Uri "$domain/" -UseBasicParsing).Content | Select-String -Pattern 'index-[^"]+\.js' | ForEach-Object { $_.Matches[0].Value }
if ($js) {
  $url = "$domain/assets/$js"
  $body = (Invoke-WebRequest -Uri $url -UseBasicParsing).Content
  if ($body -match "Не удалось оформить заказ") {
    Write-Host "`nWARN: Live JS still has OLD error text. Rebuild dist and restart Node on this machine."
  } else {
    Write-Host "`nOK: Live JS does not contain old purchase error."
  }
}
