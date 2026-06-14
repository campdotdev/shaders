'use client';

import { elapsedTime, filmGrain } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  usePostProcessPass,
  useStaticSceneHint,
} from '@lovo/matter-react';
import { floor, vec4 } from 'three/tsl';

export type FilmGrainBlend = 'additive' | 'subtractive';

export interface FilmGrainShaderProps {
  intensity: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  grainBlend: FilmGrainBlend;
}

export function FilmGrainShader({ intensity, speed, grainBlend }: FilmGrainShaderProps) {
  const intensityUniform = useAnimatableUniform<number>(intensity);
  const speedUniform = useAnimatableUniform<number>(speed);

  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  usePostProcessPass(
    (input) => {
      const grainTime = floor(elapsedTime.mul(speedUniform).mul(60));
      const grain = filmGrain(intensityUniform, grainTime);

      if (grainBlend === 'additive') {
        return input.add(vec4(grain, grain, grain, 0));
      }

      const positive = grain.abs();

      return input.sub(vec4(positive, positive, positive, 0));
    },
    [intensityUniform, speedUniform, grainBlend],
  );

  return null;
}
