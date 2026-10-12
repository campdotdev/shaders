'use client';

// LiquidGradient's GPU half. The pixel's journey: place the pixel in the
// flow, trace it backward along the flow (./flow.ts), color every point the
// trace passes from the bands and the paint there (./bands.ts, ./paint.ts),
// and average those colors. The average streaks each color along the
// current, the way a long exposure of moving liquid does, and the paint's
// fine detail is what the streaks are drawn from. The wrapper
// (./liquid-gradient.tsx) supplies the props.
import { useEffect, useMemo } from 'react';

import {
  cos,
  fract,
  fwidth,
  max,
  mix,
  type ShaderNodeObject,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
} from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

import type { ColorSpace, HueInterpolation } from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableSpeed } from '../../react/hooks/use-animatable-speed/use-animatable-speed.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import { type ColorStop, colorStopsKey, toColorRampStops } from '../shared/color.js';
import { type BandPalette, createAveragePass, createRampPass } from './bands.js';
import { createFlowPass, inlineVelocity, type PathSampler, traceFlow } from './flow.js';
import { createPaintPass } from './paint.js';

// ---------------------------------------------
// Feel constants (tuned by eye at the defaults gate)
// ---------------------------------------------
// GPU time, measured with <ShaderMonitor> on WebGPU in headless Chromium
// on the M1 Max at 2x, beside a LinearGradient baseline reading 0.12 ms: at
// 1440 by 900, 2.6 to 2.7 ms with the flow moving and 2.5 to 2.7 ms still.

// How many points each pixel's trace colors and averages. Each step reads
// the flow, the paint, and the cached palette. 12 steps with two flow reads
// each, for midpoint integration, read 0.57 to 0.63 ms in the Reactive
// card's 312 by 309 window at 2x, over its 0.4 ms budget. 8 steps with one
// read each, at the same reach, read 0.34 to 0.38 ms moving and 0.27 to
// 0.29 ms still, and looked the same.
const STEP_COUNT = 8;

// How far one step travels at swirl 1 where the flow runs at unit speed, in
// lattice cells (about one eddy each). STEP_COUNT x STEP_LENGTH, 0.3 cells,
// is the whole trace's reach at swirl 1. Longer steps reach further for the
// same cost, until neighboring samples land far enough apart to draw the
// paint's detail as separate copies around tight curls instead of one
// streak.
const STEP_LENGTH = 0.0375;

// Where thin streaks start fading to the bands' average color: the share of
// one whole pass of the stops a single pixel spans. The fade is complete at
// 1, where a pixel spans every stop and its true color is the average.
// Lower starts the fade sooner, which calms moving streaks at the cost of
// fine detail; higher keeps detail longer, and with it more shimmer.
const FADE_START = 0.25;

// How far the paint shifts each point's place in the bands, in passes of
// the stops. The paint runs -1..1, so at 1 it can move a point a whole pass
// either way, which breaks the bands into blotches. 0 would leave plain
// streaked bands.
const PAINT_SHIFT = 1;

// The swirl at which the paint reaches its full shift. Below it, the paint
// fades out with swirl, so swirl 0 draws straight bands instead of still
// blotches. Above it, swirl only carries the colors.
const FULL_PAINT_SWIRL = 0.2;

export interface LiquidGradientShaderProps {
  /**
   * Colors of the bands. Accepts hex, `oklch()`, or `oklab()`; positions
   * auto-space when omitted.
   */
  stops: ColorStop[];
  /**
   * Direction the bands run across before the flow carries them, in
   * degrees. 0 runs left to right, 90 runs bottom to top. Accepts a static
   * value or an animation signal.
   */
  angle: AnimatableProp<number>;
  /**
   * How many times the stops run across the canvas. Every other pass runs
   * the stops backward, so each pass ends on the color the next one starts
   * with and no seam forms. Values at or below 1 render as a single pass.
   * Accepts a static value or an animation signal.
   */
  repeat: AnimatableProp<number>;
  /**
   * How the colors meet. 0 gives hard bands, one flat band per stop; 1 eases
   * each stop into the next across the whole space between them. Accepts a
   * static value or an animation signal.
   */
  softness: AnimatableProp<number>;
  /**
   * How far the current carries the colors. 0 leaves the bands straight, and
   * the paint's blotches fade in by 0.2; higher values streak and curl the
   * colors further. Above about 2, the streaks start to break into separate
   * copies around tight curls. Accepts a static value or an animation
   * signal.
   */
  swirl: AnimatableProp<number>;
  /**
   * Roughly how many eddies span the canvas's height. Above 4, the flow's
   * pattern starts to repeat across a wide canvas. Accepts a static value or
   * an animation signal.
   */
  scale: AnimatableProp<number>;
  /**
   * How fast the current drifts: its eddies form, merge, and dissolve as
   * they slide across the canvas. 0 holds the flow still. Accepts a static
   * value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /**
   * Picks a different flow and paint with the same character. Each whole
   * number gives an unrelated layout.
   */
  seed: number;
  /** Color space the bands are interpolated in. */
  colorSpace: ColorSpace;
  /** Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert otherwise. */
  hueInterpolation: HueInterpolation;
}

export function LiquidGradientShader({
  stops,
  angle,
  repeat,
  softness,
  swirl,
  scale,
  speed,
  seed,
  colorSpace,
  hueInterpolation,
}: LiquidGradientShaderProps) {
  const shaderContext = useShaderContext();

  // A literal speed of 0 holds the flow still, so nothing on screen changes
  // (an animation signal might move later, so it doesn't count). Telling
  // the scene lets its frame scheduler park on the still frame instead of
  // redrawing an unchanging image, as Grain does.
  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  // useAnimatableSpeed sums speed x frame time into a phase uniform each
  // frame. The flow's arrows turn and the flow slides by the phase, so
  // changing speed changes the tempo without snapping the flow to where a
  // time x speed product would put it.
  const phaseUniform = useAnimatableSpeed(speed);

  // The animatable dials live in uniforms (values the CPU can update each
  // frame without rebuilding the shader), tracking either a static number or
  // an animation signal.
  const angleUniform = useAnimatableUniform<number>(angle);
  const repeatUniform = useAnimatableUniform<number>(repeat);
  const softnessUniform = useAnimatableUniform<number>(softness);
  const swirlUniform = useAnimatableUniform<number>(swirl);
  const scaleUniform = useAnimatableUniform<number>(scale);

  // Canvas width over height, so the eddies stay round on a wide canvas.
  const aspectNode = useAspectUniform();

  // The seed goes into the flow's and the paint's hashes, which read it as a
  // whole number 0 or above (stableHash truncates to u32, and u32 of a
  // negative float is backend-defined). The uniform is created once and
  // rewritten, so a new seed repaints without recompiling. The scene renders
  // on demand, so poke it to show the change (the bare-uniform-write gotcha
  // in docs/agents/tsl.md).
  const seedUniform = useMemo(() => uniform(0), []);

  useEffect(() => {
    seedUniform.value = Math.round(Math.abs(seed));
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, seedUniform, seed]);

  // Content fingerprint of the stops array (colors + positions). The build
  // effect keys on this string, so a re-render that passes a new array with
  // the same contents doesn't rebuild the material.
  const stopsKey = colorStopsKey(stops);

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount, and again only when the stops, the color space, or
  // the hue arc change, because colorRamp bakes the stop colors in as
  // constants. Every dial above flows through uniforms.
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

      // The flow pass draws the flow's velocity into a texture whenever the
      // flow moves, so a read costs one texel. Where the renderer can't draw
      // half floats, each read works the velocity out from the noise
      // instead, which looks the same and costs far more.
      const flowInputs = { seed: seedUniform, phase: phaseUniform };
      const flowPass = createFlowPass(shaderContext, flowInputs);
      const velocityAt = flowPass?.velocityAt ?? inlineVelocity(flowInputs);

      // The paint pass draws the paint into a texture on the first frame and
      // again only when the seed changes (./paint.ts).
      const paintPass = createPaintPass(shaderContext, { seed: seedUniform });

      // ---------------------------------------------
      // Find the pixel's place in the bands
      // ---------------------------------------------
      // LinearGradient's projection at its default center: the angle becomes
      // a unit direction, and the pixel's distance along it from the canvas
      // center, plus 0.5, is its place on the ramp. At angle 0 that is plain
      // u: 0 at the left edge, 1 at the right.
      const angleRadians = angleUniform.mul(Math.PI / 180);
      const direction = vec2(cos(angleRadians), sin(angleRadians));
      const pixelCoord = centered.dot(direction).add(0.5);

      // The projection is a straight line, so a point some lattice cells
      // away from the pixel sits that offset, dotted with coordPerCell,
      // further along the ramp. coordPerCell undoes the placement's
      // stretches in reverse to turn cells into uv: divide by scale, then x
      // by the aspect. The max() keeps a scale of 0 from dividing by zero.
      const safeScale = max(scaleUniform, 0.001);
      const coordPerCell = vec2(direction.x.div(aspectNode), direction.y).div(safeScale);

      // How far the paint can shift a point, in passes of the stops:
      // PAINT_SHIFT, faded in by smoothstep as swirl rises from 0 to
      // FULL_PAINT_SWIRL.
      // smoothstep is exactly 1 past its upper edge, so at the default swirl
      // the paint keeps its full strength.
      const paintStrength = smoothstep(0, FULL_PAINT_SWIRL, swirlUniform).mul(PAINT_SHIFT);

      // A point's place in the bands, before the passes fold it: the band
      // coordinate there, shifted by the paint there. The paint runs -1..1,
      // so `strength` is how many passes it can shift a point either way.
      const paintedCoord = (
        bandCoord: ShaderNodeObject<Node>,
        point: ShaderNodeObject<Node>,
        strength: ShaderNodeObject<Node>,
      ) => bandCoord.add(paintPass.paintAt(point).mul(strength));

      // A coordinate's place on the ramp, 0..1. Times repeat, it counts
      // passes of the stops, and a triangle wave folds them so every other
      // pass runs backward: fract(passes / 2) climbs 0..1 over two passes,
      // x 2 - 1 makes that -1..1, and 1 - abs() folds it into 0 -> 1 -> 0.
      // Each pass ends on the color the next starts with, so no seam forms.
      // max() holds repeat at 1 or more, so a repeat at or below 1 draws a
      // single pass. The fold still catches a coordinate the paint pushed
      // past either end and turns it back, where clamping it would leave a
      // flat patch of the first or last color.
      const bandPosition = (coordinate: ShaderNodeObject<Node>) =>
        fract(coordinate.mul(max(repeatUniform, 1)).mul(0.5))
          .mul(2)
          .sub(1)
          .abs()
          .oneMinus();

      // ---------------------------------------------
      // Color each point of the path
      // ---------------------------------------------
      // The ramp pass caches the palette's colors in a texture, so a sample
      // reads RGB instead of converting color spaces (./bands.ts). The
      // average pass holds the bands' average color, which thin streaks fade
      // to.
      const palette: BandPalette = {
        stops: toColorRampStops(stops),
        colorSpace,
        hueInterpolation,
      };
      const averagePass = createAveragePass(shaderContext, palette, softnessUniform);
      const rampPass = createRampPass(shaderContext, palette);

      // One point's linear RGB color. A ramp coordinate is a position, not a
      // color, and averaging positions through a curved ramp would invent a
      // middle color the path never passed, so every sample becomes a color
      // first and the trace averages the colors.
      const colorAt = (
        coordinate: ShaderNodeObject<Node>,
        averageColor: ShaderNodeObject<Node>,
      ) => {
        // The GPU shades pixels in 2x2 blocks, so each pixel can see how
        // much a value changes to its neighbors. fwidth() returns that
        // change, |change across| + |change down|. Taken on the coordinate
        // before the fold and times repeat, it counts how many whole passes
        // of the stops one pixel spans at this sample. On straight bands that
        // is a few thousandths. Where the flow squeezes a streak thinner than
        // a pixel, it climbs toward 1. Measured per sample, because slopes
        // on either side of a fold cancel once averaged.
        const footprint = fwidth(coordinate).mul(max(repeatUniform, 1));

        // Stops ease in no narrower than one pixel's footprint, so a hard
        // band's edge spans a pixel instead of a staircase. A sample that
        // spans most of a pass would pick one color from all of them, which
        // shimmers as the flow moves, so it fades toward the bands' average.
        const bandColor = rampPass.colorAt(bandPosition(coordinate), softnessUniform, footprint);

        return mix(bandColor, averageColor, smoothstep(FADE_START, 1, footprint));
      };

      // ---------------------------------------------
      // Trace it back, averaging the colors it passes
      // ---------------------------------------------
      // swirl scales every step, so it sets how far the trace reaches: at 0
      // the trace stands still and the bands stay straight. The sampler pins
      // its per-pixel inputs before the loop (the first-use gotcha in
      // docs/agents/tsl.md), so each step recomputes only what depends on
      // its offset.
      const sampleAlongPath = (): PathSampler => {
        const startPoint = flowPoint.toVar();
        const startCoord = pixelCoord.toVar();
        const perCell = coordPerCell.toVar();
        const strength = paintStrength.toVar();
        // The one-texel average is the same at every step. Read it once.
        const averageColor = averagePass.color.toVar();

        return (offset) =>
          colorAt(
            paintedCoord(startCoord.add(offset.dot(perCell)), startPoint.add(offset), strength),
            averageColor,
          );
      };

      // An unlit material whose per-pixel color comes from colorNode.
      const material = new MeshBasicNodeMaterial();

      material.colorNode = traceFlow(flowPoint, {
        steps: STEP_COUNT,
        stepLength: swirlUniform.mul(STEP_LENGTH),
        velocityAt,
        sampleAlongPath,
      });

      // A 2x2 plane exactly fills ShaderScene's camera view (-1..1 on both
      // axes), so the gradient covers the whole canvas.
      const mesh = new Mesh(new PlaneGeometry(2, 2), material);

      shaderContext.scene.add(mesh);

      // A rebuild swaps the mesh without touching any uniform, and a still
      // scene is parked, so poke it to draw the new material.
      shaderContext.scheduler.requestRender();

      return () => {
        shaderContext.scene.remove(mesh);
        flowPass?.dispose();
        paintPass.dispose();
        averagePass.dispose();
        rampPass.dispose();
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
      softnessUniform,
      swirlUniform,
      scaleUniform,
      aspectNode,
      phaseUniform,
      seedUniform,
      stopsKey,
      colorSpace,
      hueInterpolation,
    ],
  );

  return null;
}
