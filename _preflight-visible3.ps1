Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
$lines = Get-Content 'index.html'
Write-Host '===== PRE-LANDING MAIN: calculator mode/goal chooser block (lines 1465-1545) ====='
foreach ($i in 1465..1545) {
    if ($i -le $lines.Count) { Write-Host ($i.ToString('0000') + ' | ' + $lines[$i-1]) }
}
