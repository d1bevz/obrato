#!/usr/bin/env bash
# Публикация УЖЕ СОБРАННОГО dist: rsync → (пере)запуск caddy-контейнера.
# Отделена от сборки: build гоняется пользователем с rust/wasm-pack в PATH,
# publish — единственная часть, которой нужны root/docker-права.
# Открывает публичные 80/443 на VPS (HTTPS через sslip.io) — запускать осознанно.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
WWW=/home/euler/obrato-www
DIST="$REPO/apps/pwa/dist"

[ -f "$DIST/index.html" ] || { echo "нет $DIST/index.html — сначала npm run build" >&2; exit 1; }

mkdir -p "$WWW"
rsync -a --delete "$DIST/" "$WWW/"

if ! docker ps --format '{{.Names}}' | grep -q '^obrato-web$'; then
  docker rm -f obrato-web 2>/dev/null || true
  docker run -d --name obrato-web --restart unless-stopped \
    -p 80:80 -p 443:443 \
    -v "$WWW":/srv:ro \
    -v "$REPO/deploy/Caddyfile":/etc/caddy/Caddyfile:ro \
    -v obrato_caddy_data:/data -v obrato_caddy_config:/config \
    caddy:2-alpine
else
  docker exec obrato-web caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || true
fi
echo "deployed: https://72.61.103.206.sslip.io"
