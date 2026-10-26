param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
Set-Location "$root\.worktrees\feature-preflight"
Write-Host "=== STATUS ==="
git status -sb
Write-Host "=== HEAD ==="
git rev-parse HEAD
Write-Host "=== BRANCH ==="
git rev-parse --abbrev-ref HEAD
Write-Host "=== INDEX BYTES ==="
(Get-Item "index.html").Length
