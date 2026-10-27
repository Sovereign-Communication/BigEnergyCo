Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
function Run($name, $cmd) {
  $outPath = "_fg_$name.out"; $errPath = "_fg_$name.err"
  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  if (Test-Path $errPath) { Remove-Item $errPath -Force }
  $p = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command",$cmd -RedirectStandardOutput $outPath -RedirectStandardError $errPath -NoNewWindow -Wait -PassThru
  Write-Host "=== $name | exit=$($p.ExitCode) ==="
  $combined = @()
  if (Test-Path $outPath) { $combined += Get-Content $outPath -Raw }
  if (Test-Path $errPath) { $combined += Get-Content $errPath -Raw }
  ($combined -join "`n") -split "`r?`n" | Where-Object { $_.Trim() -ne "" } | Select-Object -Last 25 | Write-Host
  Write-Host ""
}
Run "check-chars" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; node scripts/check-chars.mjs'
Run "seo" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run seo'
Run "format-check" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run format:check'
Run "deploy-check" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run deploy:check'
Run "npm-test" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run test'
