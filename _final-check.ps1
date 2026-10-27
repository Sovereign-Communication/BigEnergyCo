Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
$outPath = "_npmTestFinal.txt"
$errPath = "_npmTestFinalErr.txt"
if (Test-Path $outPath) { Remove-Item $outPath -Force }
if (Test-Path $errPath) { Remove-Item $errPath -Force }
$expr = 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run test > "' + $outPath + '" 2> "' + $errPath + '"'
$p = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command",$expr -NoNewWindow -Wait -PassThru
Write-Host "npm-test exit=$($p.ExitCode)"
$out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
$err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
$failLines = @()
if ($out) {
  $lines = $out.Split("`n")
  $start = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "failing tests") { $start = $i; break }
  }
  if ($start -ge 0) {
    $failLines = $lines[$start..($lines.Count-1)]
  }
}
Write-Host "--- FAILING TESTS SECTION ---"
$failLines -join "`n"
Write-Host "--- STDERR tail 30 ---"
if ($err) { $err.Split("`n")[-30..-1] -join "`n" }
Write-Host "=== INDEX BYTES ==="
$b = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html bytes: $b ; under 130000: $($b -le 130000)"
Write-Host "=== TOKEN / PATCH STATE ==="
$html = [System.IO.File]::ReadAllText("index.html")
$tokens = [regex]::Matches($html,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"') | ForEach-Object { $_.Groups[2].Value }
Write-Host "index token values: $(($tokens | Select-Object -Unique) -join ' / ')"
$sw = [System.IO.File]::ReadAllText("sw.js")
Write-Host "sw.js CACHE_VERSION: $([regex]::Match($sw,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"
$ev = [System.IO.File]::ReadAllText("evidence\advisor-and-release.json")
Write-Host "evidence asset token claim: $([regex]::Match($ev,'asset token ([0-9a-z]+)').Groups[1].Value)"
Write-Host "evidence sw cache claim: $([regex]::Match($ev,'SW cache ([0-9a-z]+)').Groups[1].Value)"
Write-Host "=== DECISION ==="
if ($b -le 130000) { Write-Host "ready-if-other-gates-green: index under budget" } else { Write-Host "NOT READY: index still over budget at $b bytes" }
