#!/usr/bin/env bash
# Regenerate every committed poster image from its docs scene module.
# Each poster's --source is the SAME scene the live docs page renders, so the
# poster cannot drift from the demo. Runs one at a time: the poster dev server
# binds a fixed port and concurrent runs collide.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CLI="node packages/matter-cli/dist/index.js poster"
COMPONENTS_DIR="apps/docs/src/app/components"
OUT_DIR="apps/docs/public/posters"
WIDTH=1080
HEIGHT=720

if [ ! -f packages/matter-cli/dist/index.js ]; then
  echo "error: CLI not built. Run: pnpm --filter @lovo/matter-cli build" >&2
  exit 1
fi

# name:format pairs (png for the flat shaders, jpg for the busy ones)
for pair in \
  "linear-gradient:png" \
  "simplex-noise:png" \
  "aurora:jpg" \
  "grain:jpg" \
  "mesh-gradient:jpg"; do
  name="${pair%%:*}"
  format="${pair##*:}"
  echo "==> $name ($format)"
  $CLI \
    --source "${COMPONENTS_DIR}/${name}/scene.tsx" \
    --output "${OUT_DIR}/${name}.${format}" \
    --format "${format}" \
    --width "$WIDTH" \
    --height "$HEIGHT"
done

echo "All posters regenerated."
