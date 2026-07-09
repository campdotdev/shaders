'use client';

import { useEffect, useMemo } from 'react';

import { colorRamp, type ColorSpace, type HueInterpolation, simplexNoise } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { clamp, float, normalize, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

export type AuroraDirection = 'bottom' | 'top' | 'left' | 'right';

/** Raymarch slice count. Provisional `steps` prop while tuning (MAT-46 Task 7 decides its fate). */
export const DEFAULT_STEPS = 40;

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
    // ×2 base frequency so density = 1 shows readable structure out of the
    // box; density stays a relative dial around it. Re-tune at the Task 3/4
    // gates — the triangle noise and march sample the field differently.
    const groundCoords = vec2(samplePoint.z, samplePoint.x).mul(densityUniform).mul(2);
    const fieldValue = simplexNoise(groundCoords).mul(0.5).add(0.5);

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
