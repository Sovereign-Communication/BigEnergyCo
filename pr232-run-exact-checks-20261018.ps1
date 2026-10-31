$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false
$nodeDir = "C:\tmp\node-v22.23.3-win-x64"
$env:PATH = $nodeDir + ";" + $env:PATH
$node = Join-Path $nodeDir "node.exe"
$npm = (Get-Command npm.cmd).Source
$root = (Get-Location).Path
$runRoot = "C:\tmp\pr232-exact-checks-20261018"
$logs = Join-Path $runRoot "logs"
$artifacts = Join-Path $runRoot "artifacts"
$jevOut = Join-Path $root "jev-artifacts"
New-Item -ItemType Directory -Force -Path $logs,$artifacts,$jevOut | Out-Null
$script:results = [ordered]@{}
$script:logs = $logs
function Invoke-Check {
  param([string]$Job,[string]$Name,[string]$Executable,[string[]]$Arguments)
  if (-not $script:results.Contains($Job)) { $script:results[$Job] = [ordered]@{} }
  $safeName = ($Job + "-" + $Name) -replace "[^A-Za-z0-9_-]","_"
  $log = Join-Path $script:logs ($safeName + ".log")
  $started = Get-Date
  try {
    & $Executable @Arguments *> $log
    $code = $LASTEXITCODE
    if ($null -eq $code) { $code = 0 }
  } catch {
    $_ | Out-String | Set-Content -LiteralPath $log
    $code = 127
  }
  $outcome = if ($code -eq 0) { "success" } else { "failure" }
  $script:results[$Job][$Name] = $outcome
  $elapsed = [Math]::Round(((Get-Date) - $started).TotalSeconds,1)
  Write-Host ("[" + $Job + "] " + $Name + " " + $outcome + " (exit " + $code + ", " + $elapsed + "s); log: " + $log)
  if ($code -ne 0) { Get-Content -LiteralPath $log -Tail 22 | ForEach-Object { Write-Host $_ } }
  return $outcome
}
function Invoke-SecretScan {
  $job = "test"
  if (-not $script:results.Contains($job)) { $script:results[$job] = [ordered]@{} }
  $log = Join-Path $script:logs "test-secret-scan.log"
  $pattern = 'oauth_toke[n]|BEGIN [A-Z ]*PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|sk-live-[0-9A-Za-z]{10,}|ghp_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_-]{10,}|xox[bap]-[0-9A-Za-z-]+|GROQ_API_KEY\s*=\s*["'']?gsk_[0-9A-Za-z]+'
  & git grep -qE $pattern -- . ':!*.lock' 2>$null 1>$null
  $code = $LASTEXITCODE
  if ($code -eq 1) {
    $outcome = "success"
    "Secret scan clean: no tracked-file matches." | Set-Content -LiteralPath $log
  } elseif ($code -eq 0) {
    $outcome = "failure"
    "Secret scan failed: matching tracked content exists; match details suppressed." | Set-Content -LiteralPath $log
    Write-Host "[test] secret-scan failure (match details suppressed)"
  } else {
    $outcome = "failure"
    "Secret scan failed to run (git grep exit $code)." | Set-Content -LiteralPath $log
    Write-Host ("[test] secret-scan failure (scanner exit " + $code + ")")
  }
  $script:results[$job]["secret_scan"] = $outcome
}
function Write-Job {
  param([string]$Job,$Measurements)
  $steps = $script:results[$Job]
  $conclusion = if (@($steps.Values | Where-Object { $_ -ne "success" }).Count -eq 0) { "success" } else { "failure" }
  $record = [ordered]@{job=$Job;conclusion=$conclusion;steps=$steps}
  if ($Measurements -and $Measurements.Count -gt 0) { $record.measurements = $Measurements }
  $path = Join-Path $artifacts ($Job + ".json")
  [IO.File]::WriteAllText($path, (($record | ConvertTo-Json -Depth 5) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
  Write-Host ("[" + $Job + "] recorded local measured outcomes: " + $conclusion)
}
function Read-Measurements {
  param([string]$Path,[hashtable]$Map)
  if (-not (Test-Path -LiteralPath $Path)) { return @{} }
  $source = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  $out = @{}
  foreach ($key in $Map.Keys) {
    $field = $Map[$key]
    if ($null -ne $source.$field) { $out[$key] = $source.$field }
  }
  return $out
}
Write-Host ("Snapshot worktree: " + $root)
Write-Host ("Node: " + (& $node --version))
# test job
Invoke-Check test syntax $node @("scripts/check-syntax.mjs") | Out-Null
Invoke-Check test plan $node @("scripts/check-plan-pin.mjs") | Out-Null
Invoke-Check test seo $npm @("run","seo") | Out-Null
Invoke-Check test prettier $npm @("run","format:check") | Out-Null
Invoke-SecretScan
Invoke-Check test deploy_allowlist $node @("scripts/deploy-pages-local.mjs","--check") | Out-Null
Invoke-Check test flow $npm @("run","verify:flow") | Out-Null
Invoke-Check test unit_tests $npm @("test") | Out-Null
$testMeasurements = Read-Measurements (Join-Path $jevOut "test-measurement.json") @{tests_total="tests";tests_passed="pass";tests_failed="fail";tests_skipped="skipped"}
Write-Job test $testMeasurements
# web-smoke job
Invoke-Check web-smoke smoke $npm @("run","smoke:local") | Out-Null
Invoke-Check web-smoke budget_stage $node @("scripts/deploy-pages-local.mjs","--check","--stage","_pages_budget") | Out-Null
Invoke-Check web-smoke byte_budgets $node @("scripts/check-byte-budgets.mjs","--stage","_pages_budget") | Out-Null
Invoke-Check web-smoke privacyBrowser $node @("scripts/check-privacy-browser.mjs") | Out-Null
Invoke-Check web-smoke resilience_stage $node @("scripts/deploy-pages-local.mjs","--check","--stage","_pages_resilience") | Out-Null
Invoke-Check web-smoke resilienceBrowser $node @("scripts/check-resilience.mjs","--stage","_pages_resilience","--out",(Join-Path $jevOut "resilience-report.json")) | Out-Null
Invoke-Check web-smoke experience_stage $node @("scripts/deploy-pages-local.mjs","--check","--stage","_pages_experience") | Out-Null
Invoke-Check web-smoke experienceBrowser $node @("scripts/check-experience.mjs","--stage","_pages_experience","--out",(Join-Path $jevOut "experience-report.json")) | Out-Null
$smokeMeasurements = Read-Measurements (Join-Path $jevOut "smoke-measurement.json") @{smoke_gates_total="gates_total";smoke_gates_passed="gates_passed";smoke_gates_failed="gates_failed"}
Write-Job web-smoke $smokeMeasurements
# quality-lab job
Invoke-Check quality-lab a11y_stage $node @("scripts/deploy-pages-local.mjs","--check","--stage","_pages_a11y") | Out-Null
Invoke-Check quality-lab a11y-matrix $node @("scripts/check-a11y-matrix.mjs","--stage","_pages_a11y","--out",(Join-Path $jevOut "a11y-report.json")) | Out-Null
Write-Job quality-lab @{}
# lighthouse job
Invoke-Check lighthouse lighthouse_stage $node @("scripts/deploy-pages-local.mjs","--check","--stage","_pages_lighthouse") | Out-Null
Invoke-Check lighthouse lighthouse $node @("scripts/check-lighthouse.mjs","--stage","_pages_lighthouse","--out",(Join-Path $jevOut "lighthouse-report.json")) | Out-Null
Write-Job lighthouse @{}
# quality-evidence and coverage jobs
Invoke-Check quality-evidence quality_evidence $npm @("run","gate:quality-evidence") | Out-Null
Write-Job quality-evidence @{}
Invoke-Check coverage coverage $npm @("run","coverage") | Out-Null
Write-Job coverage @{}
# Copy only gate reports measured by this run into the builder's input directory.
foreach ($name in @("privacy-browser.json","resilience-report.json","experience-report.json","lighthouse-report.json")) {
  $source = Join-Path $jevOut $name
  if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $artifacts $name) -Force }
}
$summary = [ordered]@{
  snapshot = (git rev-parse HEAD).Trim()
  node = (& $node --version)
  artifacts = $artifacts
  jobs = [ordered]@{}
}
foreach ($job in $script:results.Keys) {
  $steps = $script:results[$job]
  $summary.jobs[$job] = [ordered]@{
    conclusion = if (@($steps.Values | Where-Object { $_ -ne "success" }).Count -eq 0) { "success" } else { "failure" }
    steps = $steps
  }
}
$summaryPath = Join-Path $runRoot "summary.json"
[IO.File]::WriteAllText($summaryPath, (($summary | ConvertTo-Json -Depth 7) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
Write-Host ("Summary: " + $summaryPath)