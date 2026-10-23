import { describe, expectTypeOf, it } from 'vitest';

import { type FlutedGlass, type FlutedGlassProps } from '../../index.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';

describe('FlutedGlass', () => {
  // The public shape: nine optional dials, each a number or an animation
  // signal. pnpm typecheck runs this file too, so a missing export or a
  // narrowed prop fails there as well as here.
  it('takes nine animatable number props from the package root', () => {
    expectTypeOf<FlutedGlassProps>().toEqualTypeOf<{
      width?: AnimatableProp<number>;
      angle?: AnimatableProp<number>;
      refraction?: AnimatableProp<number>;
      softness?: AnimatableProp<number>;
      shine?: AnimatableProp<number>;
      shadow?: AnimatableProp<number>;
      sway?: AnimatableProp<number>;
      swayFrequency?: AnimatableProp<number>;
      speed?: AnimatableProp<number>;
    }>();
    expectTypeOf<typeof FlutedGlass>().parameter(0).toEqualTypeOf<FlutedGlassProps>();
  });
});
