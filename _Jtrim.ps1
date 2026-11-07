param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
Set-Location $wp
$html=[System.IO.File]::ReadAllText("index.html")
$lines=$html -split '\r?\n'

Write-Host "total lines: $($lines.Count)"
Write-Host "total bytes: $($html.Length)"
Write-Host "CRLF weight: $((($html.ToCharArray() | ? { $_ -eq "`r" }).Count)) CR bytes"

Write-Host ""
Write-Host "=== blank / whitespace-only lines ==="
$idx=0
foreach($ln in $lines) {
  if($ln.Length -eq 0 -or $ln.Trim().Length -eq 0) {
    Write-Host "$($idx+1): blank"
  }
  $idx++
}

Write-Host ""
Write-Host "=== long or comment-only lines (first 80 visible chars) ==="
$idx=0
foreach($ln in $lines) {
  if($ln.Trim().Length -gt 60 -and $ln.Trim() -like "<!--*") {
    Write-Host "$($idx+1): $($ln.Replace("`r","").Substring(0,[Math]::Min(80,$ln.Length)))"
  }
  $idx++
}

Write-Host ""
Write-Host "=== required control char indexes ==="
Write-Host "useCaseRow  at char: $($html.IndexOf('id="useCaseRow"'))"
Write-Host "useCaseBlurb at char: $($html.IndexOf('id="useCaseBlurb"'))"
