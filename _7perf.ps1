param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
Set-Location "$root\.worktrees\feature-preflight"

Write-Host "=== WHERE IS THIS BUDGET? (search scripts/ tests/ package.json) ==="
Select-String -Path "scripts\lib\*.mjs","tests\*.test.mjs","package.json" -Pattern 'index\.html|130,?000|130000|INDEX_BYTES|index_html' -AllMatches | ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line)" }
