param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
Write-Host "total bytes: $($html.Length)"
Write-Host "useCaseRow at char: $($html.IndexOf('id=""useCaseRow""'))"
Write-Host "useCaseBlurb at char: $($html.IndexOf('id=""useCaseBlurb"""))"
$firstScript=$html.IndexOf('<script')
if($firstScript -gt 0) { Write-Host "first script at char: $firstScript" }
Write-Host "=== head upto first script (first 2000 chars) ==="
Write-Host $html.Substring(0,[Math]::Min(2000,$firstScript))
Write-Host ""
$lines=$html -split '\r?\n'
$blank=0
foreach($ln in $lines) { if($ln.Trim().Length -eq 0) { $blank++ } }
Write-Host "blank/empty line count: $blank"
