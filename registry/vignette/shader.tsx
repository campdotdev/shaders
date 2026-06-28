'use client';

import { useEffect, useMemo } from 'react';

import { mixColor } from '@lovo/matter';
import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  usePostProcessPass,
  useResize,
} from '@lovo/matter-react';
import { length, smoothstep, uniform, uv, vec2, vec4 } from 'three/tsl';
import { Vector2, Vector3 } from 'three/webgpu';

import { parseColor } from '../utils/color';

export interface VignetteShaderProps {
  intensity: AnimatableProp<number>;
  feather: AnimatableProp<number>;
  center: [number, number];
  falloff: AnimatableProp<number>;
  color: string;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
}

export function VignetteShader({
  intensity,
  feather,
  center,
  falloff,
  color,
  colorSpace,
  hueInterpolation,
}: VignetteShaderProps) {
  const intensityUniform = useAnimatableUniform(intensity);
  const featherUniform = useAnimatableUniform(feather);
  const falloffUniform = useAnimatableUniform(falloff);

  const centerVec = useMemo(
    () => new Vector2(center[0], center[1]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const centerUniform = useMemo(() => uniform(centerVec), [centerVec]);

  useEffect(() => {
    centerVec.set(center[0], center[1]);
  }, [center, centerVec]);

  const colorVec = useMemo(
    () => {
      const [redChannel, greenChannel, blueChannel] = parseColor(color);

      return new Vector3(redChannel, greenChannel, blueChannel);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const colorUniform = useMemo(() => uniform(colorVec), [colorVec]);

  useEffect(() => {
    const [redChannel, greenChannel, blueChannel] = parseColor(color);

    colorVec.set(redChannel, greenChannel, blueChannel);
  }, [color, colorVec]);

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
      if (updatedWidth > 0 && updatedHeight > 0) aspectNode.value = updatedWidth / updatedHeight;
    });
  }, [resize, aspectNode]);

  usePostProcessPass(
    (input) => {
      const aspect = aspectNode;
      const centered = uv().sub(centerUniform);
      const corrected = vec2(centered.x.mul(aspect), centered.y);
      const distance = length(corrected);

      const featherStart = falloffUniform.mul(featherUniform.oneMinus());
      const mask = smoothstep(featherStart, falloffUniform, distance);
      const factor = mask.mul(intensityUniform);

      // Blend the upstream pixel toward `color` inside the chosen color space,
      // following `hueInterpolation`'s arc for cylindrical spaces. mixColor works
      // on linear vec3, so blend rgb and carry the original alpha through.
      const blended = mixColor(input.rgb, colorUniform, factor, colorSpace, hueInterpolation);

      return vec4(blended, input.a);
    },
    [
      intensityUniform,
      featherUniform,
      falloffUniform,
      centerUniform,
      colorUniform,
      aspectNode,
      colorSpace,
      hueInterpolation,
    ],
  );

  return null;
}
