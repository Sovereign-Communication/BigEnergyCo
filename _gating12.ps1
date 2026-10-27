param([string]$root="C:\Users\SCM\Documents\GitHubBigEnergyCo\BigEnergyCo")
$fw="$root\.worktrees\feature-preflight"
$cwd = $fw
$outPath = "C:\Temp\npmTestOut9.txt"
$errPath = "C:\Temp\npmTestErr9.txt"
if (Test-Path $outPath) { Remove-Item $outPath -Force }
if (Test-Path $errPath) { Remove-Item $errPath -Force }
$cmd = "cd /d `"$cwd`" && npm run test > `"$outPath`" 2> `"$errPath`""
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
  Write-Host "--- FAILING TESTS SECTION (from first 'failing tests' to end) ---"
  $tail = $lines[$startIndex..($lines.Count-1)] -join "`n"
  Write-Host $tail
} else {
  Write-Host "no 'failing tests' section found"
}
Write-Host "--- STDERR tail 30 ---"
if ($err) { $err.Split("`n")[-30..-1] -join "`n" }
