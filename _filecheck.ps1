Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
$b = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "disk bytes: $b"
$h = [System.IO.File]::ReadAllText("index.html",[System.Text.UTF8Encoding]($false))
$c = [System.Text.Encoding]::UTF8.GetBytes($h)
Write-Host "utf8-redecode bytes: $($c.Length)"
Write-Host "string length: $($h.Length)"
Write-Host "diff disk-string: $(($b - $h.Length))"
