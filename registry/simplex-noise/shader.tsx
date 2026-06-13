'use client';

import { useEffect, useMemo } from 'react';

import { colorRamp, type ColorRampStop, elapsedTime, quantize, simplexNoise } from '@lovo/matter';
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react';
import { clamp, mix, uniform, uv, vec3 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import { parseHex } from '../utils/color';

export interface SimplexNoiseShaderProps {
  scale: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  focus: AnimatableProp<number>;
  bias: AnimatableProp<number>;
  softness: AnimatableProp<number>;
  colors: string[];
  stops: number[] | undefined;
  variant: number;
}

export function SimplexNoiseShader({
  scale,
  speed,
  focus,
  bias,
  softness,
  colors,
  stops,
  variant,
}: SimplexNoiseShaderProps) {
  const shaderContext = useShaderContext();
  const scaleUniform = useAnimatableUniform<number>(scale);
  const speedUniform = useAnimatableUniform<number>(speed);
  const focusUniform = useAnimatableUniform<number>(focus);
  const biasUniform = useAnimatableUniform<number>(bias);
  const softnessUniform = useAnimatableUniform<number>(softness);

  const colorsKey = colors.join('|');
  const stopsKey = stops?.join('|') ?? '';

  const variantVec = useMemo(() => new Vector2(0, 0), []);
  const variantUniform = useMemo(() => uniform(variantVec), [variantVec]);

  useEffect(() => {
    variantVec.set(variant * 12.9898, variant * 78.233);
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, variantVec, variant]);

  useEffect(
    () => {
      if (!shaderContext) return;

      const sampleXY = uv().mul(scaleUniform).add(variantUniform);
      const samplePoint = vec3(sampleXY, elapsedTime.mul(speedUniform));
      const rawNoise = simplexNoise(samplePoint);
      const normalized = rawNoise.add(1).mul(0.5);

      // Bias: shift the noise scalar earlier (<0.5) or later (>0.5) into the
      // color ramp. 0.5 is identity. In 2-color mode this reads as dark/light;
      // in multi-color mode it leans toward the first or last colors in the array.
      const biasShift = biasUniform.sub(0.5).mul(2);
      const biased = clamp(normalized.add(biasShift), 0, 1);

      // Focus: linear scale around 0.5. 1 is identity, >1 pushes values toward
      // the ramp extremes (first/last colors), <1 pulls them toward the middle.
      const focusedValue = clamp(biased.sub(0.5).mul(focusUniform).add(0.5), 0, 1);

      // Softness: blend between quantized contour bands (0) and smooth ramp (1).
      const stepCount = Math.max(colors.length, 1);
      const quantized = quantize(focusedValue, stepCount);
      const bandedValue = mix(quantized, focusedValue, softnessUniform);

      // Build the colorRamp stops from colors[] + optional stops[] (auto-even otherwise).
      const evenAt = (colorIndex: number) => colorIndex / Math.max(colors.length - 1, 1);
      const rampStops: ColorRampStop[] = colors.map((hex, colorIndex) => {
        const [redChannel, greenChannel, blueChannel] = parseHex(hex);
        const userPos = stops?.[colorIndex];
        const position =
          typeof userPos === 'number' ? Math.min(Math.max(userPos, 0), 1) : evenAt(colorIndex);

        return {
          color: vec3(redChannel, greenChannel, blueChannel),
          position,
        };
      });

      const material = new MeshBasicNodeMaterial();

      material.colorNode = colorRamp(bandedValue, rampStops);

      const mesh = new Mesh(new PlaneGeometry(2, 2), material);

      shaderContext.scene.add(mesh);

      return () => {
        shaderContext.scene.remove(mesh);
        try {
          material.dispose();
        } catch (caughtError) {
          console.debug('[SimplexNoise] material.dispose ignored:', caughtError);
        }
        try {
          mesh.geometry.dispose();
        } catch (caughtError) {
          console.debug('[SimplexNoise] geometry.dispose ignored:', caughtError);
        }
      };
    },
    // colorsKey and stopsKey are stable string proxies for the prop arrays;
    // the arrays themselves are intentionally omitted to avoid rebuilds on
    // identity-only changes. Animatable uniforms are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      shaderContext,
      scaleUniform,
      speedUniform,
      focusUniform,
      biasUniform,
      softnessUniform,
      variantUniform,
      colorsKey,
      stopsKey,
    ],
  );

  return null;
}
