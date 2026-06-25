set -euo pipefail

NAME="${1:-}"

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

# Force amd64 so locally-generated "linux" baselines match CI (ubuntu-latest =
# amd64). Without this, Docker on Apple Silicon transparently pulls the arm64
# variant of the multi-arch image, and the resulting Chromium/SwiftShader pixels
# drift from CI just enough to push noise-heavy shaders (grain) past the
# 0.02 maxDiffPixelRatio threshold.
PLATFORM_FLAG=(--platform linux/amd64)
docker pull "${PLATFORM_FLAG[@]}" "$IMAGE"


PW_ARGS_INNER=""
for arg in "${PW_ARGS[@]}"; do
  PW_ARGS_INNER+=" $(printf %q "$arg")"
done

# Mask every node_modules with an anonymous volume so the container's Linux
# install does not overwrite the host's darwin-arm64 binaries (e.g. pagefind,
# esbuild). Without this, the next host-side `pnpm snap` fails because the
# .pnpm store ends up populated with the wrong-platform binaries.
NM_MOUNTS=(-v /work/node_modules)
for dir in apps/docs apps/docs-tests packages/matter packages/matter-react \
           packages/matter-cli registry tooling/eslint-config tooling/tsconfig; do
  NM_MOUNTS+=(-v "/work/$dir/node_modules")
done

docker run --rm \
  "${PLATFORM_FLAG[@]}" \
  -v "$REPO_ROOT":/work -w /work \
  "${NM_MOUNTS[@]}" \
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
