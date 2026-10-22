Set-Location 'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\.worktrees\main-landing'
$html = Get-Content 'index.html' -Raw
$lines = Get-Content 'index.html'
Write-Host '===== PRE-LANDING MAIN: visible use-case option ids in index.html ====='
$cases = @('bill-cut','battery-only','essential-load','reserve','offgrid','portable')
foreach ($c in $cases) {
    $full = 'usecase-' + $c
    $inIdAttr = $html -match ('(?i)id="' + $full + '"')
    $inDataUseCase = $html -match ('(?i)data-use-case="' + $c + '"')
    $anyMarker = $inIdAttr -or $inDataUseCase
    $status = 'NOT PRESENT'
    if ($anyMarker) { $status = 'PRESENT' }
    Write-Host ('case ' + $c + ' (as usecase-' + $c + ') : id attr=' + $inIdAttr + '  data-use-case=' + $inDataUseCase + '  -> ' + $status)
}
Write-Host '===== en-US locale keys that belong to the 6-case visible surface, present in PRE-LANDING MAIN ====='
$keys = @(
  'useCaseLabel','useCaseBlurbLabel',
  'useCaseBillCut','useCaseTou','useCaseBackup','useCaseReserve','useCaseOffGrid','useCasePortable',
  'touLabel','touPeakLabel','touOffPeakLabel','touSelectLabel',
  'backupLabel','backupEssentialsLabel','backupHoursHelp',
  'reserveLabel','reserveKeepNote','reservePctHelp',
  'offgridLabel','offgridPresetsLabel','offgridTiltHelp',
  'portableLabel','portableDevicesLabel','portableTripDaysHelp','portableChargeHelp'
)
foreach ($k in $keys) {
    $present = $html -match ('(?i)data-i18n="' + $k + '"') -or $html -match ('(?i)data-jargon="' + $k + '"')
    $status = 'NOT PRESENT'
    if ($present) { $status = 'PRESENT' }
    Write-Host ('key ' + $k + ' : ' + $status)
}
