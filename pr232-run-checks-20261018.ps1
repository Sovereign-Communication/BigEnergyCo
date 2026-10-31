$ErrorActionPreference = 'Continue'
$repo = (Get-Location).Path
$nodeRoot = 'C:\tmp\node-v22.23.3-win-x64'
$results = 'C:\tmp\pr232-jev-results-20261018-formatted'
$artifacts = Join-Path $results 'artifacts'
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
$env:PATH = $nodeRoot + ';' + $env:PATH
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$node = Join-Path $nodeRoot 'node.exe'
$npm = Join-Path $nodeRoot 'npm.cmd'
$base = '32374c01482055f82686172592340eae072b93f7'
$expectedHead = 'd94a9055fc0abaf790c01e2e93ae644043e7f884'
$head = (& git rev-parse HEAD).Trim()
$tree = (& git show -s --format=%T HEAD).Trim()
if ($head -ne $expectedHead) { throw "Snapshot HEAD mismatch: $head" }
if ($tree -ne 'f52a03c364093ca7ab629d6c05b05a55504ef210') { throw "Snapshot tree mismatch: $tree" }
if ((& $node --version) -ne 'v22.23.3') { throw 'Pinned Node 22 is unavailable' }
if ((& git status --porcelain=v1).Length -ne 0) { throw 'Snapshot working tree is not clean before validation' }
Set-Location $repo
"SNAPSHOT head=$head tree=$tree node=$(& $node --version)" | Set-Content (Join-Path $results 'snapshot.txt')
"RESULTS $results" | Add-Content (Join-Path $results 'snapshot.txt')
$script:steps = [ordered]@{}
$script:jobLog = ''
$script:failed = $false
function Start-JobLog([string]$job) {
  $script:steps = [ordered]@{}
  $script:failed = $false
  $script:jobLog = Join-Path $results ($job + '.log')
  "JOB $job" | Set-Content $script:jobLog
  Write-Output "JOB $job"
}
function Invoke-Step([string]$name, [string]$exe, [string[]]$argv) {
  "STEP $name COMMAND $exe $($args -join ' ')" | Add-Content $script:jobLog
  & $exe @argv >> $script:jobLog 2>&1
  $code = $LASTEXITCODE
  $outcome = if ($code -eq 0) { 'success' } else { 'failure' }
  $script:steps[$name] = $outcome
  if ($code -ne 0) { $script:failed = $true }
  Write-Output "  $name=$outcome exit=$code"
  if ($code -ne 0) { Get-Content $script:jobLog -Tail 18 | Write-Output }
}
function Invoke-SecretScan {
  $name = 'secret-scan'
  $regex = 'oauth_toke[n]|BEGIN [A-Z ]*PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|sk-live-[0-9A-Za-z]{10,}|ghp_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_-]{10,}|xox[bap]-[0-9A-Za-z-]+|GROQ_API_KEY\s*=\s*["'']?gsk_[0-9A-Za-z]+'
  "STEP $name exact workflow tracked-file scanner" | Add-Content $script:jobLog
  & git grep -nE $regex -- . ':(exclude)*.lock' >> $script:jobLog 2>&1
  $code = $LASTEXITCODE
  if ($code -eq 1) { $outcome = 'success' } else { $outcome = 'failure'; $script:failed = $true }
  $script:steps[$name] = $outcome
  Write-Output "  $name=$outcome git-grep-exit=$code"
  if ($code -ne 1) { Get-Content $script:jobLog -Tail 18 | Write-Output }
}
function End-Job([string]$job, [hashtable]$measurements = @{}) {
  $conclusion = if ($script:failed) { 'failure' } else { 'success' }
  $record = [ordered]@{ job = $job; conclusion = $conclusion; steps = $script:steps }
  if ($measurements.Count -gt 0) { $record.measurements = $measurements }
  $path = Join-Path $artifacts ($job + '.json')
  $record | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $path
  Write-Output "  JOB CONCLUSION $conclusion; artifact=$path"
}
function Copy-IfPresent([string]$from, [string]$name) {
  if (Test-Path $from) { Copy-Item -LiteralPath $from -Destination (Join-Path $artifacts $name) -Force }
}

Start-JobLog 'test'
Invoke-Step 'syntax' $node @('scripts/check-syntax.mjs')
Invoke-Step 'plan-pin' $node @('scripts/check-plan-pin.mjs','--base',$base)
Invoke-Step 'seo' $npm @('run','seo')
Invoke-Step 'prettier' $npm @('run','format:check')
Invoke-SecretScan
Invoke-Step 'deploy-allowlist' $node @('scripts/deploy-pages-local.mjs','--check')
Invoke-Step 'cumulative-flow' $npm @('run','verify:flow')
Invoke-Step 'unit_tests' $npm @('test')
$tmPath = Join-Path $repo 'jev-artifacts/test-measurement.json'
$testMeasurements = @{}
if (Test-Path $tmPath) { $m=Get-Content $tmPath -Raw | ConvertFrom-Json; $testMeasurements=@{ tests_total=[double]$m.tests; tests_passed=[double]$m.pass; tests_failed=[double]$m.fail; tests_skipped=[double]$m.skipped } }
End-Job 'test' $testMeasurements

Start-JobLog 'web-smoke'
Invoke-Step 'smoke' $npm @('run','smoke:local')
Invoke-Step 'byte-stage' $node @('scripts/deploy-pages-local.mjs','--check','--stage','_pages_budget')
Invoke-Step 'byte-budgets' $node @('scripts/check-byte-budgets.mjs','--stage','_pages_budget')
Invoke-Step 'privacyBrowser' $node @('scripts/check-privacy-browser.mjs')
Invoke-Step 'resilience-stage' $node @('scripts/deploy-pages-local.mjs','--check','--stage','_pages_resilience')
Invoke-Step 'resilienceBrowser' $node @('scripts/check-resilience.mjs','--stage','_pages_resilience','--out',(Join-Path $artifacts 'resilience-report.json'))
Invoke-Step 'experience-stage' $node @('scripts/deploy-pages-local.mjs','--check','--stage','_pages_experience')
Invoke-Step 'experienceBrowser' $node @('scripts/check-experience.mjs','--stage','_pages_experience','--out',(Join-Path $artifacts 'experience-report.json'))
$smPath = Join-Path $repo 'jev-artifacts/smoke-measurement.json'
$smMeasurements = @{}
if (Test-Path $smPath) { $m=Get-Content $smPath -Raw | ConvertFrom-Json; $smMeasurements=@{ smoke_gates_total=[double]$m.gates_total; smoke_gates_passed=[double]$m.gates_passed; smoke_gates_failed=[double]$m.gates_failed } }
Copy-IfPresent (Join-Path $repo 'jev-artifacts/privacy-browser.json') 'privacy-browser.json'
End-Job 'web-smoke' $smMeasurements

Start-JobLog 'quality-lab'
Invoke-Step 'a11y-stage' $node @('scripts/deploy-pages-local.mjs','--check','--stage','_pages_a11y')
Invoke-Step 'a11y-matrix' $node @('scripts/check-a11y-matrix.mjs','--stage','_pages_a11y','--out',(Join-Path $artifacts 'a11y-report.json'))
End-Job 'quality-lab'

Start-JobLog 'lighthouse'
Invoke-Step 'lighthouse-stage' $node @('scripts/deploy-pages-local.mjs','--check','--stage','_pages_lighthouse')
Invoke-Step 'lighthouse' $node @('scripts/check-lighthouse.mjs','--stage','_pages_lighthouse','--out',(Join-Path $artifacts 'lighthouse-report.json'))
End-Job 'lighthouse'

Start-JobLog 'quality-evidence'
Invoke-Step 'quality-evidence' $npm @('run','gate:quality-evidence')
End-Job 'quality-evidence'

Start-JobLog 'coverage'
Invoke-Step 'coverage' $npm @('run','coverage')
End-Job 'coverage'

"RESULTS=$results" | Write-Output
"NODE=$(& $node --version) NPM=$(& $npm --version)" | Write-Output
"FINAL_STATUS=$((& git status --porcelain=v1) -join '|')" | Write-Output
