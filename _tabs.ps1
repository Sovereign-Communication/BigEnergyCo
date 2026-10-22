Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
$bytes = [System.IO.File]::ReadAllBytes("index.html")
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$headEnd = $text.IndexOf("<script type=`"application/ld+json`">", [StringComparison]::Ordinal)
$head = $text.Substring(0, $headEnd)
Write-Host "head text length: $($head.Length)"
$tabCount = ([regex]::Matches($head, "`t")).Count
$spaceCount = ([regex]::Matches($head, " "))
Write-Host "tabs in head: $tabCount"
Write-Host "spaces in head: $spaceCount"
$newHead = $head -replace "`t", "  "
Write-Host "head if tabs->2 spaces length: $($newHead.Length)"
$newHead2 = $head -replace "`t", ""
Write-Host "head if tabs removed length: $($newHead2.Length)"
