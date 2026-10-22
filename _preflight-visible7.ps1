Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
$html = Get-Content 'index.html' -Raw
$lines = Get-Content 'index.html'
Write-Host '===== PRE-LANDING MAIN: which use-case option values already exist in index.html ====='
$opts = Select-String -Path 'index.html' -Pattern '<option value="(billcut|tou|backup|reserve|offgrid|portable)"' -AllMatches
if ($opts) {
    Write-Host 'Existing visible use-case option values in PRE-LANDING MAIN index.html:'
    $opts.Matches | ForEach-Object { Write-Host $_.Value.Trim() }
} else {
    Write-Host 'none'
}
Write-Host '===== evidence the 6-case visible id/label surface is NOT on PRE-LANDING MAIN ====='
$anyId = $false
$checks = @('usecase-bill-cut','usecase-battery-only','usecase-essential-load','usecase-reserve','usecase-offgrid','usecase-portable')
foreach ($c in $checks) {
    if ($html -match ('(?i)' + [regex]::Escape('id="usecase-' + $c.Substring(8) + '"'))) { $anyId = $true }
}
Write-Host 'any usecase-<case> id present : ' + $anyId
Write-Host '===== existing locale keys for the use-case chooser in PRE-LANDING MAIN (context) ====='
$keys = @('useCaseLabel','useCaseBillCut','useCaseTou','useCaseBackup','useCaseReserve','useCaseOffGrid','useCasePortable')
foreach ($k in $keys) {
    $present = $html -match ('(?i)data-i18n="' + $k + '"')
    $status = 'NOT PRESENT'
    if ($present) { $status = 'PRESENT' }
    Write-Host ('key ' + $k + ' : ' + $status)
}
