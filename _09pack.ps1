param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
$before=$html.Length
$lines=$html.split("`r`n",[System.StringSplitOptions]::RemoveEmptyEntries)

function KeepLine($line) {
  $t=$line.Trim()
  # keep blank runs but collapse to single
  if($t.Length -eq 0) { return "blank" }
  # keep any line that contains a required control or asset ref
  if($line.Contains('id=""useCaseRow""') -or $line.Contains('id=""useCaseBlurb""')) { return "keep" }
  if($t -match 'src=""\./assets/') { return "keep" }
  if($t -match 'href=""\./assets/') { return "keep" }
  # keep non-comment, non-blank lines
  if(-not $t.StartsWith("<!--")) { return "keep" }
  # keep comments that look structural
  if($t -match 'section:|id=|type=|data-|href=|src=|<style|<script|<link|type=.application|google-site-verification|manifest|icon|apple-touch|twitter:card|og:') { return "keep" }
  # drop pure standalone short comments
  return "drop"
}

$out=@()
$prevWasBlank=$false
for($i=0;$i -lt $lines.Count;$i++) {
  $ln=$lines[$i]
  $decision=KeepLine($ln)
  if($decision -eq "blank") {
    if($prevWasBlank) { continue }
    $prevWasBlank=$true
    $out+=$ln
    continue
  }
  $prevWasBlank=$false
  if($decision -eq "drop") { continue }
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
Write-Host "useCaseBlurb SURVIVED: $($new.Contains('id=""useCaseBlurb"""))"
Write-Host "SCRIPT TAGS KEPT: $([regex]::Matches($new,'src=""\./assets/js/').Count)"
