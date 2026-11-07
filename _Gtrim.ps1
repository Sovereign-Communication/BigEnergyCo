param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
Set-Location $wp
$html=[System.IO.File]::ReadAllText("index.html")

function Rows($pattern,$text) {
  $m=[regex]::Matches($text,$pattern)
  $arr=@()
  foreach($x in $m){ $arr+=$x }
  $arr
}

Write-Host "=== script and css refs in index.html ==="
$scripts=Rows('src="\./assets/[^"]*\.js\?v=[0-9a-z]+"', $html)
$csss=Rows('href="\./assets/[^"]*\.css\?v=[0-9a-z]+"', $html)
Write-Host "script tag src count: $($scripts.Count)"
$scripts | % { Write-Host "  SRC: $($_.Value)" }
Write-Host "css link href count: $($csss.Count)"
$csss | % { Write-Host "  HREF: $($_.Value)" }

Write-Host ""
Write-Host "=== section mark comments present in index.html ==="
$heads=Rows('<!--\s*section:\s*[^>]+-->', $html)
Write-Host "count: $($heads.Count)"
$heads | % { Write-Host "  $($($_.Value).Trim())" }

Write-Host ""
Write-Host "=== index of required controls ==="
Write-Host "useCaseRow at char: $($html.IndexOf('id="useCaseRow"'))"
Write-Host "useCaseBlurb at char: $($html.IndexOf('id="useCaseBlurb"'))"
