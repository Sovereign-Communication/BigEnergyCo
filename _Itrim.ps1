param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
Set-Location $wp
$html=[System.IO.File]::ReadAllText("index.html")
$lines=$html -split '\r?\n'
$rc=[System.IO.File]::ReadAllText("$wp\index.html")

Write-Host "total lines: $($lines.Count)"
Write-Host "total bytes: $($rc.Length)"

Write-Host ""
Write-Host "=== lines that are purely whitespace or blank ==="
$idx=0
foreach($ln in $lines) {
  if($ln.Length -eq 0 -or ($ln.Length -gt 0 -and $ln.Trim().Length -eq 0)) {
    Write-Host "$($idx+1): BLANK/WSP ($($ln.Length) chars)"
  }
  $idx++
}

Write-Host ""
Write-Host "=== comment-only lines or long comments (> 60 chars before trim), first 80 chars ==="
$idx=0
foreach($ln in $lines) {
  if($ln.Trim() -like "<!--*" -or ($ln.Trim().Length -gt 60 -and $ln.Trim() -notmatch '</\w+>') -and $ln.Trim() -match '^<!--') {
    Write-Host "$($idx+1): $($ln.Substring(0,[Math]::Min(80,$ln.Length)).Replace("`r",""))"
  }
  $idx++
}

Write-Host ""
Write-Host "=== index where required controls begin ==="
Write-Host "useCaseRow first line: $(($rc.IndexOf("id=`"useCaseRow`"") / ([System.IO.File]::ReadAllText($wp+"\index.html") -split '\r?\n' | % { $_.Length + 2 })[0])) approximate"
Write-Host "ctrl block line: 407 approx if use-case controls appear near 53k-55k chars after CRLF"
