Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
$errPath = "_pfer2.txt"
if (Test-Path $errPath) { Remove-Item $errPath -Force }
$p = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command","Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight'; npm run perf > '_pf2.txt' 2> '_pfe2.txt'" -NoNewWindow -Wait -PassThru
Write-Host "npm run perf exit=$($p.ExitCode)"
Write-Host "--- npm run perf (stdout) tail ---"
if (Test-Path "_pf2.txt") { (Get-Content "_pf2.txt" -Raw).Split("`n")[-60..-1] -join "`n" }
Write-Host "--- npm run perf (stderr) tail ---"
if (Test-Path "_pfe2.txt") { (Get-Content "_pfe2.txt" -Raw).Split("`n")[-60..-1] -join "`n" }
