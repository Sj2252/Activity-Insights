@echo off
setlocal
cd /d "%~dp0"

set "APP_PORT=5601"
if not "%PORT%"=="" set "APP_PORT=%PORT%"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js 18 or newer is required.
  echo Download it from https://nodejs.org/ and try again.
  echo.
  pause
  exit /b 1
)

:: Check if server is already running
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:%APP_PORT%/healthz'; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 } }"
if %errorlevel% equ 0 (
  echo Activity Insights is already running.
  echo Opening dashboard at http://localhost:%APP_PORT%/ ...
  start "" "http://localhost:%APP_PORT%/"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $pidFile = Join-Path '%~dp0' '.tray.pid'; if (-not (Test-Path $pidFile)) { Start-Process -FilePath 'powershell' -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""%~dp0tray.ps1""' -WorkingDirectory '%~dp0' -WindowStyle Hidden } }"
  powershell -NoProfile -Command "Start-Sleep -Milliseconds 1500"
  exit /b 0
)

echo Starting Activity Insights in background on http://localhost:%APP_PORT%/ ...

:: Start Node server detached in background (hidden window)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

:: Start system tray app detached in background (hidden window)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'powershell' -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""%~dp0tray.ps1""' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

:: Wait up to 6 seconds for server to be ready
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { for ($i = 0; $i -lt 12; $i++) { Start-Sleep -Milliseconds 500; try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:%APP_PORT%/healthz'; if ($r.StatusCode -eq 200) { exit 0 } } catch {} }; exit 1 }"

if errorlevel 1 (
  echo.
  echo Activity Insights failed to start or port %APP_PORT% is not responding.
  echo Check that ActivityWatch is running and that port %APP_PORT% is free.
  echo.
  pause
  exit /b 1
)

echo.
echo ===================================================
echo  Activity Insights is running in the background!
echo ===================================================
echo  Dashboard: http://localhost:%APP_PORT%/
echo  Tray Icon: Active in system tray (near the clock)
echo.
echo  Closing this window will NOT stop the server.
echo  To stop: right-click the tray icon and click Stop,
echo  or run stop.bat.
echo.

powershell -NoProfile -Command "Start-Sleep -Seconds 3"
exit /b 0
