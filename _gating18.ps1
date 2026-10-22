param([string]$root="C:\Users\SCM\Documents\GitHubBigEnergyCo\BigEnergyCo")
$fw = Join-Path $root ".worktrees\feature-preflight"
if (!(Test-Path $fw)) { Write-Host "missing: $fw"; exit 1 }
$outPath = "$fw\_npmTestOut.txt"
$errPath = "$fw\_npmTestErr.txt"
if (Test-Path $outPath) { Remove-Item $outPath -Force }
if (Test-Path $errPath) { Remove-Item $errPath -Force }
$ns = New-Object System.IO.StreamWriter($outPath,$false,[System.Text.UTF8Encoding]($false))
$ne = New-Object System.IO.StreamWriter($errPath,$false,[System.Text.UTF8Encoding]($false))
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) { Write-Host "npm not found"; exit 1 }
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $npm.Source
$psi.Arguments = "run test"
$psi.WorkingDirectory = $fw
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$sd = $ns.BaseStream; $se = $ne.BaseStream
$outT = [System.Threading.Tasks.TaskCompletionSource[bool]]::new()
$errT = [System.Threading.Tasks.TaskCompletionSource[bool]]::new()
$proc.OutputDataReceived = { $out.Write($args[0].Data); $out.Flush(); if($args[0].Data -eq $null) { $outT.TrySetResult($true) } } -as [System.Diagnostics.DataReceivedEventHandler]
$proc.ErrorDataReceived = { $ne.Write($args[0].Data); $ne.Flush(); if($args[0].Data -eq $null) { $errT.TrySetResult($true) } } -as [System.Diagnostics.DataReceivedEventHandler]
$proc.Start() | Out-Null
$proc.BeginOutputReadLine()
$proc.BeginErrorReadLine()
$proc.WaitForExit()
$ns.Close(); $ne.Close()
Write-Host "exit=$($proc.ExitCode)"
$out = if (Test-Path $outPath) { Get-Content $outPath -Raw } else { "" }
$err = if (Test-Path $errPath) { Get-Content $errPath -Raw } else { "" }
$lines = $out.Split("`n")
$startIndex = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match "failing tests") { $startIndex = $i; break }
}
if ($startIndex -ge 0) {
  Write-Host "--- FAILING TESTS SECTION ---"
  ($lines[$startIndex..($lines.Count-1)] -join "`n") -replace "`r",""
} else {
  Write-Host "no failing-tests section found"
}
Write-Host "--- STDERR tail 30 ---"
if ($err) { ($err.Split("`n")[-30..-1] -join "`n") -replace "`r","" }
