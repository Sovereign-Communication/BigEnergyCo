param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$fw = Join-Path $root ".worktrees\feature-preflight"
Set-Location $fw
Write-Host "=== INDEX HTML token-like src/href occurrences ==="
$html = [System.IO.File]::ReadAllText("index.html")
$re = [regex]::Matches($html,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"')
$re | ForEach-Object { Write-Host "$($_.Groups[1].Value)=`"$./assets/...`"?v=$($_.Groups[2].Value)  (line approx char $($_.Index))" }
Write-Host "=== SW.JS CACHE_VERSION line ==="
$sw = [System.IO.File]::ReadAllText("sw.js")
[regex]::Match($sw,'CACHE_VERSION = "([^"]+)"') | ForEach-Object { Write-Host "MATCH: $($_.Value)  -> token $($_.Groups[1].Value)" }
Write-Host "=== ROBOTS.TXT occurrences of tokens ==="
$rb = [System.IO.File]::ReadAllText("robots.txt")
foreach($tok in @('20261005h','20261008a','beco-v108','beco-v109')) { $c = [regex]::Matches($rb,$tok,[System.Text.RegularExpressions.RegexOptions]::Singleline).Count; Write-Host "robots.txt contains '$tok' : $c time(s)" }
Write-Host "=== EVIDENCE JSON freshness claim tokens ==="
$ev = [System.IO.File]::ReadAllText("evidence\advisor-and-release.json")
foreach($tok in @('20261005h','20261008a','beco-v108','beco-v109')) {
  $c = [regex]::Matches($ev,$tok,[System.Text.RegularExpressions.RegexOptions]::Singleline).Count
  Write-Host "evidence contains '$tok' : $c time(s)"
}
Write-Host "=== USE CASE SURFACE ==="
Write-Host "useCaseRow present: $($html.Contains('id="useCaseRow"'))"
Write-Host "useCaseBlurb present: $($html.Contains('id="useCaseBlurb"'))"
Write-Host "options: billcut=$($html.Contains('value="billcut"')) tou=$($html.Contains('value="tou"')) backup=$($html.Contains('value="backup"')) reserve=$($html.Contains('value="reserve"')) offgrid=$($html.Contains('value="offgrid"')) portable=$($html.Contains('value="portable"'))"
Write-Host "=== INDEX BYTES ==="
Write-Host "index.html bytes: $([System.IO.File]::ReadAllBytes("index.html").Length)"
