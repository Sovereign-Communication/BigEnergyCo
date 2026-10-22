param([string]$root="C:\Users\SCM\Documents\GitHubBigEnergyCo\BigEnergyCo")
$fw = Join-Path $root ".worktrees\feature-preflight"
if (!(Test-Path $fw)) { Write-Host "MISSING worktree: $fw"; exit 1 }
$outPath = Join-Path $fw "_npmFresh.txt"
$errPath = Join-Path $fw "_npmFreshErr.txt"
if (Test-Path $outPath) { Remove-Item $outPath -Force }
if (Test-Path $errPath) { Remove-Item $errPath -Force }
$expr = "Set-Location -Path 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight'; node scripts/check-evidence-freshness.mjs"
$proc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command",$expr -NoNewWindow -Wait -PassThru
Write-Host "check-evidence-freshness.mjs exit=$($proc.ExitCode)"
$out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
$err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
Write-Host "--- check-evidence-freshness tail ---"
if ($out) { $out.Split("`n")[-20..-1] -join "`n" }
if ($err) { $err.Split("`n")[-20..-1] -join "`n" }

function RunTest($label,$testPath) {
  $outPath = Join-Path $fw "_t_$label.txt"
  $errPath = Join-Path $fw "_t_$label`_err.txt"
  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  if (Test-Path $errPath) { Remove-Item $errPath -Force }
  $expr = "Set-Location -Path 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight'; node --test '$testPath'"
  $proc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command",$expr -NoNewWindow -Wait -PassThru
  Write-Host "$label exit=$($proc.ExitCode)"
  $out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
  $err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
  Write-Host "--- $label tail ---"
  if ($out) { $out.Split("`n")[-24..-1] -join "`n" }
  if ($err) { $err.Split("`n")[-24..-1] -join "`n" }
}
RunTest "evidence-freshness" "tests\evidence-freshness.test.mjs"
RunTest "gate-self-audit" "tests\gate-self-audit.test.mjs"

Write-Host "=== INDEX BYTES ==="
$b = [System.IO.File]::ReadAllBytes((Join-Path $fw "index.html")).Length
Write-Host "index.html bytes: $b ; under 130000: $($b -le 130000)"
