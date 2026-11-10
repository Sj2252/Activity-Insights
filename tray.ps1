Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Ensure single instance of tray icon
$mutexName = "ActivityInsights_Tray_Mutex"
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $mutexName, [ref]$createdNew)
if (-not $createdNew) {
    exit 0
}

$port = if ($env:PORT) { $env:PORT } else { "5601" }
$dashboardUrl = "http://localhost:$port/"
$trayPidFile = Join-Path $PSScriptRoot ".tray.pid"

try {
    $PID | Out-File -FilePath $trayPidFile -Encoding ascii -Force
} catch {}

[System.Windows.Forms.Application]::EnableVisualStyles()

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$iconFile = Join-Path $PSScriptRoot "Activity.ico"
if (Test-Path $iconFile) {
    try {
        $notifyIcon.Icon = New-Object System.Drawing.Icon($iconFile)
    } catch {
        $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
    }
} else {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}

$notifyIcon.Text = "Activity Insights"

function Open-Dashboard {
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $dashboardUrl
        $psi.UseShellExecute = $true
        [System.Diagnostics.Process]::Start($psi) | Out-Null
    } catch {
        Start-Process "cmd.exe" -ArgumentList "/c start `"`" `"$dashboardUrl`"" -WindowStyle Hidden
    }
}

function Stop-Insights {
    try {
        # Stop node process on the listening port
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            $ids = $conn.OwningProcess | Sort-Object -Unique
            foreach ($procId in $ids) {
                $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
                if ($p -and $p.ProcessName -eq 'node') {
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {}

    # Cleanly remove tray icon
    if ($notifyIcon) {
        $notifyIcon.Visible = $false
        $notifyIcon.Dispose()
    }

    # Remove PID file
    if (Test-Path $trayPidFile) {
        Remove-Item $trayPidFile -Force -ErrorAction SilentlyContinue
    }

    try { $mutex.ReleaseMutex() } catch {}
    [System.Windows.Forms.Application]::Exit()
    [System.Environment]::Exit(0)
}

# Context Menu (right-click)
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

$menuOpen = New-Object System.Windows.Forms.ToolStripMenuItem "Open Dashboard", $null, {
    Open-Dashboard
}
try {
    $menuOpen.Font = New-Object System.Drawing.Font($menuOpen.Font, [System.Drawing.FontStyle]::Bold)
} catch {}

$menuSep = New-Object System.Windows.Forms.ToolStripSeparator

$menuStop = New-Object System.Windows.Forms.ToolStripMenuItem "Stop", $null, {
    Stop-Insights
}

$contextMenu.Items.Add($menuOpen) | Out-Null
$contextMenu.Items.Add($menuSep) | Out-Null
$contextMenu.Items.Add($menuStop) | Out-Null

$notifyIcon.ContextMenuStrip = $contextMenu
$notifyIcon.Visible = $true

# Left-click opens dashboard
$notifyIcon.Add_MouseClick({
    param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        Open-Dashboard
    }
})

# Double-click also opens dashboard
$notifyIcon.Add_DoubleClick({
    Open-Dashboard
})

# Keep script alive with Windows Forms message loop
try {
    [System.Windows.Forms.Application]::Run()
} finally {
    if ($notifyIcon) {
        $notifyIcon.Visible = $false
        $notifyIcon.Dispose()
    }
    if (Test-Path $trayPidFile) {
        Remove-Item $trayPidFile -Force -ErrorAction SilentlyContinue
    }
    try { $mutex.ReleaseMutex() } catch {}
}
