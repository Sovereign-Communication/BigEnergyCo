param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$fw = Join-Path $root ".worktrees\feature-preflight"
if (!(Test-Path $fw)) { Write-Host "MISSING worktree: $fw"; exit 1 }
Set-Location $fw
Write-Host "=== POSITION ==="
Write-Host "git status -sb:"
git status -sb
Write-Host "HEAD: $(git rev-parse HEAD)"
Write-Host "BRANCH: $(git rev-parse --abbrev-ref HEAD)"
Write-Host "=== INDEX BYTES vs BUDGET ==="
$bytes = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html bytes: $bytes ; under 130000: $($bytes -le 130000)"
Write-Host "=== USE CASE SURFACE ==="
$html = [System.IO.File]::ReadAllText("index.html")
$hasRow = $html.Contains('id="useCaseRow"')
$hasBlurb = $html.Contains('id="useCaseBlurb"')
$opts = @('billcut','tou','backup','reserve','offgrid','portable') | ForEach-Object { $html.Contains("value=""$_""") }
Write-Host "row present: $hasRow ; blurb present: $hasBlurb ; options: $($opts -join ' / ')"
Write-Host "=== STAMP / FRESHNESS ==="
$idx = [System.IO.File]::ReadAllText("index.html")
[regex]::Matches($idx,'src="\./assets/[^"]*\?v=([0-9a-z]+)"') | Select-Object -First 6 | ForEach-Object { Write-Host "src token: $($_.Groups[1].Value)" }
[regex]::Matches($idx,'href="\./assets/site\.css\?v=([0-9a-z]+)"') | ForEach-Object { Write-Host "css token: $($_.Groups[1].Value)" }
$sw = [System.IO.File]::ReadAllText("sw.js")
Write-Host "sw.js CACHE_VERSION: $([regex]::Match($sw,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"
$ev = [System.IO.File]::ReadAllText("evidence\advisor-and-release.json")
Write-Host "evidence asset token claim: $([regex]::Match($ev,'asset token ([0-9a-z]+)').Groups[1].Value)"
Write-Host "evidence sw cache claim: $([regex]::Match($ev,'SW cache ([0-9a-z]+)').Groups[1].Value)"
Write-Host "=== GATING SUITE (exit codes captured this turn) ==="
Write-Host "node --test tests/usecases.test.mjs -> exit 0 ; 30 pass 0 fail"
Write-Host "node scripts/check-usecases.mjs -> exit 0 ; USECASES OK"
Write-Host "node scripts/check-chars.mjs -> exit 0 ; CLEAN"
Write-Host "npm run seo -> exit 1 ; 1 quality failure (inline style attrs 575 > 574)"
Write-Host "npm run format:check -> exit 0 ; Prettier clean"
Write-Host "npm run deploy:check -> exit 0 ; staged 3 changed files"
Write-Host "npm run test -> exit 1 ; 1680/1690 recorded ; 10 failing tests"
Write-Host "failing tests: deploy-blobs, evidence-freshness, gate-self-audit(2), perf-budget, promote-gates(5)"
Write-Host "decisive promote-gate failures: verify positive control, stale-stamp mutation, dry run verify/plan/deploy, policy regression control"
Write-Host "parity failures named: index.html, assets/js/sizing/run.js, assets/js/sizing/ui.js"
Write-Host "=== GUARD ==="
Write-Host "paths.js present: $(Test-Path "assets/js/sizing/paths.js")"
Write-Host ".quality-evidence present: $(Test-Path ".quality-evidence")"
Write-Host ".jev-p0* present: $((Test-Path ".jev-p03a-report.json") -or (Test-Path ".jev-p02"))"
Write-Host "local scratch absent: admin.html=$(-not (Test-Path "admin.html")) blog-drafts=$(-not (Test-Path "blog-drafts")) drafts=$(-not (Test-Path "drafts")) wip=$(-not (Test-Path "wip")) landing-p1-use-case-tmp=$(-not (Test-Path "landing-p1-use-case-tmp")) first-paint-weight.test.mjs=$(-not (Test-Path "tests/first-paint-weight.test.mjs"))"
Write-Host "=== DECISION ==="
Write-Host "NOT READY: gating suite non-green. Do not commit/PR from this tree yet."
Write-Host "Next fix: index.html still 133584 bytes vs 130000 budget after last trim; freshness record still says 20261005h/beco-v108 while tree ships 20261008a/beco-v109."
