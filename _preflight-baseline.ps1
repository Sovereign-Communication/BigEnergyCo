Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
Write-Host '===== PRE-LANDING MAIN baseline: asset presence ====='
if (Test-Path 'assets/js/sizing/usecases.js') { Write-Host 'HAS assets/js/sizing/usecases.js' } else { Write-Host 'NO assets/js/sizing/usecases.js - expected before slice' }
if (Test-Path 'scripts/check-usecases.mjs') { Write-Host 'HAS scripts/check-usecases.mjs' } else { Write-Host 'NO scripts/check-usecases.mjs - expected before slice' }
if (Test-Path 'tests/usecases.test.mjs') { Write-Host 'HAS tests/usecases.test.mjs' } else { Write-Host 'NO tests/usecases.test.mjs - expected before slice' }
