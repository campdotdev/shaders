'use client';

// The dither overlay's GPU half: a post-process pass that pixelates the
// already-rendered scene into chunky cells and posterizes each cell's color
// through an ordered threshold map (the engine's ditherThreshold — Bayer and
// friends). The wrapper (./dither.tsx) supplies the props; quantize() does
// the level math.
import { useEffect, useMemo } from 'react';

import { type DitherPattern, ditherThreshold, quantize } from '@mattermix/shaders';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useBasePassUv,
  usePostProcessPass,
  useResize,
  useShaderContext,
} from '@mattermix/shaders-react';
import { floor, mix, screenCoordinate, screenSize, step, uniform, vec3, vec4 } from 'three/tsl';

export type { DitherPattern } from '@mattermix/shaders';

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
  /**
   * How strongly the pattern pushes colors across quantization steps.
   * 0 = clean posterize bands with no dither texture, 1 = classic ordered
   * dithering, above 1 the texture bleeds into flat areas for a grittier
   * look. Accepts a static value or an animation signal.
   */
  spread: AnimatableProp<number>;
  /**
   * Luminance gate: cells darker than this value get dithered, brighter
   * cells show the pixelated scene untouched. 1 = the whole image, 0 = the
   * effect is off. Accepts a static value or an animation signal.
   */
  threshold: AnimatableProp<number>;
  /** Which threshold map drives the dither (Bayer sizes and friends). */
  pattern: DitherPattern;
}

// ---------------------------------------------
// Quantization spacing
// ---------------------------------------------
// The overlay chain composes in LINEAR light, where evenly spaced levels
// cluster perceptually in the brights — three of four steps would sit in
// what the eye reads as the bright half. So the shader quantizes in a
// gamma-encoded approximation of display space instead (encode -> quantize
// -> decode), spreading the levels perceptually. Chosen by eye against
// linear-space quantization during the build.
const GAMMA = 2.2;

export function DitherShader({ pixelSize, levels, spread, threshold, pattern }: DitherShaderProps) {
  // The dials live in uniforms (values the CPU can update each frame
  // without rebuilding the shader), tracking either a static number or an
  // animation signal.
  const pixelSizeUniform = useAnimatableUniform(pixelSize);
  const levelsUniform = useAnimatableUniform(levels);
  const spreadUniform = useAnimatableUniform(spread);
  const thresholdUniform = useAnimatableUniform(threshold);

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
  // True pixelation: snap the scene sample to the cell grid
  // ---------------------------------------------
  // The color pass below can only restyle each pixel; making a cell a truly
  // UNIFORM block means resampling the rendered scene at one shared point
  // per cell. This warp runs where the scene texture is sampled: quantize
  // the 0..1 coordinate to the cell grid and land on the cell's center
  // (+0.5), so every native pixel in a cell reads the same scene color. The
  // grid is anchored top-left like screenCoordinate, keeping these cells
  // aligned with the threshold cells in the color pass.
  useBasePassUv(
    (coordinate) => {
      const devicePixel = pixelSizeUniform.mul(dprUniform).max(1);
      const pixel = coordinate.mul(screenSize);
      const snapped = floor(pixel.div(devicePixel)).add(0.5).mul(devicePixel);

      return snapped.div(screenSize);
    },
    [pixelSizeUniform, dprUniform],
  );

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

      // The cell's map value in [0, 1): where between two quantization
      // levels this cell flips from the lower to the upper one. Neighboring
      // cells get different values, which is what dissolves banding into
      // patterned texture.
      const mapValue = ditherThreshold(pattern, cellCoord);

      // Spread pivots the map around the plain 0.5 round: at 0 every cell
      // rounds identically (clean posterize bands, no texture), at 1 the map
      // acts at full strength, and above 1 it overshoots a whole step so
      // texture bleeds into areas nowhere near a level boundary.
      const rounding = mapValue.sub(0.5).mul(spreadUniform).add(0.5);

      // max(0) first: wide-gamut inputs can carry negative channels, and
      // pow() of a negative breaks WGSL const-eval.
      const source = vec3(input.rgb)
        .max(0)
        .pow(1 / GAMMA);

      // Component-wise posterize with the cell's rounding point — the
      // definition of ordered dithering.
      const quantized = quantize(source, levelsUniform, rounding);
      const ditheredRgb = quantized.pow(GAMMA);

      // The luminance gate. Rec. 709 weights on the gamma-encoded color, so
      // the dial moves perceptually; min(1) keeps additive scenes (which can
      // exceed 1) inside the 0..1 dial range, so threshold 1 always means
      // "everything". step(edge, x) is 0 where x < edge, so this is 1 for
      // cells at or below the dial. The input color is already per-cell
      // here, which lands the mask crisply on cell boundaries. Ungated
      // cells show the pixelated scene without posterization.
      const luminance = source.dot(vec3(0.2126, 0.7152, 0.0722)).min(1);
      const affected = step(luminance, thresholdUniform);
      const outputRgb = mix(vec3(input.rgb), ditheredRgb, affected);

      // Alpha passes through untouched (same rationale as the engine's
      // anti-banding dither: collapsing it would flash opaque black over
      // transparent frames).
      return vec4(outputRgb, input.a);
    },
    [pixelSizeUniform, levelsUniform, spreadUniform, thresholdUniform, dprUniform, pattern],
  );

  return null;
}
