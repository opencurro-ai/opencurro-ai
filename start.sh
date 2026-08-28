#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/curro-ai"
FRONTEND_DIR="$SCRIPT_DIR/dev-console"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Installing backend dependencies (curro-ai)…"
cd "$BACKEND_DIR"
npm install --silent

echo "Installing frontend dependencies (dev-console)…"
cd "$FRONTEND_DIR"
npm install --silent

echo "Starting backend (curro-ai)…"
cd "$BACKEND_DIR"
npm run dev > "$SCRIPT_DIR/.curro-backend.log" 2>&1 &
BACKEND_PID=$!

echo "Starting frontend (dev-console)…"
cd "$FRONTEND_DIR"
npm run dev > "$SCRIPT_DIR/.curro-frontend.log" 2>&1 &
FRONTEND_PID=$!

echo ""
echo "Backend  → http://localhost:8787  (health: http://localhost:8787/health)"
echo "Frontend → http://localhost:5173  (proxies /api → backend)"
echo ""
echo "Press Ctrl+C to stop both."
echo ""

wait "$BACKEND_PID" "$FRONTEND_PID"