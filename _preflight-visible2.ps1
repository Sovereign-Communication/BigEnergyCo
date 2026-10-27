Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
$lines = Get-Content 'index.html'
Write-Host '===== PRE-LANDING MAIN: lines mentioning option/option-set/chooser/gridtie/offgrid ====='
foreach ($i in 0..($lines.Count-1)) {
    $ln = $lines[$i]
    if ($ln -match '(?i)data-option|option-set|chooser|gridtie|offgrid|mode=|data-mode|solar-only|battery') {
        Write-Host (($i+1).ToString('0000') + ' | ' + $ln)
    }
}
Write-Host '===== rough bounds: calculator option block start/end by searching for the smallest enclosing section ====='
$found = Select-String -Path 'index.html' -Pattern 'option-set|data-option|chooser' -CaseSensitive
if ($found) {
    Write-Host 'found option markers at lines:'
    $found | ForEach-Object { Write-Host $_.LineNumber }
} else {
    Write-Host 'no option-set/data-option/chooser markers found - dumping first 40 lines of index.html'
    foreach ($i in 1..40) { Write-Host ($i.ToString('0000') + ' | ' + $lines[$i-1]) }
}
