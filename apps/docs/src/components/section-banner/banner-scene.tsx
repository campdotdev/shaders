'use client';

/**
 * The Components banner's shader: the Figma mock's faint lime wash, drawn by
 * RadialGradient, under the mock's still grid of small x marks, drawn by
 * DotField with its cross shape. It is one fixed scene, the same on the
 * index and on every component page, and it never reads the shader demoed
 * below it. banner-shader.tsx owns the client-only import, the poster that
 * stands in until this scene paints, and the visual-test skip; this file is
 * the scene.
 */
import { type ColorStop, DotField, RadialGradient, ShaderScene } from '@camp-dev/shaders';

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
// The scene
// ----------------------------------------------------------------------------

/**
 * Two layers in mount order: the wash, then the grid of x marks over it
 * with the ripple off so the grid never moves. Nothing here animates and
 * RadialGradient at speed 0 votes the scene static, so it parks after one
 * frame. The poster in banner-shader.tsx is captured from this scene, so
 * the live scene takes over from it unchanged.
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
        shape="cross"
        spacing={tuning.spacing}
        speed={0}
      />
    </ShaderScene>
  );
}
