'use client';

import { useEffect, useMemo } from 'react';

import {
  colorRamp,
  type ColorSpace,
  elapsedTime,
  type HueInterpolation,
  quantize,
  simplexNoise,
} from '@lovo/matter';
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react';
import { clamp, mix, uniform, uv, vec3 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

export interface SimplexNoiseShaderProps {
  scale: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  contrast: AnimatableProp<number>;
  bias: AnimatableProp<number>;
  softness: AnimatableProp<number>;
  stops: ColorStop[];
  seed: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
}

export function SimplexNoiseShader({
  scale,
  speed,
  contrast,
  bias,
  softness,
  stops,
  seed,
  colorSpace,
  hueInterpolation,
}: SimplexNoiseShaderProps) {
  const shaderContext = useShaderContext();
  const scaleUniform = useAnimatableUniform<number>(scale);
  const speedUniform = useAnimatableUniform<number>(speed);
  const contrastUniform = useAnimatableUniform<number>(contrast);
  const biasUniform = useAnimatableUniform<number>(bias);
  const softnessUniform = useAnimatableUniform<number>(softness);

  const stopsKey = colorStopsKey(stops);

  const seedVec = useMemo(() => new Vector2(0, 0), []);
  const seedUniform = useMemo(() => uniform(seedVec), [seedVec]);

  useEffect(() => {
    seedVec.set(seed * 12.9898, seed * 78.233);
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, seedVec, seed]);

  useEffect(
    () => {
      if (!shaderContext) return;

      const sampleXY = uv().mul(scaleUniform).add(seedUniform);
      const samplePoint = vec3(sampleXY, elapsedTime.mul(speedUniform));
      const rawNoise = simplexNoise(samplePoint);
      const normalized = rawNoise.add(1).mul(0.5);

      // Bias: shift the noise scalar earlier (<0.5) or later (>0.5) into the
      // color ramp. 0.5 is identity. In 2-color mode this reads as dark/light;
      // in multi-color mode it leans toward the first or last colors in the array.
      const biasShift = biasUniform.sub(0.5).mul(2);
      const biased = clamp(normalized.add(biasShift), 0, 1);

      // Contrast: linear scale around 0.5. 1 is identity, >1 pushes values toward
      // the ramp extremes (first/last colors), <1 pulls them toward the middle.
      const contrastedValue = clamp(biased.sub(0.5).mul(contrastUniform).add(0.5), 0, 1);

      // Softness: blend between quantized contour bands (0) and smooth ramp (1).
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
        material.dispose();
        mesh.geometry.dispose();
      };
    },
    // stopsKey is a stable string proxy for the stops array; the array itself
    // is intentionally omitted to avoid rebuilds on identity-only changes.
    // Animatable uniforms are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      shaderContext,
      scaleUniform,
      speedUniform,
      contrastUniform,
      biasUniform,
      softnessUniform,
      seedUniform,
      stopsKey,
      colorSpace,
      hueInterpolation,
    ],
  );

  return null;
}
