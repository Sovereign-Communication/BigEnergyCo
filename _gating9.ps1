param([string]$root="C:\Users\SCM\Documents\GitHubBigEnergyCo\BigEnergyCo")
$fw="$root\.worktrees\feature-preflight"
$cwd = $fw
$outPath = "C:\Temp\npmTestOut6.txt"
$errPath = "C:\Temp\npmTestErr6.txt"
if (Test-Path $outPath) { Remove-Item $outPath -Force }
if (Test-Path $errPath) { Remove-Item $errPath -Force }
$cmd = "cd /d `"$cwd`" && npm run test > `"$outPath`" 2> `"$errPath`""
Write-Host "running: $cmd"
$p = Start-Process -FilePath "cmd" -ArgumentList "/c","$cmd" -NoNewWindow -Wait -PassThru
Write-Host "exit=$($p.ExitCode)"
$out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
$err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
$failLinesOut = @()
$failLinesErr = @()
if ($out) { $lines = $out.Split("`n"); for ($i=0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "FAIL|AssertionError|ERR_ASSERTION|expected|strictEqual|not-ok") { if ($failLinesOut.Count -lt 40) { $failLinesOut += "$($i+1): $($lines[$i])" } } } }
if ($err) { $lines = $err.Split("`n"); for ($i=0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "FAIL|AssertionError|ERR_ASSERTION|expected|strictEqual|not-ok") { if ($failLinesErr.Count -lt 40) { $failLinesErr += "$($i+1): $($lines[$i])" } } } }
Write-Host "--- FAIL-RELATED OUTPUT LINES (first ~40 from stdout) ---"
$failLinesOut -join "`n"
Write-Host "--- FAIL-RELATED OUTPUT LINES (first ~40 from stderr) ---"
$failLinesErr -join "`n"
