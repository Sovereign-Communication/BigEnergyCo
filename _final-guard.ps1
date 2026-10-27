Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
Write-Host '===== 3) final guard: what the applied slice actually touched vs clean origin/main base ====='
git status -sb
Write-Host '---- vs origin/main (only the applied slice files should appear) ----'
git diff --name-status origin/main...HEAD
$applied = git diff --name-status origin/main...HEAD
function Check-Excluded($label, $pattern) {
    $hit = $applied -match $pattern
    if ($hit) {
        Write-Host "BLOCKER: $label IS in the applied diff"
    } else {
        Write-Host "OK: $label NOT in applied diff"
    }
}
Check-Excluded 'paths.js' 'paths\.js'
Check-Excluded '.quality-evidence' '\.quality-evidence'
Check-Excluded '.jev-p03a-report.json' '\.jev-p03a-report\.json'

Write-Host '---- confirm local scratch is NOT in this clean worktree ----'
$untracked = git ls-files --others --exclude-standard
function Check-Scratch($label, $pattern) {
    $hit = $untracked -match $pattern
    if ($hit) {
        Write-Host "BLOCKER: $label present in this worktree"
    } else {
        Write-Host "OK: $label absent from this worktree"
    }
}
Check-Scratch 'admin.html' 'admin\.html'
Check-Scratch 'admin.js' 'admin\.js'
Check-Scratch 'blog-drafts/' 'blog-drafts'
Check-Scratch 'drafts/' 'drafts/'
Check-Scratch '_v7/' '_v7'
Check-Scratch 'landing-p1-use-case-tmp/' 'landing-p1-use-case-tmp'
Check-Scratch 'first-paint-weight.test.mjs' 'first-paint-weight\.test\.mjs'
Check-Scratch 'root *.py scratch' 'check_advisor\.py'

Write-Host '---- confirm the only untracked items are my preflight helper scripts ----'
foreach ($u in $untracked) { Write-Host $u }
Write-Host '===== DONE ====='
