Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
Write-Host "=== rev-parse ==="
& { git rev-parse HEAD } | Select-Object -First 1
& { git rev-parse --abbrev-ref HEAD } | Select-Object -First 1
Write-Host "=== status -sb ==="
& { git status -sb } | Select-Object -First 40
Write-Host "=== diff HEAD --stat ==="
& { git diff --stat HEAD } | Select-Object -First 30
Write-Host "=== files differing from index (git diff --name-only) ==="
& { git diff --name-only } | Select-Object -First 40
Write-Host "=== files differing from index, by byte (git diff --numstat) ==="
& { git diff --numstat } | Select-Object -First 40
Write-Host "=== index.html in HEAD vs working tree ==="
$headBytes = [int](& { git cat-file -s HEAD:index.html })
$workBytes = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "HEAD index.html bytes: $headBytes"
Write-Host "working index.html bytes: $workBytes"
Write-Host "diff: $($workBytes - $headBytes)"
Write-Host "=== compare against main/refs/heads/main if reachable ==="
& { git ls-remote origin main } | Select-Object -First 5
