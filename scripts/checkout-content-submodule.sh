#!/usr/bin/env bash
set -euo pipefail

if [ -z "${CONTENT_REPO_TOKEN:-}" ]; then
  echo "CONTENT_REPO_TOKEN is required to fetch the private content submodule." >&2
  exit 1
fi

cleanup() {
  git config --global --unset-all url."https://x-access-token:${CONTENT_REPO_TOKEN}@github.com/".insteadOf >/dev/null 2>&1 || true
}
trap cleanup EXIT

git config --global url."https://x-access-token:${CONTENT_REPO_TOKEN}@github.com/".insteadOf "https://github.com/"
git submodule sync --recursive
git submodule update --init --recursive
