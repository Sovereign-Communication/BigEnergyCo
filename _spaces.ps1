Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
$bytes = [System.IO.File]::ReadAllBytes("index.html")
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
Write-Host "index.html disk bytes: $($bytes.Length)"
Write-Host "index.html text length: $($text.Length)"
$blankLines = [regex]::Matches($text, "`r`n`r`n|--^`n|`n{2,}")
Write-Host "blank-line matches: $($blankLines.Count)"
$blankBytes = 0
foreach ($m in $blankLines) {
  $blankBytes += $m.Value.Length
}
Write-Host "blank-line bytes: $blankBytes"
$newText = [regex]::Replace($text, "`r`n+`n", "`r`n")
$newText = [regex]::Replace($newText, "`n{2,}", "`n")
$newBytes = [System.Text.Encoding]::UTF8.GetBytes($newText).Length
Write-Host "after collapsing blanks, bytes: $newBytes"
Write-Host "savings: $($bytes.Length - $newBytes)"
