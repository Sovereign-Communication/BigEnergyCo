Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
$pkg = $null
if (Test-Path 'package.json') {
    $raw = Get-Content 'package.json' -Raw -ErrorAction SilentlyContinue
    if ($raw) { $pkg = $raw | ConvertFrom-Json }
}
$npm = $env:NPM_EXEC_PATH
if (-not $npm -or -not (Get-Command $npm -ErrorAction SilentlyContinue)) { $npm = 'npm' }

function Run-Exit($label, $cmd, $args_) {
    Write-Host "===== $label ====="
    $p = Start-Process $cmd -ArgumentList $args_ -NoNewWindow -PassThru -Wait
    $rc = $p.ExitCode
    Write-Host "$label rc=$rc"
    if ($rc -ne 0) {
        Write-Host "[NON-ZERO EXIT] $label"
    } else {
        Write-Host "[EXIT 0] $label"
    }
}

Run-Exit 'node --test tests/usecases.test.mjs' 'node' @('--test', 'tests/usecases.test.mjs')
Run-Exit 'node scripts/check-usecases.mjs' 'node' @('scripts/check-usecases.mjs')
Run-Exit 'node scripts/check-chars.mjs' 'node' @('scripts/check-chars.mjs')

if ($null -ne $pkg -and $pkg.PSObject.Properties.Name -contains 'scripts') {
    $wanted = @('seo','format:check','deploy:check','format','test')
    foreach ($k in $wanted) {
        if ($pkg.scripts.PSObject.Properties.Name -contains $k) {
            $cmd = $pkg.scripts.$k
            if ($cmd -match '^npm\s') {
                Run-Exit "npm run $k" $npm @('run', $k)
            } elseif ($cmd -match '^\s*"?node\s') {
                $remain = $cmd -replace '^\s*"?node\s*', '' -replace '"?\s*$', ''
                $nodeArgs = $remain -split '\s+'
                Run-Exit "npm run $k (as node)" 'node' $nodeArgs
            } else {
                Run-Exit "npm run $k (npm passthrough)" $npm @('run', $k)
            }
        } else {
            Write-Host "npm script '$k' NOT DEFINED in package.json - skipped"
        }
    }
} else {
    Write-Host 'package.json not present or has no scripts - skipped npm gates'
}
