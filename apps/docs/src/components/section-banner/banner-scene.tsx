'use client';

/**
 * The Components banner's shader: the Figma mock's lime glow, drawn by
 * RadialGradient and screened into a grid of LED dots by LedWall. It is one
 * fixed scene, the same on the index and on every component page, and it
 * never reads the shader demoed below it. banner-shader.tsx owns the
 * client-only import, the poster that stands in until this scene paints,
 * and the visual-test skip; this file is the scene.
 */
import { type ColorStop, LedWall, RadialGradient, ShaderScene, useCursor } from '@camp-dev/shaders';

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

/**
 * The glow's ramp: the palette's lime 600 and 700, an off-palette dark
 * green, then the page black. The mock draws its ellipse in lime 400 at
 * 7.5% opacity, which reads as a faint wash rather than a lime fill. The
 * dots sample this base directly and take its color at full strength, so
 * the ramp starts two palette steps darker than the mock's to land the
 * dots near the same brightness. Move every stop one step to tune. Hex
 * rather than the CSS custom properties, because a shader prop goes
 * through parseColorString and never sees the cascade.
 */
const LIME_STOPS: ColorStop[] = [
  { color: '#3a4a00', position: 0 },
  { color: '#2f3c00', position: 0.33 },
  { color: '#1d2507', position: 0.66 },
  { color: '#0b0f0d', position: 1 },
];

/**
 * How much of the glow shows between the dots, 0 for transparent gaps and 1
 * for the base untouched. The mock's 7.5%, so the wash between the dots
 * matches it while the dots themselves stay full strength.
 */
const BANNER_BLEED = 0.075;

/**
 * How dark each dot goes at the bottom of its breath, 0 for still and 1
 * for fully dark. Above LedWall's own default so the breathing reads at a
 * glance.
 */
const BANNER_FLICKER = 0.7;

/**
 * Tempo of the breath. LedWall's 1 is roughly one breath every six seconds,
 * and each dot retunes itself between 0.8 and 1.2 times the dial, so 1.8
 * is a breath every three seconds or so. Below the component's default of
 * 2.4, so the header breathes rather than shimmers.
 */
const BANNER_SPEED = 1.8;

/**
 * Where the wall's focus sits before the pointer first moves: one canvas
 * height below the bottom edge, in the same 0..1 frame as `focus`. The
 * cursor input otherwise seeds at the canvas center, which would swell a
 * cluster of dots under the middle of the header on every load, reading as
 * a highlight for a pointer that is not there. The first real pointer move
 * brings the focus in from below.
 */
const FOCUS_PARKED: readonly [number, number] = [0.5, 2];

// ----------------------------------------------------------------------------
// The scene
// ----------------------------------------------------------------------------

/**
 * The wall with the pointer as its focus. useCursor reads the scene's canvas
 * from context, so this has to render inside the ShaderScene. The input
 * listens on the window and normalizes against the canvas, so a pointer
 * anywhere on the page steers the focus, and one far below the header lands
 * well outside the swell's reach and moves no dot. Swell strength and reach
 * are LedWall's own tuned defaults.
 */
function BannerWall() {
  const cursor = useCursor({ initial: FOCUS_PARKED });

  return (
    <LedWall bleed={BANNER_BLEED} flicker={BANNER_FLICKER} focus={cursor} speed={BANNER_SPEED} />
  );
}

/**
 * Two layers in mount order: the glow, then the wall screening it, breathing
 * and swelling toward the pointer. The poster in banner-shader.tsx is
 * captured from this scene at its first frame, and ShaderScene rewinds the
 * clock and the breath phases on that frame, so the live wall takes over
 * from the poster in the same pose.
 */
export default function BannerScene() {
  return (
    <ShaderScene>
      <RadialGradient
        center={ORIGIN}
        radius={GLOW_RADIUS}
        stops={LIME_STOPS}
        stretch={GLOW_STRETCH}
      />
      <BannerWall />
    </ShaderScene>
  );
}
