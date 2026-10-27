Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
Write-Host '===== PRE-LANDING MAIN: any use-case/token strings across whole tree ====='
Select-String -Path '.' -Pattern 'usecase-|use-case|data-use-case' -Recurse -SimpleMatch | Select-Object -First 40 | Format-Table Filename, Line, LineNumber -AutoSize
Write-Host '===== count of matching lines across tree ====='
$c = (Select-String -Path '.' -Pattern 'usecase-|use-case|data-use-case' -Recurse -SimpleMatch).Count
Write-Host "matches: $c"
