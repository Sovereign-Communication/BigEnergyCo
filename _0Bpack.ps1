param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
$before=$html.Length
$lines=$html.split("`r`n",[System.StringSplitOptions]::RemoveEmptyEntries)
$out=@()
$prevBlank=$false
for($i=0;$i -lt $lines.Count;$i++) {
  $ln=$lines[$i]
  $t=$ln.Trim()
  if($t.Length -eq 0) {
    if($prevBlank) { continue }
    $prevBlank=$true
    $out+=$ln
    continue
  }
  $prevBlank=$false
  if($ln.Contains('id=""useCaseRow""') -or $ln.Contains('id=""useCaseBlurb""')) { $out+=$ln; continue }
  if($t -match 'src="') { $out+=$ln; continue }
  if($t -match 'href="') { $out+=$ln; continue }
  if($t -match 'section:|id=|type=|data-|google-site-verification|manifest|icon|apple-touch|twitter:card|og:') { $out+=$ln; continue }
  if($t.StartsWith("<!--") -and $t.EndsWith("-->") -and $t.Length -lt 90) { continue }
  $out+=$ln
}
$new=[string]::Join("`r`n",$out) + "`r`n"
$after=$new.Length
if($after -lt $before) { [System.IO.File]::WriteAllText("$wp\index.html",$new,[System.Text.UTF8Encoding]($false)) }
Write-Host "BEFORE: $before"
Write-Host "AFTER:  $after"
Write-Host "useCaseRow SURVIVED: $($new.Contains('id=""useCaseRow""'))"
Write-Host "useCase OPTIONS:"
Write-Host "  billcut  $($new.Contains('value=""billcut""'))"
Write-Host "  portable $($new.Contains('value=""portable""'))"
Write-Host "useCaseBlurb SURVIVED: $($new.Contains('id=""useCaseBlurb""'))"
Write-Host "SCRIPT SRC TAGS KEPT: $([regex]::Matches($new,'src=""\./assets/').Count)"
Write-Host "CSS HREF TAGS KEPT:   $([regex]::Matches($new,'href=""\./assets/').Count)"
