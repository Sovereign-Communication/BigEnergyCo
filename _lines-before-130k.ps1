param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$fw = Join-Path $root ".worktrees\feature-preflight"
if (!(Test-Path $fw)) { Write-Host "MISSING worktree: $fw"; exit 1 }
$htmlPath = Join-Path $fw "index.html"
$html = [System.IO.File]::ReadAllText($htmlPath)
$lines = $html.Split("`n")
$large = [System.Collections.Generic.List[object]]::new()
$lineNo = 0
foreach ($ln in $lines) {
  $lineNo++
  $bytes = [System.Text.Encoding]::UTF8.GetByteCount($ln + "`r`n")
  if ($bytes -gt 130) {
    $large.Add([PSCustomObject]@{No=$lineNo; Bytes=$bytes; Line=$ln})
  }
}
Write-Host "large lines (>130 bytes each) : $($large.Count)"
$large | ForEach-Object { Write-Host "$($_.No): $($_.Bytes)B | $($_.Line.Substring(0,[Math]::Min(120,$($_.Line).Length)) -replace "`r","")" }
