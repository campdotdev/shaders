'use client';

// The bloom's GPU half: a resample that reads the image beneath it and keeps
// only the light bright enough to bloom. The wrapper (./bloom.tsx) supplies
// the props. In this build phase the kept light is the whole output, over
// black, so the author can see what counts as bright. Later phases blur it
// through a chain of smaller textures and add it back over the image.
// ADR 0010 records why Bloom reads the image only through the sampler the
// output stage hands it.
import type { ShaderNodeObject } from 'three/tsl';
import { clamp, dot, float, max, type uniform, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useResample } from '../../react/hooks/use-resample/use-resample.js';

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
}

// ---------------------------------------------
// The bright pass: keep the light that blooms
// ---------------------------------------------

/**
 * Scale a color by how far its luminance sits into the knee: 0 below the
 * knee, 1 at the threshold and above, and a smooth rise between. `color` is
 * a premultiplied rgba, so the result is too.
 */
export function keepBright(color: TSLValue, threshold: FloatUniform): TSLValue {
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

export function BloomShader({ threshold }: BloomShaderProps) {
  // The dial lives in a uniform, a value the CPU writes and the GPU reads
  // at each draw, so changing it never rebuilds the output chain.
  const thresholdUniform = useAnimatableUniform<number>(threshold);

  // A resample. The callback receives sampleBeneath, a function that reads
  // everything mounted beneath this Effect at a 0..1 canvas coordinate, and
  // returns the function that replaces it. Bloom reads at the coordinate it
  // is asked for, so a UV warp mounted above it moves what it shows.
  useResample(
    (sampleBeneath) => (coordinate) => {
      const beneath = sampleBeneath(coordinate);
      const bright = keepBright(beneath, thresholdUniform);

      // TEMPORARY (build phase 1): show the kept light alone. The image's
      // own alpha goes back on, so an opaque pixel below the knee shows
      // black and a transparent part of the scene stays transparent.
      return vec4(bright.rgb, beneath.a);
    },
    [thresholdUniform],
  );

  return null;
}
