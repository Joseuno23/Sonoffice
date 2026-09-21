#!/usr/bin/env bash
set -euo pipefail

VM_HOST="${SONOFFICE_VM_HOST:-sonoffice@10.16.0.93}"
VM_APP_DIR="${SONOFFICE_VM_APP_DIR:-/home/sonoffice/apps/sonoffice}"
VM_WEB_DIR="${SONOFFICE_VM_WEB_DIR:-/var/www/sonoffice}"
VM_URL="${SONOFFICE_VM_URL:-http://10.16.0.93/}"
VM_HEALTH_URL="${SONOFFICE_VM_HEALTH_URL:-http://127.0.0.1:3001/api/health/db}"
PM2_PROCESS="${SONOFFICE_PM2_PROCESS:-sonoffice-api}"

echo "==> Validando repo local"
git status --short --branch

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Hay cambios locales sin commit. Commit/push antes de desplegar." >&2
  exit 1
fi

git fetch origin main

if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "ERROR: Tu HEAD local no coincide con origin/main. Hacé pull/push antes de desplegar." >&2
  exit 1
fi

echo "==> Desplegando en ${VM_HOST}"
ssh -tt "$VM_HOST" \
  bash -se -- "$VM_APP_DIR" "$VM_WEB_DIR" "$VM_URL" "$VM_HEALTH_URL" "$PM2_PROCESS" <<'REMOTE'
set -euo pipefail

VM_APP_DIR="$1"
VM_WEB_DIR="$2"
VM_URL="$3"
VM_HEALTH_URL="$4"
PM2_PROCESS="$5"

cd "$VM_APP_DIR"

echo "==> Estado inicial en VM"
git status --short --branch

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: La VM tiene cambios locales. Revisar antes de desplegar." >&2
  exit 1
fi

echo "==> Actualizando código"
git pull --ff-only origin main
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
REMOTE
