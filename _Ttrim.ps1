param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
Write-Host "total bytes: $($html.Length)"
Write-Host "useCaseRow at char: $($html.IndexOf('id=""useCaseRow""'))"
Write-Host "useCaseBlurb at char: $($html.IndexOf('id=""useCaseBlurb""'))"
$lines=$html -split '\r?\n'
Write-Host "total lines: $($lines.Count)"
$blankCount=0
$longCmnt=@()
$idx=0
foreach($ln in $lines) {
  if($ln.Length -eq 0 -or $ln.Trim().Length -eq 0) { $blankCount++ }
  if($ln.Trim().Length -gt 60 -and $ln.Trim() -like "<!--*") {
    $shown=$ln.Replace("`r","").Substring(0,[Math]::Min(80,$ln.Length))
    $longCmnt+=("$($idx+1): $shown")
  }
  $idx++
}
Write-Host "blank/empty lines: $blankCount"
Write-Host "long comment-only lines: $($longCmnt.Count)"
$longCmnt | Select-Object -First 40 | ForEach-Object { Write-Host $_ }
