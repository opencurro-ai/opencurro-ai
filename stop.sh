#!/usr/bin/env bash

PORT=8787
FRONTEND_PORT=5173

echo "Stopping backend (port $PORT)…"
fuser -k "$PORT"/tcp 2>/dev/null && echo "  Stopped." || echo "  Not running."

echo "Stopping frontend (port $FRONTEND_PORT)…"
fuser -k "$FRONTEND_PORT"/tcp 2>/dev/null && echo "  Stopped." || echo "  Not running."

echo "Done."
