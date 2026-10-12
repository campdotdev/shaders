'use client';

// SwirlGradient's GPU half. The pixel's journey: place the pixel in the
// flow, trace it backward along the flow (./flow.ts) while reading the
// bands and the paint (./paint.ts) at every point it passes, then color it
// by averaging their linear RGB colors (./bands.ts). Averaging along the path
// streaks each color along the current, the way moving liquid looks,
// instead of folding sharp copies of the bands, and the paint's fine
// detail is what the streaks are drawn from. The wrapper
// (./swirl-gradient.tsx) supplies the props.
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
  vec3,
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
import { type BandPalette, createAveragePass, createRampPass, smoothSeams } from './bands.js';
import { createFlowPass, inlineVelocity, type PathSampler, traceFlow } from './flow.js';
import { createPaintPass } from './paint.js';

// ---------------------------------------------
// Feel constants (provisional until the defaults gate)
// ---------------------------------------------
// Samples along each pixel's trace. Each step reads the flow twice for
// midpoint integration, then the paint and cached palette. To compare
// sampling quality at the same reach, increase this count and reduce
// STEP_LENGTH by the same factor. Increasing the count alone traces farther.
const STEP_COUNT = 12;

// How far one step travels at swirl 1 where the flow runs at unit speed, in
// lattice cells (about one eddy each). STEP_COUNT x STEP_LENGTH is the
// nominal trace time at swirl 1. At 0.1, neighboring samples were far
// enough apart to draw separate paint contours around tight curls. 0.025
// keeps the default trace shorter and its samples close enough to blend.
// Large swirl or step-length overrides can still expose separate samples.
const STEP_LENGTH = 0.025;

// The smaller eddies' strength, 0..1. 0 leaves the broad currents alone.
// Raising it ripples finer swirls into them; at 0.5 they swirl as hard as
// the broad eddies.
const SMALL_EDDIES = 0.45;

// How far the flow slides per unit of phase, in lattice cells, on top of
// the eddies morphing in place. 0 keeps the eddies where they are.
const SLIDE = 1;

// Where thin streaks start fading to the bands' average color: the share of
// one whole pass of the stops a single pixel spans. The fade is complete at
// 1, where a pixel spans every stop and its true color is the average.
// Lower starts the fade sooner, which calms moving streaks at the cost of
// fine detail; higher keeps detail longer, and with it more shimmer.
const FADE_START = 0.25;

// How much of each pixel's color comes from the average along its path,
// 0..1. 0 reads the bands once, where the trace ends, which folds sharp
// copies of them. 1 averages every point the trace passed, which streaks
// the colors along the current.
const SMEAR = 1;

// How a pass of the stops meets the next. 0 snaps back to the first stop,
// as LinearGradient does, leaving a seam wherever the first and last stops
// differ. 1 runs every other pass backward, so each pass ends on the color
// the next one starts with and no seam forms.
const MIRROR = 1;

// How far the paint shifts each point's place in the bands, in passes of
// the stops. The paint runs -1..1, so at 1 it can move a point a whole pass
// either way, which breaks the bands into blotches. 0 leaves plain bands.
const PAINT = 1;

// How loudly the paint's finer layers speak, 0..1, each layer weighted this
// much times the one before. Low leaves soft blotches; high adds the fine
// detail the path average streaks along the current.
const PAINT_DETAIL = 0.6;

/**
 * TEMPORARY (build-phase tuning only): dev overrides for the feel
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
  /**
   * How far the flow slides per unit of phase, in lattice cells, on top of
   * the eddies morphing in place.
   */
  slide?: number;
  /**
   * The share of one pass of the stops a pixel spans when streaks start
   * fading to the average color, 0..1.
   */
  fadeStart?: number;
  /**
   * How much of each pixel's color comes from the average along its path,
   * from 0 for the trace's end alone to 1.
   */
  smear?: number;
  /** 0 snaps each pass back to the first stop; 1 mirrors every other pass. */
  mirror?: number;
  /** How far the paint shifts each point along the bands, in passes. */
  paint?: number;
  /** How loudly the paint's finer layers speak, 0..1. */
  paintDetail?: number;
}

// The tuning rig's knobs, each falling back to its feel constant. ?? per
// knob, rather than spreading the overrides over a defaults object, so a
// knob passed as undefined still gets its constant.
function resolveTuning(tuning: SwirlGradientTuning = {}): Required<SwirlGradientTuning> {
  return {
    steps: tuning.steps ?? STEP_COUNT,
    stepLength: tuning.stepLength ?? STEP_LENGTH,
    smallEddies: tuning.smallEddies ?? SMALL_EDDIES,
    slide: tuning.slide ?? SLIDE,
    fadeStart: tuning.fadeStart ?? FADE_START,
    smear: tuning.smear ?? SMEAR,
    mirror: tuning.mirror ?? MIRROR,
    paint: tuning.paint ?? PAINT,
    paintDetail: tuning.paintDetail ?? PAINT_DETAIL,
  };
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
   * How the colors meet. 0 gives hard bands, one flat band per stop; 1 eases
   * each stop into the next across the whole space between them. Seams stay
   * crisp at any softness. Accepts a static value or an animation signal.
   */
  softness: AnimatableProp<number>;
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
   * How fast the flow drifts: its eddies form, merge, and dissolve, and the
   * bands fold along with them. 0 holds the flow still. Accepts a static
   * value or an animation signal.
   */
  speed: AnimatableProp<number>;
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
  softness,
  swirl,
  scale,
  speed,
  seed,
  colorSpace,
  hueInterpolation,
  tuning,
}: SwirlGradientShaderProps) {
  const shaderContext = useShaderContext();

  // A literal speed of 0 holds the flow still, so nothing on screen changes
  // (an animation signal might move later, so it doesn't count). Telling
  // the scene lets its frame scheduler park on the still frame instead of
  // redrawing an unchanging image, as Grain does.
  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  // useAnimatableSpeed sums speed x frame time into a phase uniform each
  // frame. The flow's arrows turn by the phase, so changing speed changes
  // the tempo without snapping the flow to where a time x speed product
  // would put it.
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
  // Each knob rides a uniform, like the props above, so its slider glides
  // without a rebuild. The step count is the loop's bound, compiled into the
  // shader, so it joins the build effect's deps instead.
  const knobs = resolveTuning(tuning);
  const stepCount = knobs.steps;
  const stepLengthUniform = useAnimatableUniform<number>(knobs.stepLength);
  const smallEddiesUniform = useAnimatableUniform<number>(knobs.smallEddies);
  const slideUniform = useAnimatableUniform<number>(knobs.slide);
  const fadeStartUniform = useAnimatableUniform<number>(knobs.fadeStart);
  const smearUniform = useAnimatableUniform<number>(knobs.smear);
  const mirrorUniform = useAnimatableUniform<number>(knobs.mirror);
  const paintUniform = useAnimatableUniform<number>(knobs.paint);
  const paintDetailUniform = useAnimatableUniform<number>(knobs.paintDetail);

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

      // The flow pass draws the flow's velocity into a texture before each
      // frame, so a read costs one texel. Where the renderer can't draw half
      // floats, each read works the velocity out from the noise instead,
      // which looks the same and costs far more.
      const flowInputs = {
        seed: seedUniform,
        smallEddies: smallEddiesUniform,
        phase: phaseUniform,
        slide: slideUniform,
      };
      const flowPass = createFlowPass(shaderContext, flowInputs);
      const velocityAt = flowPass?.velocityAt ?? inlineVelocity(flowInputs);

      // The paint pass draws the paint into a texture on the first frame and
      // again only when the seed or its detail changes (./paint.ts).
      const paintPass = createPaintPass(shaderContext, {
        seed: seedUniform,
        detail: paintDetailUniform,
      });

      // ---------------------------------------------
      // Find the pixel's place in the bands
      // ---------------------------------------------
      // LinearGradient's projection at its default center: the angle becomes
      // a unit direction, and the pixel's distance along it from the canvas
      // center, plus 0.5, is its place on the ramp. At angle 0 that is plain
      // u: 0 at the left edge, 1 at the right.
      const angleRadians = angleUniform.mul(Math.PI / 180);
      const direction = vec2(cos(angleRadians), sin(angleRadians));
      const pixelCoord = uv().sub(vec2(0.5, 0.5)).dot(direction).add(0.5);

      // The projection is a straight line, so a point some lattice cells
      // away from the pixel sits that offset, dotted with coordPerCell,
      // further along the ramp. coordPerCell undoes the placement's
      // stretches in reverse to turn cells into uv: divide by scale, then x
      // by the aspect. The max() keeps a scale of 0 from dividing by zero.
      const safeScale = max(scaleUniform, 0.001);
      const coordPerCell = vec2(direction.x.div(aspectNode), direction.y).div(safeScale);

      // A coordinate's place on the ramp, 0..1. Times repeat, it counts
      // passes of the stops. fract() keeps the fractional part, a sawtooth
      // that snaps back to the first stop each pass. The mirrored form is a
      // triangle instead: fract(passes / 2) climbs 0..1 over two passes, x 2
      // - 1 makes that -1..1, and 1 - abs() folds it into 0 -> 1 -> 0, so
      // every other pass runs backward. LinearGradient's repeat gate keeps a
      // single pass, at repeat <= 1, as the plain coordinate.
      const repeatGate = smoothstep(1, 1.01, repeatUniform);
      const bandPosition = (coordinate: ShaderNodeObject<Node>) => {
        const passes = coordinate.mul(repeatUniform);
        const sawtooth = fract(passes);
        const mirrored = fract(passes.mul(0.5)).mul(2).sub(1).abs().oneMinus();

        return mix(coordinate, mix(sawtooth, mirrored, mirrorUniform), repeatGate);
      };

      // A point's place in the bands, before the sawtooth or triangle: the
      // band coordinate there, shifted by the paint there. The paint runs
      // -1..1, so `paint` is how many passes of the stops it can shift a
      // point either way.
      const paintedCoord = (bandCoord: ShaderNodeObject<Node>, point: ShaderNodeObject<Node>) =>
        bandCoord.add(paintPass.paintAt(point).mul(paintUniform));

      // ---------------------------------------------
      // Color each paint sample before mixing it
      // ---------------------------------------------
      const palette: BandPalette = {
        stops: toColorRampStops(stops),
        colorSpace,
        hueInterpolation,
      };
      const seamColors = {
        first: palette.stops[0]?.color ?? vec3(0, 0, 0),
        last: palette.stops[palette.stops.length - 1]?.color ?? vec3(0, 0, 0),
      };
      const averagePass = createAveragePass(shaderContext, palette, softnessUniform);
      const rampPass = createRampPass(shaderContext, palette);

      // A ramp coordinate is a position, not a color. Mapping the average
      // position through a nonlinear ramp invents a middle color instead
      // of mixing the colors the trace passed. Convert every sample to
      // linear RGB first, then let traceFlow average those colors.
      const colorAt = (
        coordinate: ShaderNodeObject<Node>,
        averageColor: ShaderNodeObject<Node>,
      ) => {
        const position = bandPosition(coordinate);

        // fwidth measures the change across neighboring pixels. Measure
        // the unfolded coordinate at each sample, before fract introduces
        // a seam. Opposite slopes can cancel if averaged before this step,
        // hiding thin bands that still need smoothing.
        const footprint = fwidth(coordinate).mul(max(repeatUniform, 1));
        const edgeColor = smoothSeams(
          rampPass.colorAt(position, softnessUniform, footprint),
          position,
          footprint,
          seamColors,
          repeatGate.mul(mirrorUniform.oneMinus()),
        );
        const threadFade = smoothstep(fadeStartUniform, 1, footprint);

        return mix(edgeColor, averageColor, threadFade);
      };

      // ---------------------------------------------
      // Trace it back, mixing the paint along the way
      // ---------------------------------------------
      // Pin the placement before the loop so each step only recomputes
      // the part that depends on its offset. Each sample reads the paint,
      // maps it through the palette, and smooths bands narrower than a pixel.
      const sampleBandsAlongPath = (): PathSampler => {
        const startPoint = flowPoint.toVar();
        const startCoord = pixelCoord.toVar();
        const perCell = coordPerCell.toVar();
        // This one-texel average is identical at every step. Read it once.
        const averageColor = averagePass.color.toVar();

        return (offset) =>
          colorAt(
            paintedCoord(startCoord.add(offset.dot(perCell)), startPoint.add(offset)),
            averageColor,
          );
      };
      const liquidColor = traceFlow(flowPoint, {
        steps: stepCount,
        stepLength: swirlUniform.mul(stepLengthUniform),
        velocityAt,
        sampleAlongPath: sampleBandsAlongPath,
        finishTrace: (offset, meanColor) => {
          const endCoord = paintedCoord(
            pixelCoord.add(offset.dot(coordPerCell)),
            flowPoint.add(offset),
          );

          // Smear 0 shows the final point. Smear 1 mixes every sampled
          // color in linear light. A zero-length trace samples one point
          // throughout, so both ends of the dial give the same color.
          return mix(colorAt(endCoord, averagePass.color), meanColor, smearUniform);
        },
      });

      // An unlit material whose per-pixel color comes from colorNode.
      const material = new MeshBasicNodeMaterial();

      material.colorNode = liquidColor;

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
      stepLengthUniform,
      smallEddiesUniform,
      slideUniform,
      fadeStartUniform,
      smearUniform,
      mirrorUniform,
      paintUniform,
      paintDetailUniform,
      stepCount,
      stopsKey,
      colorSpace,
      hueInterpolation,
    ],
  );

  return null;
}
