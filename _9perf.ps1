param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
Set-Location "$root\.worktrees\feature-preflight"

Write-Host "=== perf-budget.test.mjs 130000-definition vicinity ==="
Select-String -Path "tests\perf-budget.test.mjs" -Pattern 'htmlBytes|<= 130|130_000' -Context 3,1 | ForEach-Object { "$($_.LineNumber): $($_.Line.TrimEnd())" }

Write-Host "=== index.html bytes on this tree ==="
(Get-Item "index.html").Length
