@echo off
setlocal
cd /d "%~dp0"

set "APP_PORT=5601"
if not "%PORT%"=="" set "APP_PORT=%PORT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $port = %APP_PORT%; $stopped = $false; $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; if ($conn) { foreach ($procId in ($conn.OwningProcess | Sort-Object -Unique)) { $p = Get-Process -Id $procId -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -eq 'node') { Write-Host ('Stopping Activity Insights server (PID ' + $procId + ', port ' + $port + ')...'); Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue; $stopped = $true } } }; $pidFile = Join-Path '%~dp0' '.tray.pid'; if (Test-Path $pidFile) { try { $trayPid = [int](Get-Content $pidFile -Raw).Trim(); $tp = Get-Process -Id $trayPid -ErrorAction SilentlyContinue; if ($tp) { Write-Host ('Stopping system tray app (PID ' + $trayPid + ')...'); Stop-Process -Id $trayPid -Force -ErrorAction SilentlyContinue; $stopped = $true } } catch {} Remove-Item $pidFile -Force -ErrorAction SilentlyContinue }; if (-not $stopped) { Write-Host ('Activity Insights is not running on port ' + $port + '.') } else { Write-Host 'Activity Insights stopped.' }; Start-Sleep -Milliseconds 1500; exit 0 }"
exit /b 0
