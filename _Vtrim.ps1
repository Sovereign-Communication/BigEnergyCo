param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
Write-Host "total bytes: $($html.Length)"
Write-Host "useCaseRow at char: $($html.IndexOf('id=""useCaseRow""'))"
Write-Host "useCaseBlurb at char: $($html.IndexOf('id=""useCaseBlurb""'))"
Write-Host "last 400 chars:"
Write-Host $html.Substring([Math]::Max(0,$html.Length-400))
Write-Host ""
Write-Host "=== asset refs ==="
$scripts=@(); $csss=@()
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
  $cssIdx=$s.IndexOf('href="')
  if($cssIdx -ge 0) {
    $start=$i+$cssIdx+6
    $endQ=$html.IndexOf('"', $start)
    if($endQ -gt 0) {
      $tok=$html.Substring($start,$endQ-$start)
      if($tok -match '\./assets/') { $csss+=$tok }
    }
    $i=$start+1; continue
  }
  break
}
Write-Host "script src refs: $($scripts.Count)"
$scripts | % { Write-Host "  SRC: $_" }
Write-Host "href refs: $($csss.Count)"
$csss | % { Write-Host "  HREF: $_" }

$lines=$html -split '\r?\n'
$blank=0
foreach($ln in $lines) { if($ln.Trim().Length -eq 0) { $blank++ } }
Write-Host "blank/empty line count: $blank"
