param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
Set-Location "$root\.worktrees\feature-preflight"

$html=[System.IO.File]::ReadAllText("index.html")
$lines=$html -split '\r?\n'
Write-Host "TOTAL LINES: $($lines.Count)"
Write-Host "=== heavy-line candidates (comment/blank-heavy or long multi-line copy blocks), line number + first 90 chars ==="
for ($i=0;$i -lt $lines.Count;$i++) {
  $ln=$lines[$i]
  $len=$ln.Length
  if ($len -gt 300 -or ($len -lt 2 -and $i+1 -lt $lines.Count -and $lines[$i+1].Length -lt 2) -or $ln.Trim() -match '^\s*<!--') {
    Write-Host "$($i+1): $($ln.Substring(0,[Math]::Min(90,$len)).Replace("`r",""))"
  }
}
