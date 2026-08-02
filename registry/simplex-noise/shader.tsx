'use client';

// The simplex-noise field's GPU half. Each pixel samples a 3D noise field
// (x/y from screen position, z from time, so the pattern morphs in place
// rather than scrolling), then the raw noise value runs through a chain of
// 0..1 shaping steps — balance, contrast, banding — before picking a color
// from the ramp. The wrapper (./simplex-noise.tsx) supplies the props.
import { useEffect, useMemo } from 'react';

import {
  colorRamp,
  type ColorSpace,
  type HueInterpolation,
  quantize,
  simplexNoise,
} from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableSpeed,
  useAnimatableUniform,
  useShaderContext,
  useStaticSceneHint,
} from '@lovo/matter-react';
import { clamp, mix, uniform, uv, vec3 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

export interface SimplexNoiseShaderProps {
  /**
   * Zoom of the noise field — roughly how many noise features span the
   * canvas. Higher values give a finer, denser pattern.
   * Accepts a static value or an animation signal.
   */
  scale: AnimatableProp<number>;
  /**
   * How fast the pattern morphs over time. 0 freezes the pattern.
   * Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
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

export function SimplexNoiseShader({
  scale,
  speed,
  contrast,
  balance,
  softness,
  stops,
  seed,
  colorSpace,
  hueInterpolation,
}: SimplexNoiseShaderProps) {
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
  const phaseUniform = useAnimatableSpeed(speed);
  const contrastUniform = useAnimatableUniform<number>(contrast);
  const balanceUniform = useAnimatableUniform<number>(balance);
  const softnessUniform = useAnimatableUniform<number>(softness);

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
  // Runs once per mount — and again only when the stops or color space
  // change, because colorRamp bakes the stop colors into the compiled shader
  // as constants. Every dial above flows through uniforms without touching
  // this effect.
  useEffect(
    () => {
      if (!shaderContext) return;

      // multiplying by scale zooms out so roughly `scale` noise features
      // span the canvas, and the seed offset slides the whole window to a
      // different neighborhood. The accumulated phase rides in as a third
      // dimension: as z advances the pattern morphs in place, rather than
      // sliding sideways the way an x/y offset would.
      const sampleXY = uv().mul(scaleUniform).add(seedUniform);
      const samplePoint = vec3(sampleXY, phaseUniform);

      // simplexNoise returns roughly -1..1; (x + 1) / 2 rescales it to the
      // 0..1 range the ramp and the shaping steps below expect.
      const rawNoise = simplexNoise(samplePoint);
      const normalized = rawNoise.add(1).mul(0.5);

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
      // quantize() rounds the 0..1 value to one of `stepCount` flat levels —
      // one band per color stop, which is what makes the posterized look line
      // up with the palette.
      const stepCount = Math.max(stops.length, 1);
      const quantized = quantize(contrastedValue, stepCount);
      const bandedValue = mix(quantized, contrastedValue, softnessUniform);

      // Build the colorRamp stops from the ColorStop[] (auto-even positions when omitted).
      const rampStops = toColorRampStops(stops);

      const material = new MeshBasicNodeMaterial();

      material.colorNode = colorRamp(bandedValue, rampStops, colorSpace, hueInterpolation);

      const mesh = new Mesh(new PlaneGeometry(2, 2), material);

      shaderContext.scene.add(mesh);

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
      phaseUniform,
      contrastUniform,
      balanceUniform,
      softnessUniform,
      seedUniform,
      stopsKey,
      colorSpace,
      hueInterpolation,
    ],
  );

  return null;
}
