param([string]$root="C:\Users\SCM\Documents\GitHubBigEnergyCo\BigEnergyCo")
$fw = Join-Path $root ".worktrees\feature-preflight"
if (!(Test-Path $fw)) { Write-Host "missing: $fw"; exit 1 }
$outPath = "$fw\_npmTestOut.txt"
$errPath = "$fw\_npmTestErr.txt"
if (Test-Path $outPath) { Remove-Item $outPath -Force }
if (Test-Path $errPath) { Remove-Item $errPath -Force }
$cmd = "cmd /c `"cd /d `"$fw`"`"`r`n`"`npowershell -NoProfile -Command `"`"`$env:PATH='C:\Program Files\nodejs;C:\Program Files\Git\bin;{0}'; npm run test > 'C:\Temp\npmTestOut.txt' 2> 'C:\Temp\npmTestErr.txt'`"`"`"`r`n"
$p = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command",$cmd -NoNewWindow -Wait -PassThru
Write-Host "exit=$($p.ExitCode)"
$out = if (Test-Path "C:\Temp\npmTestOut.txt") { Get-Content "C:\Temp\npmTestOut.txt" -Raw } else { "" }
$err = if (Test-Path "C:\Temp\npmTestErr.txt") { Get-Content "C:\Temp\npmTestErr.txt" -Raw } else { "" }
$lines = $out.Split("`n")
$startIndex = -1
for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "failing tests") { $startIndex = $i; break } }
if ($startIndex -ge 0) { Write-Host "--- FAILING TESTS SECTION ---"; ($lines[$startIndex..($lines.Count-1)] -join "`n") -replace "`r","" } else { Write-Host "no failing-tests section found" }
Write-Host "--- STDERR tail 30 ---"; if ($err) { ($err.Split("`n")[-30..-1] -join "`n") -replace "`r","" }
