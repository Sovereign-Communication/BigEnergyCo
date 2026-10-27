Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
Write-Host '===== feature branch structural probes ====='
Write-Host 'feature head: ' + (git rev-parse origin/feat/use-case-engine)

function Present($path) {
    $ok = $false
    try {
        git show origin/feat/use-case-engine:$path > $null 2>&1
        $ok = $true
    } catch {
        $ok = $false
    }
    Write-Host "$path on feature : " + ($ok ? 'YES' : 'NO')
}

Present 'assets/js/sizing/usecases.js'
Present 'assets/js/sizing/run.js'
Present 'assets/js/sizing/ui.js'
Present 'tests/usecases.test.mjs'
Present 'scripts/check-usecases.mjs'

$html = git show origin/feat/use-case-engine:index.html 2>$null
Write-Host '20261008a in feature index.html : ' + (($html -match '20261008a') ? 'YES' : 'NO')
Write-Host '20261005h in feature index.html : ' + (($html -match '20261005h') ? 'YES' : 'NO')
Write-Host 'beco-v109 in feature sw.js : ' + (($(git show origin/feat/use-case-engine:assets/js/turnstile-client.js 2>$null) -match 'beco-v109') ? 'YES' : 'NO')

# exclusion probes
function Excluded($pattern) {
    $tree = git ls-tree --name-only -r origin/feat/use-case-engine
    $hit = $tree -match $pattern
    Write-Host "$pattern on feature : " + ($hit ? 'PRESENT' : 'ABSENT')
}
Excluded 'paths\.js'
Excluded '\.quality-evidence/'
Excluded '\.jev-p03a-report\.json'

# diffstat vs main to see the feature's own declared footprint
Write-Host '===== feature diffstat vs origin/main ====='
git diff --stat origin/main...origin/feat/use-case-engine
