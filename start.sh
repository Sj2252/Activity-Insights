#!/usr/bin/env bash
# Activity Insights — Linux/macOS launcher
# Usage: ./start.sh [--no-open]
# Env:   PORT=5601   AW_URL=http://127.0.0.1:5600   NO_OPEN=1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-5601}"
PID_FILE="$SCRIPT_DIR/.server.pid"

# ── Check dependencies ────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo ""
  echo "  Node.js 18 or newer is required."
  echo "  Install it from https://nodejs.org/ and try again."
  echo ""
  exit 1
fi

NODE_MAJOR=$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo ""
  echo "  Node.js 18+ is required (found v$(node --version | tr -d v))."
  echo "  Upgrade from https://nodejs.org/"
  echo ""
  exit 1
fi

# ── Check if already running ──────────────────────────────────────────────────
if curl -sf "http://localhost:$PORT/healthz" >/dev/null 2>&1; then
  echo "  Activity Insights is already running on port $PORT."
  echo "  Opening http://localhost:$PORT/ ..."
  if [[ "$*" != *"--no-open"* && "${NO_OPEN:-}" != "1" ]]; then
    if command -v xdg-open &>/dev/null; then
      xdg-open "http://localhost:$PORT/" &
    elif command -v open &>/dev/null; then
      open "http://localhost:$PORT/" &
    fi
  fi
  exit 0
fi

# ── Start server in background ────────────────────────────────────────────────
echo ""
echo "  Starting Activity Insights on http://localhost:$PORT/ ..."
echo ""

nohup node "$SCRIPT_DIR/server.js" > "$SCRIPT_DIR/.server.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

# ── Wait for server to be ready (up to 8 seconds) ────────────────────────────
for i in $(seq 1 16); do
  sleep 0.5
  if curl -sf "http://localhost:$PORT/healthz" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "  Error: server process exited early."
    echo "  Check $SCRIPT_DIR/.server.log for details."
    echo ""
    exit 1
  fi
  if [ "$i" -eq 16 ]; then
    echo ""
    echo "  Error: server did not respond on port $PORT after 8 seconds."
    echo "  Check that ActivityWatch is running and port $PORT is free."
    echo ""
    exit 1
  fi
done

echo "  ================================================="
echo "   Activity Insights is running in the background!"
echo "  ================================================="
echo "   Dashboard: http://localhost:$PORT/"
echo "   Server PID: $SERVER_PID (saved to .server.pid)"
echo ""
echo "   Closing this terminal will NOT stop the server."
echo "   To stop: ./stop.sh  or  kill \$(cat .server.pid)"
echo ""

# ── Open browser ──────────────────────────────────────────────────────────────
if [[ "$*" != *"--no-open"* && "${NO_OPEN:-}" != "1" ]]; then
  if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT/" &>/dev/null &
  elif command -v open &>/dev/null; then
    open "http://localhost:$PORT/" &
  fi
fi
