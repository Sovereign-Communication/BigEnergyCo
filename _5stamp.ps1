param([string]$root="C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo")
Set-Location "$root\.worktrees\feature-preflight"

Write-Host "=== INDEX STAMP ==="
$idx=[System.IO.File]::ReadAllText("index.html")
$ms=[regex]::Matches($idx,'href="\./assets/[^"]*\?v=([0-9a-z]+)"')
$mm=[regex]::Matches($idx,'src="\./assets/js/sizing/ui\.js\?v=([0-9a-z]+)"')
$ss=[regex]::Matches($idx,'src="\./assets/js/turnstile-client\.js\?v=([0-9a-z]+)"')
Write-Host "css preload token: $($ms[0].Groups[1].Value)"
Write-Host "ui module token:   $($mm[0].Groups[1].Value)"
Write-Host "turnstile token:   $($ss[0].Groups[1].Value)"

Write-Host "=== HEATMAP STAMP ==="
$hx=[regex]::Match([System.IO.File]::ReadAllText("solar-heatmap\index.html"),'heatmap\.js\?v=([0-9a-z]+)')
Write-Host "solar-heatmap token: $($hx.Groups[1].Value)"

Write-Host "=== SW CACHE ==="
$sw=[regex]::Match([System.IO.File]::ReadAllText("sw.js"),'CACHE_VERSION = "([^"]+)"')
Write-Host "CACHE_VERSION: $($sw.Groups[1].Value)"

Write-Host "=== EVIDENCE FRESH CLAIM ==="
$ev=[System.IO.File]::ReadAllText("evidence\advisor-and-release.json")
$fm=[regex]::Match($ev,'asset token ([0-9a-z]+)')
$cm=[regex]::Match($ev,'SW cache ([0-9a-z]+)')
Write-Host "evidence asset token claim: $($fm.Groups[1].Value)"
Write-Host "evidence sw cache claim:    $($cm.Groups[1].Value)"

Write-Host "=== POOL (all tokens on tree) ==="
$pool=@{};$pool[$mm[0].Groups[1].Value]=1
$ms | % {$pool[$_.Groups[1].Value]=1}
$ss | % {$pool[$_.Groups[1].Value]=1}
$pool[$hx.Groups[1].Value]=1
$pool[$sw.Groups[1].Value]=1
$pool.Keys | Sort-Object
