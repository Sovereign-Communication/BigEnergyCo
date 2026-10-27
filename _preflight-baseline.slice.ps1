Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
$html = Get-Content 'index.html' -Raw
$lines = Get-Content 'index.html'
$cases = @('bill-cut','battery-only','essential-load','reserve','offgrid','portable')
Write-Host '===== PRE-LANDING MAIN: 6-case visible option presence (calc option set) ====='
foreach ($c in $cases) {
    $idAttr = $html -match ('(?i)data-use-case="' + $c + '"')
    $label = Select-String -InputObject $html -Pattern ('(?i)data-use-case="' + $c + '"' + '.{0,120}')
    Write-Host "case $c : data-use-case attr=$idAttr"
    if ($label) { Write-Host ('   ctx: ' + ($label.Matches[0].Value -replace '\s+',' ').Trim()) }
}
Write-Host '===== PRE-LANDING MAIN: any usecase-/data-use-case= tokens in index.html ====='
$m = Select-String -Path 'index.html' -Pattern 'usecase-|data-use-case=' -AllMatches
if ($m) { $m | ForEach-Object { Write-Host $_.Line.Trim() } }
else { Write-Host 'none' }
