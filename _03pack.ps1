param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
$before=$html.Length

function Refs($kind,$text) {
  $out=@()
  $i=0
  while($i -lt $text.Length) {
    $s=$text.Substring($i)
    $needle = if($kind -eq "js") { "src=" } else { "href=" }
    $idx=$s.IndexOf($needle)
    if($idx -lt 0){break}
    $start=$i+$idx+5
    $q1=$text.IndexOf('"', $start)
    if($q1 -lt 0){break}
    $q2=$text.IndexOf('"', $q1+1)
    if($q2 -lt 0){break}
    $token=$text.Substring($start,$q2-$start+1)
    if($token -match 'assets/') { $out+=$token }
    $i=$q2+1
  }
  $out
}
$scripts=Refs("js",$html)
$csss=Refs("css",$html)
$refsSet=@{}
$scripts | % { $refsSet[$_]=1 }
$csss | % { $refsSet[$_]=1 }

$rowIdx=$html.IndexOf('id=""useCaseRow""')
$blIdx=$html.IndexOf('id=""useCaseBlurb""')
$reqRow=$html.Substring($rowIdx, ($html.IndexOf('</select>',$rowIdx) - $rowIdx +8))
$blEnd=$html.IndexOf('</p>', $blIdx) +3
$reqBlurb=$html.Substring($blIdx, $blEnd - $blIdx)
$requiredSet=@{ $reqRow=1; $reqBlurb=1 }

$lines=$html -split '\r?\n'
$out=@(); $i=0
while($i -lt $lines.Count) {
  $ln=$lines[$i]
  if($i -ge $lines.Count-2) { $out+=$ln; $i++; continue }
  if($out.Count -ge 1 -and $out[-1].Trim().Length -eq 0 -and $ln.Trim().Length -eq 0) { $i++; continue }
  if($ln.Trim() -match '^<!--\s*section:') {
    $whole=""
    $startIdx=$i
    $j=$i+1
    while($j -lt $lines.Count -and $lines[$j].Trim() -ne '-->') { $whole+=$lines[$j]+"`r`n"; $j++ }
    $whole+=$lines[$j]; $i=$j+1
    $safe=$false
    foreach($r in $requiredSet.Keys) { if($whole.Contains($r)) { $safe=$true; break } }
    if($safe) { $out+=$whole.Split("`r`n"); continue }
    $t=$whole.Replace("`r","").Replace("`n","")
    foreach($r in $refsSet.Keys) { if($t.Contains($r)) { $safe=$true; break } }
    if($safe) { $out+=$whole.Split("`r`n"); continue }
    if($whole -match 'src=|href=|id=|<style|<script|<link|type=.application') { $out+=$whole.Split("`r`n"); continue }
    $i=$j+1; continue
  }
  $out+=$ln; $i++
}
$new=($out -join "`r`n") + "`r`n"
$after=$new.Length
if($after -lt $before) {
  [System.IO.File]::WriteAllText("$wp\index.html",$new,[System.Text.UTF8Encoding]($false))
}
Write-Host "BEFORE: $before"
Write-Host "AFTER:  $after"
Write-Host "critical touch: $(foreach($r in $requiredSet.Keys){ if(-not $new.Contains($r)) { Write-Host "MISSING req: $($r.Substring(0,50))"; break } } $false)"
Write-Host "useCaseRow SURVIVED: $($new.Contains('id=""useCaseRow""'))"
Write-Host "useCase OPTIONS:"
Write-Host "  billcut  $($new.Contains('value=""billcut""'))"
Write-Host "  tou      $($new.Contains('value=""tou""'))"
Write-Host "  backup   $($new.Contains('value=""backup""'))"
Write-Host "  reserve  $($new.Contains('value=""reserve""'))"
Write-Host "  offgrid  $($new.Contains('value=""offgrid""'))"
Write-Host "  portable $($new.Contains('value=""portable""'))"
Write-Host "useCaseBlurb SURVIVED: $($new.Contains('id=""useCaseBlurb""'))"
Write-Host "SCRIPT TAGS KEPT: $([regex]::Matches($new,'src=""\./assets/js/').Count) vs original $($scripts.Count)"
Write-Host "CSS HREF KEPT:   $([regex]::Matches($new,'href=""\./assets/').Count) vs original $($csss.Count)"
