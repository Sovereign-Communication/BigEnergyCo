param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
Set-Location "$root\.worktrees\feature-preflight"

Write-Host "=== NPM FORMAT (write) ==="
npm run format
$fmt=$LASTEXITCODE
Write-Host "npm run format exit=$fmt"

Write-Host "=== NPM FORMAT:CHECK ==="
npm run format:check
$chk=$LASTEXITCODE
Write-Host "npm run format:check exit=$chk"
exit ([int]($fmt -bor $chk))
