param([string]$root="C:\Users\SCM\Documents\Github\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
Set-Location $wp
$html=[System.IO.File]::ReadAllText("index.html")

Write-Host "total chars: $($html.Length)"
Write-Host "CRLF byte weight: $((($html.ToCharArray() | ? { $_ -eq "`r" }).Count)) CR bytes"

function Refs($kind) {
  $out=@()
  $i=0
  while($i -lt $html.Length) {
    $s=$html.Substring($i)
    $needle = if($kind -eq "js") { "src=`"./assets/" } else { "href=`"./assets/" }
    $idx=$s.IndexOf($needle)
    if($idx -lt 0){break}
    $start=$i+$idx
    $endQ=$html.IndexOf('"', $start+ $needle.Length)
    $token=$html.Substring($start, $endQ-$start+1)
    $out+=$token
    $i=$endQ+1
  }
  $out
}

Write-Host "=== script src refs ==="
$scripts=Refs("js")
Write-Host "count: $($scripts.Count)"
$scripts | % { Write-Host "  $($_)" }

Write-Host "=== css href refs ==="
$csss=Refs("css")
Write-Host "count: $($csss.Count)"
$csss | % { Write-Host "  $($_)" }

Write-Host "required control char indexes:"
Write-Host "  useCaseRow  at: $($html.IndexOf('id="useCaseRow"'))"
Write-Host "  useCaseBlurb at: $($html.IndexOf('id="useCaseBlurb"'))"

function SectionMarkIndexes {
  $out=@()
  $i=0
  while($true) {
    $idx=$html.IndexOf("<!--", $i)
    if($idx -lt 0){break}
    $close=$html.IndexOf("-->", $idx+4)
    if($close -lt 0){break}
    $mark=$html.Substring($idx,$close-$idx+3)
    if($mark -match "section:"){ $out+=$mark }
    $i=$close+3
  }
  $out
}

Write-Host "=== section mark comments ==="
$marks=SectionMarkIndexes
Write-Host "count: $($marks.Count)"
$marks | % { Write-Host "  $($_.Trim())" }
