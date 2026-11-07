param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
Set-Location $wp
git checkout -- index.html
$html=[System.IO.File]::ReadAllText("index.html")
Write-Host "restored bytes: $($html.Length)"
Write-Host "useCaseRow present: $($html.Contains('id=""useCaseRow""'))"
Write-Host "useCaseBlurb present: $($html.Contains('id=""useCaseBlurb"""))"
Write-Host "script src refs:"
$i=0
while($i -lt $html.Length) {
  $s=$html.Substring($i)
  $idx=$s.IndexOf('src="')
  if($idx -lt 0){break}
  $start=$i+$idx+5
  $endQ=$html.IndexOf('"', $start)
  if($endQ -lt 0){break}
  $tok=$html.Substring($start,$endQ-$start)
  if($tok -match '\./assets/') { Write-Host "  $tok" }
  $i=$start+1
}
