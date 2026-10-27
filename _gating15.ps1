param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$fw = Join-Path $root ".worktrees\feature-preflight"
if (!(Test-Path $fw)) { Write-Host "missing: $fw"; exit 1 }
Set-Location $fw
$outPath = "$fw\_npmTestOut.txt"
$errPath = "$fw\_npmTestErr.txt"
if (Test-Path $outPath) { Remove-Item $outPath -Force }
if (Test-Path $errPath) { Remove-Item $errPath -Force }
$cmd = "cd /d `"$fw`" && npm run test > `"$outPath`" 2> `"$errPath`""
Write-Host "running: $cmd"
$p = Start-Process -FilePath "cmd" -ArgumentList "/c","$cmd" -NoNewWindow -Wait -PassThru
Write-Host "exit=$($p.ExitCode)"
$out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
$err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
$lines = $out.Split("`n")
$startIndex = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match "failing tests") { $startIndex = $i; break }
}
if ($startIndex -ge 0) {
  Write-Host "--- FAILING TESTS SECTION (first 'failing tests' to end) ---"
  ($lines[$startIndex..($lines.Count-1)] -join "`n") -replace "`r",""
} else {
  Write-Host "no 'failing tests' section found"
}
Write-Host "--- STDERR tail 30 ---"
if ($err) { ($err.Split("`n")[-30..-1] -join "`n") -replace "`r","" }
