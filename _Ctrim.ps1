param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
Set-Location $wp
$html=[System.IO.File]::ReadAllText("index.html")
$before=$html.Length
$start=$html.IndexOf('id="useCaseRow"')
$end=$html.IndexOf('</select>', $start)+8
$blurb=$html.IndexOf('id="useCaseBlurb"')
$bend=[regex]::Match($html.Substring($blurb),"</p>").Index+3
$scriptMod=[regex]::Matches($html,'src="\./assets/js/[^"]*\.js\?v=[0-9a-z]+"')
$cssRel=[regex]::Matches($html,'href="\./assets/[^"]*\.css\?v=[0-9a-z]+"')
$safe=@{}
0..($scriptMod.Count-1) | % { $safe[$scriptMod[$_].Value]=1 }
0..($cssRel.Count-1) | % { $safe[$cssRel[$_].Value]=1 }
$required=@{}
$required[$html.Substring($start,$end-$start)]=1
$required[$html.Substring($blurb,$bend-$blurb)]=1
$lines=$html -split '\r?\n'
$out=@(); $i=0
while ($i -lt $lines.Count) {
  $ln=$lines[$i]
  if ($ln.Trim() -match '^\s*<!--\s*section:') { $hdr=$ln.Trim(); $body=@(); $j=$i+1
    while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '-->') { $body+=$lines[$j]; $j++ }
    $tail=$lines[$j]; $i=$j+1
    $block=($hdr+"`n"+$body -join "`n"+"$ret`n"+$tail)
    if ($block -match 'id="useCaseRow"|id="useCaseBlurb"|data-i18n="useCase|data-i18n="useCaseLabel"') { $out+=$block.Split("`n"); continue }
    if ($block -match '<script[^>]*type="module"|defer src=|modulepreload') { $out+=$block.Split("`n"); continue }
    if ($block -match '<link[^>]*(stylesheet|preload|modulepreload)') { $out+=$block.Split("`n"); continue }
    $stripped=[regex]::Replace($block,"\r?\n","")
    $hasCss=false; $hasJs=false
    $stripped -match 'href="\./assets/' | % { if($safe.ContainsKey($Matches[0])){$hasCss=$true} }
    $stripped -match 'src="\./assets/' | % { if($safe.ContainsKey($Matches[0])){$hasJs=$true} }
    if (-not $hasCss -and -not $hasJs) { $i=$i; continue }
    $out+=$block.Split("`n")
  } else { $out+=$ln; $i++ }
}
$new=($out -join "`n").Replace("`r`n","`r`n")
if(-not $new.EndsWith("`r`n")){$new+="`r`n"}
[System.IO.File]::WriteAllText("index.html",$new,[System.Text.UTF8Encoding]($false))
Write-Host "BEFORE: $before"
Write-Host "AFTER:  $($new.Length)"
Write-Host "CUT:    $($before-$new.Length)"
Write-Host "USE CASE ROW OK: $($new.Contains('id=\"useCaseRow\"') -and $new.Contains('value=\"billcut\"') -and $new.Contains('value=\"portable\"'))"
Write-Host "BLURB OK:       $($new.Contains('id=\"useCaseBlurb\"'))"
Write-Host "SCRIPT TAGS:    $($scriptMod.Count) original -> still present count = $([regex]::Matches($new,'src=\"\./assets/js/[^\"]*\.js\?v=\d')\Count)"
Write-Host "CSS LINKS:      $($cssRel.Count) original -> still present = $([regex]::Matches($new,'href=\"\./assets/[^\"]*\.css\?v=\d')\Count)"
