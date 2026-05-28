#!/usr/bin/env bash
# Regenerate Playwright visual regression baselines for both macOS and Linux.
#
# Linux runs through Docker because Chromium rasterizes fonts and applies
# sub-pixel anti-aliasing differently per OS — see
# docs/development/visual-regression.md for the full rationale.
#
# Usage:
#   vp run snap                 # regenerate ALL baselines (every component)
#   vp run snap mesh-gradient   # regenerate only the named spec
#
# The argument is the kebab-case component name and maps to
# apps/docs-tests/visual/<name>.spec.ts.

set -euo pipefail

NAME="${1:-}"
# Use --update-snapshots=all (explicit form) because the bare --update-snapshots
# greedily consumes the next positional as its optional mode argument in newer
# Playwright versions.
PW_ARGS=(--update-snapshots=all)
if [[ -n "$NAME" ]]; then
  PW_ARGS+=("visual/${NAME}.spec.ts")
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker is required for the Linux baseline." >&2
  echo "       install OrbStack (brew install --cask orbstack) or Docker Desktop." >&2
  echo "       see docs/development/visual-regression.md" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "error: docker daemon is not running. start OrbStack/Docker Desktop and retry." >&2
  exit 1
fi

echo "==> macOS baseline (native)"
pnpm --filter @matter/docs-tests exec playwright test "${PW_ARGS[@]}"

echo
echo "==> Linux baseline (Docker)"

PLAYWRIGHT_VERSION=$(node -p \
  "require('./apps/docs-tests/node_modules/@playwright/test/package.json').version")

IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy"
docker pull "$IMAGE"

# Build the inner playwright arg list, shell-escaped, for the bash -lc command
# that runs inside the container.
PW_ARGS_INNER=""
for arg in "${PW_ARGS[@]}"; do
  PW_ARGS_INNER+=" $(printf %q "$arg")"
done

docker run --rm \
  -v "$REPO_ROOT":/work -w /work \
  -e CI=1 \
  "$IMAGE" \
  bash -lc "
    corepack enable &&
    corepack prepare pnpm@9.12.0 --activate &&
    pnpm install --frozen-lockfile &&
    pnpm --filter @matter/docs-tests exec playwright test${PW_ARGS_INNER}
  "

echo
echo "Done. Regenerated PNGs:"
git -C "$REPO_ROOT" status --short apps/docs-tests/visual/ || true
echo
echo "Eyeball them, then commit:"
echo "  git add apps/docs-tests/visual/"
echo "  git commit -m \"test(docs-tests): regenerate ${NAME:-all} visual baselines\""
