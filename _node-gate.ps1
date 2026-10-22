Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
$node = "C:\Program Files\nodejs\node.exe"
function Run($name, $args) {
  $outPath = "_node_$name.stdout"; $errPath = "_node_$name.stderr"
  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  if (Test-Path $errPath) { Remove-Item $errPath -Force }
  $p = Start-Process -FilePath $node -ArgumentList $args -NoNewWindow -Wait -PassThru
  Write-Host "=== $name | exit=$($p.ExitCode) ==="
  $out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
  $err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
  ($out + "`n" + $err) -split "`r?`n" | Where-Object { $_.Trim() -ne "" } | Select-Object -Last 30 | Write-Host
  Write-Host ""
}
Run "check-chars" 'scripts/check-chars.mjs'
Run "format-check" 'node_modules\.bin\prettier --check .'
