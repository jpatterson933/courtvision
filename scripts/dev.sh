#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi
if [[ ! -x .venv/bin/uvicorn || ! -d client/node_modules ]]; then
  echo 'Run uv sync and npm --prefix client ci first.' >&2
  exit 1
fi
docker compose up -d --wait postgres
export CV_AUTO_REFRESH="${CV_AUTO_REFRESH:-1}"
.venv/bin/uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload &
api_pid=$!
npm --prefix client run dev -- --hostname 127.0.0.1 &
web_pid=$!
cleanup() { kill "$api_pid" "$web_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
printf '\nCourtVision: http://127.0.0.1:3000\nPress Ctrl-C to stop the app. PostgreSQL data is retained.\n'
wait "$api_pid" "$web_pid"
