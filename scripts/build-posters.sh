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
  echo "error: CLI not built. Run: pnpm --filter @mattermix/shaders-cli build" >&2
  exit 1
fi

# name:format[:background][:WxH] entries (png for the flat shaders, jpg for
# the busy ones; background is optional and only needed for shaders with a
# transparent base layer, e.g. aurora, so they flatten onto a sensible color;
# WxH overrides the default capture size and is only needed for pixel-sized
# shaders like dot-field, whose posters render pixel-locked in the demo — see
# DemoPoster's pixelSize prop — and so must be captured larger than any demo
# box they'll be cropped into)
#
# radial-gradient is the exception to "flat means png": PNG's row filters
# predict each pixel from its left and upper neighbours, which crushes a linear
# gradient (every row identical, 35 KB) but does almost nothing for a radial one
# (every row different, 1.3 MB). JPEG lands at 36 KB with no banding visible at
# poster size.
for pair in \
  "linear-gradient:png" \
  "simplex-noise:png" \
  "aurora:jpg:#0b0f1a" \
  "grain:jpg" \
  "mesh-gradient:jpg" \
  "wave-lines:jpg" \
  "vignette:jpg" \
  "dot-field:png:#0a0a14:2048x1280" \
  "radial-gradient:jpg" \
  "god-rays:jpg:#0b0f1a" \
  "conic-gradient:jpg" \
  "dither:jpg" \
  "voronoi:jpg" \
  "fractal-noise:jpg" \
  "blobs:jpg"; do
  IFS=':' read -r name format background size <<< "$pair"
  width="$WIDTH"
  height="$HEIGHT"
  if [ -n "${size:-}" ]; then
    width="${size%x*}"
    height="${size#*x}"
  fi
  echo "==> $name ($format, ${width}x${height})"
  args=(
    --source "${COMPONENTS_DIR}/${name}/scene.tsx"
    --output "${OUT_DIR}/${name}.${format}"
    --format "${format}"
    --width "$width"
    --height "$height"
  )
  if [ -n "$background" ]; then
    args+=(--background "$background")
  fi
  $CLI "${args[@]}"
done

echo "All posters regenerated."
