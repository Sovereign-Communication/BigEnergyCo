Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
Write-Host "copy index-new.html -> index.html"
Copy-Item -Path "index-new.html" -Destination "index.html" -Force
Write-Host "index.html bytes after copy: $([System.IO.File]::ReadAllBytes('index.html').Length)"
Write-Host "=== node --test tests/perf-budget.test.mjs ==="
$p = Start-Process -FilePath "node" -ArgumentList "--test","tests/perf-budget.test.mjs" -NoNewWindow -Wait -PassThru
Write-Host "node --test perf-budget exit=$($p.ExitCode)"
