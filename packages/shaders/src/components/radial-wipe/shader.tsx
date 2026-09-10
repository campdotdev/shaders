'use client';

// The radial wipe's GPU half: a post-process effect that reveals or hides
// the rendered scene from a point. Every block of pixels computes one
// number, its place in a queue, and `progress` sweeps a threshold across
// that queue. The queue is a mix of distance from `center` and a noise
// field, so one `dissolve` dial runs from a clean radial wipe to a pure
// noise dissolve. The wrapper (./radial-wipe.tsx) supplies the props.
import { useEffect, useMemo } from 'react';

import {
  floor,
  length,
  max,
  mix,
  saturate,
  screenSize,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';

import { fractalNoise, stableHash, stableHashUint } from '../../engine.js';
import {
  type AnimatableProp,
  isSignal,
} from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatablePoint } from '../../react/hooks/use-animatable-point/use-animatable-point.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { usePostProcessPass } from '../../react/hooks/use-overlay-pass/use-overlay-pass.js';
import { useResize } from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';

export interface RadialWipeShaderProps {
  /**
   * The wipe. 0 hides the scene, 1 shows it, and values between sweep the
   * front outward from `center`. Accepts a static value or an animation
   * signal.
   */
  progress: AnimatableProp<number>;
  /**
   * Where the wipe starts, 0..1 across the canvas; `[0.5, 0.5]` is the
   * middle and `[0, 0]` the top-left corner. Has no effect at `dissolve` 1,
   * where the front has no direction. Accepts a static value or an
   * animation signal.
   */
  center: AnimatableProp<readonly [number, number]>;
  /**
   * How much of the front dissolves into noise. 0 is a clean radial wipe
   * from `center`, 1 is a full noise dissolve with no direction, and values
   * between give a wipe with a ragged edge. Accepts a static value or an
   * animation signal.
   */
  dissolve: AnimatableProp<number>;
  /**
   * Block size of the dissolve's grain in CSS pixels. Each block waits its
   * own random moment, so the front arrives in blocks of this size. Match
   * it to a dot grid's spacing and the dots arrive one at a time. Accepts a
   * static value or an animation signal.
   */
  pixelSize: AnimatableProp<number>;
  /** TEMPORARY tuning rig. Removed at the defaults gate. */
  tuning?: Partial<RadialWipeTuning>;
}

// TEMPORARY tuning rig. Each field rides a uniform so the demo panel's
// sliders glide without a rebuild. Stripped at the defaults gate, when the
// landed values become named constants.
export interface RadialWipeTuning {
  /** Width of the pop-in fade at the front, in queue units where 1 is the far corner. */
  fadeWidth: number;
  /** Per-block random delay on the front, in queue units. */
  jitter: number;
  /** Frequency of the dissolve noise across the canvas, in cycles per canvas height. */
  noiseFrequency: number;
}

export const DEFAULT_TUNING: RadialWipeTuning = {
  fadeWidth: 0.08,
  jitter: 0.12,
  noiseFrequency: 2.5,
};

export function RadialWipeShader({
  progress,
  center,
  dissolve,
  pixelSize,
  tuning,
}: RadialWipeShaderProps) {
  // The dials live in uniforms: values the CPU can update each frame without
  // rebuilding the shader, tracking either a static number or an animation
  // signal.
  const progressUniform = useAnimatableUniform(progress);
  const dissolveUniform = useAnimatableUniform(dissolve);
  const pixelSizeUniform = useAnimatableUniform(pixelSize);
  // The pair is already in the pass's screen frame, [0, 0] at the top-left
  // with y growing downward, so it needs no conversion. uv() in a
  // post-process pass shares that frame; a mesh's uv() does not, which is
  // why DotField converts and this file does not.
  const centerUniform = useAnimatablePoint(center);

  // Tuning rig uniforms. TEMPORARY.
  const resolvedTuning = { ...DEFAULT_TUNING, ...tuning };
  const fadeWidthUniform = useMemo(() => uniform(DEFAULT_TUNING.fadeWidth), []);
  const jitterUniform = useMemo(() => uniform(DEFAULT_TUNING.jitter), []);
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
    jitterUniform.value = resolvedTuning.jitter;
    noiseFrequencyUniform.value = resolvedTuning.noiseFrequency;
    shaderContext?.scheduler.requestRender();
  });

  // ---------------------------------------------
  // Track the canvas aspect ratio
  // ---------------------------------------------
  // The distance math below multiplies the horizontal offset by
  // width/height so the wipe's front stays a circle on a wide canvas. The
  // uniform starts from the current canvas size (16:9 when the canvas has
  // no layout yet and reports 0), then follows every resize.
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
  // The pass: block -> queue -> threshold -> compose
  // ---------------------------------------------
  // A post-process pass: the callback receives each already-rendered pixel
  // (`input`, rgba) and returns a replacement.
  usePostProcessPass(
    (input) => {
      // Which block is this pixel in? uv() in a post-process pass is
      // screen-oriented, (0, 0) at the top-left with y growing downward, so
      // the grid anchors there with no flip. LedWall anchors its cells the
      // same way, so a pixelSize equal to a wall's spacing lands block for
      // block on its dots. Everything below is evaluated at the block's
      // center, so a block arrives as one piece.
      const blockPx = pixelSizeUniform.mul(dprUniform).max(1);
      const pixel = uv().mul(screenSize);
      const blockIndex = floor(pixel.div(blockPx));
      const blockCenterPx = blockIndex.add(0.5).mul(blockPx);
      const blockCenterUv = blockCenterPx.div(screenSize);

      // One random delay per block. One u32 seed per block: hash the
      // integer y index, add it to the x index, and hash the sum, staying in
      // u32 until the single float draw at the end, per the seeded-
      // randomness gotcha.
      const blockSeed = stableHashUint(
        blockIndex.x.toUint().add(stableHashUint(blockIndex.y.toUint())),
      );
      const jitterRandom = stableHash(blockSeed);

      // ---------------------------------------------
      // The queue: distance mixed with noise, plus the block's delay
      // ---------------------------------------------
      // Aspect-corrected distance from center. The far corner then measures
      // 1 wherever the center sits: the farthest corner from a point in the
      // unit box is max(c, 1 - c) on each axis, corrected the same way.
      // vec2(0, 0).add(centerUniform) lifts the bare vec uniform into a node
      // receiver so the chain stays safe (the vec-uniform-as-receiver
      // gotcha).
      const toBlock = blockCenterUv.sub(centerUniform);
      const corrected = vec2(toBlock.x.mul(aspectUniform), toBlock.y);
      const centerLifted = vec2(0, 0).add(centerUniform);
      const farCorner = max(centerLifted, centerLifted.oneMinus());
      const farDistance = length(vec2(farCorner.x.mul(aspectUniform), farCorner.y));
      const distance = length(corrected).div(farDistance);

      // The dissolve field: low-frequency noise over the corrected block
      // position, pushed into 0..1. fractalNoise's own range is only roughly
      // -1..1, so saturate() clamps off the rare overshoot and keeps the
      // 0..1 promise exact. A negative value would show pixels at progress 0.
      const noisePoint = vec3(blockCenterUv.x.mul(aspectUniform), blockCenterUv.y, 0).mul(
        noiseFrequencyUniform,
      );
      const noise = saturate(fractalNoise(noisePoint, { octaves: 2 }).mul(0.5).add(0.5));

      // The queue a block waits in. mix() blends distance toward noise by
      // the dissolve dial: at 0 the queue is pure distance and the front is a
      // ring around center, at 1 it is pure noise and center no longer
      // matters, and either way it stays inside 0..1 because both inputs do.
      // The block's random delay then adds up to jitter on top.
      const field = mix(distance, noise, dissolveUniform).add(jitterRandom.mul(jitterUniform));

      // progress sweeps a threshold across the queue. The threshold's range
      // covers the queue's own maximum, 1 + jitter, plus one fade width of
      // headroom, so that at progress 1 the far edge of the fade band lands
      // on the slowest block and everything is shown, and at progress 0 the
      // threshold sits at 0 below every non-negative queue value and nothing
      // is.
      const threshold = progressUniform.mul(jitterUniform.add(1).add(fadeWidthUniform));

      // The front itself: a smoothstep with its edges REVERSED (high to
      // low), which flips the ramp so it returns 1 once the queue value sits
      // a fade-width under the threshold, 0 above it, and an S-curve in
      // between. That band is the pop-in.
      const reveal = smoothstep(threshold, threshold.sub(fadeWidthUniform), field);

      // Compose. The scene texture is premultiplied by construction (the
      // scene blends over a transparent clear), so scaling rgb and alpha by
      // the same factor is the correct way to hide it: at 0 the alpha goes to
      // 0 and the page shows through.
      return vec4(vec3(input.rgb).mul(reveal), input.a.mul(reveal));
    },
    [
      progressUniform,
      dissolveUniform,
      pixelSizeUniform,
      centerUniform,
      aspectUniform,
      dprUniform,
      fadeWidthUniform,
      jitterUniform,
      noiseFrequencyUniform,
    ],
  );

  return null;
}
