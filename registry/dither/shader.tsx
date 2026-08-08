'use client';

// The dither overlay's GPU half: a post-process pass that pixelates the
// already-rendered scene into chunky cells and posterizes each cell's color
// through an ordered threshold map (the engine's ditherThreshold — Bayer and
// friends). The wrapper (./dither.tsx) supplies the props; quantize() does
// the level math.
import { useEffect, useMemo } from 'react';

import { type DitherPattern, ditherThreshold, quantize } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  usePostProcessPass,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { screenCoordinate, uniform, vec3, vec4 } from 'three/tsl';

export type { DitherPattern } from '@lovo/matter';

export interface DitherShaderProps {
  /**
   * Edge length of one dither cell in CSS pixels — bigger cells, chunkier
   * image. Accepts a static value or an animation signal.
   */
  pixelSize: AnimatableProp<number>;
  /**
   * Quantization levels per color channel. 2 is the harshest two-tone look;
   * around 6 reads as subtle banding. Fractional values animate the spacing
   * continuously. Accepts a static value or an animation signal.
   */
  levels: AnimatableProp<number>;
  /** Which threshold map drives the dither (Bayer sizes and friends). */
  pattern: DitherPattern;
}

// ---------------------------------------------
// Quantization spacing (resolved at the first visual gate)
// ---------------------------------------------
// The overlay chain composes in LINEAR light, where evenly spaced levels
// cluster perceptually in the brights. With this flag on, the shader
// quantizes in a gamma-encoded approximation of display space instead
// (encode -> quantize -> decode), spreading the levels perceptually. Judged
// by eye at Gate 1; the loser gets deleted at the defaults gate.
const QUANTIZE_IN_GAMMA = true;
const GAMMA = 2.2;

export function DitherShader({ pixelSize, levels, pattern }: DitherShaderProps) {
  // The two dials live in uniforms (values the CPU can update each frame
  // without rebuilding the shader), tracking either a static number or an
  // animation signal.
  const pixelSizeUniform = useAnimatableUniform(pixelSize);
  const levelsUniform = useAnimatableUniform(levels);

  // ---------------------------------------------
  // CSS pixels -> device pixels
  // ---------------------------------------------
  // pixelSize is specified in CSS pixels so the look matches across 1x and
  // 3x displays, but screenCoordinate below counts device pixels. The
  // renderer's pixel ratio (which respects maxDPR clamping) converts between
  // them; useResize re-fires on monitor moves and browser zoom, when that
  // ratio changes.
  const shaderContext = useShaderContext();
  const resize = useResize();
  // Created once and never replaced (vignette's aspect-uniform pattern): the
  // effect below writes into it, and the pass depends on the stable wrapper.
  const dprUniform = useMemo(
    () => uniform(resize.get()[2] || 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const apply = () => {
      const rendererRatio = shaderContext?.renderer.three.getPixelRatio();

      dprUniform.value =
        rendererRatio !== undefined && rendererRatio > 0 ? rendererRatio : resize.get()[2] || 1;
    };

    apply();

    return resize.on('change', apply);
  }, [resize, dprUniform, shaderContext]);

  // ---------------------------------------------
  // The pass: cell -> threshold -> posterize
  // ---------------------------------------------
  // A post-process pass: the callback receives each already-rendered pixel
  // (`input`, rgba) and returns a replacement.
  usePostProcessPass(
    (input) => {
      // Which dither cell is this pixel in? screenCoordinate counts device
      // pixels from the top-left; dividing by the cell edge puts every pixel
      // of a cell at the same integer part. max(1) guards a zero-sized cell
      // (division by zero) if pixelSize animates through 0.
      const devicePixel = pixelSizeUniform.mul(dprUniform).max(1);
      const cellCoord = screenCoordinate.xy.div(devicePixel);

      // The cell's threshold in [0, 1): where between two quantization
      // levels this cell flips from the lower to the upper one. Neighboring
      // cells get different thresholds, which is what dissolves banding into
      // patterned texture.
      const threshold = ditherThreshold(pattern, cellCoord);

      // max(0) first: wide-gamut inputs can carry negative channels, and
      // pow() of a negative breaks WGSL const-eval.
      const linearRgb = vec3(input.rgb).max(0);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- gate A/B toggle, removed at the defaults gate
      const source = QUANTIZE_IN_GAMMA ? linearRgb.pow(1 / GAMMA) : linearRgb;

      // Component-wise posterize with the cell's threshold as the rounding
      // point — the definition of ordered dithering.
      const quantized = quantize(source, levelsUniform, threshold);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- gate A/B toggle, removed at the defaults gate
      const outputRgb = QUANTIZE_IN_GAMMA ? quantized.pow(GAMMA) : quantized;

      // Alpha passes through untouched (same rationale as the engine's
      // anti-banding dither: collapsing it would flash opaque black over
      // transparent frames).
      return vec4(outputRgb, input.a);
    },
    [pixelSizeUniform, levelsUniform, dprUniform, pattern],
  );

  return null;
}
