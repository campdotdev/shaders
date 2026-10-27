'use client';

// The fluted glass's GPU half: a base-pass UV warp that moves where the scene
// texture is sampled, so the image beneath the glass bends through repeating
// flutes. The flute math lives in the engine's fluteSurface primitive; this
// file converts the pass's coordinate into the pixels the primitive works in,
// and the bend it returns back out. The wrapper (./fluted-glass.tsx) supplies
// the props.
import { useEffect, useMemo } from 'react';

import type { ShaderNodeObject } from 'three/tsl';
import { abs, fract, screenSize, uniform, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { fluteSurface } from '../../engine.js';
import { FLAT_EXPONENT, PRISM_EXPONENT } from '../../primitives/flute-surface/flute-surface.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useBasePassUv } from '../../react/hooks/use-base-pass-uv/use-base-pass-uv.js';
import { useResize } from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';

export interface FlutedGlassShaderProps {
  /**
   * The width of one flute, in CSS pixels. Accepts a static value or an
   * animation signal.
   */
  fluteWidth: AnimatableProp<number>;
  /**
   * The direction the flutes run, in degrees on screen: 0 runs them left to
   * right and 90 runs them bottom to top. Accepts a static value or an
   * animation signal.
   */
  angle: AnimatableProp<number>;
  /**
   * How far each flute bends the image beneath it, in half flute widths at
   * the steepest part of the glass. 0 leaves the image unchanged. Accepts a
   * static value or an animation signal.
   */
  refraction: AnimatableProp<number>;
  /**
   * The shape of each flute seen from its end, from 0 to 1: 0 is a prism,
   * 0.5 is round, and 1 is a flat top with steep walls. The wrapper turns a
   * name into its point on this dial. Accepts a static value or an animation
   * signal.
   */
  crossSection: AnimatableProp<number>;
  /**
   * TEMPORARY (build-phase tuning only): dev overrides for the feel
   * constants. Stripped at the defaults-tuning gate.
   */
  tuning: FlutedGlassTuning | undefined;
}

/**
 * TEMPORARY (build-phase tuning only): dev overrides for the feel constants,
 * wired to the docs panel's "Tuning (dev)" section. Stripped at the
 * defaults-tuning gate, when the landed values are baked into constants.
 */
export interface FlutedGlassTuning {
  /** The slope's exponent at a cross-section of 0, the prism. */
  prismExponent?: number;
  /** The slope's exponent at a cross-section of 1, the flat top. */
  flatExponent?: number;
}

// ---------------------------------------------
// Mirroring at the canvas edge
// ---------------------------------------------
// Near the canvas edge the bend can point off the canvas, where the scene
// texture has nothing. Left alone, the sampler, the GPU unit that reads a
// texture, clamps to the edge texel, the texture's outermost pixel, and
// repeats it, which draws a smeared strip. This folds the coordinate back
// instead, as if the image were mirrored past each edge.
//
// fract(x / 2) * 2 counts x along a 0-to-2 cycle, and subtracting 1 makes it
// run -1 to 1. Its absolute value then falls from 1 to 0 and climbs back,
// and 1 minus that rises from 0 to 1 and falls back: a triangle wave. On
// 0..1 it returns x unchanged, past 1 it walks back down, so 1.1 reads 0.9,
// and below 0 it walks back up, so -0.1 reads 0.1. It works per component.
function mirrorOntoCanvas(coordinate: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  return abs(fract(coordinate.div(2)).mul(2).sub(1)).oneMinus();
}

export function FlutedGlassShader({
  fluteWidth,
  angle,
  refraction,
  crossSection,
  tuning,
}: FlutedGlassShaderProps) {
  const shaderContext = useShaderContext();

  // The dials live in uniforms, values the CPU writes and the GPU reads at
  // each draw, so changing them never rebuilds the output chain.
  const fluteWidthUniform = useAnimatableUniform(fluteWidth);
  const angleUniform = useAnimatableUniform(angle);
  const refractionUniform = useAnimatableUniform(refraction);
  const crossSectionUniform = useAnimatableUniform(crossSection);

  // ---------------------------------------------
  // Tuning (dev): stripped at the defaults gate
  // ---------------------------------------------
  // The feel constants ride uniforms too, so the panel's tuning sliders move
  // the glass without a rebuild. Each falls back to the primitive's constant
  // when the panel leaves it unset. The effect keys on the two numbers, not
  // the tuning object, which the panel rebuilds on every write.
  const prismExponentUniform = useMemo(() => uniform(PRISM_EXPONENT), []);
  const flatExponentUniform = useMemo(() => uniform(FLAT_EXPONENT), []);
  const prismExponent = tuning?.prismExponent ?? PRISM_EXPONENT;
  const flatExponent = tuning?.flatExponent ?? FLAT_EXPONENT;

  useEffect(() => {
    prismExponentUniform.value = prismExponent;
    flatExponentUniform.value = flatExponent;
    // A bare uniform write repaints nothing on a static scene (the
    // bare-uniform-write gotcha in docs/agents/tsl.md).
    shaderContext?.scheduler.requestRender();
  }, [prismExponent, flatExponent, prismExponentUniform, flatExponentUniform, shaderContext]);

  // ---------------------------------------------
  // CSS pixels -> device pixels
  // ---------------------------------------------
  // fluteWidth is in CSS pixels so a flute keeps its size on a 1x and a 2x
  // display, but the warp below counts device pixels. The renderer's pixel
  // ratio, which respects maxDPR clamping, converts between them; useResize
  // fires again on monitor moves and browser zoom, when that ratio changes.
  // Dither builds its ratio the same way.
  const resize = useResize();
  // Created once and never replaced: the effect below writes into it, and
  // the warp depends on the stable wrapper.
  const pixelRatioUniform = useMemo(
    () => uniform(resize.get()[2] || 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const apply = () => {
      const rendererRatio = shaderContext?.renderer.three.getPixelRatio();

      pixelRatioUniform.value =
        rendererRatio !== undefined && rendererRatio > 0 ? rendererRatio : resize.get()[2] || 1;
      // A bare uniform write repaints nothing on a static scene, so ask for
      // a frame (the bare-uniform-write gotcha in docs/agents/tsl.md).
      shaderContext?.scheduler.requestRender();
    };

    apply();

    return resize.on('change', apply);
  }, [resize, pixelRatioUniform, shaderContext]);

  // ---------------------------------------------
  // Refraction: bend the scene through the flutes
  // ---------------------------------------------
  // A base-pass UV warp: the callback receives the 0..1 coordinate the
  // rendered scene is about to be sampled at and returns a replacement.
  // That coordinate is a pass coordinate, [0, 0] at the top-left with y
  // growing downward.
  useBasePassUv(
    (coordinate) => {
      // Into the primitive's frame: subtract 0.5 to measure from the canvas
      // center, so the middle flute sits in the middle of the canvas and
      // the flutes turn around it as `angle` changes. Times screenSize, the
      // drawing buffer in device pixels, turns 0..1 into pixels, so a flute
      // is as wide across a wide canvas as across a tall one. The y flip
      // points y up, the frame the primitive's angle is measured in.
      const flip = vec2(1, -1);
      const position = coordinate.sub(0.5).mul(screenSize).mul(flip);

      const { bend } = fluteSurface(position, {
        fluteWidth: fluteWidthUniform.mul(pixelRatioUniform),
        angle: angleUniform,
        refraction: refractionUniform,
        crossSection: crossSectionUniform,
        prismExponent: prismExponentUniform,
        flatExponent: flatExponentUniform,
      });

      // Back out: the bend comes back in device pixels with y up. Flip y
      // again and divide by the buffer size to get a 0..1 offset in the
      // pass's frame, then fold anything off the canvas back onto it.
      const bent = coordinate.add(bend.mul(flip).div(screenSize));

      return mirrorOntoCanvas(bent);
    },
    [
      fluteWidthUniform,
      angleUniform,
      refractionUniform,
      crossSectionUniform,
      prismExponentUniform,
      flatExponentUniform,
      pixelRatioUniform,
    ],
  );

  return null;
}
