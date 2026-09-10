'use client';

// The dissolve's GPU half: a post-process effect that turns the scene
// beneath it into grain. Each block of pixels draws one random value, and
// the block is shown where that value sits under `progress` times the
// alpha the scene already has there. Over an opaque scene that is a plain
// dissolve driven by `progress`. Over a soft edge, such as a feathered
// wipe's front, it replaces the smooth alpha with a scatter of shown and
// hidden blocks in the same proportion, which is what makes a ragged edge
// out of two components that share no code. The wrapper (./dissolve.tsx)
// supplies the props.
import { useEffect, useMemo } from 'react';

import { floor, mix, saturate, screenSize, smoothstep, uniform, uv, vec3, vec4 } from 'three/tsl';

import { fractalNoise, stableHash, stableHashUint } from '../../engine.js';
import {
  type AnimatableProp,
  isSignal,
} from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { usePostProcessPass } from '../../react/hooks/use-overlay-pass/use-overlay-pass.js';
import { useResize } from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';

export interface DissolveShaderProps {
  /**
   * The dissolve. 0 hides the scene, 1 shows every block the scene's own
   * alpha allows, and values between show a matching share of blocks.
   * Accepts a static value or an animation signal.
   */
  progress: AnimatableProp<number>;
  /**
   * Block size of the grain in CSS pixels. Each block waits its own random
   * moment, so the scene arrives in blocks of this size. Match it to a dot
   * grid's spacing and the dots arrive one at a time. Accepts a static
   * value or an animation signal.
   */
  pixelSize: AnimatableProp<number>;
  /** TEMPORARY tuning rig. Removed at the defaults gate. */
  tuning?: Partial<DissolveTuning>;
}

// TEMPORARY tuning rig. Each field rides a uniform so the demo panel's
// sliders glide without a rebuild. Stripped at the defaults gate, when the
// landed values become named constants.
export interface DissolveTuning {
  /** Width of the pop-in fade per block, in progress units. */
  fadeWidth: number;
  /** How much of each block's value is its own static rather than the shared noise, 0 to 1. */
  grain: number;
  /** Frequency of the shared noise across the canvas, in cycles per canvas height. */
  noiseFrequency: number;
}

export const DEFAULT_TUNING: DissolveTuning = {
  fadeWidth: 0.08,
  grain: 0.3,
  noiseFrequency: 2.5,
};

// ---------------------------------------------
// Constants
// ---------------------------------------------
// Floor on the incoming alpha before the un-premultiply divide. Blocks
// this transparent are hidden by the threshold anyway, so the floor only
// keeps the divide finite.
const MIN_ALPHA = 0.001;

export function DissolveShader({ progress, pixelSize, tuning }: DissolveShaderProps) {
  // The dials live in uniforms: values the CPU can update each frame without
  // rebuilding the shader, tracking either a static number or an animation
  // signal.
  const progressUniform = useAnimatableUniform(progress);
  const pixelSizeUniform = useAnimatableUniform(pixelSize);

  // Tuning rig uniforms. TEMPORARY.
  const resolvedTuning = { ...DEFAULT_TUNING, ...tuning };
  const fadeWidthUniform = useMemo(() => uniform(DEFAULT_TUNING.fadeWidth), []);
  const grainUniform = useMemo(() => uniform(DEFAULT_TUNING.grain), []);
  const noiseFrequencyUniform = useMemo(() => uniform(DEFAULT_TUNING.noiseFrequency), []);

  // The render-on-demand vote: a fixed progress at any value draws nothing
  // that changes between frames, so the scene may stop. A signal is live by
  // definition, whatever it reads right now.
  useStaticSceneHint(!isSignal(progress));

  // ---------------------------------------------
  // CSS pixels -> device pixels
  // ---------------------------------------------
  // pixelSize is in CSS pixels so the grain matches on 1x and 3x displays,
  // but screenSize below counts device pixels. The renderer's pixel ratio
  // converts between them; useResize re-fires on monitor moves and browser
  // zoom, when that ratio changes. Created once and never replaced, so the
  // pass can depend on it without re-registering.
  const shaderContext = useShaderContext();
  const resize = useResize();
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

  useEffect(() => {
    fadeWidthUniform.value = resolvedTuning.fadeWidth;
    grainUniform.value = resolvedTuning.grain;
    noiseFrequencyUniform.value = resolvedTuning.noiseFrequency;
    shaderContext?.scheduler.requestRender();
  });

  // ---------------------------------------------
  // Track the canvas aspect ratio
  // ---------------------------------------------
  // The noise below samples an aspect-corrected position so its clumps are
  // round on a wide canvas rather than stretched. The uniform starts from
  // the current canvas size (16:9 when the canvas has no layout yet and
  // reports 0), then follows every resize.
  const [initialWidth, initialHeight] = resize.get();
  const aspectUniform = useMemo(
    () => uniform(initialHeight > 0 ? initialWidth / initialHeight : 16 / 9),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) aspectUniform.value = canvasWidth / canvasHeight;

    return resize.on('change', ([updatedWidth, updatedHeight]) => {
      if (updatedWidth > 0 && updatedHeight > 0) {
        aspectUniform.value = updatedWidth / updatedHeight;
      }
    });
  }, [resize, aspectUniform]);

  // ---------------------------------------------
  // The pass: block -> value -> threshold -> compose
  // ---------------------------------------------
  // A post-process pass: the callback receives each already-rendered pixel
  // (`input`, rgba) and returns a replacement.
  usePostProcessPass(
    (input) => {
      // Which block is this pixel in? uv() in a post-process pass is
      // screen-oriented, (0, 0) at the top-left with y growing downward, so
      // the grid anchors there with no flip. LedWall anchors its cells the
      // same way, so a pixelSize equal to a wall's spacing lands block for
      // block on its dots. The value below is evaluated at the block's
      // center, so a block arrives as one piece.
      const blockPx = pixelSizeUniform.mul(dprUniform).max(1);
      const pixel = uv().mul(screenSize);
      const blockIndex = floor(pixel.div(blockPx));
      const blockCenterPx = blockIndex.add(0.5).mul(blockPx);
      const blockCenterUv = blockCenterPx.div(screenSize);

      // One random draw per block, from one u32 seed per block: hash the
      // integer y index, add it to the x index, and hash the sum, staying in
      // u32 until the single float draw at the end, per the seeded-
      // randomness gotcha.
      const blockSeed = stableHashUint(
        blockIndex.x.toUint().add(stableHashUint(blockIndex.y.toUint())),
      );
      const blockRandom = stableHash(blockSeed);

      // The shared noise: low-frequency noise over the corrected block
      // position, pushed into 0..1. fractalNoise's own range is only roughly
      // -1..1, so saturate() clamps off the rare overshoot and keeps the
      // 0..1 promise exact. This is what gives the dissolve clumps rather
      // than pure static.
      const noisePoint = vec3(blockCenterUv.x.mul(aspectUniform), blockCenterUv.y, 0).mul(
        noiseFrequencyUniform,
      );
      const noise = saturate(fractalNoise(noisePoint, { octaves: 2 }).mul(0.5).add(0.5));

      // The block's value: the shared noise blended toward the block's own
      // static by the grain dial. Both inputs sit in 0..1, so the mix does
      // too. At grain 0 neighbouring blocks arrive together in clumps; at 1
      // every block arrives on its own.
      const value = mix(noise, blockRandom, grainUniform);

      // The threshold is progress times the alpha the scene already has
      // here. Over an opaque scene that is just progress. Over a soft
      // edge the threshold falls with the alpha, so the share of blocks
      // shown across the band matches the alpha the band had, and the
      // smooth edge becomes grain of the same density. One fade width of
      // headroom lets progress 1 over alpha 1 show the slowest block.
      const target = progressUniform.mul(input.a);
      const threshold = target.mul(fadeWidthUniform.add(1));

      // The front itself: a smoothstep with its edges REVERSED (high to
      // low), which flips the ramp so it returns 1 once the value sits a
      // fade-width under the threshold, 0 above it, and an S-curve in
      // between. That band is the pop-in.
      const reveal = smoothstep(threshold, threshold.sub(fadeWidthUniform), value);

      // Compose. A shown block is shown at full strength, not at the soft
      // alpha it arrived with: the scene texture is premultiplied, so
      // dividing rgb by alpha recovers the pixel's own color and alpha 1
      // makes it opaque. That is what turns a smooth edge into hard grain.
      // The floor on alpha keeps the divide finite for blocks the threshold
      // hides anyway. reveal then scales the restored pixel, so hidden
      // blocks go to alpha 0 and the page shows through.
      const restoredRgb = vec3(input.rgb).div(input.a.max(MIN_ALPHA));

      return vec4(restoredRgb.mul(reveal), reveal);
    },
    [
      progressUniform,
      pixelSizeUniform,
      aspectUniform,
      dprUniform,
      fadeWidthUniform,
      grainUniform,
      noiseFrequencyUniform,
    ],
  );

  return null;
}
