'use client';

/**
 * The Components banner's shader: the Figma mock's faint lime wash, drawn by
 * RadialGradient, under a still grid of small gray dots from DotField, with
 * Dither over both so every dot breaks into a few Bayer cells and the wash
 * into speckle. It is one fixed scene, the same on the index and on every
 * component page, and it never reads the shader demoed below it.
 * banner-shader.tsx owns the client-only import, the poster that stands in
 * until this scene paints, and the visual-test skip; this file is the scene.
 */
import { type ColorStop, Dither, DotField, RadialGradient, ShaderScene } from '@camp-dev/shaders';

import { BANNER_HEIGHT, BANNER_WIDTH } from './banner-geometry';
import { BANNER_TUNING, type BannerTuning } from './banner-tuning';

// ----------------------------------------------------------------------------
// The mock's geometry
// ----------------------------------------------------------------------------

// The canvas is always BANNER_WIDTH by BANNER_HEIGHT (banner-geometry.ts),
// so every pixel figure below is exact at every window width.

/**
 * The mock's glow is a half-ellipse centered on the block's bottom edge,
 * half the viewport wide and as tall as the block, so its top just touches
 * the top of the nav. These are its two semi-axes in CSS pixels.
 */
const GLOW_HALF_WIDTH = BANNER_WIDTH / 2;
const GLOW_HEIGHT = BANNER_HEIGHT;

/** Where the glow starts: the bottom center of the block, in 0..1 canvas units. */
const ORIGIN = [0.5, 1] as const;

/**
 * `stretch` squashes RadialGradient's circle into an ellipse. It is the
 * horizontal reach over the vertical one, so the mock's 864 by 200 glow is
 * 4.32: a pixel has to sit 4.32 times further out sideways to land on the
 * same color it would 1 unit up.
 */
const GLOW_STRETCH = GLOW_HALF_WIDTH / GLOW_HEIGHT;

/**
 * `radius` is where the ramp reaches its last color, with 1 landing at the
 * canvas corners. The shader measures distance in canvas heights and divides
 * by the half-diagonal in those units, and `stretch` leaves the vertical
 * reach alone, so the ramp ends at the top of the block when radius is one
 * canvas height divided by the half-diagonal of the 1728 by 200 canvas: about
 * 0.23. The canvas is always that size, so the figure is exact everywhere.
 */
const HALF_DIAGONAL = Math.hypot(BANNER_WIDTH / BANNER_HEIGHT / 2, 0.5);
const GLOW_RADIUS = GLOW_HEIGHT / BANNER_HEIGHT / HALF_DIAGONAL;

// ----------------------------------------------------------------------------
// The mock's colors
// ----------------------------------------------------------------------------

/**
 * The page background, and the wash's last stop. Hex rather than the CSS
 * custom property, because a shader prop goes through parseColorString and
 * never sees the cascade.
 */
const PAGE_BLACK = '#0b0f0d';

// ----------------------------------------------------------------------------
// How the dots become marks
// ----------------------------------------------------------------------------
// Dither samples the finished scene once per cell, at the cell's center, so
// a dot smaller than a few cells reaches it as a handful of flat gray cells.
// Each of those cells then rounds to a quantization step on its own: the
// dot's gray, scaled by the step count, plus the cell's slot in the Bayer
// tile, floored. A cell lights when that sum crosses 1, so the tile's
// highest slots light first and a darker gray lights fewer of them. Bayer
// 4x4's five highest slots are the corners and center of a 3 by 3 window,
// an x, whose center sits 1.5 cells across and 2.5 cells down from the
// tile's top-left corner. Two alignments have to hold for every dot to draw
// that same x. `spacing` must be a multiple of the tile edge, the matrix
// size times `pixelSize`, so every dot meets the tile at one phase. And
// that phase must put the dot's center on the window's center: DotField
// anchors its grid at the canvas center and Dither anchors its tiles at the
// canvas corner, so the phase is set by the canvas size alone, half the
// width and half the height taken modulo the tile edge.

// ----------------------------------------------------------------------------
// The scene
// ----------------------------------------------------------------------------

/**
 * Three layers in mount order: the wash, the dot grid over it with the
 * ripple off so the grid never moves, then Dither carving both into cells.
 * Nothing here animates and RadialGradient at speed 0 votes the scene
 * static, so it parks after one frame. The poster in banner-shader.tsx is
 * captured from this scene, so the live scene takes over from it unchanged.
 */
export default function BannerScene({ tuning = BANNER_TUNING }: { tuning?: BannerTuning }) {
  const stops: ColorStop[] = [
    { color: tuning.glowColor, position: 0 },
    { color: PAGE_BLACK, position: 1 },
  ];

  return (
    <ShaderScene>
      <RadialGradient center={ORIGIN} radius={GLOW_RADIUS} stops={stops} stretch={GLOW_STRETCH} />
      <DotField
        amplitude={0}
        color={tuning.dotColor}
        dotSize={tuning.dotSize}
        spacing={tuning.spacing}
        speed={0}
      />
      <Dither
        levels={tuning.levels}
        pattern={tuning.pattern}
        pixelSize={tuning.pixelSize}
        spread={tuning.spread}
      />
    </ShaderScene>
  );
}
