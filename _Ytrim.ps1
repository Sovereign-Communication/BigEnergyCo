param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
Write-Host "total bytes: $($html.Length)"
$rowIdx=$html.IndexOf('id=""useCaseRow""')
$blIdx=$html.IndexOf('id=""useCaseBlurb""')
Write-Host "useCaseRow at char: $rowIdx"
Write-Host "useCaseBlurb at char: $blIdx"
$firstScript=$html.IndexOf('<script')
Write-Host "first script at char: $firstScript"
if($firstScript -gt 0) {
 Write-Host "=== tail from first script, first 1200 chars ==="
 Write-Host $html.Substring($firstScript,[Math]::Min(1200,$html.Length-$firstScript))
}
