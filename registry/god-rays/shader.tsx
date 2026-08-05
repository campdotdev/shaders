'use client';

// The god rays' GPU half. The wrapper (./god-rays.tsx) passes resolved props
// down; this component builds a full-screen plane whose per-pixel color is a
// field of light rays radiating from a chosen origin, and mounts it into the
// shared ShaderScene. The component emits light over a transparent
// background — stack it above a dark layer.
import { useEffect, useMemo } from 'react';

import { fractalNoise, simplexNoise } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatablePoint,
  useAnimatableSpeed,
  useAnimatableUniform,
  useResize,
  useShaderContext,
  useStaticSceneHint,
} from '@lovo/matter-react';
import { atan2, cos, float, Fn, length, mix, sin, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

export interface GodRaysShaderProps {
  /**
   * Ray origin, 0..1 across the canvas; `[0.5, 0.5]` is centered and
   * `[0, 0]` is the top-left corner. Values outside 0..1 park the source
   * off-canvas. Accepts a static value or an animation signal.
   */
  center: AnimatableProp<readonly [number, number]>;
  /**
   * Roughly how many rays fit around a full revolution. Higher packs more,
   * thinner rays; lower gives a few broad ones.
   * Accepts a static value or an animation signal.
   */
  density: AnimatableProp<number>;
  /**
   * How defined the rays are. 0 is a soft overlapping haze; 1 sharpens the
   * noise creases into crisp, readable beams.
   * Accepts a static value or an animation signal.
   */
  definition: AnimatableProp<number>;
  /**
   * Overall brightness. 0 hides the rays.
   * Accepts a static value or an animation signal.
   */
  intensity: AnimatableProp<number>;
  /**
   * How much rays bend and billow along their length. 0 gives straight,
   * unwarped spokes; higher values make them wavier and more chaotic.
   * Accepts a static value or an animation signal.
   */
  waviness: AnimatableProp<number>;
  /**
   * Shimmer rate — how fast rays swell, fade, and hand brightness to their
   * neighbors. 0 freezes the motion.
   * Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /**
   * TEMPORARY (build-phase tuning only): dev overrides for the bend/dapple
   * character constants. Stripped — with the constants baked back in — at
   * the defaults-tuning gate.
   */
  tuning?: { bendAmount?: number; bendFrequency?: number; dappleAmount?: number };
}

// Converts the density dial (rays per revolution) into the radius of the
// circle the noise is sampled on. Simplex features are ~1 unit wide, so a
// circle of circumference N passes ~N features per revolution:
// radius = N / (2 * PI).
const DENSITY_TO_CIRCLE = 1 / (2 * Math.PI);

// Noise-space units the pattern morphs per phase unit (phase advances
// ~1/second at speed 1). Higher = busier shimmer.
const SHIMMER_RATE = 0.05;

// Exponent for the haze end of the definition dial. Raising the 0..1 field
// to a power >1 deepens the valleys while leaving peaks near 1 — gentle
// contrast, wide soft lobes. Higher = darker gaps even at definition 0.
const SOFT_EXPONENT = 1.6;

// Ridge shaping for the beam end (Aurora's reciprocal-power trick): measure
// how far the field is from its peak (1 - value), amplify that gap, and take
// a reciprocal power. Values at the peak stay ~1 while everything else
// collapses toward 0 — thin bright filaments. GAIN widens/narrows the
// filaments (higher = thinner); EXPONENT hardens their edges.
const RIDGE_GAIN = 14;
const RIDGE_EXPONENT = 1.3;

// mx noise's practical amplitude is well under its nominal ±1 — remapped to
// 0..1 the field really lives around 0.2..0.8, so a curve that saves its
// brightness for values near 1 would never fire (the dial read as inverted
// at the phase-3 gate). This stretches the field about its midpoint before
// the ridge so genuine noise peaks land on 1. Higher = thicker, brighter
// filament cores (a wider stretch saturates more of each peak).
const PEAK_STRETCH = 2.2;

// The bend field's angular frequency, as a circle radius in noise space —
// ~0.6 gives 3-4 independent bend regions per revolution. Higher = more,
// smaller kinks.
const BEND_FREQUENCY = 0.6;

// How fast the bend pattern changes along the ray (per unit of normalized
// distance). Higher = rays that wander back and forth more often.
const BEND_ALONG = 1.2;

// Bend-pattern drift per phase unit. Kept far below SHIMMER_RATE so the
// bends evolve lazily under the brightness shimmer.
const BEND_DRIFT = 0.03;

// Maximum bend in radians at full distance and waviness 1. Turning it up
// makes rays snake; too high and they cross their neighbors.
const BEND_AMOUNT = 0.5;

// Dapple field frequency over canvas space. Higher = smaller patches of
// light and shade riding the beams.
const DAPPLE_FREQUENCY = 3;

// Dapple drift per phase unit — the patchiness slowly reshuffles.
const DAPPLE_DRIFT = 0.04;

// How much of the field's brightness the dapple may take away, 0..1. Fixed
// by design (no prop) unless a gate proves the need for a dial.
const DAPPLE_AMOUNT = 0.35;

export function GodRaysShader({
  center,
  density,
  definition,
  intensity,
  waviness,
  speed,
  tuning,
}: GodRaysShaderProps) {
  const shaderContext = useShaderContext();

  // A literal speed of 0 means nothing on screen ever changes (an animation
  // signal might move later, so it doesn't count). Telling the scene lets its
  // frame scheduler go idle instead of re-rendering an unchanging image.
  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  const densityUniform = useAnimatableUniform<number>(density);
  const definitionUniform = useAnimatableUniform<number>(definition);
  const intensityUniform = useAnimatableUniform<number>(intensity);
  const wavinessUniform = useAnimatableUniform<number>(waviness);

  // TEMPORARY (build-phase tuning only): the character constants ride
  // uniforms so the dev sliders glide instead of rebuilding the material.
  const bendAmountUniform = useAnimatableUniform<number>(tuning?.bendAmount ?? BEND_AMOUNT);
  const bendFrequencyUniform = useAnimatableUniform<number>(
    tuning?.bendFrequency ?? BEND_FREQUENCY,
  );
  const dappleAmountUniform = useAnimatableUniform<number>(tuning?.dappleAmount ?? DAPPLE_AMOUNT);
  // Speed is integrated on the CPU into a phase uniform (speed x delta per
  // frame), so tempo changes glide instead of snapping the pattern.
  const phaseUniform = useAnimatableSpeed(speed);

  // screenOrigin converts the prop's screen-style coordinates (y grows
  // downward, like CSS) into uv space, where v grows upward — same as
  // RadialGradient. Without it, lowering the center would raise the rays.
  const centerUniform = useAnimatablePoint(center, { screenOrigin: true });

  // ---------------------------------------------
  // Track the canvas aspect ratio
  // ---------------------------------------------
  // The polar math needs width/height so rays stay evenly spaced in angle on
  // wide canvases. Starts from the current size (16:9 fallback while the
  // canvas reports 0), then follows every resize.
  const resize = useResize();
  const [initialWidth, initialHeight] = resize.get();
  const aspectNode = useMemo(
    () => uniform(initialHeight > 0 ? initialWidth / initialHeight : 16 / 9),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) aspectNode.value = canvasWidth / canvasHeight;

    return resize.on('change', ([updatedWidth, updatedHeight]) => {
      if (updatedWidth > 0 && updatedHeight > 0) {
        aspectNode.value = updatedWidth / updatedHeight;
        // At speed 0 the scene is hinted static, so without this poke a
        // resize would update the uniform and never repaint.
        shaderContext?.scheduler.requestRender();
      }
    });
  }, [shaderContext, resize, aspectNode]);

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  useEffect(() => {
    if (!shaderContext) return;

    const material = new MeshBasicNodeMaterial();

    material.transparent = true;
    // rgb below is emitted light (premultiplied); alpha is coverage. Without
    // this flag NormalBlending scales rgb by alpha a second time and the
    // soft ray edges dim quadratically.
    material.premultipliedAlpha = true;

    const godRaysNode = Fn(() => {
      // ---------------------------------------------
      // Polar conversion
      // ---------------------------------------------
      // Where is this pixel relative to the ray origin? uv() is its 0..1
      // position; subtracting the center gives an offset. Multiplying the
      // horizontal offset by width/height puts both axes in the same units,
      // so angles and distances aren't stretched by the canvas shape.
      const centered = uv().sub(centerUniform);
      const corrected = vec2(centered.x.mul(aspectNode), centered.y);

      // Distance from the canvas center to a corner in those units; dividing
      // by it makes dist read 0 at the origin and 1 at "corner distance" on
      // any canvas shape (RadialGradient's convention).
      const halfDiagonal = length(vec2(aspectNode.mul(0.5), 0.5));
      const dist = length(corrected).div(halfDiagonal);

      // The pixel's direction from the origin, in radians, -PI..PI.
      // 0 points right, PI/2 points up (uv's v grows upward).
      const theta = atan2(corrected.y, corrected.x);

      // ---------------------------------------------
      // Waviness — bend rays as they travel
      // ---------------------------------------------
      // A second, lower-frequency noise field nudges each pixel's ANGLE
      // before the ray lookup. The same circle-embedding trick keeps the
      // bends seamless; the third axis mixes progress along the ray with a
      // slow drift, so a ray bends differently at its tip than at its root
      // and the bends lazily evolve. Scaling by dist anchors rays straight
      // at the origin — bends grow with travel, like light through
      // increasingly disturbed air.
      const bend = simplexNoise(
        vec3(
          cos(theta).mul(bendFrequencyUniform),
          sin(theta).mul(bendFrequencyUniform),
          dist.mul(BEND_ALONG).add(phaseUniform.mul(BEND_DRIFT)),
        ),
      );
      const warpedTheta = theta.add(bend.mul(wavinessUniform).mul(bendAmountUniform).mul(dist));

      // ---------------------------------------------
      // Ray field — seamless circle embedding
      // ---------------------------------------------
      // Instead of sampling noise along a flat angular axis (which tears
      // where 360° wraps to 0°), sample it ON A CIRCLE inside 3D noise
      // space: the point (cos(theta), sin(theta)) * circleRadius traces a
      // closed loop, so walking a full revolution lands exactly where it
      // started — seamless by construction. The circle's radius sets how
      // many noise features the loop passes, i.e. the ray count; because it
      // is continuous, density can animate freely.
      //
      // The phase rides the third axis: sliding the sampling circle through
      // noise space morphs the pattern IN PLACE — rays swell, fade, and
      // sway, nothing streams outward.
      const circleRadius = densityUniform.mul(DENSITY_TO_CIRCLE);
      const rayCoord = vec3(
        cos(warpedTheta).mul(circleRadius),
        sin(warpedTheta).mul(circleRadius),
        phaseUniform.mul(SHIMMER_RATE),
      );
      const raw = simplexNoise(rayCoord).mul(0.5).add(0.5);

      // ---------------------------------------------
      // Definition — haze vs beams
      // ---------------------------------------------
      // Two shapings of the same field, blended by the dial. The soft end
      // just deepens the valleys; the ridge end collapses everything but the
      // peaks into darkness so only thin bright filaments survive. The ridge
      // reads a peak-stretched copy of the field (see PEAK_STRETCH) so real
      // noise peaks actually reach the curve's bright summit.
      const soft = raw.pow(SOFT_EXPONENT);
      const stretched = raw.sub(0.5).mul(PEAK_STRETCH).add(0.5).clamp(0, 1);
      const ridge = float(1).div(stretched.oneMinus().mul(RIDGE_GAIN).add(1).pow(RIDGE_EXPONENT));
      const field = mix(soft, ridge, definitionUniform);

      // ---------------------------------------------
      // Dapple — patchy life along the beams
      // ---------------------------------------------
      // A cheap two-octave fbm over CANVAS space (not polar), so patches of
      // light and shade drift across the beams the way water caustics
      // texture underwater shafts. Remapped from [-1,1] to a multiplier
      // that dips at most DAPPLE_AMOUNT below full brightness.
      const dapple = fractalNoise(
        vec3(
          corrected.x.mul(DAPPLE_FREQUENCY),
          corrected.y.mul(DAPPLE_FREQUENCY),
          phaseUniform.mul(DAPPLE_DRIFT),
        ),
        { octaves: 2 },
      )
        .mul(0.5)
        .add(0.5);
      const dappled = field.mul(
        dapple.mul(dappleAmountUniform).add(dappleAmountUniform.oneMinus()),
      );

      const lit = dappled.mul(intensityUniform).clamp(0, 1);

      // Premultiplied output: rgb is the light itself, alpha its coverage.
      return vec4(vec3(lit), lit);
    })();

    material.colorNode = godRaysNode;

    // A 2x2 plane exactly fills ShaderScene's camera view (-1..1 both axes).
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
  }, [
    shaderContext,
    densityUniform,
    definitionUniform,
    intensityUniform,
    wavinessUniform,
    bendAmountUniform,
    bendFrequencyUniform,
    dappleAmountUniform,
    phaseUniform,
    centerUniform,
    aspectNode,
  ]);

  return null;
}
