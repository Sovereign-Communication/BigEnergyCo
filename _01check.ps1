param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
Set-Location $wp
git checkout -- index.html
$html=[System.IO.File]::ReadAllText("index.html")
Write-Host "restored bytes: $($html.Length)"
$rowIdx=$html.IndexOf('id=""useCaseRow""')
$blIdx=$html.IndexOf('id=""useCaseBlurb""')
Write-Host "useCaseRow at char: $rowIdx"
Write-Host "useCaseBlurb at char: $blIdx"
$scripts=@()
$i=0
while($i -lt $html.Length) {
  $s=$html.Substring($i)
  $jsIdx=$s.IndexOf('src="')
  if($jsIdx -ge 0) {
    $start=$i+$jsIdx+5
    $endQ=$html.IndexOf('"', $start)
    if($endQ -gt 0) {
      $tok=$html.Substring($start,$endQ-$start)
      if($tok -match '\./assets/') { $scripts+=$tok }
    }
    $i=$start+1; continue
  }
  break
}
Write-Host "script src refs: $($scripts.Count)"
$scripts | % { Write-Host "  SRC: $_" }
