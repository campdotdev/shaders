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

// Every color here is a literal rather than a CSS custom property, because a
// shader prop goes through parseColorString and never sees the cascade.

/**
 * The wash: the mock's lime glow at its center, fading to the page black.
 * Two stops, since nothing samples the wash for brightness — the marks carry
 * their own color and the gaps between them show this untouched.
 */
const GLOW_STOPS: ColorStop[] = [
  { color: 'oklch(0.22 0.04 130)', position: 0 },
  { color: '#0b0f0d', position: 1 },
];

/**
 * The marks' flat color, read off the mock by eye. It is what stands in for
 * an opacity dial, which DotField has no equivalent of: a near-black green
 * over a near-black wash reads as the mock's faint texture, and lifting the
 * lightness is what brings the grid forward.
 */
const MARK_COLOR = 'oklch(0.26 0.02 155)';

// ----------------------------------------------------------------------------
// The mock's grid
// ----------------------------------------------------------------------------

/**
 * Mark pitch in CSS pixels. The mock's pattern is five marks across 32
 * pixels, a 6.4 pitch, rounded here to a whole number for a reason worth
 * keeping: a mark's arms are under a pixel thick, so where a mark falls
 * between device pixels decides which pixels it touches. At 6.4 the pitch is
 * 12.8 device pixels on a 2x display, so consecutive marks land at five
 * different sub-pixel positions and each one drew a different pattern — one
 * looked like an H, the next like an x. A whole-pixel pitch puts every mark
 * at the same position on both 1x and 2x, so they all draw alike. The grid
 * is anchored at the canvas center, 864 by 100, both whole, so the alignment
 * holds on every display.
 */
const MARK_SPACING = 6;

/**
 * Mark width in CSS pixels, tip to tip. The mock's SVG export measures 6.34
 * wide on a grid of about 20, which is the pattern at roughly 3x, so a mark
 * is about 2 at 1x. Nudged up from there so the arms, which are 0.317 of
 * this, clear one device pixel on a 2x display.
 */
const MARK_SIZE = 2.5;

// ----------------------------------------------------------------------------
// The scene
// ----------------------------------------------------------------------------

/**
 * Two layers in mount order: the wash, then the grid of x marks over it with
 * the ripple off so the grid never moves. Nothing here animates and
 * RadialGradient at speed 0 votes the scene static, so it parks after one
 * frame. The poster in banner-shader.tsx is captured from this scene, so the
 * live scene takes over from it unchanged.
 */
export default function BannerScene() {
  return (
    <ShaderScene>
      <RadialGradient
        center={ORIGIN}
        radius={GLOW_RADIUS}
        stops={GLOW_STOPS}
        stretch={GLOW_STRETCH}
      />
      <DotField
        amplitude={0}
        color={MARK_COLOR}
        dotSize={MARK_SIZE}
        shape="cross"
        spacing={MARK_SPACING}
        speed={0}
      />
    </ShaderScene>
  );
}
