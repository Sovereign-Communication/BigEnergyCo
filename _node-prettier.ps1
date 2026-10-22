Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
$node = "C:\Program Files\nodejs\node.exe"
$prettier = "node_modules\.bin\prettier"
$p = Start-Process -FilePath $node -ArgumentList @($prettier,"--check","index.html") -RedirectStandardOutput "_np_stdout.txt" -RedirectStandardError "_np_stderr.txt" -NoNewWindow -Wait -PassThru
Write-Host "prettier (node) exit=$($p.ExitCode)"
Get-Content "_np_stdout.txt","_np_stderr.txt" -ErrorAction SilentlyContinue | Where-Object { $_.Trim() -ne "" } | Select-Object -Last 30 | Write-Host
