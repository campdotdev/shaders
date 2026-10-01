#!/usr/bin/env bash
# Regenerate every committed poster image from its docs scene module.
# Each poster's --source is the SAME scene the live docs page renders, so the
# poster cannot drift from the demo. Runs one at a time: the poster dev server
# binds a fixed port and concurrent runs collide.
#
# After each capture, build-thumbnail.mjs cuts the component's card thumbnail
# for the components index from the new poster. Pass --thumbnails-only to
# re-cut every thumbnail from the committed posters without capturing any.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CLI="node packages/shaders-cli/dist/index.js poster"
COMPONENTS_DIR="apps/docs/src/app/components"
OUT_DIR="apps/docs/public/posters"
WIDTH=1080
HEIGHT=720

THUMBNAILS_ONLY=0
case "${1:-}" in
  "") ;;
  --thumbnails-only) THUMBNAILS_ONLY=1 ;;
  *)
    echo "error: unknown argument $1. The only option is --thumbnails-only." >&2
    exit 1
    ;;
esac

if [ "$THUMBNAILS_ONLY" = 0 ] && [ ! -f packages/shaders-cli/dist/index.js ]; then
  echo "error: CLI not built. Run: pnpm --filter @camp-dev/shaders-cli build" >&2
  exit 1
fi

# name:format[:background][:WxH][:crop] entries (png for the flat shaders, jpg
# for the busy ones; background is optional and only needed for shaders with a
# transparent base layer, e.g. aurora, so they flatten onto a sensible color;
# WxH overrides the default capture size and is only needed for pixel-sized
# shaders like dot-field, whose posters render pixel-locked in the demo — see
# DemoPoster's pixelSize prop — and so must be captured larger than any demo
# box they'll be cropped into)
#
# crop is the side, in poster pixels, of the center square the card thumbnail
# is cut from. Without it the thumbnail keeps the poster's full height. Only a
# pixel-sized shader needs one, because its poster keeps the pattern at its
# real on-screen size and a full-height cut shrinks the pattern out of sight
# (build-thumbnail.mjs works through DotField's numbers). DotField's 360 is
# six of its 60-pixel cells across.
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
  "dot-field:png:#0a0a14:2048x1280:360" \
  "radial-gradient:jpg" \
  "god-rays:jpg:#0b0f1a" \
  "conic-gradient:jpg" \
  "dither:jpg" \
  "voronoi:jpg" \
  "fractal-noise:jpg" \
  "blobs:jpg" \
  "led-wall:jpg:#0b0f0d" \
  "cursor-ripple:jpg" \
  "cursor-spotlight:jpg" \
  "radial-wipe:jpg:#0b0f0d" \
  "dissolve:jpg:#0b0f0d"; do
  IFS=':' read -r name format background size crop <<< "$pair"
  width="$WIDTH"
  height="$HEIGHT"
  if [ -n "${size:-}" ]; then
    width="${size%x*}"
    height="${size#*x}"
  fi
  poster="${OUT_DIR}/${name}.${format}"
  if [ "$THUMBNAILS_ONLY" = 0 ]; then
    echo "==> $name ($format, ${width}x${height})"
    args=(
      --source "${COMPONENTS_DIR}/${name}/scene.tsx"
      --output "$poster"
      --format "${format}"
      --width "$width"
      --height "$height"
    )
    if [ -n "$background" ]; then
      args+=(--background "$background")
    fi
    $CLI "${args[@]}"
  fi
  thumbnail_args=("$poster")
  if [ -n "${crop:-}" ]; then
    thumbnail_args+=(--crop "$crop")
  fi
  node scripts/build-thumbnail.mjs "${thumbnail_args[@]}"
done

if [ "$THUMBNAILS_ONLY" = 1 ]; then
  echo "All thumbnails regenerated."
  exit 0
fi

# The Components banner is captured from its own scene at the mock's width,
# 1728 by the 200px header block, and shown at that size, center-cropped, by
# banner-shader.tsx. Past 864px either side of center the glow has already
# reached page black, so a wider viewport shows the page past the poster's
# edges with no seam.
echo "==> banner (jpg, 1728x200)"
$CLI \
  --source apps/docs/src/components/section-banner/banner-scene.tsx \
  --output "${OUT_DIR}/banner.jpg" \
  --format jpg \
  --width 1728 \
  --height 200 \
  --background "#0b0f0d"

echo "All posters regenerated."
