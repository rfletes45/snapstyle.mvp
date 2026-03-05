param(
  [switch]$NoExpoClear
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot

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

$colyseusDir = Join-Path $root "colyseus-server"
if (Test-Path $colyseusDir) {
  Ensure-Dependencies -Directory $colyseusDir -Label "Colyseus server"

  # Kill any stale process on port 2567 before starting
  $staleConn = Get-NetTCPConnection -LocalPort 2567 -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($staleConn) {
    Write-Host "Killing stale process on port 2567 (PID $($staleConn.OwningProcess))..." -ForegroundColor DarkYellow
    Stop-Process -Id $staleConn.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }

  $colyseusScript = @"
Set-Location '$colyseusDir'
Write-Host '=== Starting Colyseus Server ===' -ForegroundColor Cyan
npm run dev
"@

  Start-WorkerWindow -WorkingDirectory $colyseusDir -ScriptBody $colyseusScript
}

$expoCommand = if ($NoExpoClear) { "npx expo start" } else { "npx expo start --clear" }
$expoScript = @"
Set-Location '$root'
Write-Host '=== Starting Expo ===' -ForegroundColor Green
$expoCommand
"@

Start-WorkerWindow -WorkingDirectory $root -ScriptBody $expoScript

Write-Host ""
Write-Host "Expo launched in a separate window." -ForegroundColor Yellow
if (Test-Path $colyseusDir) {
  Write-Host "  Colyseus : http://localhost:2567" -ForegroundColor Cyan
}
Write-Host "  Expo     : http://localhost:8081" -ForegroundColor Green
Write-Host ""
Write-Host "Flags:" -ForegroundColor DarkGray
Write-Host "  .\start.ps1 -NoExpoClear     # faster Expo startup (skip cache clear)" -ForegroundColor DarkGray
