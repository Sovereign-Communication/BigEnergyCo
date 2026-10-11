Set-Location "C:\Users\SCM\Documents\GitHubBigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
Write-Host "=== BEFORE STASH: INDEX BYTES / TOKEN STATE ==="
$b = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html bytes: $b"
$html = [System.IO.File]::ReadAllText("index.html",[System.Text.UTF8Encoding]($false))
$tokens = [regex]::Matches($html,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"') | ForEach-Object { $_.Groups[2].Value }
Write-Host "index token values: $(($tokens | Select-Object -Unique) -join ' / ')"
$sw = [System.IO.File]::ReadAllText("sw.js")
Write-Host "sw.js CACHE_VERSION: $([regex]::Match($sw,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"
function Run($label,$expr) {
  $outPath = "_st2$label.txt"; $errPath = "_st2$label`_err.txt"
  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  if (Test-Path $errPath) { Remove-Item $errPath -Force }
  $p = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command",$expr -NoNewWindow -Wait -PassThru
  Write-Host "$label exit=$($p.ExitCode)"
  $out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
  $err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
  Write-Host "--- $label tail ---"
  if ($out) { $out.Split("`n")[-14..-1] -join "`n" }
  if ($err) { $err.Split("`n")[-14..-1] -join "`n" }
}
$s = & { git stash push -q 2>&1 }
Write-Host "stash exit=$LASTEXITCODE"
$s
Run "deploy-check-clean" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run deploy:check > "_de2.txt" 2> "_de2err.txt"'
Run "npm-test-clean" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run test > "_tn2.txt" 2> "_t2err.txt"'
Write-Host "=== AFTER CLEAN RUN: INDEX BYTES / TOKEN STATE ==="
$b2 = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html bytes: $b2"
$html2 = [System.IO.File]::ReadAllText("index.html",[System.Text.UTF8Encoding]($false))
$tokens2 = [regex]::Matches($html2,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"') | ForEach-Object { $_.Groups[2].Value }
Write-Host "index token values: $(($tokens2 | Select-Object -Unique) -join ' / ')"
$sw2 = [System.IO.File]::ReadAllText("sw.js")
Write-Host "sw.js CACHE_VERSION: $([regex]::Match($sw2,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"
$r = & { git stash pop -q 2>&1 }
Write-Host "pop exit=$LASTEXITCODE"
$r
Write-Host "=== AFTER RESTORE: INDEX BYTES / TOKEN STATE ==="
$b3 = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html bytes: $b3"
$html3 = [System.IO.File]::ReadAllText("index.html",[System.Text.UTF8Encoding]($false))
$tokens3 = [regex]::Matches($html3,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"') | ForEach-Object { $_.Groups[2].Value }
Write-Host "index token values: $(($tokens3 | Select-Object -Unique) -join ' / ')"
$sw3 = [System.IO.File]::ReadAllText("sw.js")
Write-Host "sw.js CACHE_VERSION: $([regex]::Match($sw3,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"
