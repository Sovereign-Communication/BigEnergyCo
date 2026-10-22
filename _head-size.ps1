Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
$new = [System.IO.File]::ReadAllText("index-new.html",[System.Text.UTF8Encoding]($false))
$old = [System.IO.File]::ReadAllText("index.html",[System.Text.UTF8Encoding]($false))
$needle = "<script type=`"application/ld+json`">"
$newHead = $new.Substring(0, $new.IndexOf($needle, [StringComparison]::Ordinal))
$oldHead = $old.Substring(0, $old.IndexOf($needle, [StringComparison]::Ordinal))
Write-Host "index-new.html total bytes: $([System.IO.File]::ReadAllBytes('index-new.html').Length)"
Write-Host "index.html total bytes: $([System.IO.File]::ReadAllBytes('index.html').Length)"
Write-Host "new head length: $($newHead.Length)"
Write-Host "old head length: $($oldHead.Length)"
Write-Host "head savings: $($oldHead.Length - $newHead.Length)"
