param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
Set-Location "$root\.worktrees\feature-preflight"

$html=[System.IO.File]::ReadAllText("index.html")
$idx=$html.IndexOf('id="useCaseRow"')
Write-Host "useCaseRow block (verbatim):"
$end=$html.IndexOf('</select>', $idx)
Write-Host $html.Substring($idx, $end-$idx+8)
Write-Host ""
Write-Host "useCaseBlurb block (verbatim):"
$bidx=$html.IndexOf('id="useCaseBlurb"')
if ($bidx -ge 0) {
$bend=$html.IndexOf('</p>', $bidx)
Write-Host $html.Substring($bidx, $bend-$bidx+4)
} else { Write-Host "NOT FOUND" }
