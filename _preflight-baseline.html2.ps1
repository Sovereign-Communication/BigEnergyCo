Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
Write-Host '===== PRE-LANDING MAIN index.html per-case visible option presence ====='
$html = Get-Content 'index.html' -Raw
$cases = @('bill-cut','battery-only','essential-load','reserve','offgrid','portable')
foreach ($c in $cases) {
    $full = 'usecase-'+$c
    $idAttr = $html -match ('(?i)data-use-case="' + $c + '"')
    $idLiteral = $html -match ('usecase-' + $c)
    Write-Host "case $c : data-use-case attr=$idAttr  literal usecase-$c id=$idLiteral"
}
Write-Host '===== lines carrying usecase- ids in PRE-LANDING MAIN index.html ====='
Select-String -Path 'index.html' -Pattern 'usecase-|data-use-case=' -AllMatches | ForEach-Object { Write-Host $_.Line.Trim() }
if (-not (Select-String -Path 'index.html' -Pattern 'usecase-|data-use-case=' -Quiet)) {
    Write-Host 'PRE-LANDING MAIN: no usecase-/data-use-case= tokens in index.html - expected before slice'
}
