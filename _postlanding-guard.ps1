Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
Write-Host '===== post-landing guard: confirm no paths.js / .quality-evidence / .jev-p0* landed on main-landing (exact match) ====='
$tree = git ls-tree --name-only -r HEAD
$hasPaths = $tree -cmatch 'assets/js/sizing/paths\.js'
Write-Host 'paths.js (exact) on HEAD : '
if ($hasPaths) { Write-Host '  PRESENT-UNEXPECTED' } else { Write-Host '  ABSENT-expected' }
$hasQE = $tree -cmatch '\.quality-evidence/'
Write-Host '.quality-evidence/ (exact) on HEAD : '
if ($hasQE) { Write-Host '  PRESENT-UNEXPECTED' } else { Write-Host '  ABSENT-expected' }
$hasJev = $tree -cmatch '\.jev-p03a-report\.json'
Write-Host '.jev-p03a-report.json (exact) on HEAD : '
if ($hasJev) { Write-Host '  PRESENT-UNEXPECTED' } else { Write-Host '  ABSENT-expected' }
Write-Host '===== post-landing index.html diffstat vs main baseline ====='
git diff --stat origin/main...HEAD
Write-Host '===== DONE ====='
