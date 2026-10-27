Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
$html = Get-Content 'index.html' -Raw
$lines = Get-Content 'index.html'
Write-Host '===== PRE-LANDING MAIN calculator option set ====='
$idx = $lines | Select-String -Pattern 'data-use-case' -CaseSensitive
if ($idx) {
    Write-Host 'PRE-LANDING MAIN has data-use-case nodes; dumping context around each:'
    foreach ($m in $idx) {
        $ln = $m.LineNumber
        $start = [Math]::Max(1, $ln - 2)
        $end = [Math]::Min($lines.Count, $ln + 2)
        Write-Host ('----- around line ' + $ln + ' -----')
        foreach ($i in $start..$end) {
            Write-Host ($i.ToString('0000') + ' | ' + $lines[$i-1])
        }
    }
} else {
    Write-Host 'PRE-LANDING MAIN has NO data-use-case nodes in index.html (expected before slice)'
}
Write-Host '===== explicit literal usecase- ids in PRE-LANDING MAIN index.html ====='
Select-String -Path 'index.html' -Pattern 'usecase-' -AllMatches -CaseSensitive | ForEach-Object { Write-Host $_.Line.Trim() }
if (-not (Select-String -Path 'index.html' -Pattern 'usecase-' -Quiet -CaseSensitive)) {
    Write-Host 'NONE: no usecase- ids in PRE-LANDING MAIN index.html - expected before the slice lands'
}
