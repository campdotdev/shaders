'use client';

// The grain overlay's GPU half. The per-pixel randomness itself comes from
// the engine's grain() primitive (a screen-position hash); this file decides
// the two things layered on top of it: how often the pattern re-rolls
// (speed) and how the noise combines with the image underneath (blend).
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
  // Both props live in uniforms (values the CPU can update each frame
  // without rebuilding the shader), tracking either a static number or an
  // animation signal.
  const intensityUniform = useAnimatableUniform<number>(intensity);
  const speedUniform = useAnimatableUniform<number>(speed);

  // A literal speed of 0 freezes the pattern, so nothing ever changes on
  // screen (an animation signal might move later and doesn't count). Telling
  // the scene lets its frame scheduler go idle instead of re-rendering.
  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  // A post-process pass: the callback receives each already-rendered pixel
  // (`input`, rgba) and returns a replacement. Everything drawn by earlier
  // layers in the scene flows through here.
  usePostProcessPass(
    (input) => {
      // Quantize time into whole steps so the pattern re-rolls in discrete
      // ticks instead of shifting continuously. floor(seconds * speed * 60)
      // increments every 1/(speed*60) seconds: at speed 1 the grain re-rolls
      // 60 times a second (fresh noise every frame at 60 fps); at lower
      // speeds each pattern holds longer; at 0 the argument never advances
      // and the pattern freezes.
      const grainTime = floor(elapsedTime.mul(speedUniform).mul(60));

      // A per-pixel random value centered on zero (roughly -intensity/2 to
      // +intensity/2), derived from the pixel's screen position and the time
      // step above — same pixel, same tick, same value.
      const grainValue = grain(intensityUniform, grainTime);

      // The blend branch is plain JavaScript, so the choice is baked into
      // the compiled shader — which is why `blend` sits in the deps array:
      // changing it is the one prop change that rebuilds this pass.
      if (blend === 'additive') {
        // Same signed value on r, g, and b nudges the pixel brighter or
        // darker without tinting it; alpha stays untouched (the vec4's
        // fourth component is 0).
        return input.add(vec4(grainValue, grainValue, grainValue, 0));
      }

      // Subtractive: fold the signed noise to positive-only and subtract,
      // so grain can only darken — dark specks on the image, never bright
      // sparkle.
      const positive = grainValue.abs();

      return input.sub(vec4(positive, positive, positive, 0));
    },
    [intensityUniform, speedUniform, blend],
  );

  return null;
}
