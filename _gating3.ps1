param([string]$root="C:\Users\SCM\Documents\GitHubBigEnergyCo\BigEnergyCo")
Set-Location "$root\.worktrees\feature-preflight"
$outPath = "$env:TEMP\npmTestOut.txt"
$errPath = "$env:TEMP\npmTestErr.txt"
if (Test-Path $outPath) { Remove-Item $outPath }
if (Test-Path $errPath) { Remove-Item $errPath }
$p = Start-Process -FilePath "bash" -ArgumentList "-c", "cd /c/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo/.worktrees/feature-preflight && npm run test" -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outPath -RedirectStandardError $errPath
$out = Get-Content $outPath -Raw
$err = Get-Content $errPath -Raw
Write-Host "=== npm test exit=$($p.ExitCode) ==="
Write-Host "--- TEST STDOUT (tail 40 lines) ---"
$out.Split("`n")[-40..-1] -join "`n"
Write-Host "--- TEST STDERR (tail 40 lines) ---"
$err.Split("`n")[-40..-1] -join "`n"
