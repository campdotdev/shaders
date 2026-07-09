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
  float,
  fract,
  normalize,
  type ShaderNodeObject,
  sin,
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
    // Screen position → normalized device coords: center-origin, x scaled by
    // aspect so ribbons don't stretch on wide canvases.
    const ndcX = uv().x.sub(0.5).mul(2).mul(aspectNode);
    const ndcY = uv().y.sub(0.5).mul(2);

    // Virtual camera: sits below the aurora looking toward the horizon (+z),
    // biased slightly upward so the band occupies the upper frame.
    const rayOrigin = vec3(0, 0, -6.7);
    const rayDirection = normalize(vec3(ndcX, ndcY.mul(0.8).add(0.25), 1.4));

    // One horizontal slice at the curtain-base altitude. The bent divisor
    // (rd.y·2 + 0.4 instead of plain rd.y) fakes atmospheric curvature: rays
    // that graze the horizon hit at a finite distance instead of infinity, so
    // the sheet bends down toward the horizon line.
    const sliceAltitude = float(0.9);
    const marchDistance = sliceAltitude.sub(rayOrigin.y).div(rayDirection.y.mul(2).add(0.4));
    const samplePoint = rayOrigin.add(rayDirection.mul(marchDistance));

    // Sample the field on the ground plane: z runs toward the horizon,
    // x runs across the screen.
    // Base pattern frequency, tuned by eye at the Task 3 gate (user preferred
    // old density 0.75 × the 2.0 base). density stays a relative dial around 1.
    const groundCoords = vec2(samplePoint.z, samplePoint.x).mul(densityUniform).mul(1.5);
    // Base shimmer rate, tuned by eye at the Task 3 gate (the reference's 0.06
    // read as static; the user's preferred feel was ~2.4× faster). speed stays
    // a relative dial around 1.
    const shimmerPhase = elapsedTime.mul(speedUniform).mul(0.15);
    const fieldValue = triangleField(groundCoords, shimmerPhase, turbulenceUniform);

    // Rays pointing below the horizon never hit the sky — fade them out fast.
    const horizonMask = clamp(rayDirection.y.mul(15).add(0.4), 0, 1);

    const brightness = fieldValue.mul(horizonMask);

    // Fixed-altitude tint (the ramp's curtain-base green) until Task 5 drives
    // the ramp per-slice. Keeps the ramp plumbing live through Tasks 2–4.
    const sliceColor = colorRamp(float(0.15), rampStops, colorSpace, hueInterpolation);

    material.colorNode = vec4(sliceColor.mul(brightness), brightness);
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
