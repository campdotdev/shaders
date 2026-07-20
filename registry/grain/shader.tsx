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
  /**
   * Peak luminance deviation added or subtracted per pixel. 0 = no grain.
   * Accepts a static value or an animation signal.
   */
  intensity: AnimatableProp<number>;
  /**
   * How fast the grain pattern re-rolls, relative to 60 fps. 0 freezes the
   * pattern on a static frame. Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /**
   * How the grain combines with the image: `'additive'` brightens and
   * darkens symmetrically; `'subtractive'` only darkens (specks on the
   * image).
   */
  blend: GrainBlend;
}

export function GrainShader({ intensity, speed, blend }: GrainShaderProps) {
  const intensityUniform = useAnimatableUniform<number>(intensity);
  const speedUniform = useAnimatableUniform<number>(speed);

  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  usePostProcessPass(
    (input) => {
      const grainTime = floor(elapsedTime.mul(speedUniform).mul(60));
      const grainValue = grain(intensityUniform, grainTime);

      if (blend === 'additive') {
        return input.add(vec4(grainValue, grainValue, grainValue, 0));
      }

      const positive = grainValue.abs();

      return input.sub(vec4(positive, positive, positive, 0));
    },
    [intensityUniform, speedUniform, blend],
  );

  return null;
}
