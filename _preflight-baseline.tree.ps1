Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
Write-Host '===== PRE-LANDING MAIN: roots and file counts ====='
$root = Get-ChildItem -Force
Write-Host 'top-level items:'
$root | ForEach-Object { Write-Host ('  ' + $_.Name + '  (' + $_.FullName.Substring($root[0].FullName.Length + 1) + ')') }
Write-Host '===== PRE-LANDING MAIN: js/mjs/html/json literal files ====='
@(Get-ChildItem -Recurse -File -Include *.js,*.mjs,*.html,*.json) | Sort-Object FullName | ForEach-Object { Write-Host $_.Name + '  <-  ' + $_.FullName.Substring($PWD.Path.Length + 1) }
Write-Host '===== count ====='
Write-Host ('js: ' + ( (Get-ChildItem -Recurse -File -Include *.js | Measure-Object).Count ))
Write-Host ('mjs: ' + ( (Get-ChildItem -Recurse -File -Include *.mjs | Measure-Object).Count ))
Write-Host ('html: ' + ( (Get-ChildItem -Recurse -File -Include *.html | Measure-Object).Count ))
Write-Host ('json: ' + ( (Get-ChildItem -Recurse -File -Include *.json | Measure-Object).Count ))
