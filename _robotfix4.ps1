param([string]$root="C:\Users\SCM\Documents\GitHubBigEnergyCo\BigEnergyCo")
$fw = Join-Path $root ".worktrees\feature-preflight"
Set-Location $fw
$changed = New-Object System.Collections.ArrayList
function Apply($file,$find,$repl) {
  $p = Join-Path $fw $file
  if (!(Test-Path $p)) { Write-Host "missing $file" ; return }
  $s = [System.IO.File]::ReadAllText($p,[System.Text.UTF8Encoding]($false))
  $c = $s.Replace($find,$repl)
  if ($c -eq $s) { Write-Host "no-op $file : find='$find' repl='$repl'" } else { [System.IO.File]::WriteAllText($p,$c,[System.Text.UTF8Encoding]($false)); $changed.Add("$file : $find -> $repl") | Out-Null ; Write-Host "PATCHED $file : $find -> $repl" }
}
# index tokens already 20261008a on this tree, but ensure all ?v= tokens became 20261008a during trim pass; do a global replace of any residual 20261005h token in index
Apply "index.html" 'v=20261005h' 'v=20261008a'
Apply "index.html" 'v=20261005h' 'v=20261008a'
# sw.js already beco-v109; but ensure no residual beco-v108 anywhere
Apply "sw.js" 'beco-v108' 'beco-v109'
# robots.txt currently has none of the known tokens per last check; ensure any 20261005h goes to 20261008a
Apply "robots.txt" '20261005h' '20261008a'
# evidence json
Apply "evidence\advisor-and-release.json" 'asset token 20261005h' 'asset token 20261008a'
Apply "evidence\advisor-and-release.json" 'SW cache beco-v108' 'SW cache beco-v109'
Write-Host "=== POST-PATCH TOKEN PRESENCE ==="
$html = [System.IO.File]::ReadAllText("index.html")
Write-Host "index.html src/href ?v tokens:"
[regex]::Matches($html,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"') | ForEach-Object { Write-Host "  $($_.Groups[1].Value)=`"$./assets/...`"?v=$($_.Groups[2].Value)" }
$sw = [System.IO.File]::ReadAllText("sw.js")
Write-Host "sw.js CACHE_VERSION: $([regex]::Match($sw,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"
$rb = [System.IO.File]::ReadAllText("robots.txt")
Write-Host "robots.txt contains 20261008a: $($rb.Contains('20261008a')) ; contains 20261005h: $($rb.Contains('20261005h'))"
$ev = [System.IO.File]::ReadAllText("evidence\advisor-and-release.json")
Write-Host "evidence asset token claim: $([regex]::Match($ev,'asset token ([0-9a-z]+)').Groups[1].Value)"
Write-Host "evidence sw cache claim: $([regex]::Match($ev,'SW cache ([0-9a-z]+)').Groups[1].Value)"
Write-Host "=== PATCHES APPLIED LIST ==="
$changed -join "`n"
