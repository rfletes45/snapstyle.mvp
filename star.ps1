param(
  [switch]$SkipFishingBuild,
  [switch]$RebuildFishing,
  [switch]$NoExpoClear
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $root "start.ps1"

if (-not (Test-Path $startScript)) {
  throw "Could not find start.ps1 in $root"
}

& $startScript `
  -SkipFishingBuild:$SkipFishingBuild `
  -RebuildFishing:$RebuildFishing `
  -NoExpoClear:$NoExpoClear
