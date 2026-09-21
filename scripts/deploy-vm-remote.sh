#!/usr/bin/env bash
set -euo pipefail

VM_WEB_DIR="${SONOFFICE_VM_WEB_DIR:-/var/www/sonoffice}"
VM_URL="${SONOFFICE_VM_URL:-http://10.16.0.93/}"
VM_HEALTH_URL="${SONOFFICE_VM_HEALTH_URL:-http://127.0.0.1:3001/api/health/db}"
PM2_PROCESS="${SONOFFICE_PM2_PROCESS:-sonoffice-api}"

echo "==> Estado inicial en VM"
git status --short --branch

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: La VM tiene cambios locales. Revisar antes de desplegar." >&2
  exit 1
fi

echo "==> Actualizando código"
git fetch origin main
git pull --ff-only origin main
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "ERROR: La VM no quedó exactamente en origin/main. Revisar ramas/commits locales." >&2
  exit 1
fi
git log --oneline -1

echo "==> Instalando dependencias reproducibles"
npm ci

echo "==> Compilando API y frontend"
npm run build

echo "==> Validando sudo en VM"
sudo -v < /dev/tty

echo "==> Publicando frontend en Nginx"
sudo -n rsync -a --delete apps/web/dist/ "$VM_WEB_DIR/"
sudo -n chown -R www-data:www-data "$VM_WEB_DIR"

echo "==> Reiniciando API con PM2"
pm2 restart "$PM2_PROCESS"
pm2 save
pm2 status

echo "==> Validando API y web"
curl --fail --show-error --location --include "$VM_HEALTH_URL"
curl --fail --show-error --location --head "$VM_URL"

echo "==> Deploy terminado correctamente"
