'use client';

import { elapsedTime, grain } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  usePostProcessPass,
  useStaticSceneHint,
} from '@lovo/matter-react';
import { floor, vec4 } from 'three/tsl';

export type GrainBlend = 'additive' | 'subtractive';

export interface GrainShaderProps {
  intensity: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  grainBlend: GrainBlend;
}

export function GrainShader({ intensity, speed, grainBlend }: GrainShaderProps) {
  const intensityUniform = useAnimatableUniform<number>(intensity);
  const speedUniform = useAnimatableUniform<number>(speed);

  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  usePostProcessPass(
    (input) => {
      const grainTime = floor(elapsedTime.mul(speedUniform).mul(60));
      const grainValue = grain(intensityUniform, grainTime);

      if (grainBlend === 'additive') {
        return input.add(vec4(grainValue, grainValue, grainValue, 0));
      }

      const positive = grainValue.abs();

      return input.sub(vec4(positive, positive, positive, 0));
    },
    [intensityUniform, speedUniform, grainBlend],
  );

  return null;
}
