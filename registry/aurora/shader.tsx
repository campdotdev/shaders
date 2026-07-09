'use client';

import { useEffect, useMemo } from 'react';

import { colorRamp, type ColorSpace, type HueInterpolation } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { smoothstep, uniform, uv, vec4 } from 'three/tsl';
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

    // ── Placeholder graph (replaced by the raymarch in Tasks 2–6) ──────────
    // A soft band: rises quickly above the "horizon" (y ≈ 0.25) and fades out
    // toward the top. Altitude for the ramp is just screen height for now.
    const altitude = uv().y;
    const band = smoothstep(0.22, 0.34, altitude).mul(smoothstep(0.4, 0.85, altitude).oneMinus());

    const rampColor = colorRamp(altitude, rampStops, colorSpace, hueInterpolation);
    const emission = rampColor.mul(band).mul(intensityUniform);
    const coverage = band.mul(0.8);

    material.colorNode = vec4(emission, coverage);
    // ── End placeholder graph ───────────────────────────────────────────────

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
