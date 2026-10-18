# Canvas Grades auto-updater for Windows (Chrome, Edge, Brave, Opera, Vivaldi).
#   First time on a computer:  powershell -ExecutionPolicy Bypass -File update.ps1 -Install
# -Install copies the extension to %LOCALAPPDATA%\CanvasGrades\extension and schedules this script
# hourly and at sign-in. Each run installs a newer release from the Discord release message, but
# only if it is signed by the release key; the extension reloads itself within the hour.
param([switch]$Install)
$ErrorActionPreference = 'Stop'
$Base = Join-Path $env:LOCALAPPDATA 'CanvasGrades'
$Dir = Join-Path $Base 'extension'
$Log = Join-Path $Base 'update.log'
$Modulus = 'xLZDsjKzNUxL0GcqLCUFjZoJUyg7o6YmC60imLwAir+4CDtxZNOieIF95/19jps/UfHt6CUr2qd8RGtJfqWcO3hMVQEQl7VVPkQF3fKagRhlSp3cKqJbUAzxgCCmu8C/NHs14shqltNY4Twd6KGsLhZ1reyyzztUrY943IWFa1wnqWG2fPqM53RWcxwPjoDV19oK3wXO1qKREDPRdXm4OQdcB+f207i4w9Ag46XiOy3OltyeM5LZgv2IwyG+fgumnog7h/U3GQH2MamKcqb2UmZWpvQQ5NuBFl1iA3fCG7m1SrrcvlaEgjnJaRbEju9Pjsu9JxX/jENEK0JD5mCA7WWxrT6wZPN2ZhBpElJiemO9MTsKNiWuAeXFXXbp89FWvl/4i1PKgOlyOWZQN2Da2TqNgC0Rm2ahXsfRYWQhPBoMJUH1tIgXU5B9CqsWpKO5tSMcUVbFKWcgvgXh90g+GP+34tZXOpKRfr4WAJpCWixE42u70BZTggE82blNuCdv'
New-Item -ItemType Directory -Force $Dir | Out-Null
function Log($m) { "$(Get-Date -Format s) $m" | Add-Content $Log; Write-Host $m }

if ($Install) {
  if ((Resolve-Path $PSScriptRoot).Path -ne (Resolve-Path $Dir).Path) { Copy-Item (Join-Path $PSScriptRoot '*') $Dir -Recurse -Force }
  $ps = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Dir\update.ps1`""
  # conhost --headless (Windows 11) avoids a console window flashing every hour.
  $action = if ([Environment]::OSVersion.Version.Build -ge 22000) { New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless powershell.exe $ps" } else { New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $ps }
  $triggers = @((New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME), (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)))
  Register-ScheduledTask -TaskName 'Canvas Grades Updater' -Action $action -Trigger $triggers -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries) -Force | Out-Null
  # The folder is under hidden AppData, so hand people the path to paste into the Load unpacked window.
  Set-Clipboard $Dir
  Write-Host ''
  Write-Host "Installed to $Dir  (this path is now copied)"
  Write-Host ''
  Write-Host 'Now in your browser:'
  Write-Host '  1. Go to the Extensions page (chrome://extensions, edge://extensions, brave://extensions ...)'
  Write-Host '  2. Turn on Developer mode, then click Load unpacked'
  Write-Host '  3. Click the address bar of the folder window, press Ctrl+V, press Enter, then click Select Folder'
  Write-Host 'Remove any older copy of the extension that was loaded from a different folder.'
  exit
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) "canvas-grades-$([guid]::NewGuid())"
try {
  $url = if ($env:CANVAS_GRADES_RELEASE_URL) { $env:CANVAS_GRADES_RELEASE_URL } else { (Get-Content (Join-Path $Dir 'release-url.txt') -Raw).Trim() }
  if (-not $url) { exit }
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $msg = Invoke-RestMethod $url -TimeoutSec 30
  $zip = $msg.attachments | Where-Object { $_.filename -match '^canvas-grades-\d+\.\d+\.\d+\.zip$' } | Select-Object -First 1
  $sig = $msg.attachments | Where-Object { $_.filename -eq "$($zip.filename).sig" } | Select-Object -First 1
  if (-not $zip -or -not $sig) { exit }
  $installed = [version](Get-Content (Join-Path $Dir 'manifest.json') -Raw | ConvertFrom-Json).version
  if ([version]($zip.filename -replace '^canvas-grades-|\.zip$', '') -le $installed) { exit }

  New-Item -ItemType Directory $tmp | Out-Null
  Invoke-WebRequest $zip.url -OutFile "$tmp\release.zip" -UseBasicParsing -TimeoutSec 120
  Invoke-WebRequest $sig.url -OutFile "$tmp\release.sig" -UseBasicParsing -TimeoutSec 30
  $rsa = New-Object Security.Cryptography.RSACryptoServiceProvider
  $key = New-Object Security.Cryptography.RSAParameters
  $key.Modulus = [Convert]::FromBase64String($Modulus); $key.Exponent = [byte[]](1, 0, 1)
  $rsa.ImportParameters($key)
  $signature = [Convert]::FromBase64String([IO.File]::ReadAllText("$tmp\release.sig").Trim())
  if (-not $rsa.VerifyData([IO.File]::ReadAllBytes("$tmp\release.zip"), 'SHA256', $signature)) { throw "Signature check failed for $($zip.filename); update rejected." }

  Expand-Archive "$tmp\release.zip" "$tmp\x"
  # The version check uses the signed manifest, so an old signed release can't be replayed as a downgrade.
  $new = [version](Get-Content "$tmp\x\manifest.json" -Raw | ConvertFrom-Json).version
  if ($new -le $installed) { throw "Release $new is not newer than $installed; ignored." }
  Get-ChildItem $Dir | Where-Object Name -ne 'manifest.json' | Remove-Item -Recurse -Force
  Get-ChildItem "$tmp\x" | Where-Object Name -ne 'manifest.json' | Copy-Item -Destination $Dir -Recurse -Force
  # manifest.json goes last: the extension reloads when it sees a new version, so every other file must already be in place.
  Copy-Item "$tmp\x\manifest.json" $Dir -Force
  Log "Updated $installed -> $new"
} catch {
  Log "Update failed: $($_.Exception.Message)"
  exit 1
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
