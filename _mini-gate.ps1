Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
function Run($name, $cmd) {
  $outPath = "_o$name.txt"; $errPath = "_e$name.txt"
  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  if (Test-Path $errPath) { Remove-Item $errPath -Force }
  $p = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command",$cmd -NoNewWindow -Wait -PassThru
  Write-Host "=== $name | exit=$($p.ExitCode) ==="
  $combined = ((if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }) + "`n" + (if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" })) -split "`n" | Where-Object { $_.Trim() -ne "" }
  $combined | Select-Object -Last 30 | Write-Host
  Write-Host ""
}
Run "check-chars" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; node scripts/check-chars.mjs > "_o_cc.txt" 2> "_e_cc.txt"'
Run "format-check" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run format:check > "_o_fc.txt" 2> "_e_fc.txt"'
Write-Host "=== index.html tail hex (last 40 bytes) ==="
$bytes = [System.IO.File]::ReadAllBytes("index.html")
$tail = $bytes[-40..-1]
$hex = ($tail | ForEach-Object { $_.ToString("x2") }) -join ""
Write-Host "hex: $hex"
$text = [System.Text.Encoding]::UTF8.GetString($tail)
Write-Host "as text: $text"
