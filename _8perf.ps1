param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
Set-Location "$root\.worktrees\feature-preflight"

Write-Host "=== perf-budget.test.mjs budget lines ==="
Select-String -Path "tests\perf-budget.test.mjs" -Pattern '130,?000|exceeds' | ForEach-Object { "$($_.LineNumber): $($_.Line)" }

Write-Host "=== performance-budgets.mjs budget names/limits ==="
Select-String -Path "scripts\lib\performance-budgets.mjs" -Pattern 'home_document|130,?000|raw_bytes' | ForEach-Object { "$($_.LineNumber): $($_.Line)" }

Write-Host "=== byte-budgets.mjs budget table vicinity ==="
Select-String -Path "scripts\lib\byte-budgets.mjs" -Pattern 'home_document|130,?000|INDEX_BYTES|index_html' | ForEach-Object { "$($_.LineNumber): $($_.Line)" }
