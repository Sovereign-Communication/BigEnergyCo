param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
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
# section mark comments
$secs=@()
$j=0
while($true) {
  $idx=$html.IndexOf('<!--', $j)
  if($idx -lt 0){break}
  $close=$html.IndexOf('-->', $idx+4)
  if($close -lt 0){break}
  $mark=$html.Substring($idx,$close-$idx+3)
  if($mark -match 'section:') { $secs+=$mark.Trim() }
  $j=$close+3
}
Write-Host "section mark comments: $($secs.Count)"
$secs | % { Write-Host "  $_" }
