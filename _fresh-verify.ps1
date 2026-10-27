param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$fw = Join-Path $root ".worktrees\feature-preflight"
if (!(Test-Path $fw)) { Write-Host "MISSING worktree: $fw"; exit 1 }
Set-Location $fw
function Run($label,$cmd) {
  $outPath = "$fw\_run_$label.txt"
  $errPath = "$fw\_run_$label`_err.txt"
  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  if (Test-Path $errPath) { Remove-Item $errPath -Force }
  $proc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command",$cmd -NoNewWindow -Wait -PassThru
  Write-Host "$label exit=$($proc.ExitCode)"
  $out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
  $err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
  Write-Host "--- $label tail ---"
  if ($out) { $out.Split("`n")[-24..-1] -join "`n" }
  if ($err) { $err.Split("`n")[-24..-1] -join "`n" }
}
Run "check-evidence-freshness" "Set-Location -Path '$fw'; node scripts/check-evidence-freshness.mjs"
Run "evidence-freshness-test" "Set-Location -Path '$fw'; node --test 'tests\evidence-freshness.test.mjs'"
Run "gate-self-audit-test" "Set-Location -Path '$fw'; node --test 'tests\gate-self-audit.test.mjs'"
Write-Host "=== INDEX BYTES ==="
$b = [System.IO.File]::ReadAllBytes("$fw\index.html").Length
Write-Host "index.html bytes: $b ; under 130000: $($b -le 130000)"
