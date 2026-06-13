'use client';

import { useEffect, useMemo } from 'react';

import {
  type AnimatableProp,
  useAnimatableUniform,
  useOverlayPass,
  useResize,
} from '@lovo/matter-react';
import { length, smoothstep, mix as tslMix, uniform, uv, vec2, vec4 } from 'three/tsl';
import { Vector2, Vector3 } from 'three/webgpu';

import { parseHex } from '../utils/color';

export interface VignetteShaderProps {
  intensity: AnimatableProp<number>;
  softness: AnimatableProp<number>;
  center: [number, number];
  radius: AnimatableProp<number>;
  color: string;
}

export function VignetteShader({
  intensity,
  softness,
  center,
  radius,
  color,
}: VignetteShaderProps) {
  const intensityUniform = useAnimatableUniform(intensity);
  const softnessUniform = useAnimatableUniform(softness);
  const radiusUniform = useAnimatableUniform(radius);

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
      const [redChannel, greenChannel, blueChannel] = parseHex(color);

      return new Vector3(redChannel, greenChannel, blueChannel);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const colorUniform = useMemo(() => uniform(colorVec), [colorVec]);

  useEffect(() => {
    const [redChannel, greenChannel, blueChannel] = parseHex(color);

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

  useOverlayPass(
    (input) => {
      const aspect = aspectNode;
      const centered = uv().sub(centerUniform);
      const corrected = vec2(centered.x.mul(aspect), centered.y);
      const distance = length(corrected);

      const innerRadius = radiusUniform.mul(softnessUniform.oneMinus());
      const mask = smoothstep(innerRadius, radiusUniform, distance);
      const factor = mask.mul(intensityUniform);

      return tslMix(input, vec4(colorUniform, 1), factor);
    },
    [intensityUniform, softnessUniform, radiusUniform, centerUniform, colorUniform, aspectNode],
  );

  return null;
}
