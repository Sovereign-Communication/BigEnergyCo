Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
Write-Host '===== PRE-LANDING MAIN index.html use-case visible markup ====='
$html = Get-Content 'index.html' -Raw -ErrorAction SilentlyContinue
$ids = @('bill-cut','battery-only','essential-load','reserve','offgrid','portable')
foreach ($id in $ids) {
    $present = $html -match ('(?i)(data-use-case|id=.*'+$id+'|use-case-'+$id+'|\b'+$id+'\b)') -or ($html -match ('(?i)usecase-'+$id))
    if ($present) {
        Write-Host "PRE-LANDING MAIN index.html references marker for $id"
    } else {
        Write-Host "PRE-LANDING MAIN index.html: no visible marker for $id - expected before slice"
    }
}
# also dump any line that already carries the literal 6-case option ids if present
Write-Host '===== PRE-LANDING MAIN: any usecase- ids already in index.html ====='
Select-String -Path 'index.html' -Pattern 'usecase-' -AllMatches -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_.Line.Trim() }
if (-not (Select-String -Path 'index.html' -Pattern 'usecase-' -Quiet -ErrorAction SilentlyContinue)) {
    Write-Host 'PRE-LANDING MAIN: no usecase- ids in index.html - expected before slice'
}
