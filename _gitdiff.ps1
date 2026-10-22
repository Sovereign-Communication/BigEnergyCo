Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
Write-Host "=== git status (short) ==="
& { git status --short 2>&1 } | Select-Object -First 40
Write-Host "=== git stash list ==="
& { git stash list 2>&1 }
Write-Host "=== diff HEAD --name-status ==="
& { git diff --name-status HEAD 2>&1 } | Select-Object -First 40
Write-Host "=== bytes on disk vs git HEAD blob for the files touch staging and index.html ==="
& { git ls-files --stage index.html staging-manifest.json 2>&1 } | Select-Object -First 5
$ihd = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html on disk: $ihd"
foreach ($f in @("index.html","staging-manifest.json","robots.txt")) {
  if (Test-Path $f) {
    $d = [System.IO.File]::ReadAllBytes($f).Length
    Write-Host "$f on disk: $d"
  }
}
