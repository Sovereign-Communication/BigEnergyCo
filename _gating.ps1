param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
Set-Location "$root\.worktrees\feature-preflight"
Write-Host "=== POSITION ==="
Write-Host "git status -sb:"
git status -sb
Write-Host "HEAD: $(git rev-parse HEAD)"
Write-Host "BRANCH: $(git rev-parse --abbrev-ref HEAD)"

Write-Host "=== INDEX BYTES ==="
$bytes = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html bytes: $bytes"
Write-Host "under 130000 budget: $($bytes -le 130000)"

Write-Host "=== USE CASE SURFACE PRESENT? ==="
$html = [System.IO.File]::ReadAllText("index.html")
$hasRow = $html.Contains('id="useCaseRow"')
$hasBlurb = $html.Contains('id="useCaseBlurb"')
$options = @('billcut','tou','backup','reserve','offgrid','portable') | ForEach-Object { $html.Contains("value=""$_""") }
Write-Host "useCaseRow present: $hasRow"
Write-Host "useCaseBlurb present: $hasBlurb"
Write-Host "option values present: billcut=$($options[0]) tou=$($options[1]) backup=$($options[2]) reserve=$($options[3]) offgrid=$($options[4]) portable=$($options[5])"

Write-Host "=== FRESHNESS / STAMP DECLARATIONS ==="
Write-Host "index.html asset tokens (first 6):"
$idxHtml = [System.IO.File]::ReadAllText("index.html")
$re = [regex]::Matches($idxHtml, 'src="\./assets/[^"]*\?v=([0-9a-z]+)"')
$re | Select-Object -First 6 | ForEach-Object { Write-Host "  src token: $($_.Groups[1].Value)" }
$hc = [regex]::Matches($idxHtml, 'href="\./assets/site\.css\?v=([0-9a-z]+)"')
$hc | Select-Object -First 2 | ForEach-Object { Write-Host "  css href token: $($_.Groups[1].Value)" }
Write-Host "sw.js CACHE_VERSION:"
$sw = [System.IO.File]::ReadAllText("sw.js")
[regex]::Match($sw, 'CACHE_VERSION = "([^"]+)"').Groups[1].Value | ForEach-Object { Write-Host "  $($_)" }
Write-Host "evidence freshness record claim:"
$ev = [System.IO.File]::ReadAllText("evidence\advisor-and-release.json")
[regex]::Matches($ev, 'asset token ([0-9a-z]+)') | ForEach-Object { Write-Host "  evidence asset token: $($_.Groups[1].Value)" }
[regex]::Matches($ev, 'SW cache ([0-9a-z]+)') | ForEach-Object { Write-Host "  evidence sw cache: $($_.Groups[1].Value)" }

Write-Host "=== RUN GATING SUITE ==="
function Run($label, $cmd, $args) {
  Write-Host "--- $label ---"
  $fail = $false
  try {
    $proc = Start-Process -FilePath $cmd -ArgumentList $args -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$env:TEMP\runout.txt" -RedirectStandardError "$env:TEMP\runerr.txt"
    $out = Get-Content "$env:TEMP\runout.txt" -Raw
    $err = Get-Content "$env:TEMP\runerr.txt" -Raw
    if ($out) { Write-Host "STDOUT (tail):"; $out.Split("`n")[-6..-1] -join "`n" }
    if ($err) { Write-Host "STDERR (tail):"; $err.Split("`n")[-6..-1] -join "`n" }
    Write-Host "exit=$($proc.ExitCode)"
    if ($proc.ExitCode -ne 0) { $fail = $true }
  } catch {
    Write-Host "ERROR launching: $_"
    $fail = $true
  }
  return $fail
}

$ret = Run "usecases.test.mjs" "node" "--test" "tests/usecases.test.mjs"
$ret = Run "check-usecases.mjs" "node" "scripts/check-usecases.mjs"
$ret = Run "check-chars.mjs" "node" "scripts/check-chars.mjs"
$ret = Run "seo" "npm" "run" "seo"
$ret = Run "format:check" "npm" "run" "format:check"
$ret = Run "deploy:check" "npm" "run" "deploy:check"
Write-Host "npm run test needs longer timeout; invoking separately..."
$testfail = $false
try {
  $tp = Start-Process -FilePath "npm" -ArgumentList "run","test" -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$env:TEMP\npmtestout.txt" -RedirectStandardError "$env:TEMP\npmtesterr.txt"
  $tout = Get-Content "$env:TEMP\npmtestout.txt" -Raw
  $terr = Get-Content "$env:TEMP\npmtesterr.txt" -Raw
  if ($tout) { Write-Host "TEST STDOUT (tail):"; $tout.Split("`n")[-12..-1] -join "`n" }
  if ($terr) { Write-Host "TEST STDERR (tail):"; $terr.Split("`n")[-12..-1] -join "`n" }
  Write-Host "test exit=$($tp.ExitCode)"
  if ($tp.ExitCode -ne 0) { $testfail = $true }
} catch {
  Write-Host "ERROR launching test: $_"
  $testfail = $true
}

Write-Host "=== GUARD ==="
Write-Host "paths.js present in tree: $(Test-Path "assets\js\sizing\paths.js")"
Write-Host ".quality-evidence present: $(Test-Path ".quality-evidence")"
Write-Host ".jev-p0* present: $( (Test-Path ".jev-p03a-report.json") -or (Test-Path ".jev-p02" ) )"
Write-Host "admin.html present: $(Test-Path "admin.html")"
Write-Host "blog-drafts present: $(Test-Path "blog-drafts")"
Write-Host "drafts present: $(Test-Path "drafts")"
Write-Host "wip present: $(Test-Path "wip")"
Write-Host "nul present: $(Test-Path "nul")"
Write-Host "landing-p1-use-case-tmp present: $(Test-Path "landing-p1-use-case-tmp")"
Write-Host "first-paint-weight.test.mjs present: $(Test-Path "tests\first-paint-weight.test.mjs")"
Write-Host "root py tools present: $( (Test-Path "check_advisor.py") -or (Test-Path "check_cf_status.py") -or (Test-Path "check_groq_models.py") -or (Test-Path "check_pages_live.py") -or (Test-Path "check_permissions.py") -or (Test-Path "check_script_subdomain.py") -or (Test-Path "check_token_plan_models.py") -or (Test-Path "check_workflow.py") -or (Test-Path "delegate_blog_post.py") -or (Test-Path "dispatch_and_monitor.py") )"
Write-Host "=== DECISION ==="
if ($ret -or $testfail) {
  Write-Host "NOT READY. gating suite still has failures. Do not commit/PR yet."
} else {
  Write-Host "READY. gating suite green. Can proceed to clean commit/PR from feature worktree."
}
