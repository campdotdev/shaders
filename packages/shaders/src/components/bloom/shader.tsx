'use client';

// The bloom's GPU half: a resample that reads the image beneath it, keeps
// only the light bright enough to bloom, and blurs that light through a
// chain of smaller textures (./chain.ts). The wrapper (./bloom.tsx) supplies
// the props. The blurred light, the glow, is then added back over the
// image. ADR 0010 records why Bloom reads the image only through the sampler the output
// stage hands it.
import { useEffect, useMemo } from 'react';

import type { ShaderNodeObject } from 'three/tsl';
import { clamp, dot, float, max, min, type uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useResample } from '../../react/hooks/use-resample/use-resample.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { createBloomChain } from './chain.js';

type TSLValue = ShaderNodeObject<Node>;
type FloatUniform = ReturnType<typeof uniform<number>>;

// ---------------------------------------------
// Constants
// ---------------------------------------------

/**
 * How much each color channel counts toward luminance, a single number for
 * how bright a color looks. These are the Rec. 709 weights for linear red,
 * green, and blue, and they sum to 1, so white measures 1. The eye is most
 * sensitive to green and least to blue: pure green measures 0.72 and pure
 * blue 0.07, which is why a saturated blue blooms later than a yellow that
 * looks as bright.
 */
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;

/**
 * The knee's width, as a share of the threshold. The knee is the range of
 * luminance just below the threshold where light fades in. At 0.5 it runs
 * from half the threshold up to the threshold. Higher starts the fade from
 * darker light, so the kept light has softer edges and more of the image
 * blooms faintly. Lower fades in over a narrower range, and near 0 light
 * switches on at the threshold.
 */
const KNEE = 0.5;

/**
 * The narrowest knee, in luminance. The fade divides by the knee's width,
 * and a threshold of 0 would make that width 0. This floor keeps the divide
 * finite. It is far below one step of an 8-bit channel (1/255), so it
 * changes nothing visible.
 */
const MIN_KNEE_WIDTH = 1e-4;

export interface BloomShaderProps {
  /**
   * How bright a part of the image has to be before it blooms, as a
   * luminance, where 0 is black and 1 is the brightest white a screen
   * shows. 0 blooms everything. Light fades in over the range from half
   * the threshold up to it. Accepts a static value or an animation signal.
   */
  threshold: AnimatableProp<number>;
  /**
   * How far the glow reaches, from 0 to 1. 0 keeps it tight against the
   * bright parts, and 1 lets it reach about a third of the canvas's
   * height. The glow stays as bright against the light at every radius,
   * and a higher one adds the wide, faint part. Values outside 0 to 1
   * clamp. Accepts a static
   * value or an animation signal.
   */
  radius: AnimatableProp<number>;
  /**
   * How much of the glow is added over the image. 0 adds none and leaves
   * the image as it was, 1 adds the glow as the chain made it, and higher
   * values add more. Negative values act as 0. Accepts a static value or
   * an animation signal.
   */
  strength: AnimatableProp<number>;
}

// ---------------------------------------------
// The bright pass: keep the light that blooms
// ---------------------------------------------

/**
 * Scale a color by how far its luminance sits into the knee: 0 below the
 * knee, 1 at the threshold and above, and a smooth rise between. `color` is
 * a premultiplied rgba, so the result is too.
 */
function keepBright(color: TSLValue, threshold: FloatUniform): TSLValue {
  // The scene texture is premultiplied: each color channel is already
  // scaled by alpha (the premultiplied-alpha gotcha in docs/agents/tsl.md).
  // So this luminance is already weighed by alpha. A half-transparent white
  // measures 0.5, and a fully transparent pixel measures 0 and never counts
  // as bright. dot() multiplies the channels by the weights pair by pair
  // and sums them. Nothing clamps the result: the scene pass stores half
  // floats, 16-bit numbers that hold values past 1, so a Source that adds
  // light can measure above 1.
  const luminance = dot(vec3(color.rgb), vec3(...LUMINANCE_WEIGHTS));

  // The knee, in luminance. It ends at the threshold and starts one width
  // below. A negative threshold acts as 0.
  const kneeEnd = max(threshold, 0);
  const kneeWidth = max(kneeEnd.mul(KNEE), MIN_KNEE_WIDTH);

  // How far into the knee this pixel sits: 0 at the knee's start and
  // below, 1 at the threshold and above. At a threshold of 0 the knee's
  // start is just below 0, so every pixel lands at 1 and everything blooms.
  const progress = clamp(luminance.sub(kneeEnd.sub(kneeWidth)).div(kneeWidth), 0, 1);

  // Smoothstep's curve, 3t² - 2t³, written out. It is flat at both ends,
  // so the kept light eases in at the knee's start and eases out at the
  // threshold, with no visible line at either. TSL's own smoothstep(a, b,
  // x) is undefined when a equals b, which a threshold of 0 would cause,
  // and the floored width above is what avoids that.
  const kept = progress.mul(progress).mul(float(3).sub(progress.mul(2)));

  // Scale all four channels. A pixel below the knee becomes transparent
  // black, which adds nothing when the glow goes back over the image.
  return color.mul(kept);
}

export function BloomShader({ threshold, radius, strength }: BloomShaderProps) {
  const shaderContext = useShaderContext();

  // The dials live in uniforms, values the CPU writes and the GPU reads at
  // each draw, so changing them never rebuilds the output chain.
  const thresholdUniform = useAnimatableUniform<number>(threshold);
  const radiusUniform = useAnimatableUniform<number>(radius);
  const strengthUniform = useAnimatableUniform<number>(strength);

  // ---------------------------------------------
  // The blur chain
  // ---------------------------------------------
  // The chain's nodes, which allocate nothing on the GPU, so a memo can
  // hold them through a Strict Mode remount. The effect below allocates
  // the textures and releases them (the Strict Mode gotcha in
  // docs/agents/tsl.md).
  //
  // The second argument is asked once a frame, on the CPU, before the
  // chain draws. A uniform's `.value` is the number the CPU last wrote, so
  // at a strength of 0 the chain skips all its draws and Bloom costs one
  // read of a stale texture, multiplied by 0.
  const chain = useMemo(
    () => createBloomChain(float(radiusUniform), () => strengthUniform.value > 0),
    [radiusUniform, strengthUniform],
  );

  useEffect(() => {
    if (!shaderContext) return;

    return chain.start(shaderContext);
  }, [chain, shaderContext]);

  // ---------------------------------------------
  // The resample: hand the chain the bright parts, read back the glow
  // ---------------------------------------------
  // A resample. The callback receives sampleBeneath, a function that reads
  // everything mounted beneath this Effect at a 0..1 canvas coordinate, and
  // returns the function that replaces it. The output stage calls the
  // callback again each time it rebuilds, with a new sampleBeneath.
  useResample(
    (sampleBeneath) => {
      // What the chain blurs. uv() here is the 0..1 position of a texel of
      // the chain's first level. That level is half the canvas's size, so
      // each texel sits where four of the canvas's pixels meet, and those
      // pixels' centers are a quarter of a texel out along each diagonal.
      // One read at each center returns that pixel alone. The bright pass
      // runs on each read, and the four results are averaged.
      //
      // The order matters. One read at the texel's own position would
      // return the average of the four pixels, and a lone bright pixel,
      // such as one of Swells' glints, would drop to a quarter of its
      // brightness before the bright pass saw it and fall below the
      // threshold. Run per pixel, the bright pass keeps it, and the average
      // then spreads its light over the texel.
      //
      // Every read goes through sampleBeneath, so each resample mounted
      // beneath Bloom shapes the glow as it shapes the image. They run four
      // times per texel here, which is once per pixel of the canvas.
      const brightAt = (offsetX: number, offsetY: number) =>
        keepBright(
          sampleBeneath(uv().add(vec2(offsetX, offsetY).mul(chain.firstTexel))),
          thresholdUniform,
        );

      chain.setSource(
        brightAt(-0.25, -0.25)
          .add(brightAt(0.25, -0.25))
          .add(brightAt(-0.25, 0.25))
          .add(brightAt(0.25, 0.25))
          .mul(0.25),
      );

      // The output: the image, plus the glow scaled by `strength`. Both
      // are read at the coordinate Bloom is asked for, so a UV warp mounted
      // above Bloom moves the image and its glow together.
      return (coordinate) => {
        const image = vec4(sampleBeneath(coordinate));
        const glow = vec4(chain.glowAt(coordinate)).mul(max(strengthUniform, 0));

        // Light adds. Two lamps on one wall are brighter than either, so
        // the glow's color goes on top of the image's with a plain sum.
        // The sum can pass 1, and the screen clips it to white there,
        // which is what a camera does to light it cannot hold.
        //
        // Alpha takes the same sum, capped at 1. The glow's alpha is the
        // blurred alpha of the light that bloomed, so where the glow lands
        // on a transparent part of the scene it brings its own coverage
        // and shows over the page behind the canvas. Both values are
        // premultiplied, so color and alpha stay matched when they add
        // (the premultiplied-alpha gotcha in docs/agents/tsl.md). Alpha
        // past 1 has no meaning to the browser, hence the cap.
        return vec4(image.rgb.add(glow.rgb), min(image.a.add(glow.a), 1));
      };
    },
    [chain, thresholdUniform, strengthUniform],
  );

  return null;
}
