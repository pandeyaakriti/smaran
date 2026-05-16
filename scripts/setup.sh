#!/usr/bin/env bash
# Smaran — one-shot dev environment setup
set -euo pipefail

echo "🧠 Setting up Smaran..."

# ── Python backend ────────────────────────────────────
echo "→ Creating Python virtual environment"
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements-dev.txt

# ── Frontend ─────────────────────────────────────────
echo "→ Installing Node dependencies"
cd frontend && npm install && cd ..

# ── Environment files ─────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo "→ Created .env from .env.example — edit it before running!"
fi

# ── Data directories ──────────────────────────────────
mkdir -p data/chroma_db data/uploads

# ── Ollama model ──────────────────────────────────────
echo "→ Pulling Ollama model (llama3.2 — requires Ollama installed)"
ollama pull llama3.2 || echo "  ⚠  Ollama not found — install from https://ollama.com and run: ollama pull llama3.2"

echo ""
echo "✅ Setup complete! Start the dev servers with:  ./scripts/start_dev.sh"
