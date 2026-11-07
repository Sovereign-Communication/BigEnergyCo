param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
Write-Host "total bytes: $($html.Length)"
$rowIdx=$html.IndexOf('id=""useCaseRow""')
$blIdx=$html.IndexOf('id=""useCaseBlurb""')
Write-Host "useCaseRow at char: $rowIdx"
Write-Host "useCaseBlurb at char: $blIdx"
$lines=$html -split '\r?\n'
if($rowIdx -lt 0) { Write-Host "fallback: useCaseRow not found in restored read; dumping lines 700-900" }
for($i=699; $i -lt [Math]::Min(900,$lines.Count); $i++) {
  Write-Host "$($i+1): $($lines[$i])"
}
