param([string]$root="C:\Users\SCM\Documents\GitHubBigEnergyCo\BigEnergyCo")
$fw = Join-Path $root ".worktrees\feature-preflight"
Set-Location $fw
Write-Host "=== ROBOTS.TXT FULL TEXT ==="
[System.IO.File]::ReadAllText("robots.txt") -replace "`r",""
Write-Host "=== EVIDENCE SEO_SUMMARY LINE ==="
$ev = [System.IO.File]::ReadAllText("evidence\advisor-and-release.json")
($ev -split "`n") | ForEach-Object { if($_ -match 'seo_summary') { Write-Host $_ } }
Write-Host "=== INDEX HTML token count by value ==="
$html = [System.IO.File]::ReadAllText("index.html")
$counts = @{}
foreach($m in [regex]::Matches($html,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"')) {
  $v = $m.Groups[2].Value
  $counts[$v] = if ($counts.ContainsKey($v)) { $counts[$v]+1 } else { 1 }
}
$counts.Keys | ForEach-Object { Write-Host "token $_ : $($counts[$_]) occurrence(s)" }
Write-Host "=== SW.JS CACHE_VERSION ==="
$sw = [System.IO.File]::ReadAllText("sw.js")
Write-Host "CACHE_VERSION: $([regex]::Match($sw,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"
Write-Host "=== INDEX BYTES ==="
$b = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html bytes: $b ; under 130000: $($b -le 130000)"
Write-Host "=== USE CASE SURFACE ==="
Write-Host "useCaseRow present: $($html.Contains('id="useCaseRow"')) ; useCaseBlurb present: $($html.Contains('id="useCaseBlurb"'))"
$opts = @('billcut','tou','backup','reserve','offgrid','portable') | ForEach-Object { $html.Contains("value=""$_""") }
Write-Host "options present: $($opts -join ' / ')"
