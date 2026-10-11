param([string]$root="C:\Users\SCM\Documents\GitHubBigEnergyCo\BigEnergyCo")
$fw = Join-Path $root ".worktrees\feature-preflight"
Set-Location $fw
$changed = @()
function Apply($file,$find,$repl) {
  $p = Join-Path $fw $file
  if (!(Test-Path $p)) { Write-Host "missing $file"; return }
  $s = [System.IO.File]::ReadAllText($p,[System.Text.UTF8Encoding]($false))
  $b = $s.Length
  $c = $s.Replace($find,$repl,[System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($c -eq $s) { Write-Host "no-op $file" } else { [System.IO.File]::WriteAllText($p,$c,[System.Text.UTF8Encoding]($false)); $changed += "$file: $find -> $repl" }
}
Apply "index.html" 'src="\./assets/js/sizing/ui\.js?v=20261005h"' 'src="\./assets/js/sizing/ui\.js?v=20261008a"'
Apply "index.html" 'src="\./assets/js/turnstile-client\.js?v=20261005h"' 'src="\./assets/js/turnstile-client\.js?v=20261008a"'
Apply "index.html" 'src="\./assets/js/chat\.js?v=20261005h"' 'src="\./assets/js/chat\.js?v=20261008a"'
Apply "index.html" 'href="\./assets/site\.css?v=20261005h"' 'href="\./assets/site\.css?v=20261008a"'
Apply "sw.js" 'CACHE_VERSION = "beco-v108"' 'CACHE_VERSION = "beco-v109"'
Apply "robots.txt" '20261005h' '20261008a'
Write-Host "=== PATCHES APPLIED ==="
$changed -join "`n"
Write-Host "=== POST-PATCH VALUES ==="
$html = [System.IO.File]::ReadAllText("index.html")
$html.IndexOf('id="useCaseRow"') | ForEach-Object { Write-Host "useCaseRow still present: yes (at char $_)" }
[regex]::Matches($html,'src="\./assets/js/sizing/ui\.js?v=([0-9a-z]+)"') | ForEach-Object { Write-Host "ui token now: $($_.Groups[1].Value)" }
[regex]::Matches($html,'href="\./assets/site\.css?v=([0-9a-z]+)"') | ForEach-Object { Write-Host "css token now: $($_.Groups[1].Value)" }
$sw = [System.IO.File]::ReadAllText("sw.js")
Write-Host "CACHE_VERSION now: $([regex]::Match($sw,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"
$robots = [System.IO.File]::ReadAllText("robots.txt")
if ($robots -match '20261008a') { Write-Host "robots.txt now references 20261008a" }
$bytesNew = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html bytes after patch: $bytesNew"
