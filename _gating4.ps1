param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$fw="$root\.worktrees\feature-preflight"
if (!(Test-Path $fw)) { Write-Host "worktree missing: $fw"; exit 1 }
Set-Location $fw
$outPath="$env:TEMP\npmTestOut2.txt"; $errPath="$env:TEMP\npmTestErr2.txt"
if (Test-Path $outPath) { Remove-Item $outPath }
if (Test-Path $errPath) { Remove-Item $errPath }
$p=Start-Process -FilePath "bash" -ArgumentList "-c","cd /c/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo/.worktrees/feature-preflight && npm run test" -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outPath -RedirectStandardError $errPath
Write-Host "exit=$($p.ExitCode)"
$out=Get-Content $outPath -Raw
$err=Get-Content $errPath -Raw
Write-Host "--- STDOUT tail 40 ---"
$out.Split("`n")[-40..-1] -join "`n"
Write-Host "--- STDERR tail 40 ---"
$err.Split("`n")[-40..-1] -join "`n"
