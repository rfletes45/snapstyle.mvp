param(
  [switch]$SkipFishingBuild,
  [switch]$RebuildFishing,
  [switch]$NoExpoClear
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$clientDir = Join-Path $root "client"
$serverDir = Join-Path $root "colyseus-server"
$fishingDistIndex = Join-Path $clientDir "dist\index.html"

function Get-PreferredPowerShellPath {
  $powershellCmd = Get-Command powershell -ErrorAction SilentlyContinue
  if ($powershellCmd) {
    return $powershellCmd.Source
  }

  $pwshCmd = Get-Command pwsh -ErrorAction SilentlyContinue
  if ($pwshCmd) {
    return $pwshCmd.Source
  }

  throw "Neither 'powershell' nor 'pwsh' was found on PATH."
}

function Ensure-Command {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found on PATH."
  }
}

function Ensure-Dependencies {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Directory,
    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  $nodeModulesPath = Join-Path $Directory "node_modules"
  if (Test-Path $nodeModulesPath) {
    return
  }

  Write-Host "=== Installing dependencies for $Label ===" -ForegroundColor Yellow
  Push-Location $Directory
  try {
    npm install
  } finally {
    Pop-Location
  }
}

function Start-WorkerWindow {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,
    [Parameter(Mandatory = $true)]
    [string]$ScriptBody
  )

  $psExe = Get-PreferredPowerShellPath
  Start-Process `
    -FilePath $psExe `
    -WorkingDirectory $WorkingDirectory `
    -ArgumentList @("-NoExit", "-Command", $ScriptBody) `
    | Out-Null
}

Ensure-Command "node"
Ensure-Command "npm"
Ensure-Command "npx"

Ensure-Dependencies -Directory $root -Label "Expo app"
Ensure-Dependencies -Directory $serverDir -Label "Colyseus server"
Ensure-Dependencies -Directory $clientDir -Label "fishing client"

$shouldBuildFishing = -not $SkipFishingBuild -and ($RebuildFishing -or -not (Test-Path $fishingDistIndex))
if ($shouldBuildFishing) {
  Write-Host "=== Building fishing web bundle (client/dist) ===" -ForegroundColor Magenta
  Push-Location $clientDir
  try {
    npm run build
  } finally {
    Pop-Location
  }
} elseif (Test-Path $fishingDistIndex) {
  Write-Host "Using existing fishing bundle at client/dist." -ForegroundColor DarkGray
}

$colyseusScript = @"
Set-Location '$serverDir'
Write-Host '=== Starting Colyseus Server ===' -ForegroundColor Cyan
node scripts/patch-colyseus-core.js
node start-dev.js
"@

$expoCommand = if ($NoExpoClear) { "npx expo start" } else { "npx expo start --clear" }
$expoScript = @"
Set-Location '$root'
Write-Host '=== Starting Expo ===' -ForegroundColor Green
$expoCommand
"@

Start-WorkerWindow -WorkingDirectory $serverDir -ScriptBody $colyseusScript
Start-WorkerWindow -WorkingDirectory $root -ScriptBody $expoScript

Write-Host ""
Write-Host "All required processes launched in separate windows." -ForegroundColor Yellow
Write-Host "  Colyseus : http://localhost:2567" -ForegroundColor Cyan
Write-Host "  Fishing  : http://localhost:2567/fishing" -ForegroundColor Magenta
Write-Host "  Expo     : http://localhost:8081" -ForegroundColor Green
Write-Host ""
Write-Host "Flags:" -ForegroundColor DarkGray
Write-Host "  .\start.ps1 -RebuildFishing    # force rebuild client/dist" -ForegroundColor DarkGray
Write-Host "  .\start.ps1 -SkipFishingBuild  # skip fishing bundle build check" -ForegroundColor DarkGray
Write-Host "  .\start.ps1 -NoExpoClear       # faster Expo startup" -ForegroundColor DarkGray
