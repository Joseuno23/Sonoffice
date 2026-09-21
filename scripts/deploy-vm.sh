#!/usr/bin/env bash
set -euo pipefail

VM_HOST="${SONOFFICE_VM_HOST:-sonoffice@10.16.0.93}"
VM_APP_DIR="${SONOFFICE_VM_APP_DIR:-/home/sonoffice/apps/sonoffice}"

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
ssh -tt "$VM_HOST" "cd '$VM_APP_DIR' \
  && git fetch origin main \
  && git status --short --branch \
  && if test -n \"\$(git status --porcelain)\"; then echo 'ERROR: La VM tiene cambios locales. Revisar antes de desplegar.' >&2; exit 1; fi \
  && git pull --ff-only origin main \
  && if test \"\$(git rev-parse HEAD)\" != \"\$(git rev-parse origin/main)\"; then echo 'ERROR: La VM no quedó exactamente en origin/main. Revisar ramas/commits locales.' >&2; exit 1; fi \
  && bash scripts/deploy-vm-remote.sh"
