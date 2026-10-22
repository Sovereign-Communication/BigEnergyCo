Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
if (-not (Test-Path "index-new.html")) { Write-Host "index-new.html MISSING"; exit }
$new = [System.IO.File]::ReadAllText("index-new.html",[System.Text.UTF8Encoding]($false))
Write-Host "index-new.html exists, length: $($new.Length)"
$matches = [regex]::Matches($new,'<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"')
Write-Host "module script src matches: $($matches.Count)"
$matches | ForEach-Object { Write-Host "  $($_.Groups[1].Value)" }
$workerMatches = [regex]::Matches($new,'new\s+Worker\(\s*"([^"]+)"')
Write-Host "worker matches: $($workerMatches.Count)"
$workerMatches | ForEach-Object { Write-Host "  $($_.Groups[1].Value)" }
