Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
Write-Host "=== npm config list ==="
& { npm config list 2>&1 } | Select-Object -First 40
Write-Host "=== .npmrc in repo root ==="
if (Test-Path ".npmrc") { Get-Content ".npmrc" } else { Write-Host "no .npmrc in repo root" }
Write-Host "=== .npmrc in parent ==="
if (Test-Path "..\.npmrc") { Get-Content "..\.npmrc" } else { Write-Host "no ..\.npmrc" }
Write-Host "=== node_modules top-level in worktree ==="
if (Test-Path "node_modules") { (Get-ChildItem node_modules).Name | Select-Object -First 40 }
else { Write-Host "no node_modules in worktree" }
Write-Host "=== global npm root ==="
$out = & { npm root -g 2>&1 }
Write-Host "global npm root: $out"
$globalNm = $out.Trim()
Write-Host "=== global node_modules top-level ==="
if ($globalNm -and (Test-Path $globalNm)) { (Get-ChildItem $globalNm).Name | Select-Object -First 40 }
else { Write-Host "no global node_modules at $globalNm" }
Write-Host "=== prettier in global? ==="
if ($globalNm -and (Test-Path (Join-Path $globalNm "prettier"))) { Write-Host "prettier dir EXISTS globally" }
else { Write-Host "prettier dir MISSING globally" }
