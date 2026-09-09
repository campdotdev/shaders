'use client';

// The LED wall's GPU half: a post-process effect that screens the rendered
// scene into a grid of square dots, one per cell, each lit with the color
// the scene had at that cell's center. The wrapper (./led-wall.tsx)
// supplies the props. Two overlay hooks do the work: a base-pass uv snap so
// every pixel in a cell samples the same scene color, then a color pass
// that masks each cell down to its dot, sweeps a jittered, noise-warped
// reveal front outward from `center` as `progress` rises, and scales the
// gaps by `bleed`.
import { useEffect, useMemo } from 'react';

import {
  abs,
  float,
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
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatablePoint } from '../../react/hooks/use-animatable-point/use-animatable-point.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useBasePassUv } from '../../react/hooks/use-base-pass-uv/use-base-pass-uv.js';
import { usePostProcessPass } from '../../react/hooks/use-overlay-pass/use-overlay-pass.js';
import { useResize } from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';

export interface LedWallShaderProps {
  /** Cell pitch in CSS pixels. Accepts a static value or an animation signal. */
  spacing: AnimatableProp<number>;
  /**
   * Edge of the square dot in CSS pixels. Accepts a static value or an
   * animation signal.
   */
  dotSize: AnimatableProp<number>;
  /**
   * How much of the scene shows between the dots. 0 leaves the gaps
   * transparent, 1 leaves the scene untouched there. The reveal scales the
   * gaps too, so they reach this much of the scene only once `progress` is
   * 1. Accepts a static value or an animation signal.
   */
  bleed: AnimatableProp<number>;
  /**
   * The reveal. 0 hides every dot, 1 lights every dot, and values between
   * sweep the front outward from `center`. Accepts a static value or an
   * animation signal.
   */
  progress: AnimatableProp<number>;
  /**
   * Where the reveal starts, 0..1 across the canvas; `[0.5, 0.5]` is the
   * middle and `[0, 0]` the top-left corner. Accepts a static value or an
   * animation signal.
   */
  center: AnimatableProp<readonly [number, number]>;
  /**
   * Shape of the reveal front. 0 is a clean ring around `center` with a
   * little per-dot static, 1 is a fully warped front with fingers and bays.
   * Accepts a static value or an animation signal.
   */
  waviness: AnimatableProp<number>;
  /** TEMPORARY tuning rig. Removed at the defaults gate. */
  tuning?: Partial<LedWallTuning>;
}

// TEMPORARY tuning rig. Each field rides a uniform so the demo panel's
// sliders glide without a rebuild. Stripped at the defaults gate, when the
// landed values become the named constants below.
export interface LedWallTuning {
  /** Width of the pop-in fade at the reveal front, in reveal units. */
  fadeWidth: number;
  /** Per-dot random offset on the front, in reveal units. */
  jitter: number;
  /** How far the noise warp can push the front at waviness 1, in reveal units. */
  warpAmount: number;
  /** Noise frequency of the warp across the canvas, in cycles per canvas height. */
  warpFrequency: number;
}

export const DEFAULT_TUNING: LedWallTuning = {
  fadeWidth: 0.08,
  jitter: 0.12,
  warpAmount: 0.6,
  warpFrequency: 2.5,
};

// ---------------------------------------------
// Constants
// ---------------------------------------------
// Width of the anti-aliasing band across a dot's rim, in device pixels.
// Wider softens every dot into a blur; narrower stair-steps the rim on 1x
// displays. 0.7 is under one pixel, so the band touches only the pixels the
// rim actually crosses.
const RIM_SOFTNESS_PX = 0.7;

export function LedWallShader({
  spacing,
  dotSize,
  bleed,
  progress,
  center,
  waviness,
  tuning,
}: LedWallShaderProps) {
  // The dials live in uniforms: values the CPU can update each frame without
  // rebuilding the shader, tracking either a static number or an animation
  // signal.
  const spacingUniform = useAnimatableUniform(spacing);
  const dotSizeUniform = useAnimatableUniform(dotSize);
  const bleedUniform = useAnimatableUniform(bleed);
  const progressUniform = useAnimatableUniform(progress);
  const wavinessUniform = useAnimatableUniform(waviness);
  // screenOrigin converts the prop's screen-style pair (y down, [0, 0]
  // top-left, like CSS) into uv space, where v grows upward, so the reveal
  // starts where the page author pointed.
  const centerUniform = useAnimatablePoint(center, { screenOrigin: true });

  // Tuning rig uniforms. TEMPORARY.
  const resolvedTuning = { ...DEFAULT_TUNING, ...tuning };
  const fadeWidthUniform = useMemo(() => uniform(DEFAULT_TUNING.fadeWidth), []);
  const jitterUniform = useMemo(() => uniform(DEFAULT_TUNING.jitter), []);
  const warpAmountUniform = useMemo(() => uniform(DEFAULT_TUNING.warpAmount), []);
  const warpFrequencyUniform = useMemo(() => uniform(DEFAULT_TUNING.warpFrequency), []);

  useEffect(() => {
    fadeWidthUniform.value = resolvedTuning.fadeWidth;
    jitterUniform.value = resolvedTuning.jitter;
    warpAmountUniform.value = resolvedTuning.warpAmount;
    warpFrequencyUniform.value = resolvedTuning.warpFrequency;
    shaderContext?.scheduler.requestRender();
  });

  // ---------------------------------------------
  // CSS pixels -> device pixels
  // ---------------------------------------------
  // spacing and dotSize are in CSS pixels so the look matches on 1x and 3x
  // displays, but screenSize below counts device pixels. The renderer's
  // pixel ratio converts between them; useResize re-fires on monitor moves
  // and browser zoom, when that ratio changes. Created once and never
  // replaced, so the passes can depend on it without re-registering.
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

  // ---------------------------------------------
  // Track the canvas aspect ratio
  // ---------------------------------------------
  // The distance math below multiplies the horizontal offset by
  // width/height so a reveal ring stays a circle on a wide canvas. The
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
  // Snap the scene sample to the cell center
  // ---------------------------------------------
  // The color pass can only restyle each pixel; giving a whole cell ONE
  // scene color means resampling the scene at one shared point per cell.
  // This warp runs where the scene texture is sampled. The coordinate is
  // uv space, v growing upward, so the y flip anchors the grid to the
  // top-left corner the way the color pass below does. Without matching
  // anchors the sampled cells and the drawn dots drift apart by a fraction
  // of a cell whenever the canvas height is not a multiple of the pitch.
  useBasePassUv(
    (coordinate) => {
      const cellPx = spacingUniform.mul(dprUniform).max(1);
      const pixel = vec2(coordinate.x, coordinate.y.oneMinus()).mul(screenSize);
      const snapped = floor(pixel.div(cellPx)).add(0.5).mul(cellPx);
      const snappedUv = snapped.div(screenSize);

      return vec2(snappedUv.x, snappedUv.y.oneMinus());
    },
    [spacingUniform, dprUniform],
  );

  // ---------------------------------------------
  // The pass: cell -> dot mask -> compose
  // ---------------------------------------------
  // A post-process pass: the callback receives each already-rendered pixel
  // (`input`, rgba, already snapped to its cell's color) and returns a
  // replacement.
  usePostProcessPass(
    (input) => {
      // Which cell is this pixel in, and where inside it? Same top-left
      // anchoring as the snap above. cellLocal runs -0.5..0.5 across the
      // cell with 0 at its center.
      const cellPx = spacingUniform.mul(dprUniform).max(1);
      const pixel = vec2(uv().x, uv().y.oneMinus()).mul(screenSize);
      const cellCoord = pixel.div(cellPx);
      const cellIndex = floor(cellCoord);
      const cellLocal = cellCoord.sub(cellIndex).sub(0.5);

      // ---------------------------------------------
      // Per-cell randomness
      // ---------------------------------------------
      // One u32 seed per cell: hash the integer y index, add it to the x
      // index, and hash the sum. stableHash then turns that seed into the
      // jitter delay below, staying in u32 until that final conversion, per
      // the seeded-randomness gotcha.
      const cellSeed = stableHashUint(
        cellIndex.x.toUint().add(stableHashUint(cellIndex.y.toUint())),
      );
      const jitterRandom = stableHash(cellSeed);

      // ---------------------------------------------
      // The reveal: distance from center, jittered and warped
      // ---------------------------------------------
      // The cell's center in uv space (v up), so it compares with the
      // center uniform in the same frame. Evaluated per CELL, not per pixel,
      // so a dot pops in as one piece.
      const cellCenterPx = cellIndex.add(0.5).mul(cellPx);
      const cellCenterUv = vec2(
        cellCenterPx.x.div(screenSize.x),
        cellCenterPx.y.div(screenSize.y).oneMinus(),
      );

      // Aspect-corrected distance from center. The far corner then measures
      // 1 wherever the center sits: the farthest corner from a point in the
      // unit box is max(c, 1 - c) on each axis, corrected the same way.
      const toCell = cellCenterUv.sub(centerUniform);
      const corrected = vec2(toCell.x.mul(aspectUniform), toCell.y);
      const centerLifted = vec2(0, 0).add(centerUniform);
      const farCorner = max(centerLifted, centerLifted.oneMinus());
      const farDistance = length(vec2(farCorner.x.mul(aspectUniform), farCorner.y)).max(0.001);
      const distance = length(corrected).div(farDistance);

      // The warp: low-frequency noise over the corrected cell position,
      // pushed into 0..1 so it only ever ADDS distance. A negative warp
      // would light dots at progress 0. fractalNoise's own range is only
      // roughly -1..1, so saturate() clamps off the rare overshoot past
      // either end and keeps the 0..1 promise exact.
      const warpPoint = vec3(cellCenterUv.x.mul(aspectUniform), cellCenterUv.y, 0).mul(
        warpFrequencyUniform,
      );
      const warp = saturate(fractalNoise(warpPoint, { octaves: 2 }).mul(0.5).add(0.5));

      // The field a dot has to wait for: its distance, plus its own random
      // delay, plus the warp scaled by waviness. progress sweeps a
      // threshold across it. The threshold tracks the field's own maximum,
      // which is 1 plus jitter plus warpAmount times waviness, plus one
      // fade width of headroom, so that at progress 1 the far edge of the
      // fade band lands on the slowest dot, and at progress 0 the threshold
      // sits at 0 below every non-negative field value.
      const field = distance
        .add(jitterRandom.mul(jitterUniform))
        .add(warp.mul(wavinessUniform).mul(warpAmountUniform));
      const threshold = progressUniform.mul(
        jitterUniform.add(warpAmountUniform.mul(wavinessUniform)).add(1).add(fadeWidthUniform),
      );

      // The reveal itself: a smoothstep with its edges REVERSED (high to
      // low), which flips the ramp so it returns 1 once the field sits a
      // fade-width under the threshold, 0 above it, and an S-curve in
      // between. That band is the pop-in.
      const reveal = smoothstep(threshold, threshold.sub(fadeWidthUniform), field);

      // The dot's half-edge in cell units. dotSize in device pixels over the
      // cell pitch gives the edge as a fraction of the cell; half of it is
      // the distance from the center to the rim. min(0.5) keeps a dot from
      // growing past its own cell when dotSize animates above spacing.
      const halfEdge = dotSizeUniform.mul(dprUniform).div(cellPx).mul(0.5).min(0.5);

      // Signed distance to the square's rim: the larger of the two axis
      // distances from the center, minus the half-edge. Negative inside,
      // positive outside, zero on the rim. max(|x|, |y|) is what makes the
      // shape a square rather than length()'s circle.
      const squareDistance = max(abs(cellLocal.x), abs(cellLocal.y)).sub(halfEdge);

      // Reversed smoothstep again, as at the reveal above: pixels deeper
      // than one rim-width inside get 1, pixels past it outside get 0, and
      // the band across the rim fades smoothly. The width is in device
      // pixels converted into cell units, so it stays sub-pixel at any
      // pitch.
      const rim = float(RIM_SOFTNESS_PX).div(cellPx);
      const dotMask = smoothstep(rim, rim.negate(), squareDistance);

      // Compose. The scene texture is premultiplied by construction (the
      // scene blends over a transparent clear), so scaling rgb and alpha by
      // the same factor is the correct way to dim it. Inside the dot the
      // factor is 1: the dot is the scene at full strength. In the gaps it
      // is bleed: 0 leaves alpha 0 so the page shows through, 1 leaves the
      // scene untouched.
      const factor = mix(bleedUniform, float(1), dotMask).mul(reveal);

      return vec4(vec3(input.rgb).mul(factor), input.a.mul(factor));
    },
    [
      spacingUniform,
      dotSizeUniform,
      bleedUniform,
      progressUniform,
      wavinessUniform,
      centerUniform,
      aspectUniform,
      dprUniform,
      fadeWidthUniform,
      jitterUniform,
      warpAmountUniform,
      warpFrequencyUniform,
    ],
  );

  return null;
}
