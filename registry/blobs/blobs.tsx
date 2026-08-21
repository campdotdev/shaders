'use client';

// Public face of the Blobs goo: owns the props, their JSDoc, and their
// defaults, then delegates to BlobsShader (./shader.tsx), which sums a
// metaball field over roaming blob centers and thresholds it into merging,
// splitting shapes. Render it inside a <ShaderScene>, typically stacked
// over a background layer — the space between blobs is transparent.
import type { ColorSpace, HueInterpolation } from '@camp-dev/shaders';
import type { AnimatableProp } from '@camp-dev/shaders-react';

import type { ColorStop } from '../utils/color';
import { BlobsShader } from './shader';

export type { ColorStop } from '../utils/color';

export interface BlobsProps {
  /**
   * Palette blobs draw from. Each blob picks its color by a stable per-blob
   * random value mapped along this ramp. Accepts hex, `oklch()`, or
   * `oklab()`; positions auto-space when omitted.
   */
  stops?: ColorStop[];
  /**
   * Number of blobs, 1-20. Fractional values grow the last blob in
   * smoothly, so an animated count never pops. Defaults to 8. Accepts a
   * static value or an animation signal.
   */
  count?: AnimatableProp<number>;
  /**
   * Base blob size. 0 is tight beads; 1 is fat blobs that merge from far
   * apart. Defaults to 0.6. Accepts a static value or an animation signal.
   */
  size?: AnimatableProp<number>;
  /**
   * How much blob sizes differ from each other. 0 renders every blob at
   * `size`; 1 scatters them from near-zero to full size. Defaults to 0.5.
   * Accepts a static value or an animation signal.
   */
  sizeVariation?: AnimatableProp<number>;
  /**
   * How far blobs roam from `center`. 0 huddles them into one gooey mass;
   * 1 ranges them across the canvas so merges become occasional
   * encounters. Defaults to 0.8. Accepts a static value or an animation
   * signal.
   */
  spread?: AnimatableProp<number>;
  /**
   * Width of the goo edge. 0 is a crisp anti-aliased silhouette; 1 fades
   * blobs out as soft mist. Defaults to 0.4. Accepts a static value or an
   * animation signal.
   */
  softness?: AnimatableProp<number>;
  /**
   * Depth inside the goo: slides colors along the ramp by field strength
   * around each blob's own pick — toward the ramp's start at the edges and
   * its end in the cores. 0 is flat. Defaults to 0.5. Accepts a static
   * value or an animation signal.
   */
  shading?: AnimatableProp<number>;
  /**
   * Center of the roam region, 0..1 across the canvas; `[0.5, 0.5]` is the
   * canvas middle. Defaults to `[0.5, 0.5]`. Accepts a static value or an
   * animation signal.
   */
  center?: AnimatableProp<readonly [number, number]>;
  /**
   * How fast blobs drift. 0 freezes them. Defaults to 0.2. Accepts a
   * static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * Re-rolls every blob's path, size, and color pick. Change it for a
   * different arrangement of the same character. Defaults to 0.
   */
  seed?: number;
  /** Color space the ramp interpolates in. Defaults to `'oklab'`. */
  colorSpace?: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise. Defaults to `'shorter'`.
   */
  hueInterpolation?: HueInterpolation;
}

// Deep-water palette: stops walk a lightness ladder (dark navy up to
// bright purple) so neighboring blobs read as depth, not hue soup. The
// darkest stop sits at blue's near-max chroma for its lightness — dark
// hues can't hold much more and stay inside P3.
const DEFAULT_STOPS: ColorStop[] = [
  { color: 'oklch(0.255 0.108 265.847)' }, // paletteOklch.blue[2]
  { color: 'oklch(0.346 0.198 265.847)' }, // paletteOklch.blue[4]
  { color: 'oklch(0.460 0.248 293.328)' }, // paletteOklch.violet[6]
  { color: 'oklch(0.720 0.250 320)' }, // paletteOklch.purple[9]
];

// Hoisted so the default isn't a fresh array literal on every render —
// center feeds effect deps downstream.
const DEFAULT_CENTER: readonly [number, number] = [0.5, 0.5];

export function Blobs({
  stops = DEFAULT_STOPS,
  count = 8,
  size = 0.6,
  sizeVariation = 0.5,
  spread = 0.8,
  softness = 0.4,
  shading = 0.5,
  center = DEFAULT_CENTER,
  speed = 0.2,
  seed = 0,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: BlobsProps) {
  return (
    <BlobsShader
      center={center}
      colorSpace={colorSpace}
      count={count}
      hueInterpolation={hueInterpolation}
      seed={seed}
      shading={shading}
      size={size}
      sizeVariation={sizeVariation}
      softness={softness}
      speed={speed}
      spread={spread}
      stops={stops}
    />
  );
}
