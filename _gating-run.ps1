Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
function Run($name, $cmd) {
  $outPath = "_out_$name.txt"; $errPath = "_err_$name.txt"
  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  if (Test-Path $errPath) { Remove-Item $errPath -Force }
  $p = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command",$cmd -NoNewWindow -Wait -PassThru
  Write-Host "=== $name ==="
  Write-Host "command: $cmd"
  Write-Host "exit: $($p.ExitCode)"
  $out = if (Test-Path $outPath) { (Get-Content $outPath -Raw) } else { "" }
  $err = if (Test-Path $errPath) { (Get-Content $errPath -Raw) } else { "" }
  $combined = ($out + "`n" + $err) -split "`n" | Where-Object { $_.Trim() -ne "" }
  $tail = $combined | Select-Object -Last 40
  $tail -join "`n" | Write-Host
  Write-Host ""
}
Run "usecases-test" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; node --test tests/usecases.test.mjs > "_out_usecases-test.txt" 2> "_err_usecases-test.txt"'
Run "check-usecases" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; node scripts/check-usecases.mjs > "_out_check-usecases.txt" 2> "_err_check-usecases.txt"'
Run "check-chars" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; node scripts/check-chars.mjs > "_out_check-chars.txt" 2> "_err_check-chars.txt"'
Run "seo" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run seo > "_out_seo.txt" 2> "_err_seo.txt"'
Run "format-check" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run format:check > "_out_format-check.txt" 2> "_err_format-check.txt"'
Run "deploy-check" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run deploy:check > "_out_deploy-check.txt" 2> "_err_deploy-check.txt"'
Run "npm-test" 'Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"; npm run test > "_out_npm-test.txt" 2> "_err_npm-test.txt"'
