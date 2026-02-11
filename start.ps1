# Start both Colyseus server and Expo dev server in separate windows
$root = $PSScriptRoot

# 1) Apply Colyseus patch & start game server (port 2567)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  Set-Location '$root\colyseus-server'
  Write-Host '=== Starting Colyseus Server ===' -ForegroundColor Cyan
  node scripts/patch-colyseus-core.js
  node start-dev.js
" -WorkingDirectory "$root\colyseus-server"

# 2) Start Expo / Metro (port 8081)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  Set-Location '$root'
  Write-Host '=== Starting Expo ===' -ForegroundColor Green
  npx expo start --clear
" -WorkingDirectory $root

Write-Host 'Both servers launching in separate windows.' -ForegroundColor Yellow
Write-Host '  Colyseus : http://localhost:2567' -ForegroundColor Cyan
Write-Host '  Expo     : http://localhost:8081' -ForegroundColor Green
