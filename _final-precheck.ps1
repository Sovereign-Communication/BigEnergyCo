Set-Location "C:\Users\SCM\Documents\GitHubBigEnergyCo\BigEnergyCo\.worktrees\feature-preflight"
$b = [System.IO.File]::ReadAllBytes("index.html").Length
$html = [System.IO.File]::ReadAllText("index.html",[System.Text.UTF8Encoding]($false))
$tokens = [regex]::Matches($html,'(src|href)="\./assets/[^"]*\?v=([0-9a-z]+)"') | ForEach-Object { $_.Groups[2].Value }
$sw = [System.IO.File]::ReadAllText("sw.js")
$ev = [System.IO.File]::ReadAllText("evidence\advisor-and-release.json")
$cachedBytes = $b
Write-Host "=== INDEX BYTES ==="
Write-Host "index.html bytes: $cachedBytes ; under 130000: $($cachedBytes -le 130000)"
Write-Host "=== USE CASE SURFACE ==="
Write-Host "useCaseRow present: $($html.Contains('id=""useCaseRow""')) ; useCaseBlurb present: $($html.Contains('id=""useCaseBlurb""'))"
$opts = @('billcut','tou','backup','reserve','offgrid','portable') | ForEach-Object { $html.Contains("value=`"$_`"") }
Write-Host "options present: $($opts -join ' / ')"
Write-Host "=== TOKEN / PATCH STATE ==="
Write-Host "index token values: $(($tokens | Select-Object -Unique) -join ' / ')"
Write-Host "sw.js CACHE_VERSION: $([regex]::Match($sw,'CACHE_VERSION = "([^"]+)"').Groups[1].Value)"
Write-Host "evidence asset token claim: $([regex]::Match($ev,'asset token ([0-9a-z]+)').Groups[1].Value)"
Write-Host "evidence sw cache claim: $([regex]::Match($ev,'SW cache ([0-9a-z]+)').Groups[1].Value)"
Write-Host "=== FRESH GATE (light) ==="
$ok = & { node scripts/check-evidence-freshness.mjs 2>&1 }
$rc = $LASTEXITCODE
Write-Host "check-evidence-freshness exit=$rc"
if ($ok) { $ok.Split("`n")[-6..-1] -join "`n" }
Write-Host "=== GIT STATUS HEADLINE ==="
$gs = & { git status -sb 2>&1 }
$gs
