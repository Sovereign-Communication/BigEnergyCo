$ErrorActionPreference = 'Stop'
$checks = @(
  @{ Name = 'npm-test'; File = 'npm'; Args = @('test') },
  @{ Name = 'chars'; File = 'node'; Args = @('scripts/check-chars.mjs') },
  @{ Name = 'seo'; File = 'npm'; Args = @('run','seo') },
  @{ Name = 'format'; File = 'npm'; Args = @('run','format:check') },
  @{ Name = 'deploy'; File = 'npm'; Args = @('run','deploy:check') },
  @{ Name = 'byte-budgets'; File = 'node'; Args = @('scripts/check-byte-budgets.mjs') },
  @{ Name = 'plan'; File = 'npm'; Args = @('run','plan:check') },
  @{ Name = 'prettier'; File = 'npx'; Args = @('--yes','prettier@3.9.6','--check','.') }
)
$logDir = 'C:\tmp\p15-final-preflight-84cff9e-20261022'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
foreach ($check in $checks) {
  Write-Host "RUN $($check.Name)"
  $logPath = Join-Path $logDir ($check.Name + '.log')
  $argsForCheck = $check.Args
  & $check.File @argsForCheck 2>&1 | Tee-Object -FilePath $logPath
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    Write-Host "FAIL $($check.Name) exit=$code"
    exit $code
  }
  Write-Host "PASS $($check.Name)"
}
