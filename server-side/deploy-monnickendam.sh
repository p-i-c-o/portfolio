#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/p-i-c-o/portfolio"
REPO_BRANCH="${REPO_BRANCH:-main}"
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

log "Cloning ${REPO_URL} branch ${REPO_BRANCH} into temporary directory"
git clone --depth 1 --branch "${REPO_BRANCH}" "${REPO_URL}" "${WORK_DIR}/repo"

log "Building blog pages"
python3 "${WORK_DIR}/repo/scripts/build-blog.py"

log "Syncing site files into ${TARGET_DIR}"
rsync -a --delete \
  --exclude ".git/" \
  --exclude ".gitignore" \
  --exclude "blog-posts/" \
  --exclude "scripts/" \
  --exclude "server-side/" \
  "${WORK_DIR}/repo/" \
  "${TARGET_DIR}/"

log "Done"
