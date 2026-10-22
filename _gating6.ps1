param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$fw="$root\.worktrees\feature-preflight"
if (!(Test-Path $fw)) { Write-Host "worktree missing: $fw"; exit 1 }
Set-Location $fw
$outPath = "C:\Temp\npmTestOut3.txt"
$errPath = "C:\Temp\npmTestErr3.txt"
if (Test-Path $outPath) { Remove-Item $outPath -Force }
if (Test-Path $errPath) { Remove-Item $errPath -Force }
$p = Start-Process -FilePath "npm" -ArgumentList "run","test" -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outPath -RedirectStandardError $errPath
Write-Host "exit=$($p.ExitCode)"
$out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
$err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
Write-Host "--- STDOUT tail 40 ---"
if ($out) { $out.Split("`n")[-40..-1] -join "`n" }
Write-Host "--- STDERR tail 40 ---"
if ($err) { $err.Split("`n")[-40..-1] -join "`n" }
