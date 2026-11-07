param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
$before=$html.Length
$lines=$html.split("`r`n",[StringSplitOptions]::RemoveEmptyEntries)
$out=@()
$removed=0
for($i=0;$i -lt $lines.Length;$i++) {
  $ln=$lines[$i]
  $t=$ln.Trim()
  if($t.Length -eq 0) { $removed++; continue }
  if($ln.Contains('id=""useCaseRow""') -or $ln.Contains('id=""useCaseBlurb""')) { $out+=$ln; continue }
  if($t -match 'src="') { $out+=$ln; continue }
  if($t -match 'href="') { $out+=$ln; continue }
  if($t -match 'google-site-verification|og:|twitter:|data-i18n="useCase') { $out+=$ln; continue }
  if($t -match 'section:|id=|type=|data-|manifest|icon|apple-touch') { $out+=$ln; continue }
  if($t.StartsWith("<!--") -and $t.EndsWith("-->") -and $t.Length -lt 90) { $removed++; continue }
  $out+=$ln
}
$new=$out -join "`r`n"
if($new.Length -gt 0) { $new+="`r`n" }
$after=$new.Length
Write-Host "BEFORE: $before"
Write-Host "AFTER:  $after"
Write-Host "removed lines: $removed"
if($after -lt $before) { [System.IO.File]::WriteAllText("$wp\index.html",$new,[System.Text.UTF8Encoding]($false)) }
Write-Host "useCaseRow SURVIVED: $($new.Contains('id=""useCaseRow""'))"
Write-Host "billcut: $($new.Contains('value=""billcut""')) portable: $($new.Contains('value=""portable""'))"
Write-Host "useCaseBlurb SURVIVED: $($new.Contains('id=""useCaseBlurb""'))"
Write-Host "SCRIPT SRC TAGS KEPT: $([regex]::Matches($new,'src=""\./assets/').Count)"
Write-Host "CSS HREF TAGS KEPT:   $([regex]::Matches($new,'href=""\./assets/').Count)"
$ucLine=""
foreach($ln in $new.split("`r`n",[StringSplitOptions]::RemoveEmptyEntries)) {
  if($ln.Contains('id=""useCaseRow""')) { $ucLine=$ln; break }
}
Write-Host "useCaseRow context: $ucLine"
