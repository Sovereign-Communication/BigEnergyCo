param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
Write-Host "total bytes: $($html.Length)"
Write-Host "useCaseRow at char: $($html.IndexOf('id=""useCaseRow""'))"
Write-Host "useCaseBlurb at char: $($html.IndexOf('id=""useCaseBlurb""'))"
$lines=$html -split '\r?\n'
$blank=0
$commentLines=@()
foreach($ln in $lines) {
  if($ln.Trim().Length -eq 0) { $blank++ }
  elseif($ln.Trim() -like '<!--*') { $commentLines+=("$($ln.IndexOf($html.Split("`n")[0]))"): $([regex]::Replace($ln,"`r","").Substring(0,[Math]::Min(80,$ln.Length)))" }
}
Write-Host "blank line count: $blank"
Write-Host "comment lines: $($commentLines.Count)"
$commentLines | Select-Object -First 40 | ForEach-Object { Write-Host $_ }
