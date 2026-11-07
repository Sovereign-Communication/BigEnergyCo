param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
$before=$html.Length
$lines=@()
$idx=0
$buf=""
foreach($ch in $html.ToCharArray()) {
  $buf+=$ch
  if($buf.EndsWith("`r`n")) { $lines+=$buf; $buf=""; $idx++ }
}
if($buf.Length -gt 0) { $lines+=$buf }
Write-Host "parsed line count: $($lines.Count)"
Write-Host "useCaseRow char index: $($html.IndexOf('id=""useCaseRow""'))"
Write-Host "useCaseBlurb char index: $($html.IndexOf('id=""useCaseBlurb""'))"

$scriptCount=0
$cssCount=0
$i=0
while($i -lt $html.Length) {
  $s=$html.Substring($i)
  $jsIdx=$s.IndexOf('src="')
  if($jsIdx -ge 0) {
    $start=$i+$jsIdx+5
    $endQ=$html.IndexOf('"', $start)
    if($endQ -gt 0) {
      $tok=$html.Substring($start,$endQ-$start)
      if($tok -match '\./assets/') { $scriptCount++ }
    }
    $i=$start+1; continue
  }
  $cssIdx=$s.IndexOf('href="')
  if($cssIdx -ge 0) {
    $start=$i+$cssIdx+6
    $endQ=$html.IndexOf('"', $start)
    if($endQ -gt 0) {
      $tok=$html.Substring($start,$endQ-$start)
      if($tok -match '\./assets/') { $cssCount++ }
    }
    $i=$start+1; continue
  }
  break
}
Write-Host "asset script src count: $scriptCount"
Write-Host "asset href count: $cssCount"

# Compact: remove runs of 2+ trailing blank lines at the very end only. Also merge any run of 2+ blanks in head section only if it's above the useCaseRow.
$out=@()
$topEnd=$lines.Count
for($i=$lines.Count-1;$i -ge 0 -and $lines[$i].Trim().Length -eq 0;$i--) { $topEnd=$i }
$out=@($lines[0..($topEnd-1)])
if($topEnd -lt $lines.Count - 1) { $out+=$lines[$topEnd] }
if(-not $out[-1].EndsWith("`r`n")) { $out[-1]+="`r`n" }

$compacted=[string]::Join([string]::Empty,$out)
$after=$compacted.Length
if($after -lt $before) {
  [System.IO.File]::WriteAllText("$wp\index.html",$compacted,[System.Text.UTF8Encoding]($false))
}
$finalBytes=[System.IO.File]::ReadAllText("$wp\index.html").Length
Write-Host "BEFORE: $before"
Write-Host "AFTER (disk): $finalBytes"
Write-Host "trimmed blank tail lines: $($lines.Count - $out.Count)"
Write-Host "useCaseRow SURVIVED: $($finalBytes -gt 0 -and $compacted.Contains('id=""useCaseRow""'))"
Write-Host "useCase OPTIONS:"
Write-Host "  billcut  $($compacted.Contains('value=""billcut""'))"
Write-Host "  portable $($compacted.Contains('value=""portable""'))"
Write-Host "script src refs after: $scriptCount (unchanged by tail trim)"
