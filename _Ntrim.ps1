param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")

$scripts=@(); $csss=@(); $mods=@()
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
    $i=$start+1
    continue
  }
  $cssIdx=$s.IndexOf('href="')
  if($cssIdx -ge 0) {
    $start=$i+$cssIdx+6
    $endQ=$html.IndexOf('"', $start)
    if($endQ -gt 0) {
      $tok=$html.Substring($start,$endQ-$start)
      if($tok -match '\./assets/') { $csss+=$tok }
    }
    $i=$start+1
    continue
  }
  $modIdx=$s.IndexOf('modulepreload')
  if($modIdx -ge 0) {
    $mp=$s.IndexOf('href="', $modIdx)
    if($mp -ge 0) {
      $start=$mp+6
      $endQ=$html.IndexOf('"', $start)
      if($endQ -gt 0) {
        $tok=$html.Substring($start,$endQ-$start)
        if($tok -match '\./assets/') { $mods+=$tok }
      }
    }
    $i=$start+1
    continue
  }
  break
}
Write-Host "script src refs: $($scripts.Count)"
$scripts | % { Write-Host "  SRC: $_" }
Write-Host "css href refs:  $($csss.Count)"
$csss | % { Write-Host "  HREF: $_" }
Write-Host "modulepreload:  $($mods.Count)"
$mods | % { Write-Host "  PRE: $_" }

Write-Host ""
Write-Host "useCaseRow present: $($html.Contains('id=""useCaseRow""'))"
Write-Host "useCaseBlurb present: $($html.Contains('id=""useCaseBlurb"""))"

function Sections($text) {
  $out=@()
  $i=0
  while($true) {
    $idx=$text.IndexOf('<!--', $i)
    if($idx -lt 0){break}
    $close=$text.IndexOf('-->', $idx+4)
    if($close -lt 0){break}
    $mark=$text.Substring($idx,$close-$idx+3)
    if($mark -match 'section:') { $out+=$mark }
    $i=$close+3
  }
  $out
}
$secs=Sections($html)
Write-Host "section mark comments found: $($secs.Count)"
$secs | % { Write-Host "  $($_.Trim())" }
