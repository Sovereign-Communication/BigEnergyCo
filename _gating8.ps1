param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$fw="$root\.worktrees\feature-preflight"
$cwd = $fw
$outPath = "C:\Temp\npmTestOut5.txt"
$errPath = "C:\Temp\npmTestErr5.txt"
if (Test-Path $outPath) { Remove-Item $outPath -Force }
if (Test-Path $errPath) { Remove-Item $errPath -Force }
$cmd = "cd /d `"$cwd`" && npm run test > `"$outPath`" 2> `"$errPath`""
Write-Host "running: $cmd"
$p = Start-Process -FilePath "cmd" -ArgumentList "/c","$cmd" -NoNewWindow -Wait -PassThru
Write-Host "exit=$($p.ExitCode)"
$out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
$err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
Write-Host "--- STDOUT tail 40 ---"
if ($out) { $out.Split("`n")[-40..-1] -join "`n" }
Write-Host "--- STDERR tail 40 ---"
if ($err) { $err.Split("`n")[-40..-1] -join "`n" }
