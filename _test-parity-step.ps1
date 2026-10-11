Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
Write-Host "=== BEFORE: INDEX BYTES / TOKEN STATE ==="
$b = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html bytes: $b"
$html = [System.IO.File]::ReadAllText("index.html",[System.Text.UTF8Encoding]($false))
$tokens = [regex]::Matches($html,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"') | ForEach-Object { $_.Groups[2].Value }
Write-Host "index token values: $(($tokens | Select-Object -Unique) -join ' / ')"
$sw = [System.IO.File]::ReadAllText("sw.js")
Write-Host "sw.js CACHE_VERSION: $([regex]::Match($sw,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"

Write-Host "=== STASHING WORK TREE EDITS ==="
$s = & { git stash push -u -m "parity-check-script-work" 2>&1 }
Write-Host "stash exit=$LASTEXITCODE"
Write-Host "stash output: $s"

Write-Host "=== CLEAN-COMMIT RUN: deploy:check ==="
$outPath = "_do.txt"; $errPath = "_de.txt"
if (Test-Path $outPath) { Remove-Item $outPath -Force }
if (Test-Path $errPath) { Remove-Item $errPath -Force }
$p = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command","Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight'; npm run deploy:check > '_dc.txt' 2> '_dcr.txt'" -NoNewWindow -Wait -PassThru
Write-Host "npm run deploy:check exit=$($p.ExitCode)"
Write-Host "--- deploy:check tail ---"
if (Test-Path "_dc.txt") { (Get-Content "_dc.txt" -Raw).Split("`n")[-12..-1] -join "`n" }
if (Test-Path "_dcr.txt") { (Get-Content "_dcr.txt" -Raw).Split("`n")[-12..-1] -join "`n" }

Write-Host "=== CLEAN-COMMIT RUN: npm test ==="
$outPath2 = "_tn.txt"; $errPath2 = "_tnerr.txt"
if (Test-Path $outPath2) { Remove-Item $outPath2 -Force }
if (Test-Path $errPath2) { Remove-Item $errPath2 -Force }
$p2 = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command","Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight'; npm run test > '_nt.txt' 2> '_nterr.txt'" -NoNewWindow -Wait -PassThru
Write-Host "npm run test exit=$($p2.ExitCode)"
Write-Host "--- npm test tail ---"
if (Test-Path "_nt.txt") { (Get-Content "_nt.txt" -Raw).Split("`n")[-18..-1] -join "`n" }
if (Test-Path "_nterr.txt") { (Get-Content "_nterr.txt" -Raw).Split("`n")[-18..-1] -join "`n" }

Write-Host "=== AFTER CLEAN RUN (STILL STASHED): INDEX BYTES / TOKEN STATE ==="
$b2 = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html bytes: $b2"
$html2 = [System.IO.File]::ReadAllText("index.html",[System.Text.UTF8Encoding]($false))
$tokens2 = [regex]::Matches($html2,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"') | ForEach-Object { $_.Groups[2].Value }
Write-Host "index token values: $(($tokens2 | Select-Object -Unique) -join ' / ')"
$sw2 = [System.IO.File]::ReadAllText("sw.js")
Write-Host "sw.js CACHE_VERSION: $([regex]::Match($sw2,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"

Write-Host "=== RESTORING STASH ==="
$rp = & { git stash pop -q 2>&1 }
Write-Host "pop exit=$LASTEXITCODE"
Write-Host "pop output: $rp"

Write-Host "=== AFTER RESTORE: INDEX BYTES / TOKEN STATE ==="
$b3 = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html bytes: $b3"
$html3 = [System.IO.File]::ReadAllText("index.html",[System.Text.UTF8Encoding]($false))
$tokens3 = [regex]::Matches($html3,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"') | ForEach-Object { $_.Groups[2].Value }
Write-Host "index token values: $(($tokens3 | Select-Object -Unique) -join ' / ')"
$sw3 = [System.IO.File]::ReadAllText("sw.js")
Write-Host "sw.js CACHE_VERSION: $([regex]::Match($sw3,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"
