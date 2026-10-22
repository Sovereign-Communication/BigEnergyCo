Set-Location "C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
$before = [System.IO.File]::ReadAllBytes("index.html").Length
Write-Host "index.html before: $before"
$text = [System.IO.File]::ReadAllText("index.html",[System.Text.UTF8Encoding]($false))
# collapse blank lines to a single newline, both CRLF and LF
$newText = $text -replace "`r`n[ `t]*`r`n", "`r`n"
$newText = $newText -replace "`n[ `t]*`n", "`n"
# also collapse multiple blank lines separated by whitespace-only lines
$newText = $newText -replace "`r`n[ `t]*`r`n[ `t]*`r`n", "`r`n`r`n"
$newText = $newText -replace "`n[ `t]*`n[ `t]*`n", "`n`n"
$afterTextBytes = [System.Text.Encoding]::UTF8.GetBytes($newText).Length
Write-Host "index.html after text roundtrip bytes: $afterTextBytes"
$afterDiskBytes = [System.Text.Encoding]::UTF8.GetBytes($newText).Length
Write-Host "index.html after disk bytes: $afterDiskBytes"
[System.IO.File]::WriteAllText("index.html", $newText, [System.Text.UTF8Encoding]($false))
Write-Host "index.html written. new disk bytes: $([System.IO.File]::ReadAllBytes('index.html').Length)"
Write-Host "=== node --test tests/perf-budget.test.mjs ==="
$p = Start-Process -FilePath "node" -ArgumentList "--test","tests/perf-budget.test.mjs" -NoNewWindow -Wait -PassThru
Write-Host "node --test perf-budget exit=$($p.ExitCode)"
