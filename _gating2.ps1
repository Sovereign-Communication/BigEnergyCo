param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
Set-Location "$root\.worktrees\feature-preflight"

function Run($label, $cmd) {
  Write-Host "=== $label ==="
  $p = Start-Process -FilePath "bash" -ArgumentList "-c", "`"$cmd`"" -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$env:TEMP\runout.txt" -RedirectStandardError "$env:TEMP\runerr.txt"
  $out = Get-Content "$env:TEMP\runout.txt" -Raw
  $err = Get-Content "$env:TEMP\runerr.txt" -Raw
  if ($out) { Write-Host "STDOUT (tail):"; $out.Split("`n")[-8..-1] -join "`n" }
  if ($err) { Write-Host "STDERR (tail):"; $err.Split("`n")[-8..-1] -join "`n" }
  Write-Host "exit=$($p.ExitCode)"
}

Run "usecases.test.mjs" "cd /c/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo/.worktrees/feature-preflight && node --test tests/usecases.test.mjs"
Run "check-usecases.mjs" "cd /c/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo/.worktrees/feature-preflight && node scripts/check-usecases.mjs"
Run "check-chars.mjs" "cd /c/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo/.worktrees/feature-preflight && node scripts/check-chars.mjs"
Run "seo" "cd /c/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo/.worktrees/feature-preflight && npm run seo"
Run "format:check" "cd /c/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo/.worktrees/feature-preflight && npm run format:check"
Run "deploy:check" "cd /c/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo/.worktrees/feature-preflight && npm run deploy:check"
Run "npm test" "cd /c/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo/.worktrees/feature-preflight && npm run test"

# guard quick
Write-Host "=== GUARD ==="
Write-Host "paths.js present: $(Test-Path "assets/js/sizing/paths.js")"
Write-Host ".quality-evidence present: $(Test-Path ".quality-evidence")"
Write-Host ".jev-p0* present: $((Test-Path ".jev-p03a-report.json") -or (Test-Path ".jev-p02"))"
Write-Host "admin.html present: $(Test-Path "admin.html")"
Write-Host "blog-drafts present: $(Test-Path "blog-drafts")"
Write-Host "drafts present: $(Test-Path "drafts")"
Write-Host "wip present: $(Test-Path "wip")"
Write-Host "nul present: $(Test-Path "nul")"
Write-Host "landing-p1-use-case-tmp present: $(Test-Path "landing-p1-use-case-tmp")"
Write-Host "first-paint-weight.test.mjs present: $(Test-Path "tests/first-paint-weight.test.mjs")"
