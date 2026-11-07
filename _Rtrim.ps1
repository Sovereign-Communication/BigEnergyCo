param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")

Write-Host "total bytes: $($html.Length)"
Write-Host "useCaseRow at char: $($html.IndexOf('id=""useCaseRow""'))"
Write-Host "useCaseBlurb at char: $($html.IndexOf('id=""useCaseBlurb""'))"

$lines=$html -split '\r?\n'
Write-Host "total lines: $($lines.Count)"
Write-Host ""
Write-Host "=== blank / whitespace-only lines (first 120) ==="
$idx=0; $shown=0
foreach($ln in $lines) {
  if($ln.Length -eq 0 -or $ln.Trim().Length -eq 0) {
    if($shown -lt 120) { Write-Host "$($idx+1): blank" }
    $shown++
  }
  $idx++
}
Write-Host "total blank/empty lines: $shown"

Write-Host ""
Write-Host "=== long or comment-only lines (first 80 visible chars), count only ==="
$longLines=@()
$idx=0
foreach($ln in $lines) {
  if($ln.Trim().Length -gt 60 -and $ln.Trim() -like "<!--*") {
    $longLines+="$($idx+1): $($ln.Replace("`r","").Substring(0,[Math]::Min(80,$ln.Length)))"
  }
  $idx++
}
Write-Host "long comment lines: $($longLines.Count)"
$longLines | Select-Object -First 40 | ForEach-Object { Write-Host $_ }
