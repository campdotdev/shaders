'use client';

import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';

export interface FlutedGlassShaderProps {
  width: AnimatableProp<number>;
  angle: AnimatableProp<number>;
  refraction: AnimatableProp<number>;
  softness: AnimatableProp<number>;
  shine: AnimatableProp<number>;
  shadow: AnimatableProp<number>;
  sway: AnimatableProp<number>;
  swayFrequency: AnimatableProp<number>;
  speed: AnimatableProp<number>;
}

export function FlutedGlassShader(_props: FlutedGlassShaderProps) {
  return null;
}
