param(
  [switch]$SkipBuilds,
  [switch]$RebuildAll,
  [switch]$NoExpoClear,
  [switch]$Watch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$serverDir = Join-Path $root "colyseus-server"
$starforgeDir = Join-Path $root "starforge-viewer"
$starforgeDistIndex = Join-Path $starforgeDir "dist\index.html"

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
Ensure-Dependencies -Directory $starforgeDir -Label "starforge-viewer"

# --- Build web clients (esbuild → dist/) ---
# The Colyseus server serves each dist/ folder at /starforge.
function Build-WebClient {
  param(
    [string]$Directory,
    [string]$Label,
    [string]$DistIndex
  )
  $shouldBuild = -not $SkipBuilds -and ($RebuildAll -or -not (Test-Path $DistIndex))
  if ($shouldBuild) {
    Write-Host "=== Building $Label ===" -ForegroundColor Magenta
    Push-Location $Directory
    try {
      npm run build
    } finally {
      Pop-Location
    }
  } elseif (Test-Path $DistIndex) {
    Write-Host "Using existing $Label bundle." -ForegroundColor DarkGray
  }
}

Build-WebClient -Directory $starforgeDir -Label "starforge-viewer (starforge-viewer/dist)" -DistIndex $starforgeDistIndex

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

# Optionally start esbuild watchers for auto-rebuild on file changes
if ($Watch) {
  $starforgeWatchScript = @"
Set-Location '$starforgeDir'
Write-Host '=== Starforge viewer watcher ===' -ForegroundColor DarkCyan
node build.mjs --watch
"@

  Start-WorkerWindow -WorkingDirectory $starforgeDir -ScriptBody $starforgeWatchScript
}

Start-WorkerWindow -WorkingDirectory $root -ScriptBody $expoScript

Write-Host ""
Write-Host "All required processes launched in separate windows." -ForegroundColor Yellow
Write-Host "  Colyseus   : http://localhost:2567" -ForegroundColor Cyan
Write-Host "  Starforge  : http://localhost:2567/starforge" -ForegroundColor DarkCyan
Write-Host "  Expo       : http://localhost:8081" -ForegroundColor Green
if ($Watch) {
  Write-Host "  Watchers   : esbuild auto-rebuild on file changes" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "Flags:" -ForegroundColor DarkGray
Write-Host "  .\start.ps1 -RebuildAll      # force rebuild all web clients" -ForegroundColor DarkGray
Write-Host "  .\start.ps1 -SkipBuilds      # skip all web client builds" -ForegroundColor DarkGray
Write-Host "  .\start.ps1 -Watch           # also start esbuild file watchers" -ForegroundColor DarkGray
Write-Host "  .\start.ps1 -NoExpoClear     # faster Expo startup" -ForegroundColor DarkGray
