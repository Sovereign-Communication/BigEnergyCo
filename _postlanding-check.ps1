Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
Write-Host '===== post-landing guard: confirm no paths.js and no trailing-scope trees landed on main-landing ====='
if (Test-Path 'assets/js/sizing/paths.js') { Write-Host 'PATHS.JS PRESENT - UNEXPECTED' } else { Write-Host 'PATHS.JS ABSENT - expected' }
if (Test-Path '.quality-evidence') { Write-Host '.QUALITY-EVIDENCE PRESENT - UNEXPECTED' } else { Write-Host '.QUALITY-EVIDENCE ABSENT - expected' }
if (Test-Path '.jev-p03a-report.json') { Write-Host '.JEV P03 REPORT PRESENT - UNEXPECTED' } else { Write-Host '.JEV P03 REPORT ABSENT - expected' }
if (Test-Path 'landing-p1-use-case-tmp') { Write-Host 'landing-p1-use-case-tmp PRESENT - UNEXPECTED' } else { Write-Host 'landing-p1-use-case-tmp ABSENT - expected' }
Write-Host '===== post-landing index.html diffstat vs main baseline (should be only the stamp + use-case block) ====='
git diff --stat origin/main...HEAD
Write-Host '===== DONE ====='
