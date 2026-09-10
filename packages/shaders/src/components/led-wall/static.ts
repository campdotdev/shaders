// The render-on-demand vote for the LED wall, kept as a pure function so it
// has a unit test. The wall may tell the scene to stop drawing only when
// no flicker, no swell, and no live signal can change a pixel between
// frames.
import {
  type AnimatableProp,
  isSignal,
} from '../../react/hooks/animatable-signal/animatable-signal.js';

export interface LedWallStaticInputs {
  flicker: AnimatableProp<number>;
  progress: AnimatableProp<number>;
  focus: AnimatableProp<readonly [number, number]>;
  swell: AnimatableProp<number>;
}

export function isLedWallStatic({ flicker, progress, focus, swell }: LedWallStaticInputs): boolean {
  // A signal is live by definition, whatever it reads right now: the vote
  // is cast at render time and a signal changes between renders.
  if (isSignal(flicker) || isSignal(progress) || isSignal(focus)) return false;
  if (isSignal(swell)) return false;

  return flicker === 0 && swell === 0;
}
