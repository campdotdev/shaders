'use client';

// The fractal-noise field's GPU half. Each pixel sums several octaves of 3D
// simplex noise — every octave at double the frequency and a fraction of the
// amplitude of the one before, so broad shapes carry progressively finer
// grain on top (x/y from screen position, turned by `angle` and drawn out
// by `stretch`, z from time, so the pattern morphs in place rather than
// scrolling). The layered sum then runs through a chain
// of 0..1 shaping steps — balance, contrast, banding — before picking a color
// from the ramp. The wrapper (./fractal-noise.tsx) supplies the props.
import { useEffect, useMemo } from 'react';

import { clamp, cos, float, max, mix, sin, uniform, uv, vec2, vec3 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import {
  colorRamp,
  type ColorSpace,
  type FractalFold,
  fractalNoise,
  type HueInterpolation,
  quantize,
} from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableSpeed } from '../../react/hooks/use-animatable-speed/use-animatable-speed.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import { type ColorStop, colorStopsKey, toColorRampStops } from '../shared/color.js';

/**
 * Texture character: plain layered clouds, soft folded billows, or a crisp
 * vein network.
 */
export type FractalNoiseStyle = 'clouds' | 'smoke' | 'veins';

// ---------------------------------------------
// Feel constants (tuned by eye at the build's visual gates)
// ---------------------------------------------
// The detail prop (0..1) maps onto fBm gain — the per-octave amplitude
// falloff — inside this range. Gain is what decides how loudly the finer
// octaves speak: at GAIN_MIN they all but vanish, at GAIN_MAX they rival
// the broad base layer. Raising GAIN_MAX makes detail 1 rougher; raising
// GAIN_MIN keeps even detail 0 slightly layered.
const GAIN_MIN = 0.15;
const GAIN_MAX = 0.85;

// Which turbulence fold each style asks the fBm primitive for. Folding runs
// every octave through abs() before it joins the sum: the sign flips at
// every zero crossing become creases, and the creases are what read as
// billow edges (smooth) or veins (sharp).
const STYLE_FOLD: Record<FractalNoiseStyle, FractalFold> = {
  clouds: 'none',
  smoke: 'smooth',
  veins: 'sharp',
};

// Per-style remap of the raw fBm sum onto the 0..1 range the ramp expects:
// value = clamp(raw * spread + lift, 0, 1).
// clouds: raw is ~-1..1, so 0.5/0.5 is exactly (raw + 1) / 2.
// smoke:  abs² folding pools values low — a spread above 1 widens them.
// veins:  sqrt folding pools values high — a negative lift pulls them back.
const STYLE_REMAP: Record<FractalNoiseStyle, { spread: number; lift: number }> = {
  clouds: { spread: 0.5, lift: 0.5 },
  smoke: { spread: 1.6, lift: 0.18 },
  veins: { spread: 1.4, lift: -0.28 },
};

export interface FractalNoiseShaderProps {
  /**
   * Texture character. 'clouds' is plain layered fBm; 'smoke' folds each
   * layer into soft rounded billows; 'veins' folds sharper, leaving a
   * network of crisp bright creases.
   */
  style: FractalNoiseStyle;
  /**
   * Zoom of the noise field — roughly how many broad noise features span
   * the canvas; finer octaves layer detail on top. Counts features across
   * the streaks when `stretch` is above 1. Accepts a static value or an
   * animation signal.
   */
  scale: AnimatableProp<number>;
  /**
   * The direction the features run, in degrees on screen: 0 runs them left
   * to right and 90 runs them bottom to top, the degrees FlutedGlass's
   * `angle` uses. Accepts a static value or an
   * animation signal.
   */
  angle: AnimatableProp<number>;
  /**
   * How much longer each feature runs along `angle`, 1 or more. At 1, a
   * feature is as much longer than wide as the canvas is wider than tall.
   * `stretch` multiplies that, so on a 2:1 canvas a stretch of 3 draws
   * features 6 times longer than wide. Accepts a static value or an animation signal.
   */
  stretch: AnimatableProp<number>;
  /**
   * How fast the pattern morphs over time. 0 freezes the pattern.
   * Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /**
   * Number of noise layers summed, 1-8. More octaves add finer detail at
   * higher cost. Fixed at shader-build time.
   */
  octaves: number;
  /**
   * How strongly the finer layers show through, 0-1. 0 leaves only the
   * broadest layer; 1 gives every layer near-equal weight. Accepts a
   * static value or an animation signal.
   */
  detail: AnimatableProp<number>;
  /**
   * Pushes noise values toward the ramp extremes. 1 is neutral; above 1
   * leans into the first and last colors, below 1 pulls everything toward
   * the middle stops. Accepts a static value or an animation signal.
   */
  contrast: AnimatableProp<number>;
  /**
   * Shifts the whole pattern through the color ramp. 0.5 is neutral; below
   * leans toward the first colors, above leans toward the last. In 2-color
   * mode this reads as a dark/light balance. Accepts a static value or an
   * animation signal.
   */
  balance: AnimatableProp<number>;
  /**
   * Blends between posterized contour bands and a smooth gradient. 0 = hard
   * bands (one per color stop); 1 = fully smooth. Accepts a static value or
   * an animation signal.
   */
  softness: AnimatableProp<number>;
  /**
   * Colors of the ramp the noise field maps onto. Accepts hex, `oklch()`,
   * or `oklab()`; positions auto-space when omitted.
   */
  stops: ColorStop[];
  /**
   * Static offset of the noise pattern. Change it for a different layout of
   * the same character.
   */
  seed: number;
  /** Color space the ramp is interpolated in. */
  colorSpace: ColorSpace;
  /** Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert otherwise. */
  hueInterpolation: HueInterpolation;
}

export function FractalNoiseShader({
  style,
  scale,
  angle,
  stretch,
  speed,
  octaves,
  detail,
  contrast,
  balance,
  softness,
  stops,
  seed,
  colorSpace,
  hueInterpolation,
}: FractalNoiseShaderProps) {
  const shaderContext = useShaderContext();

  // A literal speed of 0 freezes the pattern, so nothing ever changes on
  // screen (an animation signal might move later and doesn't count). Telling
  // the scene lets its frame scheduler go idle instead of re-rendering.
  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  // The animated dials live in uniforms (values the CPU can update each
  // frame without rebuilding the shader), tracking either a static number or
  // an animation signal. Speed is the exception: useAnimatableSpeed
  // integrates it into a phase uniform (speed x delta summed each frame), so
  // a speed change shifts the morphing tempo without snapping the pattern.
  const scaleUniform = useAnimatableUniform<number>(scale);
  const angleUniform = useAnimatableUniform<number>(angle);
  const stretchUniform = useAnimatableUniform<number>(stretch);
  const phaseUniform = useAnimatableSpeed(speed);
  const detailUniform = useAnimatableUniform<number>(detail);
  const contrastUniform = useAnimatableUniform<number>(contrast);
  const balanceUniform = useAnimatableUniform<number>(balance);
  const softnessUniform = useAnimatableUniform<number>(softness);

  // The canvas's width / height. The tilt below squares up the field with it,
  // so `angle` reads in true on-screen degrees on a wide canvas.
  const aspectUniform = useAspectUniform();

  // Content fingerprint of the stops array (colors + positions). The build
  // effect keys on this string, so a re-render that passes a new array with
  // the same contents doesn't rebuild the material.
  const stopsKey = colorStopsKey(stops);

  // The seed becomes a 2D offset of the sampling window. The Vector2 and its
  // uniform are created once; the effect below writes into them, so changing
  // the seed re-positions the pattern without recompiling the material.
  const seedVec = useMemo(() => new Vector2(0, 0), []);
  const seedUniform = useMemo(() => uniform(seedVec), [seedVec]);

  useEffect(() => {
    // Multiplying the seed by two unrelated constants (12.9898/78.233, a
    // classic shader-hashing pair) spreads consecutive seeds far apart in
    // both axes, so seed 1 and seed 2 land in unrelated regions of the noise
    // field instead of one step apart. The scene renders on demand, so poke
    // the scheduler to show the change.
    seedVec.set(seed * 12.9898, seed * 78.233);
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, seedVec, seed]);

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount — and again only when a structural input changes:
  // octaves (the octave loop is unrolled into the compiled shader), style
  // (the fold choice is baked into each unrolled octave), or the stops /
  // color space (colorRamp bakes the stop colors in as constants). Every
  // dial above flows through uniforms without touching this effect.
  useEffect(
    () => {
      if (!shaderContext) return;

      // ---------------------------------------------
      // Tilt and stretch: turn the pixel into a field position
      // ---------------------------------------------
      // uv() is the pixel's 0..1 position, 0..1 on both axes whatever the
      // canvas shape, so on a wide canvas every feature is already wider
      // than it is tall. Rotating in uv would skew the angle: 30 degrees
      // would show at about 14 on the 2.35:1 hero. So the rotation runs in
      // square space instead, and the result returns to uv after it.
      //
      // Subtracting 0.5 puts the canvas center at the origin, so the field
      // turns around the middle of the canvas. Multiplying x by the aspect
      // ratio (width / height) squares the space up: one unit is now one
      // canvas height on both axes, so a degree on screen is a degree here.
      const centered = uv().sub(0.5);
      const squareX = centered.x.mul(aspectUniform);
      const squareY = centered.y;

      // Rotate by -angle, the standard 2D rotation written out per axis.
      // `along` is how far the pixel sits in the angle's direction, `across`
      // how far it sits at right angles to it. At angle 0, cos is 1 and sin
      // is 0, so along is x and across is y, and nothing turns.
      const angleRadians = angleUniform.mul(Math.PI / 180);
      const cosine = cos(angleRadians);
      const sine = sin(angleRadians);
      const along = squareX.mul(cosine).add(squareY.mul(sine));
      const across = squareY.mul(cosine).sub(squareX.mul(sine));

      // Dividing `along` by stretch slows the field down in the angle's
      // direction: at stretch 4, a pixel has to move four times as far
      // along the angle to cross one feature, so features run four times
      // longer that way. `across` is untouched, so `scale` still counts
      // features across the streaks. The max() floors stretch at 1, which
      // also keeps a stretch of 0 from dividing by zero.
      //
      // Dividing by the aspect ratio again undoes the squaring, and adding
      // 0.5 undoes the centering, so at angle 0 and stretch 1 this is uv
      // back again and the field draws exactly what it drew before these
      // props existed. At other angles the canvas shape's own widening
      // turns with the angle, so on a wide canvas the streaks come out
      // aspect x stretch long.
      const fieldXY = vec2(along.div(max(stretchUniform, 1)).div(aspectUniform), across).add(0.5);

      // Where to sample the noise field. Multiplying by scale zooms out so
      // roughly `scale` broad noise features span the canvas, and the seed
      // offset slides the whole window to a different neighborhood. The
      // accumulated phase rides in as a third dimension: as z advances the
      // pattern morphs in place, rather than sliding sideways the way an x/y
      // offset would.
      const sampleXY = fieldXY.mul(scaleUniform).add(seedUniform);
      const samplePoint = vec3(sampleXY, phaseUniform);

      // detail rides a uniform; remap 0..1 onto the useful gain range in
      // TSL so the slider glides without rebuilding the material.
      const gainNode = mix(float(GAIN_MIN), float(GAIN_MAX), detailUniform);

      // Sum `octaves` layers of simplex noise. Layer i samples at twice the
      // frequency and pow(gain, i) times the amplitude of layer i-1, so
      // broad shapes carry fine grain on top — the layered look
      // single-octave noise can't produce. The style picks the per-octave
      // fold: unfolded clouds come back roughly -1..1, folded smoke/veins
      // roughly 0..1 (abs() leaves nothing negative).
      const rawNoise = fractalNoise(samplePoint, {
        octaves,
        gain: gainNode,
        fold: STYLE_FOLD[style],
      });

      // Remap the raw sum onto the 0..1 range the ramp expects. One formula
      // covers every style — clouds' 0.5/0.5 is exactly (raw + 1) / 2, and
      // the folded styles' spread/lift recenters their clustered values
      // (smoke pools low, veins pools high). The clamp catches overshoot.
      // Plain numbers, not uniforms: the remap pair is welded to the style,
      // and a style change rebuilds the material anyway.
      const { spread, lift } = STYLE_REMAP[style];
      const normalized = clamp(rawNoise.mul(spread).add(lift), 0, 1);

      // Balance: shift the noise scalar earlier (<0.5) or later (>0.5) into the
      // color ramp. 0.5 is identity. In 2-color mode this reads as dark/light;
      // in multi-color mode it leans toward the first or last colors in the array.
      // The (balance - 0.5) * 2 mapping turns the 0..1 dial into a -1..+1
      // shift, so either end of the dial can push every value past a ramp
      // extreme; the clamp catches what overshoots.
      const balanceShift = balanceUniform.sub(0.5).mul(2);
      const balanced = clamp(normalized.add(balanceShift), 0, 1);

      // Contrast: linear scale around 0.5. 1 is identity, >1 pushes values toward
      // the ramp extremes (first/last colors), <1 pulls them toward the middle.
      // The subtract/scale/add-back sandwich stretches distances from the
      // midpoint while leaving the midpoint itself fixed.
      const contrastedValue = clamp(balanced.sub(0.5).mul(contrastUniform).add(0.5), 0, 1);

      // Softness: blend between quantized contour bands (0) and smooth ramp (1).
      // quantize() rounds the 0..1 value to one of `stepCount` evenly spaced
      // flat levels — one band per color stop. With auto-spaced stops (the
      // default) the levels land exactly on the stop colors; explicit uneven
      // positions keep the band count but sample the ramp between stops.
      const stepCount = Math.max(stops.length, 1);
      const quantized = quantize(contrastedValue, stepCount);
      const bandedValue = mix(quantized, contrastedValue, softnessUniform);

      // Build the colorRamp stops from the ColorStop[] (auto-even positions when omitted).
      const rampStops = toColorRampStops(stops);

      const material = new MeshBasicNodeMaterial();

      material.colorNode = colorRamp(bandedValue, rampStops, colorSpace, hueInterpolation);

      const mesh = new Mesh(new PlaneGeometry(2, 2), material);

      shaderContext.scene.add(mesh);

      // A rebuild swaps the mesh without touching any uniform, and the scene
      // renders on demand — at speed 0 the scheduler is parked, so without
      // this poke a style/octaves/stops/colorSpace change would compile the
      // new material and never draw it.
      shaderContext.scheduler.requestRender();

      return () => {
        shaderContext.scene.remove(mesh);
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
      scaleUniform,
      angleUniform,
      stretchUniform,
      aspectUniform,
      phaseUniform,
      detailUniform,
      contrastUniform,
      balanceUniform,
      softnessUniform,
      seedUniform,
      style,
      octaves,
      stopsKey,
      colorSpace,
      hueInterpolation,
    ],
  );

  return null;
}
