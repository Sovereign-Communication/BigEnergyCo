Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
Write-Host "=== committed blob sizes for the files the test actually reads ==="
foreach ($path in @("index.html","staging/index.html")) {
  if (Test-Path $path) {
    $b = [System.IO.File]::ReadAllBytes($path).Length
    Write-Host "$path on disk: $b"
  } else {
    Write-Host "$path on disk: MISSING"
  }
}
Write-Host "=== committed blob sizes from git ==="
& { git cat-file -s HEAD:index.html 2>&1 }
& { git cat-file -s HEAD:staging/index.html 2>&1 }
Write-Host "=== staging-manifest.json exists? ==="
Test-Path staging-manifest.json
Test-Path staging/staging-manifest.json
Write-Host "=== git diff --staged for index.html byte diff ==="
& { git diff --stat HEAD -- index.html 2>&1 }
Write-Host "=== on-disk index.html encoding sanity ==="
$h = [System.IO.File]::ReadAllText("index.html",[System.Text.UTF8Encoding]($false))
Write-Host "index.html string length: $($h.Length)"
Write-Host "index.html disk bytes: $([System.IO.File]::ReadAllBytes('index.html').Length)"
Write-Host "index.html utf8-roundtrip bytes: $([System.Text.Encoding]::UTF8.GetBytes($h).Length)"
Write-Host "=== SME token state ==="
$tokens = [regex]::Matches($h,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"') | ForEach-Object { $_.Groups[2].Value }
Write-Host "index token values: $(($tokens | Select-Object -Unique) -join ' / ')"
$sw = [System.IO.File]::ReadAllText("sw.js")
Write-Host "sw.js CACHE_VERSION: $([regex]::Match($sw,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"
Write-Host "=== diff HEAD --index.html (first 200 lines) ==="
& { git diff HEAD -- index.html 2>&1 } | Select-Object -First 200
