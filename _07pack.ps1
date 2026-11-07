param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
Write-Host "total bytes: $($html.Length)"
Write-Host "useCaseRow at char: $($html.IndexOf('id=""useCaseRow""'))"
Write-Host "useCaseBlurb at char: $($html.IndexOf('id=""useCaseBlurb""'))"
$lines=$html.split("`r`n",[System.StringSplitOptions]::RemoveEmptyEntries)
$blank=0
for($i=0;$i -lt $lines.Count;$i++) {
  if($lines[$i].Trim().Length -eq 0) { $blank++ }
}
Write-Host "blank line count: $blank"
$longCmnt=@()
for($i=0;$i -lt $lines.Count;$i++) {
  if($lines[$i].Trim().StartsWith("<!--") -and $lines[$i].Trim().Length -gt 60) {
    $longCmnt+=("$($i+1): " + $lines[$i].Replace("`r","").Substring(0,[Math]::Min(80,$lines[$i].Length)))
  }
}
Write-Host "long comment lines: $($longCmnt.Count)"
$longCmnt | Select-Object -First 40 | ForEach-Object { Write-Host $_ }
