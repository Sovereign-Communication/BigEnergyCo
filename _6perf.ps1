param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
Set-Location "$root\.worktrees\feature-preflight"

Write-Host "=== INDEX BYTES NOW ==="
(Get-Item "index.html").Length

Write-Host "=== BUDGET DECLARATIONS (js_to_first_result / index.html) ==="
Select-String -Path "scripts\lib\performance-budgets.mjs" -Pattern 'js_to_first_result|index\.html\s*=>' | ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line)" }
