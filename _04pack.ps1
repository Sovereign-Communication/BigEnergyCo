param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
$before=$html.Length
$out=@()
$prevBlank=$false
foreach($ln in $html -split '\r?\n') {
  $t=$ln.Trim()
  $isBlank=$t.Length -eq 0
  if($isBlank -and $prevBlank) { continue }
  $prevBlank=$isBlank
  $out+=$ln
}
$new=[string]::Join("`r`n", $out) + "`r`n"
$after=$new.Length
if($after -lt $before) { [System.IO.File]::WriteAllText("$wp\index.html",$new,[System.Text.UTF8Encoding]($false)) }
Write-Host "BEFORE: $before"
Write-Host "AFTER:  $after"
Write-Host "useCaseRow SURVIVED: $($new.Contains('id=""useCaseRow""'))"
Write-Host "useCase OPTIONS:"
Write-Host "  billcut  $($new.Contains('value=""billcut""'))"
Write-Host "  portable $($new.Contains('value=""portable""'))"
Write-Host "useCaseBlurb SURVIVED: $($new.Contains('id=""useCaseBlurb""'))"
Write-Host "SCRIPT TAGS KEPT: $([regex]::Matches($new,'src=""\./assets/js/').Count)"
