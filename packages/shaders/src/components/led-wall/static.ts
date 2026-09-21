// The render-on-demand vote for the LED wall, kept as a pure function so it
// has a unit test. The wall may tell the scene to stop drawing only when no
// pixel can change between frames. Only the breath moves on its own, and it
// needs both a flicker depth and a speed: the phase the breath reads stops
// advancing at speed 0, and flicker 0 multiplies the breath away. The swell
// reads the focus, the reach, and the cell geometry, none of which advance
// with time, so a numeric swell draws the same dots every frame however
// strong it is. Every other component votes on speed alone; the wall adds
// flicker because it has a second dial that can switch the same motion off.
//
// The focus is the one input a signal does not make live. A cursor signal
// only changes when the pointer moves, and useCursor wakes the scene itself
// on every move and keeps it drawing until the smoothing settles, so the
// vote can let a still pointer park the scene. Counting the signal here
// would keep the frame loop running for the page's lifetime for nothing.
import {
  type AnimatableProp,
  isSignal,
} from '../../react/hooks/animatable-signal/animatable-signal.js';

export interface LedWallStaticInputs {
  flicker: AnimatableProp<number>;
  /** Accepted so the call site mirrors the wall's dials; it never counts. */
  focus: AnimatableProp<readonly [number, number]>;
  speed: AnimatableProp<number>;
  swell: AnimatableProp<number>;
}

export function isLedWallStatic({ flicker, speed, swell }: LedWallStaticInputs): boolean {
  // A signal is live by definition, whatever it reads right now: the vote
  // is cast at render time and a signal changes between renders. The focus
  // is left out on purpose; the file-top comment says why.
  if (isSignal(flicker) || isSignal(speed) || isSignal(swell)) return false;

  return flicker === 0 || speed === 0;
}
