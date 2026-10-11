Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
function Run($label,$expr) {
  $outPath = "_out_$label.txt"; $errPath = "_err_$label.txt"
  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  if (Test-Path $errPath) { Remove-Item $errPath -Force }
  $p = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command",$expr -NoNewWindow -Wait -PassThru
  Write-Host "$label exit=$($p.ExitCode)"
  $out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
  $err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
  Write-Host "--- $label tail ---"
  if ($out) { $out.Split("`n")[-18..-1] -join "`n" }
  if ($err) { $err.Split("`n")[-18..-1] -join "`n" }
}
Run "usecases" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; node --test tests/usecases.test.mjs > "_out_usecases.txt" 2> "_err_usecases.txt"'
Run "check-usecases" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; node scripts/check-usecases.mjs > "_out_check-usecases.txt" 2> "_err_check-usecases.txt"'
Run "check-chars" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; node scripts/check-chars.mjs > "_out_check-chars.txt" 2> "_err_check-chars.txt"'
Run "seo" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run seo > "_out_seo.txt" 2> "_err_seo.txt"'
Run "format-check" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run format:check > "_out_format-check.txt" 2> "_err_format-check.txt"'
Run "deploy-check" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run deploy:check > "_out_deploy-check.txt" 2> "_err_deploy-check.txt"'
Run "npm-test" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run test > "_out_npm-test.txt" 2> "_err_npm-test.txt"'
Write-Host "=== INDEX BYTES ==="
$b = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html bytes: $b ; under 130000: $($b -le 130000)"
Write-Host "=== TOKEN / PATCH STATE ==="
$html = [System.IO.File]::ReadAllText("index.html")
$tokens = [regex]::Matches($html,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"') | ForEach-Object { $_.Groups[2].Value }
Write-Host "index token values: $(($tokens | Select-Object -Unique) -join ' / ')"
$sw = [System.IO.File]::ReadAllText("sw.js")
Write-Host "sw.js CACHE_VERSION: $([regex]::Match($sw,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"
$ev = [System.IO.File]::ReadAllText("evidence\advisor-and-release.json")
Write-Host "evidence asset token claim: $([regex]::Match($ev,'asset token ([0-9a-z]+)').Groups[1].Value)"
Write-Host "evidence sw cache claim: $([regex]::Match($ev,'SW cache ([0-9a-z]+)').Groups[1].Value)"
Write-Host "=== DECISION ==="
$b2 = [System.IO.File]::ReadAllBytes("index.html").Length
if ($b2 -le 130000) { Write-Host "ready-if-other-gates-green: index under budget" } else { Write-Host "NOT READY: index still over budget at $b2 bytes" }
