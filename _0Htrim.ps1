param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
$wp="$root\.worktrees\feature-preflight"
$html=[System.IO.File]::ReadAllText("$wp\index.html")
Write-Host "total bytes: $($html.Length)"
Write-Host "useCaseRow at char: $($html.IndexOf('id=""useCaseRow""'))"
Write-Host "useCaseBlurb at char: $($html.IndexOf('id=""useCaseBlurb""'))"
$lines=$html.split("`r`n",[System.StringSplitOptions]::RemoveEmptyEntries)
$patterns=@('src="\./assets','href="\./assets','google-site-verification','og:title','og:description','twitter:title','twitter:description','data-i18n="useCase')
foreach($pat in $patterns) {
  $hits=@()
  for($i=0;$i -lt $lines.Count;$i++) {
    if($lines[$i] -match [regex]::Escape($pat)) { $hits+=("$($i+1): $($lines[$i].Substring(0,[Math]::Min(90,$lines[$i].Length)))") }
  }
  Write-Host "=== hits for $pat ($($hits.Count)) ==="
  $hits | Select-Object -First 12 | ForEach-Object { Write-Host $_ }
}
