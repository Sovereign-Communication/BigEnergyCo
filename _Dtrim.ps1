param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
Set-Location $wp
$html=[System.IO.File]::ReadAllText("index.html")
$before=$html.Length
$rc=[System.Text.RegularExpressions.Regex]::new('src="\./assets/js/[^"]*\.js\?v=[0-9a-z]+"',[System.Text.RegularExpressions.RegexOptions]::Singleline)
$cc=[System.Text.RegularExpressions.Regex]::new('href="\./assets/[^"]*\.css\?v=[0-9a-z]+"',[System.Text.RegularExpressions.RegexOptions]::Singleline)
$refs=@{}
$rc.Matches($html) | % { $refs[$_.Value]=1 }
$cc.Matches($html) | % { $refs[$_.Value]=1 }
$required=@{}
$required[$html.Substring($html.IndexOf('id="useCaseRow"'), ($html.IndexOf('</select>',$html.IndexOf('id="useCaseRow"'))-$html.IndexOf('id="useCaseRow"')+8))]=1
$blurbIdx=$html.IndexOf('id="useCaseBlurb"')
$required[$html.Substring($blurbIdx,([regex]::Match($html.Substring($blurbIdx),"</p>").Index)+3)] = 1

function ScriptBlockScope($raw) {
  $start=$raw.IndexOf('<script')
  if($start -lt 0){return $null}
  $end=$raw.IndexOf('</script>',$start)+9
  return $raw.Substring($start,$end-$start)
}
function SafeBlock($block) {
  $s=ScriptBlockScope($block)
  if($s){ if($refs.ContainsKey($s)){return $true} }
  $m=$cc.Matches($block)
  foreach($mm in $m){ if($refs.ContainsKey($mm.Value)){return $true} }
  return $false
}

$doc=[System.Xml.XmlDocument]::new()
$sw=[System.Xml.XmlWriterSettings]::new()
$sw.Indent=$false; $sw.OmitXmlDeclaration=$true
$xw=[System.Xml.XmlWriter]::Create($null,$sw)
$doc.LoadHtml($html)
$htmlNode=$doc.DocumentElement
$body=$htmlNode.SelectSingleNode("//body")
$keep=@{}; $byId=@{}
foreach($n in $htmlNode.SelectNodes("//*[@id]")){ $byId[$n.GetAttribute("id")]=$n }
$keep[$byId["useCaseRow"]]=1; $keep[$byId["useCaseBlurb"]]=1
foreach($n in $htmlNode.SelectNodes("//script|//link")) {
  $raw=$n.OuterXml
  if($refs.ContainsKey($raw)){ $keep[$n]=1 }
}
$compactedFolders=@{}; $compactedSections=@{}
$target=$htmlNode.SelectSingleNode("//body");
$children=@()
foreach($c in $target.ChildNodes) { $children+=$c }
$out=@()
$i=0
while($i -lt $children.Count) {
  $c=$children[$i]
  $outer=$c.OuterXml
  if($c.LocalName -eq "div" -and $c.Attributes["data-section"] -or $outer -match 'data-section="[^"]+"') {
    $block=$outer
    $j=$i+1; $nest=1
    while($j -lt $children.Count -and $nest -gt 0) {
      $nxt=$children[$j]
      if($nxt.OuterXml -match '<div'){$nest++}
      if($nxt.OuterXml -match '</div>'){$nest--}
      if($nest -gt 0){$block+=$nxt.OuterXml; $j++}
      else {break}
    }
    $i=$j; $sectionId=[regex]::Match($block,'data-section="([^"]+)"').Groups[1].Value
    if($block -match 'id="useCaseRow"|id="useCaseBlurb"') { $out+=$block; continue }
    if(SafeBlock($block)) { $out+=$block; continue }
    $compactedSections[$sectionId]=1; continue
  } else { $out+=$outer; $i++ }
}
[void]$xw.WriteRaw([string]::Join([string]::Empty,$out))
$xw.Flush(); $xw.Close()
$rendered=$xw.InnerXml
$final=$rendered.TrimEnd() + "`r`n"
$fname="$wp\index.html"
$fs=[System.IO.File]::WriteAllText($fname,$final,[System.Text.UTF8Encoding]($false))
Write-Host "BEFORE: $before"
Write-Host "AFTER:  $($final.Length)"
Write-Host "CUT:    $($before-$final.Length)"
Write-Host "USE CASE ROW SURVIVED: $($final.Contains('id="useCaseRow"')); OPTIONS: billcut=$($final.Contains('value="billcut"')) portable=$($final.Contains('value="portable"'))"
Write-Host "BLURB SURVIVED: $($final.Contains('id="useCaseBlurb"'))"
Write-Host "SCRIPT TAGS KEPT: $([regex]::Matches($final,'src="\./assets/js/').Count) vs original $([regex]::Matches($html,'src="\./assets/js/').Count)"
Write-Host "CSS LINKS KEPT: $([regex]::Matches($final,'href="\./assets/').Count) vs original $([regex]::Matches($html,'href="\./assets/').Count)"
