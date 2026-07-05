#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

export LANGCHAIN_TRACING_V2="${LANGCHAIN_TRACING_V2:-true}"
export LANGCHAIN_PROJECT="${LANGCHAIN_PROJECT:-story-studio-dev}"

if [[ -z "${LANGCHAIN_API_KEY:-}" ]]; then
  echo "Missing LANGCHAIN_API_KEY."
  echo "Copy .env.example to .env.local, set your LangSmith key, then retry:"
  echo "  cp .env.example .env.local"
  echo "  pnpm dev:langsmith"
  exit 1
fi

exec pnpm dev
