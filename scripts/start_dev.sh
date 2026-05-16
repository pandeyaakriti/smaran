#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting Smaran dev servers..."

# Start backend
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
cd frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:5173"
echo "  API Docs → http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop."
trap "kill $BACKEND_PID $FRONTEND_PID" INT
wait
