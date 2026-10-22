Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
Write-Host "=== npm run (scripts) ==="
& { npm run 2>&1 } | Select-Object -First 80
Write-Host "=== node --test tests/perf-budget.test.mjs ==="
$errPath = "_perf_err.txt"
$outPath = "_perf_out.txt"
if (Test-Path $errPath) { Remove-Item $errPath -Force }
if (Test-Path $outPath) { Remove-Item $outPath -Force }
$p = Start-Process -FilePath "node" -ArgumentList "--test","tests/perf-budget.test.mjs" -NoNewWindow -Wait -PassThru
Write-Host "node --test perf-budget exit=$($p.ExitCode)"
Write-Host "--- stdout tail ---"
if (Test-Path $outPath) { (Get-Content $outPath -Raw).Split("`n")[-60..-1] -join "`n" }
Write-Host "--- stderr tail ---"
if (Test-Path $errPath) { (Get-Content $errPath -Raw).Split("`n")[-60..-1] -join "`n" }
