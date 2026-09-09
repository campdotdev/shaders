// The render-on-demand vote for the LED wall, kept as a pure function so it
// has a unit test. The wall may tell the scene to stop drawing only when
// nothing on it can change between frames.
import {
  type AnimatableProp,
  isSignal,
} from '../../react/hooks/animatable-signal/animatable-signal.js';

export interface LedWallStaticInputs {
  flicker: AnimatableProp<number>;
  progress: AnimatableProp<number>;
  spotlight: AnimatableProp<readonly [number, number]>;
  spotlightIntensity: AnimatableProp<number>;
}

export function isLedWallStatic({
  flicker,
  progress,
  spotlight,
  spotlightIntensity,
}: LedWallStaticInputs): boolean {
  // A signal is live by definition, whatever it reads right now: the vote
  // is cast at render time and a signal changes between renders.
  if (isSignal(flicker) || isSignal(progress) || isSignal(spotlight)) return false;
  if (isSignal(spotlightIntensity)) return false;

  return flicker === 0 && spotlightIntensity === 0;
}
