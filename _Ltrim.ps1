param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")

function Refs($kind,$text) {
  $out=@()
  $i=0
  while($i -lt $text.Length) {
    $s=$text.Substring($i)
    $needle = if($kind -eq "js") { "src=" } else { "href=" }
    $idx=$s.IndexOf($needle)
    if($idx -lt 0){break}
    $start=$i+$idx
    $q1=$text.IndexOf('"', $start+$needle.Length)
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

$reqRow=$html.Substring($html.IndexOf('id="useCaseRow"'), ($html.IndexOf('</select>',$html.IndexOf('id="useCaseRow"')) - $html.IndexOf('id="useCaseRow"') +8))
$blurbIdx=$html.IndexOf('id="useCaseBlurb"')
$blurbEnd=[regex]::Match($html.Substring($blurbIdx),"</p>").Index+3
$reqBlurb=$html.Substring($blurbIdx,$blurbEnd-$blurbIdx)
$requiredSet=@{ $reqRow=1; $reqBlurb=1 }

$lines=$html -split '\r?\n'
$out=@(); $i=0
while($i -lt $lines.Count) {
  $ln=$lines[$i]
  if($i -ge $lines.Count-2) { $out+=$ln; $i++; continue }
  if($out.Count -ge 1) {
    $prev=$out[-1]
    if($prev.Trim().Length -eq 0 -and $ln.Trim().Length -eq 0) { $i++; continue }
  }
  $out+=$ln; $i++
}

$new=($out -join "`r`n") + "`r`n"
$before=$html.Length
$after=$new.Length
$criticallyTouched=$false
foreach($r in $requiredSet.Keys) { if(-not $new.Contains($r)) { $criticallyTouched=$true; Write-Host "MISSING REQ BLOCK: $($r.Substring(0,60))..." } }
foreach($r in $refsSet.Keys) { if(-not $new.Contains($r)) { Write-Host "MISSING ASSET REF: $r"; $criticallyTouched=$true } }

[System.IO.File]::WriteAllText("$wp\index.html", $new, [System.Text.UTF8Encoding]($false))
Write-Host "BEFORE: $before"
Write-Host "AFTER:  $after"
Write-Host "CUT:    $($before-$after)"
Write-Host "critical touch: $criticallyTouched"
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
