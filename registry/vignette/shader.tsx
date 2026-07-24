'use client';

// The vignette's GPU half: a post-process pass that measures each pixel's
// distance from a focal point and blends the already-rendered image toward
// `color` as that distance grows. The wrapper (./vignette.tsx) supplies the
// props; the engine's mixColor() does the color-space-aware blending.
import { useEffect, useMemo } from 'react';

import { mixColor } from '@lovo/matter';
import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  usePostProcessPass,
  useResize,
} from '@lovo/matter-react';
import { length, smoothstep, uniform, uv, vec2, vec4 } from 'three/tsl';
import { Vector2, Vector3 } from 'three/webgpu';

import { parseColor } from '../utils/color';

export interface VignetteShaderProps {
  /**
   * Overlay strength toward the edges. 0 = no vignette, 1 = full `color` at
   * the edge. Accepts a static value or an animation signal.
   */
  intensity: AnimatableProp<number>;
  /**
   * How gradually the vignette ramps in, as a fraction of `radius`.
   * 0 = a hard ring at `radius`; 1 = feathers all the way from the center.
   * Accepts a static value or an animation signal.
   */
  feather: AnimatableProp<number>;
  /**
   * Vignette center, 0..1 across the canvas; `[0.5, 0.5]` is centered and
   * `[0, 0]` is the top-left corner.
   */
  center: [number, number];
  /**
   * Normalized distance from `center` at which the vignette reaches full
   * strength. Smaller values close the vignette in sooner.
   * Accepts a static value or an animation signal.
   */
  radius: AnimatableProp<number>;
  /** Color blended in toward the edges (hex, `oklch()`, or `oklab()`). */
  color: string;
  /** Color space the overlay blend is computed in. */
  colorSpace: ColorSpace;
  /** Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert otherwise. */
  hueInterpolation: HueInterpolation;
}

export function VignetteShader({
  intensity,
  feather,
  center,
  radius,
  color,
  colorSpace,
  hueInterpolation,
}: VignetteShaderProps) {
  // The three animated dials live in uniforms (values the CPU can update
  // each frame without rebuilding the shader), tracking either a static
  // number or an animation signal.
  const intensityUniform = useAnimatableUniform(intensity);
  const featherUniform = useAnimatableUniform(feather);
  const radiusUniform = useAnimatableUniform(radius);

  // ---------------------------------------------
  // Stable vectors the prop effects write into
  // ---------------------------------------------
  // Each vector and its uniform wrapper are created once and never replaced;
  // the effects push new prop values in with .set(). The pass at the bottom
  // depends only on these stable references, so changing `center` or `color`
  // updates the picture without tearing down and recompiling the pass. This
  // also keeps the raw `center` array out of the heavy effect's deps — the
  // tuple gets a fresh identity every render.
  //
  // Unlike the mesh components, `center` needs NO y flip here: the
  // post-process quad's uv is already screen-style (v = 0 at the top), so
  // the prop's top-left-origin coordinates pass straight through. Verified
  // by poster render — don't "fix" this to match the mesh components.

  const centerVec = useMemo(
    () => new Vector2(center[0], center[1]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const centerUniform = useMemo(() => uniform(centerVec), [centerVec]);

  useEffect(() => {
    centerVec.set(center[0], center[1]);
  }, [center, centerVec]);

  // The color prop decodes once into linear rgb channels (parseColor handles
  // hex and wide-gamut oklch/oklab strings); the effect below re-decodes
  // whenever the string changes.
  const colorVec = useMemo(
    () => {
      const [redChannel, greenChannel, blueChannel] = parseColor(color);

      return new Vector3(redChannel, greenChannel, blueChannel);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const colorUniform = useMemo(() => uniform(colorVec), [colorVec]);

  useEffect(() => {
    const [redChannel, greenChannel, blueChannel] = parseColor(color);

    colorVec.set(redChannel, greenChannel, blueChannel);
  }, [color, colorVec]);

  // ---------------------------------------------
  // Track the canvas aspect ratio
  // ---------------------------------------------
  // The distance math below needs width/height to keep the vignette
  // circular. The uniform starts from the current canvas size (falling back
  // to 16:9 when the canvas hasn't been laid out yet and reports 0), then an
  // effect re-reads it on mount and follows every resize. The zero guards
  // skip nonsense ratios while the canvas is collapsed.
  const resize = useResize();
  const [initialWidth, initialHeight] = resize.get();
  const aspectNode = useMemo(
    () => uniform(initialHeight > 0 ? initialWidth / initialHeight : 16 / 9),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) aspectNode.value = canvasWidth / canvasHeight;

    return resize.on('change', ([updatedWidth, updatedHeight]) => {
      if (updatedWidth > 0 && updatedHeight > 0) aspectNode.value = updatedWidth / updatedHeight;
    });
  }, [resize, aspectNode]);

  // ---------------------------------------------
  // The pass: distance -> mask -> blend
  // ---------------------------------------------
  // A post-process pass: the callback receives each already-rendered pixel
  // (`input`, rgba) and returns a replacement.
  usePostProcessPass(
    (input) => {
      // How far is this pixel from the focal point? uv() is the pixel's
      // 0..1 position on the canvas. Multiplying the horizontal offset by
      // width/height converts it into the same units as the vertical offset
      // — without that, length() would measure an ellipse stretched to the
      // canvas shape instead of a circle.
      const aspect = aspectNode;
      const centered = uv().sub(centerUniform);
      const corrected = vec2(centered.x.mul(aspect), centered.y);
      const distance = length(corrected);

      // Where the fade begins. oneMinus() flips the 0..1 feather dial:
      // feather 0 puts the start at radius itself (zero-width band — a hard
      // ring), feather 1 puts it at the focal point (the fade spans the
      // whole radius). smoothstep then eases 0 -> 1 across that band, so the
      // mask is 0 inside featherStart, 1 past radius, and an S-curve in
      // between. Intensity scales the whole mask: the blend amount per
      // pixel, 0 = untouched, 1 = fully `color` at the edge.
      const featherStart = radiusUniform.mul(featherUniform.oneMinus());
      const mask = smoothstep(featherStart, radiusUniform, distance);
      const factor = mask.mul(intensityUniform);

      // Blend the upstream pixel toward `color` inside the chosen color space,
      // following `hueInterpolation`'s arc for cylindrical spaces. mixColor works
      // on linear vec3, so blend rgb and carry the original alpha through.
      const blended = mixColor(input.rgb, colorUniform, factor, colorSpace, hueInterpolation);

      return vec4(blended, input.a);
    },
    [
      intensityUniform,
      featherUniform,
      radiusUniform,
      centerUniform,
      colorUniform,
      aspectNode,
      colorSpace,
      hueInterpolation,
    ],
  );

  return null;
}
