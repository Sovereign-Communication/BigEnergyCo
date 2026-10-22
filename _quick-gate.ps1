Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
function Run($name, $cmd) {
  $outPath = "_quick_$name.stdout"; $errPath = "_quick_$name.stderr"
  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  if (Test-Path $errPath) { Remove-Item $errPath -Force }
  $p = Start-Process -FilePath "node" -ArgumentList $cmd -NoNewWindow -Wait -PassThru
  Write-Host "=== $name | exit=$($p.ExitCode) ==="
  $out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
  $err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
  ($out + "`n" + $err) -split "`r?`n" | Where-Object { $_.Trim() -ne "" } | Select-Object -Last 30 | Write-Host
  Write-Host ""
}
Run "check-chars" 'scripts/check-chars.mjs'
Run "format-check" 'C:\Users\SCM\AppData\Roaming\npm\node_modules\.bin\prettier.cmd --check .'
