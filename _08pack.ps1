param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
$before=$html.Length
$lines=$html.split("`r`n",[System.StringSplitOptions]::RemoveEmptyEntries)
$out=@()
$prevBlank=$false
foreach($ln in $lines) {
  $t=$ln.Trim()
  $isBlank=$t.Length -eq 0
  if($isBlank -and $prevBlank) { continue }
  $prevBlank=$isBlank
  # remove standalone comment lines that are pure commentary, not preceding a tag, and not long
  if($t.StartsWith("<!--") -and $t.EndsWith("-->") -and $t.Length -lt 90) {
    # do NOT remove comments that are likely meaningful (have interior text like section: or id= or type=)
    if($t -match 'section:|id=|type=|href=|src=|data-') { $out+=$ln; continue }
    # keep only if preceded by a blank line (so it is a section separator-ish); otherwise drop isolated ones
    $drop=$true
    $out+=$ln
    continue
  }
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
Write-Host "SCRIPT TAGS KEPT: $([regex]::Matches($new,'src=""\./assets/js/').Count)"
