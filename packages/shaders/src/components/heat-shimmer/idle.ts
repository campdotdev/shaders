// The heat shimmer's idle vote, a pure function so it has a unit test. The
// wrapper (./heat-shimmer.tsx) casts it. A strength of 0 or less moves the
// image by nothing, and a speed of 0 stops the clock, so either lets the
// scene park. `scale` and the tuning never move anything over time, and each
// repaints through its uniform when it changes.
import {
  type AnimatableProp,
  isSignal,
} from '../../react/hooks/animatable-signal/animatable-signal.js';

export interface HeatShimmerIdleInputs {
  strength: AnimatableProp<number>;
  speed: AnimatableProp<number>;
}

export function isHeatShimmerIdle({ strength, speed }: HeatShimmerIdleInputs): boolean {
  // A signal counts as moving whatever it reads right now, even beside a
  // strength or speed of 0: the vote is cast at render time, and a signal
  // changes between renders.
  if (isSignal(strength) || isSignal(speed)) return false;

  return strength <= 0 || speed === 0;
}
