param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$fw="$root\.worktrees\feature-preflight"
$cwd = $fw
$outPath = "C:\Temp\npmTestOut7.txt"
$errPath = "C:\Temp\npmTestErr7.txt"
if (Test-Path $outPath) { Remove-Item $outPath -Force }
if (Test-Path $errPath) { Remove-Item $errPath -Force }
$cmd = "cd /d `"$cwd`" && npm run test > `"$outPath`" 2> `"$errPath`""
Write-Host "running: $cmd"
$p = Start-Process -FilePath "cmd" -ArgumentList "/c","$cmd" -NoNewWindow -Wait -PassThru
Write-Host "exit=$($p.ExitCode)"
$out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
$err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
$failLines = @()
if ($out) { $lines = $out.Split("`n"); for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "FAIL|AssertionError|ERR_ASSERTION|expected|strictEqual") { if ($failLines.Count -lt 120) { $failLines += "$($i+1): $($lines[$i])" } } } }
Write-Host "--- FIRST ~120 FAIL-RELATED LINES (stdout) ---"
$failLines -join "`n"
