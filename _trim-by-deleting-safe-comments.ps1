Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
$htmlPath = "index.html"
$before = [System.IO.File]::ReadAllBytes($htmlPath).Length
$html = [System.IO.File]::ReadAllText($htmlPath,[System.Text.UTF8Encoding]($false))
$lines = $html.Split("`n")
$out = [System.Collections.Generic.List[string]]::new()
$keptBlank = $false
foreach ($ln in $lines) {
  $t = $ln.Trim()
  if ($t.Length -eq 0) {
    if ($keptBlank) { continue }
    $keptBlank = $true
    $out.Add($ln)
    continue
  }
  $keptBlank = $false
  if ($t -match 'id="useCaseRow"' -or $t -match 'id="useCaseBlurb"') { $out.Add($ln); continue }
  if ($t -match 'src="\./assets/' -or $t -match 'href="\./assets/') { $out.Add($ln); continue }
  if ($t -match 'google-site-verification|og:|twitter:|data-i18n="useCase') { $out.Add($ln); continue }
  if ($t -match 'section:|id=|type=|data-|manifest|icon|apple-touch|style') { $out.Add($ln); continue }
  if ($t.StartsWith("<!--") -and $t.EndsWith("-->") -and $t.Length -lt 90) { continue }
  $out.Add($ln)
}
$new = ($out -join "`n") + "`r`n"
$afterBytes = [System.Text.Encoding]::UTF8.GetByteCount($new)
if ($afterBytes -lt $before) { [System.IO.File]::WriteAllText($htmlPath,$new,[System.Text.UTF8Encoding]($false)) }
$html2 = [System.IO.File]::ReadAllText($htmlPath,[System.Text.UTF8Encoding]($false))
$finalBytes = [System.IO.File]::ReadAllBytes($htmlPath).Length
Write-Host "BEFORE: $before ; AFTER: $finalBytes ; delta: $($before-$finalBytes)"
Write-Host "under 130000: $($finalBytes -le 130000)"
Write-Host "useCaseRow present: $($html2.Contains('id=""useCaseRow""')) ; useCaseBlurb present: $($html2.Contains('id=""useCaseBlurb""'))"
$opts = @('billcut','tou','backup','reserve','offgrid','portable') | ForEach-Object { $html2.Contains("value=`"$_`"") }
Write-Host "options present: $($opts -join ' / ')"
$okSrc = [regex]::Matches($html2,'src="\./assets/js/[^"]*\?v=[0-9a-z]+"').Count
$okCss = [regex]::Matches($html2,'href="\./assets/site\.css\?v=[0-9a-z]+"').Count
Write-Host "js src refs kept: $okSrc ; css href refs kept: $okCss"
$tokens = [regex]::Matches($html2,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"') | ForEach-Object { $_.Groups[2].Value }
Write-Host "token values present: $(($tokens | Select-Object -Unique) -join ' / ')"
