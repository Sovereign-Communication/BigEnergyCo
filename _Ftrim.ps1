param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
Set-Location $wp
$html=[System.IO.File]::ReadAllText("index.html")

function Rows($pattern,$text) {
  $m=[regex]::Matches($text,$pattern,[System.Text.RegularExpressions.RegexOptions]::Singleline)
  $arr=@()
  foreach($x in $m){ $arr+=$x }
  $arr
}
$rc=Rows('src="\./assets/js/[^"]*\.js\?v=[0-9a-z]+"', $html)
$cc=Rows('href="\./assets/[^"]*\.css\?v=[0-9a-z]+"', $html)
Write-Host "=== asset refs currently on tree ==="
Write-Host "script tags: $($rc.Count)"
$rc | ForEach-Object { Write-Host "  SRC: $($_.Value)" }
Write-Host "css links:   $($cc.Count)"
$cc | ForEach-Object { Write-Host "  HREF: $($_.Value)" }

Write-Host ""
Write-Host "=== evidence/lit sections present? ==="
if($html -match 'id="lit-corner"'){ Write-Host "lit-corner PRESENT" } else { Write-Host "lit-corner ABSENT" }
if($html -match 'id="evidence-section"' -or $html -match 'evidence' -and $html -match '<section') { Write-Host "evidence-ish section likely present"; }
if($html -match 'data-section="evidence"'){ Write-Host "data-section=evidence PRESENT" }
if($html -match 'data-section="lit"'){ Write-Host "data-section=lit PRESENT" }
if($html -match 'data-section="compliance"'){ Write-Host "data-section=compliance PRESENT" }
if($html -match 'data-section="seo"'){ Write-Host "data-section=seo PRESENT" }
if($html -match 'data-section="legal"' -or $html -match 'data-section="legal"' ){ Write-Host "data-section=legal PRESENT" }
if($html -match 'data-section="features"'){ Write-Host "data-section=features PRESENT" }
if($html -match 'data-section="analytics"'){ Write-Host "data-section=analytics PRESENT" }

Write-Host ""
Write-Host "=== section header line numbers ==="
$lines=$html -split '\r?\n'
for($i=0;$i -lt $lines.Count;$i++) {
  if($lines[$i] -match '<!--\s*section:') {
    Write-Host "$($i+1): $($lines[$i].Trim())"
  }
}

Write-Host ""
Write-Host "=== indexes of required controls ==="
Write-Host "useCaseRow at char index: $($html.IndexOf('id="useCaseRow"'))"
Write-Host "useCaseBlurb at char index: $($html.IndexOf('id="useCaseBlurb"'))"
