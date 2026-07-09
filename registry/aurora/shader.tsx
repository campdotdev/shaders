'use client';

import { useEffect, useMemo } from 'react';

import {
  colorRamp,
  type ColorSpace,
  elapsedTime,
  type HueInterpolation,
  type TSLNode,
} from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import {
  clamp,
  cos,
  dot,
  exp2,
  float,
  Fn,
  fract,
  Loop,
  mix,
  normalize,
  screenCoordinate,
  type ShaderNodeObject,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

export type AuroraDirection = 'bottom' | 'top' | 'left' | 'right';

/** Raymarch slice count. Provisional `steps` prop while tuning (MAT-46 Task 7 decides its fate). */
export const DEFAULT_STEPS = 40;

type TSLValue = ShaderNodeObject<Node>;

/**
 * Triangle wave of x in [0.01, 0.49]. Where simplex is billowy, the triangle
 * wave has straight slopes and sharp creases — the creases become the curtain
 * filaments.
 */
const triangleWave = (value: TSLNode): TSLValue => fract(value).sub(0.5).abs().clamp(0.01, 0.49);

/** Rotate a vec2 by an angle without mat2 — keeps everything a plain chain. */
const rotate2d = (point: TSLValue, angle: TSLNode): TSLValue =>
  vec2(
    point.x.mul(cos(angle)).sub(point.y.mul(sin(angle))),
    point.x.mul(sin(angle)).add(point.y.mul(cos(angle))),
  );

/**
 * Streaky FBM built from triangle waves: five octaves, each rotated and
 * domain-warped by the previous. `shimmerPhase` rotates the warp over time
 * (the aurora shimmer); `warpStrength` scales the warp (turbulence).
 * Returns a field value in [0, 0.55] whose reciprocal shaping concentrates
 * brightness into thin filaments.
 */
const triangleField = (
  coords: TSLValue,
  shimmerPhase: TSLNode,
  warpStrength: TSLNode,
): TSLValue => {
  let sampleCoords = rotate2d(coords, coords.x.mul(0.06));
  let octaveCoords = sampleCoords;
  let fieldSum: TSLValue = float(0);
  let amplitude = 1.8;
  let warpDivisor = 2.5;

  for (let octave = 0; octave < 5; octave += 1) {
    const ridge = rotate2d(
      vec2(
        triangleWave(octaveCoords.x).add(triangleWave(octaveCoords.y)),
        triangleWave(octaveCoords.y.add(triangleWave(octaveCoords.x))),
      ).mul(0.75),
      shimmerPhase,
    );

    sampleCoords = sampleCoords.sub(ridge.div(warpDivisor).mul(warpStrength));
    sampleCoords = sampleCoords.mul(1.21);
    octaveCoords = octaveCoords.mul(1.3);
    warpDivisor *= 0.45;
    amplitude *= 0.42;

    fieldSum = fieldSum.add(
      triangleWave(sampleCoords.x.add(triangleWave(sampleCoords.y))).mul(amplitude),
    );

    sampleCoords = rotate2d(sampleCoords, float(-0.3)).negate();
  }

  return float(1).div(fieldSum.mul(29).pow(1.3)).clamp(0, 0.55);
};

export interface AuroraShaderProps {
  stops: ColorStop[];
  intensity: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  drift: AnimatableProp<number>;
  turbulence: AnimatableProp<number>;
  density: AnimatableProp<number>;
  falloff: AnimatableProp<number>;
  direction: AuroraDirection;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  steps: number;
}

export function AuroraShader({
  stops,
  intensity,
  speed,
  drift,
  turbulence,
  density,
  falloff,
  direction,
  colorSpace,
  hueInterpolation,
  steps,
}: AuroraShaderProps) {
  const shaderContext = useShaderContext();
  const resize = useResize();

  const intensityUniform = useAnimatableUniform<number>(intensity);
  const speedUniform = useAnimatableUniform<number>(speed);
  const driftUniform = useAnimatableUniform<number>(drift);
  const turbulenceUniform = useAnimatableUniform<number>(turbulence);
  const densityUniform = useAnimatableUniform<number>(density);
  const falloffUniform = useAnimatableUniform<number>(falloff);

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
      if (updatedWidth > 0 && updatedHeight > 0) aspectNode.value = updatedWidth / updatedHeight;
    });
  }, [resize, aspectNode]);

  const stopsKey = colorStopsKey(stops);

  useEffect(() => {
    const material = new MeshBasicNodeMaterial();

    material.transparent = true;
    // rgb below is the accumulated curtain light itself (premultiplied), alpha
    // is coverage. Without this flag NormalBlending scales rgb by alpha a
    // second time and everything dims quadratically (MAT-45).
    material.premultipliedAlpha = true;

    const rampStops = toColorRampStops(stops);

    // ── Aurora graph ────────────────────────────────────────────────────────
    const stepCount = steps;

    const auroraNode = Fn(() => {
      // Screen position → normalized device coords: center-origin, x scaled by
      // aspect so ribbons don't stretch on wide canvases.
      const ndcX = uv().x.sub(0.5).mul(2).mul(aspectNode);
      const ndcY = uv().y.sub(0.5).mul(2);

      // Virtual camera: sits below the aurora looking toward the horizon (+z),
      // biased slightly upward so the band occupies the upper frame.
      const rayOrigin = vec3(0, 0, -6.7);
      const rayDirection = normalize(vec3(ndcX, ndcY.mul(0.8).add(0.25), 1.4));

      // Base shimmer rate, tuned by eye at the Task 3 gate (the reference's
      // 0.06 read as static; the user's preferred feel was ~2.4× faster).
      // speed stays a relative dial around 1.
      const shimmerPhase = elapsedTime.mul(speedUniform).mul(0.15);

      // Fixed-altitude tint (the ramp's curtain-base green) until Task 5
      // drives the ramp per-slice.
      const sliceColor = colorRamp(float(0.15), rampStops, colorSpace, hueInterpolation);

      // Screen-space hash: decorrelates the slice offsets pixel-to-pixel so
      // the march's discrete slices dissolve into grain instead of banding.
      const screenHash = fract(
        sin(dot(screenCoordinate.xy, vec2(12.9898, 4.1414))).mul(43758.5453),
      );

      // Accumulators must be GPU-side variables (`toVar`) because the loop
      // below runs on the GPU — a JS variable can't change per iteration there.
      const accumulated = vec4(0).toVar();
      const runningAverage = vec4(0).toVar();

      Loop(stepCount, ({ i }: { i: TSLValue }) => {
        const stepIndex = float(i);

        // Ramp the jitter in over the first steps — the lowest slices form
        // the curtain's sharp bottom edge and shouldn't be blurred.
        const jitter = screenHash.mul(0.006).mul(smoothstep(0, 15, stepIndex));

        // Slice altitudes: pow(i, 1.4) packs slices tightly at the base
        // (sharp bright lower border) and spreads them out with height
        // (long soft fade upward). The bent divisor (rd.y·2 + 0.4) fakes
        // atmospheric curvature — horizon-grazing rays hit at a finite
        // distance, bending the sheet down toward the horizon line.
        const sliceAltitude = stepIndex.pow(1.4).mul(0.002).add(0.8);
        const marchDistance = sliceAltitude
          .sub(rayOrigin.y)
          .div(rayDirection.y.mul(2).add(0.4))
          .sub(jitter);
        const samplePoint = rayOrigin.add(rayDirection.mul(marchDistance));

        // Sample the field on the ground plane: z runs toward the horizon,
        // x runs across the screen. Base pattern frequency tuned by eye at
        // the Task 3 gate; density stays a relative dial around 1.
        const groundCoords = vec2(samplePoint.z, samplePoint.x).mul(densityUniform).mul(1.5);

        const fieldValue = triangleField(groundCoords, shimmerPhase, turbulenceUniform);

        const slice = vec4(sliceColor.mul(fieldValue), fieldValue);

        // Average-then-accumulate: blending each slice into a running average
        // before adding smears slice-to-slice noise into continuous wisps.
        runningAverage.assign(mix(runningAverage, slice, 0.5));

        // Atmospheric extinction: each successive slice contributes
        // exponentially less. smoothstep suppresses the first few slices,
        // which otherwise read as a hard floor.
        const extinction = exp2(stepIndex.mul(-0.065).sub(2.5));

        accumulated.addAssign(runningAverage.mul(extinction).mul(smoothstep(0, 5, stepIndex)));
      });

      // Rays pointing below the horizon never hit the sky — fade them out fast.
      const horizonMask = clamp(rayDirection.y.mul(15).add(0.4), 0, 1);

      const emission = accumulated.rgb.mul(horizonMask).mul(1.8);
      const coverage = accumulated.a.mul(horizonMask).mul(1.5).clamp(0, 1);

      return vec4(emission.max(0), coverage);
    })();

    material.colorNode = auroraNode;
    // ── End aurora graph ────────────────────────────────────────────────────

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext?.scene.add(mesh);

    return () => {
      shaderContext?.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
    };
    // stopsKey is a stable string proxy for `stops` — listing the array itself
    // would rebuild on identity-only changes. Stop colors/positions, direction,
    // and steps are baked as literals, so content changes must rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shaderContext,
    stopsKey,
    colorSpace,
    hueInterpolation,
    direction,
    steps,
    intensityUniform,
    speedUniform,
    driftUniform,
    turbulenceUniform,
    densityUniform,
    falloffUniform,
    aspectNode,
  ]);

  return null;
}
