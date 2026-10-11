'use client';

// SwirlGradient's GPU half. The pixel's journey: place the pixel in the
// flow, trace it backward along the flow (./flow.ts) to where its color
// started, then read LinearGradient's repeating bands at that starting
// point. Every pixel reads the bands from somewhere upstream, so the
// straight bands come out stretched and folded, like paint swirled on
// water. The wrapper (./swirl-gradient.tsx) supplies the props.
import { useEffect, useMemo } from 'react';

import { cos, fract, max, mix, sin, smoothstep, uniform, uv, vec2 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { colorRamp, type ColorSpace, type HueInterpolation } from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import { type ColorStop, colorStopsKey, toColorRampStops } from '../shared/color.js';
import { createFlowPass, inlineVelocity, traceFlow } from './flow.js';

// ---------------------------------------------
// Flow constants (provisional until the defaults gate)
// ---------------------------------------------
// How many steps each pixel's trace takes. More steps follow tight eddies
// more faithfully, and each one costs a texture read per pixel. Too few
// and a step overshoots the curve it should follow, so neighboring pixels
// land in unrelated places and the threads tear.
const STEP_COUNT = 24;

// How far one step travels at swirl 1 where the flow runs at unit speed, in
// lattice cells (about one eddy each). STEP_COUNT x STEP_LENGTH is the whole trace's reach at swirl
// 1. Longer steps reach further for the same cost, until they start to tear.
const STEP_LENGTH = 0.05;

// The smaller eddies' strength, 0..1. 0 leaves the broad flow alone, with
// smooth, wide folds. Raising it curls finer swirls into the folds.
const SMALL_EDDIES = 0.35;

/**
 * TEMPORARY (build-phase tuning only): dev overrides for the flow's feel
 * constants. Stripped at the defaults gate.
 */
export interface SwirlGradientTuning {
  /**
   * Steps in each pixel's trace. Compiled into the shader, so a change
   * rebuilds the material.
   */
  steps?: number;
  /** Distance one step travels at swirl 1, in lattice cells (about one eddy each). */
  stepLength?: number;
  /** Strength of the smaller eddies, from 0 for none to 1. */
  smallEddies?: number;
}

export interface SwirlGradientShaderProps {
  /**
   * Colors of the bands. Accepts hex, `oklch()`, or `oklab()`; positions
   * auto-space when omitted.
   */
  stops: ColorStop[];
  /**
   * Direction the bands run across, in degrees. 0 runs left to right, 90
   * runs bottom to top. Accepts a static value or an animation signal.
   */
  angle: AnimatableProp<number>;
  /**
   * How many times the stops run across the canvas. Each pass runs the stops
   * in the same direction and snaps back to the first, so unless the first
   * and last stop match there is a crisp seam at every band boundary, which
   * the flow draws out into threads. Values at or below 1 render as a single
   * pass. Accepts a static value or an animation signal.
   */
  repeat: AnimatableProp<number>;
  /**
   * How far the flow carries the colors. 0 leaves the bands straight; higher
   * values stretch and fold them further. Accepts a static value or an
   * animation signal.
   */
  swirl: AnimatableProp<number>;
  /**
   * Roughly how many eddies span the canvas's height. Accepts a static value
   * or an animation signal.
   */
  scale: AnimatableProp<number>;
  /**
   * Picks a different flow with the same character. Each whole number gives
   * an unrelated flow.
   */
  seed: number;
  /** Color space the bands are interpolated in. */
  colorSpace: ColorSpace;
  /** Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert otherwise. */
  hueInterpolation: HueInterpolation;
  /** TEMPORARY (build-phase tuning only). Stripped at the defaults gate. */
  tuning?: SwirlGradientTuning;
}

export function SwirlGradientShader({
  stops,
  angle,
  repeat,
  swirl,
  scale,
  seed,
  colorSpace,
  hueInterpolation,
  tuning,
}: SwirlGradientShaderProps) {
  const shaderContext = useShaderContext();

  // Nothing moves yet, so the scene can render once and park.
  useStaticSceneHint(true);

  // The animatable dials live in uniforms (values the CPU can update each
  // frame without rebuilding the shader), tracking either a static number or
  // an animation signal.
  const angleUniform = useAnimatableUniform<number>(angle);
  const repeatUniform = useAnimatableUniform<number>(repeat);
  const swirlUniform = useAnimatableUniform<number>(swirl);
  const scaleUniform = useAnimatableUniform<number>(scale);

  // Canvas width over height, so the eddies stay round on a wide canvas.
  const aspectNode = useAspectUniform();

  // The seed goes into the flow's hash, which reads it as a whole number 0
  // or above (stableHash truncates to u32, and u32 of a negative float is
  // backend-defined). The uniform is created once and rewritten, so a new
  // seed repaints without recompiling. The scene renders on demand, so poke
  // it to show the change (the bare-uniform-write gotcha in
  // docs/agents/tsl.md).
  const seedUniform = useMemo(() => uniform(0), []);

  useEffect(() => {
    seedUniform.value = Math.round(Math.abs(seed));
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, seedUniform, seed]);

  // ---------------------------------------------
  // Tuning (dev), stripped at the defaults gate
  // ---------------------------------------------
  // The step length and the smaller eddies ride uniforms, so their sliders
  // glide without a rebuild. The step count is the loop's bound, compiled
  // into the shader, so it joins the build effect's deps instead.
  const stepCount = tuning?.steps ?? STEP_COUNT;
  const stepLength = tuning?.stepLength ?? STEP_LENGTH;
  const smallEddies = tuning?.smallEddies ?? SMALL_EDDIES;
  const stepLengthUniform = useMemo(() => uniform(STEP_LENGTH), []);
  const smallEddiesUniform = useMemo(() => uniform(SMALL_EDDIES), []);

  useEffect(() => {
    stepLengthUniform.value = stepLength;
    smallEddiesUniform.value = smallEddies;
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, stepLengthUniform, smallEddiesUniform, stepLength, smallEddies]);

  // Content fingerprint of the stops array (colors + positions). The build
  // effect keys on this string, so a re-render that passes a new array with
  // the same contents doesn't rebuild the material.
  const stopsKey = colorStopsKey(stops);

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount, and again when the stops or color space change
  // (colorRamp bakes the stop colors in as constants) or the step count does
  // (the loop's bound). Every dial above flows through uniforms.
  useEffect(
    () => {
      if (!shaderContext) return;

      // ---------------------------------------------
      // Place the pixel in the flow
      // ---------------------------------------------
      // uv() is the pixel's position on the plane, 0..1 both ways.
      // Subtracting 0.5 centers it, so changing the scale zooms around the
      // middle of the canvas rather than its corner. x times the aspect
      // ratio measures both axes in canvas heights, which keeps the eddies
      // round on a wide canvas. Times scale, one lattice cell of the noise,
      // about one eddy, spans 1/scale of the canvas's height.
      const centered = uv().sub(vec2(0.5, 0.5));
      const flowPoint = vec2(centered.x.mul(aspectNode), centered.y).mul(scaleUniform);

      // ---------------------------------------------
      // Trace it back to where its color started
      // ---------------------------------------------
      // The flow pass draws the flow's velocity into a texture before each
      // frame, so a step costs one texture read. Where the renderer can't
      // draw half floats, the trace works the velocity out from the noise
      // at every step instead, which looks the same and costs far more.
      const flowInputs = { seed: seedUniform, smallEddies: smallEddiesUniform };
      const flowPass = createFlowPass(shaderContext, flowInputs);

      // swirl scales every step, so it sets how far the trace reaches: at 0
      // the trace stands still and the bands stay exactly straight.
      const flowOffset = traceFlow(flowPoint, {
        steps: stepCount,
        stepLength: swirlUniform.mul(stepLengthUniform),
        velocityAt: flowPass?.velocityAt ?? inlineVelocity(flowInputs),
      });

      // The offset comes back in lattice cells. Undo the placement's
      // stretches, in reverse, to turn it into uv: divide by scale, then x
      // by the aspect. The max() keeps a scale of 0 from dividing by zero.
      const safeScale = max(scaleUniform, 0.001);
      const uvOffset = vec2(flowOffset.x.div(aspectNode), flowOffset.y).div(safeScale);
      const sourceUv = uv().add(uvOffset);

      // ---------------------------------------------
      // Read the bands where the color started
      // ---------------------------------------------
      // From here on this is LinearGradient's math at its default center and
      // a speed of 0, read at sourceUv instead of uv, so at swirl 0 the two
      // draw the same image. The angle becomes a unit direction, and the
      // pixel's distance along it, plus 0.5, is its place on the ramp. At
      // angle 0 that is plain u: 0 at the left edge, 1 at the right.
      const angleRadians = angleUniform.mul(Math.PI / 180);
      const direction = vec2(cos(angleRadians), sin(angleRadians));
      const gradientCoord = sourceUv.sub(vec2(0.5, 0.5)).dot(direction).add(0.5);

      // The repeating bands: multiplying by repeat fits that many passes of
      // the ramp into one, and fract() keeps the fractional part, so the
      // coordinate saws 0 -> 1 over and over. The mix is LinearGradient's
      // repeat gate: at repeat <= 1 the smoothstep is exactly 0 and the
      // single pass comes through untouched.
      const tiled = fract(gradientCoord.mul(repeatUniform));
      const rampCoord = mix(gradientCoord, tiled, smoothstep(1, 1.01, repeatUniform));

      // An unlit material whose per-pixel color comes from colorNode.
      // colorRamp maps the 0..1 coordinate to a color, blending between
      // stops in the chosen color space.
      const material = new MeshBasicNodeMaterial();

      material.colorNode = colorRamp(
        rampCoord,
        toColorRampStops(stops),
        colorSpace,
        hueInterpolation,
      );

      // A 2x2 plane exactly fills ShaderScene's camera view (-1..1 on both
      // axes), so the bands cover the whole canvas.
      const mesh = new Mesh(new PlaneGeometry(2, 2), material);

      shaderContext.scene.add(mesh);

      // A rebuild swaps the mesh without touching any uniform, and a still
      // scene is parked, so poke it to draw the new material.
      shaderContext.scheduler.requestRender();

      return () => {
        shaderContext.scene.remove(mesh);
        flowPass?.dispose();
        try {
          material.dispose();
        } catch {
          // three/webgpu can throw during dispose under Strict Mode double-invoke
        }
        try {
          mesh.geometry.dispose();
        } catch {
          // same
        }
      };
    },
    // stopsKey is a stable string proxy for the stops array; the array itself
    // is intentionally omitted to avoid rebuilds on identity-only changes.
    // Animatable uniforms are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      shaderContext,
      angleUniform,
      repeatUniform,
      swirlUniform,
      scaleUniform,
      aspectNode,
      seedUniform,
      stepLengthUniform,
      smallEddiesUniform,
      stepCount,
      stopsKey,
      colorSpace,
      hueInterpolation,
    ],
  );

  return null;
}
