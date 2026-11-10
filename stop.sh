#!/usr/bin/env bash
# Activity Insights — Linux/macOS stop script
# Usage: ./stop.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-5601}"
PID_FILE="$SCRIPT_DIR/.server.pid"
STOPPED=0

# ── Stop via PID file ─────────────────────────────────────────────────────────
if [ -f "$PID_FILE" ]; then
  SERVER_PID=$(cat "$PID_FILE" 2>/dev/null | tr -d '[:space:]')
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "  Stopping Activity Insights (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null && STOPPED=1
    # Wait up to 3 seconds for clean exit
    for _ in $(seq 1 6); do
      sleep 0.5
      kill -0 "$SERVER_PID" 2>/dev/null || break
    done
    # Force kill if still alive
    kill -9 "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

# ── Fallback: find any node process listening on the port ─────────────────────
if [ $STOPPED -eq 0 ]; then
  if command -v lsof &>/dev/null; then
    PORT_PID=$(lsof -ti "TCP:$PORT" -sTCP:LISTEN 2>/dev/null | head -1)
    if [ -n "$PORT_PID" ]; then
      PROC_NAME=$(ps -p "$PORT_PID" -o comm= 2>/dev/null || echo "")
      if [[ "$PROC_NAME" == *"node"* ]]; then
        echo "  Stopping Activity Insights on port $PORT (PID $PORT_PID)..."
        kill "$PORT_PID" 2>/dev/null && STOPPED=1
      else
        echo "  Port $PORT is used by '$PROC_NAME' — leaving it alone."
        exit 0
      fi
    fi
  elif command -v ss &>/dev/null; then
    PORT_PID=$(ss -tlnp "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)
    if [ -n "$PORT_PID" ]; then
      echo "  Stopping process on port $PORT (PID $PORT_PID)..."
      kill "$PORT_PID" 2>/dev/null && STOPPED=1
    fi
  fi
fi

if [ $STOPPED -eq 1 ]; then
  echo "  Activity Insights stopped."
else
  echo "  Activity Insights is not running on port $PORT."
fi
