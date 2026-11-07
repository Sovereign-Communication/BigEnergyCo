param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
Set-Location $wp
$html=[System.IO.File]::ReadAllText("index.html")
$before=$html.Length

function Rows($pattern,$text) {
  $m=[regex]::Matches($text,$pattern,[System.Text.RegularExpressions.RegexOptions]::Singleline)
  $arr=@()
  foreach($x in $m){ $arr+=$x }
  $arr
}

$rc=Rows('src="\./assets/js/[^"]*\.js\?v=[0-9a-z]+"', $html)
$cc=Rows('href="\./assets/[^"]*\.css\?v=[0-9a-z]+"', $html)
$refs=@{}
foreach($x in $rc){ $refs[$x.Value]=1 }
foreach($x in $cc){ $refs[$x.Value]=1 }

$idx=$html.IndexOf('id="useCaseRow"')
$end=$html.IndexOf('</select>',$idx)+8
$reqRow=$html.Substring($idx,$end-$idx)
$blIdx=$html.IndexOf('id="useCaseBlurb"')
$blEnd=[regex]::Match($html.Substring($blIdx),"</p>").Index+3
$reqBlurb=$html.Substring($blIdx,$blEnd-$blIdx)
$required=@{ $reqRow=1; $reqBlurb=1 }

$lines=$html -split '\r?\n'
$out=@(); $i=0
while($i -lt $lines.Count) {
  $ln=$lines[$i]
  if($ln -match '^\s*<!--\s*section:\s*([^>]+)-->') {
    $secName=$matches[1].Trim()
    $block=@(); $j=$i+1
    while($j -lt $lines.Count -and $lines[$j] -notmatch '^\s*-->\s*$') { $block+=$lines[$j]; $j++ }
    $close=$lines[$j].Trim(); $i=$j+1
    $joined=($block -join "`n") + "`n"
    $joined+=$close
    $containsReq=$false
    foreach($r in $required.Keys) { if($joined.Contains($r)) { $containsReq=$true; break } }
    $safe=$false
    foreach($r in $refs.Keys) { if($joined.Contains($r)) { $safe=$true; break } }
    if($containsReq) { $out+=$ln; $out+=$block; $out+=$close; continue }
    if($safe) { $out+=$ln; $out+=$block; $out+=$close; continue }
    if($joined.Trim() -match '<script|<link|<style|id=') { $out+=$ln; $out+=$block; $out+=$close; continue }
    Write-Host "DROPPED section: $secName"
    continue
  } else { $out+=$ln; $i++ }
}

$new=($out -join "`n").TrimEnd() + "`r`n"
[System.IO.File]::WriteAllText("$wp\index.html", $new, [System.Text.UTF8Encoding]($false))
Write-Host "BEFORE: $before"
Write-Host "AFTER:  $($new.Length)"
Write-Host "CUT:    $($before-$new.Length)"
Write-Host "useCaseRow SURVIVED: $($new.Contains('id="useCaseRow"'))"
Write-Host "USE CASE OPTIONS:"
Write-Host "  billcut  $($new.Contains('value="billcut"'))"
Write-Host "  tou      $($new.Contains('value="tou"'))"
Write-Host "  backup   $($new.Contains('value="backup"'))"
Write-Host "  reserve  $($new.Contains('value="reserve"'))"
Write-Host "  offgrid  $($new.Contains('value="offgrid"'))"
Write-Host "  portable $($new.Contains('value="portable"'))"
Write-Host "useCaseBlurb SURVIVED: $($new.Contains('id="useCaseBlurb"'))"
Write-Host "SCRIPT TAGS: $([regex]::Matches($new,'src="\./assets/js/').Count) kept of $([regex]::Matches($html,'src="\./assets/js/').Count") original"
Write-Host "CSS LINKS:   $([regex]::Matches($new,'href="\./assets/').Count) kept of $([regex]::Matches($html,'href="\./assets/').Count") original"
