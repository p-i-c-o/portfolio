#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/p-i-c-o/portfolio"
TARGET_DIR="${HOME}/www/monnickendam.ch"
WORK_DIR="$(mktemp -d)"
LOG_PREFIX="[monnickendam deploy]"

log() {
  printf '%s %s\n' "${LOG_PREFIX}" "$*"
}

cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

mkdir -p "${TARGET_DIR}"

log "Cloning ${REPO_URL} into temporary directory"
git clone --depth 1 "${REPO_URL}" "${WORK_DIR}/repo"

log "Syncing site files into ${TARGET_DIR}"
rsync -a --delete \
  --exclude ".git/" \
  --exclude ".gitignore" \
  --exclude "server-side/" \
  "${WORK_DIR}/repo/" \
  "${TARGET_DIR}/"

log "Done"
