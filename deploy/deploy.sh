#!/usr/bin/env bash
# Деплой Obrato PWA = build (нужны node + rust/wasm-pack в PATH) + publish
# (нужны docker-права — см. publish.sh). Разделено, чтобы build не гонять
# под root с чужим PATH: `npm run build` сам пересобирает wasm (prebuild).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO/apps/pwa"
npm run build

exec "$REPO/deploy/publish.sh"
