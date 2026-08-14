#!/usr/bin/env bash
# Start the Curro AI (TypeScript) agent backend + its Next.js frontend.
# The original Python backend/frontend are unaffected — use ./start.sh for those.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/curro-ai"
FRONTEND_DIR="$SCRIPT_DIR/frontend-2"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Starting Curro AI backend…"
cd "$BACKEND_DIR"
[ -d node_modules ] || npm install
npm run dev &
BACKEND_PID=$!

echo "Starting Curro AI frontend…"
cd "$FRONTEND_DIR"
[ -d node_modules ] || npm install
CURRO_API_URL="http://localhost:8787" npm run dev &
FRONTEND_PID=$!

echo ""
echo "Curro backend  → http://localhost:8787"
echo "Curro frontend → http://localhost:3001"
echo "Press Ctrl+C to stop both."
echo ""

wait "$BACKEND_PID" "$FRONTEND_PID"
