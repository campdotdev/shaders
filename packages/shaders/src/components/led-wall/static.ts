// The render-on-demand vote for the LED wall, kept as a pure function so it
// has a unit test. The wall may tell the scene to stop drawing only when no
// pixel can change between frames. Only the breath moves on its own, and it
// needs both a flicker depth and a speed: the phase the breath reads stops
// advancing at speed 0, and flicker 0 multiplies the breath away. The swell
// reads the focus, the reach, and the cell geometry, none of which advance
// with time, so a numeric swell draws the same dots every frame however
// strong it is. Every other component votes on speed alone; the wall adds
// flicker because it has a second dial that can switch the same motion off.
import {
  type AnimatableProp,
  isSignal,
} from '../../react/hooks/animatable-signal/animatable-signal.js';

export interface LedWallStaticInputs {
  flicker: AnimatableProp<number>;
  focus: AnimatableProp<readonly [number, number]>;
  speed: AnimatableProp<number>;
  swell: AnimatableProp<number>;
}

export function isLedWallStatic({ flicker, focus, speed, swell }: LedWallStaticInputs): boolean {
  // A signal is live by definition, whatever it reads right now: the vote
  // is cast at render time and a signal changes between renders.
  if (isSignal(flicker) || isSignal(focus)) return false;
  if (isSignal(speed) || isSignal(swell)) return false;

  return flicker === 0 || speed === 0;
}
