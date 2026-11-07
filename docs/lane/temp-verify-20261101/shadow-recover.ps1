$ErrorActionPreference = 'SilentlyContinue'
$out = 'C:\tmp\.shadow-recover.log'
function Log($m) { Add-Content -LiteralPath $out -Value ((Get-Date -Format o) + ' ' + $m) -Encoding UTF8 }

# first action: prove the process actually started
$elev = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Log ('STARTED pid=' + $PID + ' user=' + $env:USERNAME + ' elevated=' + $elev)

# Recorded identities are git blob SHA-1 object IDs from the 2026-10-30 proof ledger.
function Get-BlobSha1([string]$path) {
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  $fs = [System.IO.File]::OpenRead($path)
  try {
    $len = $fs.Length
    $hdr = [System.Text.Encoding]::ASCII.GetBytes('blob ' + $len + [char]0)
    [void]$sha1.TransformBlock($hdr, 0, $hdr.Length, $null, 0)
    $buf = New-Object byte[] 65536
    $n = 0
    while (($n = $fs.Read($buf, 0, $buf.Length)) -gt 0) { [void]$sha1.TransformBlock($buf, 0, $n, $null, 0) }
    [void]$sha1.TransformFinalBlock((New-Object byte[] 0), 0, 0)
    return (($sha1.Hash | ForEach-Object { $_.ToString('x2') }) -join '')
  } finally { $fs.Dispose() }
}

$targets = @(
  @{ rel = 'tmp\car2-bak\cities.js';   size = 20722; sha = 'a964fc51666cc1d36b6f73c6477b8957b594ffc4'; dest = 'C:\tmp\car2-bak\cities.js' },
  @{ rel = 'tmp\car4-bak\frontier.js'; size = 24977; sha = '1a6da8de6311ca9ae11667fbe06a7e564d76c6a7'; dest = 'C:\tmp\car4-bak\frontier.js' }
)

$shadows = @()
try { $shadows = @(Get-CimInstance -ClassName Win32_ShadowCopy -ErrorAction Stop) }
catch { Log ('CIM ERROR: ' + $_.Exception.Message) }
Log ('SHADOW COUNT (cim): ' + $shadows.Count)

$v = (& vssadmin list shadows 2>&1 | Out-String)
Log '=== vssadmin list shadows ==='
Log $v

$restored = 0
if ($shadows.Count -eq 0) {
  Log 'NO SHADOW COPIES REPORTED BY CIM - nothing to search'
} else {
  foreach ($s in $shadows) {
    $dev = $s.DeviceObject
    Log ($s.InstallDate + ' -> ' + $dev)
    if (-not $dev) { continue }
    foreach ($t in $targets) {
      $p = $dev.TrimEnd('\') + '\' + $t.rel
      if (-not (Test-Path -LiteralPath $p)) { Log ('  absent: ' + $t.rel); continue }
      $fi = Get-Item -LiteralPath $p
      $b = Get-BlobSha1 $p
      $sha256 = (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLower()
      Log ('  CANDIDATE size=' + $fi.Length + ' blob1=' + $b + ' sha256=' + $sha256 + ' :: ' + $p)
      if (($fi.Length -eq $t.size) -and ($b -eq $t.sha)) {
        $dir = Split-Path -Parent $t.dest
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        Copy-Item -LiteralPath $p -Destination $t.dest -Force
        $vb = Get-BlobSha1 $t.dest
        Log ('  RESTORED -> ' + $t.dest + ' blob1=' + $vb + ' verify=' + $(if ($vb -eq $t.sha) { 'OK' } else { 'FAIL' }))
        if ($vb -eq $t.sha) { $restored++ }
      } else {
        Log '  size/blob mismatch - NOT restored'
      }
    }
  }
}

Log ('RESTORED COUNT: ' + $restored)
Log ('END ' + (Get-Date -Format o))
